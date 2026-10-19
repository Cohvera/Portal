import { BadRequestException, ConflictException, ForbiddenException } from "@nestjs/common";
import { prisma } from "@cohvera/database";
import { createHash } from "node:crypto";

const profiles: Record<string, readonly string[]> = { QHOME: ["07"] };
const invalid = (message: string): never => { throw new BadRequestException(message); };
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid("Ongeldig JSON-object.");
  return value as Record<string, unknown>;
}
function string(value: unknown, max: number): string {
  if (typeof value !== "string" || value.length > max) return invalid("Ongeldig tekstveld in export.");
  return value.trim();
}
export function parseReaderImport(companyCode: string, input: unknown, now = Date.now()) {
  const codes = profiles[companyCode];
  if (!codes) throw new ForbiddenException("Voor dit bedrijf is nog geen Plenion-importprofiel ingesteld.");
  const body = object(input);
  const grouped = body.schema_version === 2;
  if ((!grouped && body.schema_version !== 1) || body.source !== "plenion_reader_projects" || body.truncated !== false)
    return invalid("Kies een volledige portal-projects.json-export van de reader.");
  const observed = Date.parse(string(body.fetched_at, 50));
  if (!Number.isFinite(observed) || observed > now + 300000 || now - observed >= 86400000)
    return invalid("De export is ongeldig of ouder dan 24 uur. Maak een nieuwe export.");
  if (!Array.isArray(body.projects) || body.projects.length > 20000 || body.count !== body.projects.length)
    return invalid("De export is onvolledig of te groot.");
  const ids = new Set<string>();
  const bit = (value: unknown) => {
    if (value !== "0" && value !== "1") return invalid("Afsluit- of projectmapvinkjes ontbreken of zijn ongeldig.");
    return value === "1";
  };
  const rows = body.projects.map(value => {
    const row = object(value);
    const id = string(row.source_id, 100), number = string(row.number, 60);
    const code = string(row.status_code ?? "", 30), label = string(row.status_label ?? "", 100);
    const statusId = string(row.status_id, 100);
    const name = string(row.name ?? "", 300), description = string(row.description ?? "", 2000);
    if (!id || !/^\d+$/.test(number) || !statusId || ids.has(id))
      return invalid("Ongeldige of dubbele project-ID, projectnummer of status.");
    ids.add(id);
    const revisionClosed = bit(row.revision_closed), closed = bit(row.out_of_wip);
    const parentValue = grouped ? string(row.parent_source_id, 100) : "0";
    if (grouped && !/^\d+$/.test(parentValue)) return invalid("Ongeldige IDProjectMap.");
    const parentId = parentValue === "0" ? null : parentValue;
    const isProjectMap = grouped ? bit(row.is_project_map) : false;
    const documentType = grouped ? string(row.document_type ?? "", 30) : "";
    const versionNumber = grouped ? string(row.version_number ?? "", 30) : "";
    return {id,number,name,description,code,label,closed,revisionClosed,parentId,isProjectMap,documentType,versionNumber};
  });
  const byId = new Map(rows.map(row => [row.id,row]));
  const children = new Map<string, typeof rows>();
  for (const row of rows) {
    if (!row.parentId) continue;
    const parent = byId.get(row.parentId);
    // Never guess by name or merge an orphan into a different project.
    if (!parent || !parent.isProjectMap || parent.parentId || row.isProjectMap || row.id === row.parentId)
      return invalid("Een projectmapkoppeling ontbreekt of is ongeldig. Exporteer alle records inclusief hoofdprojecten.");
    children.set(parent.id, [...(children.get(parent.id) ?? []), row]);
  }
  const numbers = new Set<string>();
  const projects = rows.filter(row => !row.parentId && !row.revisionClosed && codes.includes(row.code)).map(row => {
    if (!row.label) return invalid("De geselecteerde status heeft geen omschrijving.");
    if (numbers.has(row.number)) return invalid("Meerdere actuele versies voor hetzelfde projectnummer. Controleer de bron.");
    numbers.add(row.number);
    const documents = (children.get(row.id) ?? []).map(child => ({
      sourceId:child.id, number:child.number, name:child.name, description:child.description,
      statusCode:child.code, statusLabel:child.label, documentType:child.documentType,
      versionNumber:child.versionNumber, revisionClosed:child.revisionClosed, closed:child.closed,
    })).sort((a,b) => a.sourceId.localeCompare(b.sourceId));
    return {...row, documents};
  }).sort((a,b) => a.number.localeCompare(b.number));
  const documentCount = projects.reduce((sum,p)=>sum+p.documents.length,0);
  const skipped = rows.length - projects.length - documentCount;
  const digest = createHash("sha256").update(JSON.stringify({companyCode, observed, grouped, projects})).digest("hex");
  return {projects, skipped, documentCount, grouped, observed: new Date(observed), digest};
}

