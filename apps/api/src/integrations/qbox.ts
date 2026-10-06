import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, Param, Post, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { createHash, timingSafeEqual } from "node:crypto";
import { prisma } from "@cohvera/database";

export function verifyQboxKey(value: unknown) {
  const key = process.env.QBOX_IMPORT_API_KEY || "";
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(key)) throw new ServiceUnavailableException("Q-box import is niet ingesteld.");
  if (typeof value !== "string" || value.length > 128 || !timingSafeEqual(createHash("sha256").update(value).digest(), createHash("sha256").update(key).digest()))
    throw new UnauthorizedException("Ongeldige Q-box sleutel.");
}
export function qboxCompanyCode() {
  const code = process.env.QBOX_IMPORT_COMPANY || "TOMME";
  if (!["TOMME", "QHOME", "WARCO"].includes(code))
    throw new ServiceUnavailableException("Ongeldig doelbedrijf voor Q-box import.");
  return code;
}
const fail = (): never => { throw new BadRequestException("Ongeldige of verouderde Plenion-export."); };
const text = (v: unknown, max: number): string => typeof v === "string" && v.length <= max ? v : fail();
export function validateSnapshot(value: unknown, now = Date.now()) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail();
  const d = value as Record<string, unknown>;
  if (d.schema_version !== 2 || d.source_kind !== "central_datahub" || d.source_system !== "PLENION" || d.live !== true) return fail();
  const snapshotId = text(d.snapshot_id, 150), batchId = text(d.batch_id, 150);
  if (!snapshotId || !batchId) return fail();
  const observed = Date.parse(text(d.source_observed_at, 50)), validUntil = Date.parse(text(d.valid_until, 50));
  if (!Number.isFinite(observed) || !Number.isFinite(validUntil) || observed > now + 300000 || now - observed >= 86400000 || validUntil <= now || validUntil > observed + 86400000) return fail();
  if (!Array.isArray(d.projects) || d.projects.length > 10000) return fail();
  const projects = d.projects.map((value: unknown) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return fail();
    const p = value as Record<string, unknown>;
    const number = text(p.number, 60), customer = text(p.customer, 300), description = text(p.description, 2000), planned = text(p.planned, 10);
    if (!/^\d+$/.test(number) || p.status_label !== "07 - In Uitvoering" || p.evidence !== "central_datahub" || p.active !== true || p.is_current !== true || p.closed !== false) return fail();
    if (planned && (!/^\d{4}-\d{2}-\d{2}$/.test(planned) || !Number.isFinite(Date.parse(planned)) || new Date(planned).toISOString().slice(0,10) !== planned)) return fail();
    return {number, customer, description, planned};
  }).sort((a,b) => a.number.localeCompare(b.number));
  if (new Set(projects.map(p => p.number)).size !== projects.length) return fail();
  const sourceObservedAt = new Date(observed);
  const digest = createHash("sha256").update(JSON.stringify({snapshotId,batchId,observed,projects})).digest("hex");
  return {snapshotId,batchId,sourceObservedAt,digest,projects};
}

@Controller("integrations/qbox")
export class QboxImportController {
  @Post("plenion/projects")
  async ingest(@Body() body: unknown) {
    const snapshot = validateSnapshot(body);
    // Only server configuration selects the destination; never trust a payload company.
    const companyCode = qboxCompanyCode();
    return prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(71620501)`;
      const company = await tx.company.findUnique({where:{code:companyCode}});
      if (!company?.isActive) throw new ForbiddenException("Het ingestelde doelbedrijf is niet actief.");
      const previous = await tx.qboxImport.findUnique({where:{companyCode}});
      if (previous && previous.sourceObservedAt > snapshot.sourceObservedAt) throw new ConflictException("Een nieuwere bronstand is al verwerkt.");
      if (previous?.digest === snapshot.digest) return {accepted:true, companyCode, duplicate:true, count:previous.projectCount, snapshotId:previous.snapshotId};
      if (previous && previous.sourceObservedAt.getTime() === snapshot.sourceObservedAt.getTime()) throw new ConflictException("Dezelfde bronstand heeft andere inhoud. Controleer de export.");
      for (const p of snapshot.projects) {
        const source = {customer:p.customer, sourceDescription:p.description, sourcePlannedAt:p.planned ? new Date(p.planned) : null, sourceSeenAt:snapshot.sourceObservedAt};
        await tx.project.upsert({
          where:{companyId_externalSource_externalId:{companyId:company.id,externalSource:"PLENION",externalId:p.number}},
          create:{...source,companyId:company.id,externalSource:"PLENION",externalId:p.number,name:`${p.number} · ${p.description || p.customer || "Plenion-project"}`.slice(0,200),owner:"",status:"Actief",statusColor:"#2563eb"},
          // Local title, owner and status remain editable and are not overwritten.
          update:source,
        });
      }
      await tx.qboxImport.upsert({where:{companyCode},create:{companyCode,snapshotId:snapshot.snapshotId,digest:snapshot.digest,sourceObservedAt:snapshot.sourceObservedAt,projectCount:snapshot.projects.length},update:{snapshotId:snapshot.snapshotId,digest:snapshot.digest,sourceObservedAt:snapshot.sourceObservedAt,projectCount:snapshot.projects.length,receivedAt:new Date()}});
      return {accepted:true,companyCode,duplicate:false,count:snapshot.projects.length,snapshotId:snapshot.snapshotId};
    }, {timeout:60000});
  }
}
@Controller("companies/:companyCode/integrations/plenion")
export class PlenionStatusController {
  @Get("status")
  async status(@Param("companyCode") companyCode: string) {
    const result = await prisma.qboxImport.findUnique({where:{companyCode},select:{snapshotId:true,sourceObservedAt:true,receivedAt:true,projectCount:true}});
    return {connected:!!result,stale:!result || Date.now()-result.sourceObservedAt.getTime()>=86400000,...result};
  }
}
