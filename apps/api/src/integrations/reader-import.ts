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
  if (body.schema_version !== 1 || body.source !== "plenion_reader_projects" || body.truncated !== false)
    return invalid("Kies een volledige portal-projects.json-export van de reader.");
  const observed = Date.parse(string(body.fetched_at, 50));
  if (!Number.isFinite(observed) || observed > now + 300000 || now - observed >= 86400000)
    return invalid("De export is ongeldig of ouder dan 24 uur. Maak een nieuwe export.");
  if (!Array.isArray(body.projects) || body.projects.length > 20000 || body.count !== body.projects.length)
    return invalid("De export is onvolledig of te groot.");
  const ids = new Set<string>(), numbers = new Set<string>();
  let skipped = 0;
  const projects = body.projects.flatMap(value => {
    const row = object(value);
    const id = string(row.source_id, 100), number = string(row.number, 60);
    const code = string(row.status_code ?? "", 30), label = string(row.status_label ?? "", 100);
    const statusId = string(row.status_id, 100);
    const name = string(row.name ?? "", 300), description = string(row.description ?? "", 2000);
    if (!id || !/^\d+$/.test(number) || !statusId || ids.has(id))
      return invalid("Ongeldige of dubbele project-ID, projectnummer of status.");
    ids.add(id);
    if (!["0", "1"].includes(String(row.revision_closed)) || !["0", "1"].includes(String(row.out_of_wip)))
      return invalid("Afsluitvinkjes ontbreken of zijn ongeldig.");
    if (!codes.includes(code)) { skipped++; return []; }
    if (!label) return invalid("De geselecteerde status heeft geen omschrijving.");
    // Closed revisions are historical records, not a second current project.
    if (String(row.revision_closed) === "1") { skipped++; return []; }
    if (numbers.has(number)) return invalid("Meerdere actuele versies voor hetzelfde projectnummer. Controleer de bron.");
    numbers.add(number);
    return [{id, number, name, description, label, closed: String(row.out_of_wip) === "1"}];
  }).sort((a,b) => a.number.localeCompare(b.number));
  const digest = createHash("sha256").update(JSON.stringify({companyCode, observed, projects})).digest("hex");
  return {projects, skipped, observed: new Date(observed), digest};
}

export async function importReaderProjects(companyCode: string, input: unknown) {
  const parsed = parseReaderImport(companyCode, input);
  return prisma.$transaction(async tx => {
    // Share the automatic import lock so concurrent imports cannot mix source stands.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(71620501)`;
    const company = await tx.company.findUnique({where:{code:companyCode}});
    if (!company?.isActive) throw new ForbiddenException("Bedrijf niet actief.");
    const previous = await tx.qboxImport.findUnique({where:{companyCode}});
    if (previous && previous.sourceObservedAt > parsed.observed)
      throw new ConflictException("Een nieuwere bronstand is al geïmporteerd.");
    if (previous?.digest === parsed.digest)
      return {count: parsed.projects.length, skipped: parsed.skipped, duplicate: true};
    if (previous && previous.sourceObservedAt.getTime() === parsed.observed.getTime())
      throw new ConflictException("Dezelfde bronstand heeft andere inhoud.");
    for (const p of parsed.projects) {
      const source = {sourceRecordId:p.id, sourceStatusLabel:p.label, sourceIsClosed:p.closed,
        sourceIsActive:!p.closed, sourceDescription:p.description, sourceSeenAt:parsed.observed};
      await tx.project.upsert({
        where:{companyId_externalSource_externalId:{companyId:company.id, externalSource:"PLENION", externalId:p.number}},
        create:{...source, companyId:company.id, externalSource:"PLENION", externalId:p.number,
          name:`${p.number} · ${p.description || p.name || "Plenion-project"}`.slice(0,200),
          customer:"", owner:"", status:"Actief", statusColor:"#2563eb"},
        update:source,
      });
    }
    const data = {sourceKind:"reader_selection", contractVersion:5, captureSha256:null,
      snapshotId:`reader-${parsed.digest}`, digest:parsed.digest, sourceObservedAt:parsed.observed,
      projectCount:parsed.projects.length, receivedAt:new Date()};
    await tx.qboxImport.upsert({where:{companyCode},create:{companyCode,...data},update:data});
    return {count:parsed.projects.length, skipped:parsed.skipped, duplicate:false};
  }, {timeout:60000});
}