export async function importReaderProjects(companyCode: string, input: unknown) {
  const parsed = parseReaderImport(companyCode, input);
  return prisma.$transaction(async tx => {
    // Share the automatic import lock so concurrent imports cannot mix source stands.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(71620501)`;
    const company = await tx.company.findUnique({where:{code:companyCode}});
    if (!company?.isActive) throw new ForbiddenException("Bedrijf niet actief.");
    const previous = await tx.qboxImport.findUnique({where:{companyCode}});
    if (previous && previous.contractVersion > (parsed.grouped ? 6 : 5))
      throw new ConflictException("Gebruik de nieuwste readerexport met projectmapkoppelingen.");
    if (previous && previous.sourceObservedAt > parsed.observed)
      throw new ConflictException("Een nieuwere bronstand is al geïmporteerd.");
    if (previous?.digest === parsed.digest)
      return {count: parsed.projects.length, skipped: parsed.skipped, documentCount: parsed.documentCount, duplicate: true};
    if (previous && previous.sourceObservedAt.getTime() === parsed.observed.getTime())
      throw new ConflictException("Dezelfde bronstand heeft andere inhoud.");
    for (const p of parsed.projects) {
      const source = {sourceRecordId:p.id, sourceStatusLabel:p.label, sourceIsClosed:p.closed,
        sourceIsActive:!p.closed, sourceDescription:p.description, sourceSeenAt:parsed.observed,
        ...(parsed.grouped ? {sourceParentRecordId:null, sourceDocuments:p.documents} : {})};
      await tx.project.upsert({
        where:{companyId_externalSource_externalId:{companyId:company.id, externalSource:"PLENION", externalId:p.number}},
        create:{...source, companyId:company.id, externalSource:"PLENION", externalId:p.number,
          name:`${p.number} · ${p.description || p.name || "Plenion-project"}`.slice(0,200),
          customer:"", owner:"", status:"Actief", statusColor:"#2563eb"},
        update:source,
      });
    }
    if (parsed.grouped) {
      for (const p of parsed.projects) {
        // Keep old project IDs, tasks and warehouse references; only hide proven children from lists.
        const childIds = p.documents.map(d => d.sourceId);
        if (childIds.length) await tx.project.updateMany({
          where:{companyId:company.id,externalSource:"PLENION",sourceRecordId:{in:childIds}},
          data:{sourceParentRecordId:p.id},
        });
      }
    }
    const data = {sourceKind:"reader_selection", contractVersion:parsed.grouped ? 6 : 5, captureSha256:null,
      snapshotId:`reader-${parsed.digest}`, digest:parsed.digest, sourceObservedAt:parsed.observed,
      projectCount:parsed.projects.length, receivedAt:new Date()};
    await tx.qboxImport.upsert({where:{companyCode},create:{companyCode,...data},update:data});
    return {count:parsed.projects.length, skipped:parsed.skipped, documentCount:parsed.documentCount, duplicate:false};
  }, {timeout:60000});
}
