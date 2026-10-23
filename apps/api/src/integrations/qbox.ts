import {ingestReaderEvents} from "./qbox-monitor";
import { importReaderProjects } from "./reader-import";
import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, Headers, Param, Post, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { createHash, timingSafeEqual } from "node:crypto";
import { tvTelemetry } from "../tv";
import { Prisma } from "@cohvera/database";
import { prisma } from "@cohvera/database";

export function verifyQboxKey(value: unknown): string {
  const entries: {key:string; company:string}[] = [];
  for (const company of ["QHOME", "TOMME", "WARCO"]) {
    const key = process.env[`QBOX_IMPORT_KEY_${company}`];
    if (key) entries.push({key,company});
  }
  const legacy = process.env.QBOX_IMPORT_API_KEY;
  if (legacy) entries.push({key:legacy,company:qboxCompanyCode()});
  if (!entries.length || entries.some(e => !/^[A-Za-z0-9_-]{43,128}$/.test(e.key)))
    throw new ServiceUnavailableException("Q-box importsleutels zijn niet correct ingesteld.");
  // A key must identify exactly one company; ambiguous configuration fails closed.
  for (const entry of entries)
    if (entries.some(other => other.key === entry.key && other.company !== entry.company))
      throw new ServiceUnavailableException("Gebruik een verschillende Q-box sleutel per bedrijf.");
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{43,128}$/.test(value))
    throw new UnauthorizedException("Ongeldige Q-box sleutel.");
  const digest = createHash("sha256").update(value).digest();
  let company: string | undefined;
  for (const entry of entries)
    if (timingSafeEqual(digest, createHash("sha256").update(entry.key).digest())) company = entry.company;
  if (!company) throw new UnauthorizedException("Ongeldige Q-box sleutel.");
  return company;
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
  const version = d.schema_version;
  const direct = version === 4;
  const sourceKind = direct ? "qbox_capture" : "central_datahub";
  if ((version !== 2 && version !== 3 && version !== 4) || d.source_kind !== sourceKind || d.source_system !== "PLENION" || d.live !== true) return fail();
  const captureSha256 = direct ? text(d.capture_sha256, 64) : null;
  if (direct && !/^[a-f0-9]{64}$/.test(captureSha256!)) return fail();
  if ((version === 3 || version === 4) && (d.scope !== "ALL_CURRENT_PROJECTS" || d.complete !== true)) return fail();
  const snapshotId = text(d.snapshot_id, 150), batchId = text(d.batch_id, 150);
  if (!snapshotId || !batchId) return fail();
  const observed = Date.parse(text(d.source_observed_at, 50)), validUntil = Date.parse(text(d.valid_until, 50));
  if (!Number.isFinite(observed) || !Number.isFinite(validUntil) || observed > now + 300000 || now - observed >= 86400000 || validUntil <= now || validUntil > observed + 86400000) return fail();
  if (!Array.isArray(d.projects) || d.projects.length > 10000) return fail();
  const projects = d.projects.map((value: unknown) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return fail();
    const p = value as Record<string, unknown>;
    const number = text(p.number, 60), customer = text(p.customer, 300), description = text(p.description, 2000), planned = text(p.planned, 10);
    if (!/^\d+$/.test(number) || p.evidence !== sourceKind || p.is_current !== true || typeof p.active !== "boolean" || typeof p.closed !== "boolean") return fail();
    const statusLabel = text(p.status_label, 100);
    if (!statusLabel.trim()) return fail();
    const sourceId = (version === 3 || version === 4) ? text(p.source_id, 100) : null;
    if ((version === 3 || version === 4) && !sourceId) return fail();
    if (version === 2 && (statusLabel !== "07 - In Uitvoering" || p.active !== true || p.closed !== false)) return fail();
    if (planned && (!/^\d{4}-\d{2}-\d{2}$/.test(planned) || !Number.isFinite(Date.parse(planned)) || new Date(planned).toISOString().slice(0,10) !== planned)) return fail();
    return {number, customer, description, planned, statusLabel, sourceId, closed:p.closed, active:p.active};
  }).sort((a,b) => a.number.localeCompare(b.number));
  if (new Set(projects.map(p => p.number)).size !== projects.length) return fail();
  if (version !== 2 && new Set(projects.map(p => p.sourceId)).size !== projects.length) return fail();
  const sourceObservedAt = new Date(observed);
  const digestInput = version === 2
    ? {snapshotId,batchId,observed,projects:projects.map(({number,customer,description,planned})=>({number,customer,description,planned}))}
    : {version,snapshotId,batchId,observed,projects,...(direct ? {captureSha256} : {})};
  const digest = createHash("sha256").update(JSON.stringify(digestInput)).digest("hex");
  return {version,snapshotId,batchId,sourceObservedAt,digest,projects,sourceKind,captureSha256};
}

@Controller("integrations/qbox")
export class QboxImportController {
  @Post("reader-status")
  async readerStatus(@Body() body:unknown,@Headers("x-qbox-key") key:unknown){
    return ingestReaderEvents(verifyQboxKey(key),body);
  }

  @Post("plenion/reader-projects")
  async readerProjects(@Body() body: unknown, @Headers("x-qbox-key") key: unknown) {
    const companyCode = verifyQboxKey(key);
    const result = await importReaderProjects(companyCode, body);
    return {accepted:true, companyCode, ...result};
  }

  @Post("tv")
  async tv(@Body() body: unknown, @Headers("x-qbox-key") key: unknown) {
    const companyCode=verifyQboxKey(key);
    const company=await prisma.company.findUnique({where:{code:companyCode}});
    if(!company?.isActive) throw new ForbiddenException("Het ingestelde doelbedrijf is niet actief.");
    const parsed=tvTelemetry(body);
    const data={fleet:parsed.fleet ?? Prisma.DbNull,nas:parsed.nas ?? Prisma.DbNull,receivedAt:new Date()};
    await prisma.tvBoard.upsert({where:{companyCode},create:{companyCode,...data},update:data});
    return {accepted:true};
  }

  @Post("plenion/projects")
  async ingest(@Body() body: unknown, @Headers("x-qbox-key") key: unknown) {
    const snapshot = validateSnapshot(body);
    // Only server configuration selects the destination; never trust a payload company.
    const companyCode = verifyQboxKey(key);
    return prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(71620501)`;
      const company = await tx.company.findUnique({where:{code:companyCode}});
      if (!company?.isActive) throw new ForbiddenException("Het ingestelde doelbedrijf is niet actief.");
      const previous = await tx.qboxImport.findUnique({where:{companyCode}});
      if (previous && (previous.contractVersion ?? 2) > snapshot.version) throw new ConflictException("Een oudere connector mag de nieuwe import niet overschrijven.");
      if (previous && previous.sourceObservedAt > snapshot.sourceObservedAt) throw new ConflictException("Een nieuwere bronstand is al verwerkt.");
      if (previous?.digest === snapshot.digest) return {accepted:true, companyCode, duplicate:true, count:previous.projectCount, snapshotId:previous.snapshotId};
      if (previous && previous.sourceObservedAt.getTime() === snapshot.sourceObservedAt.getTime() && (previous.contractVersion ?? 2) >= snapshot.version) throw new ConflictException("Dezelfde bronstand heeft andere inhoud. Controleer de export.");
      for (const p of snapshot.projects) {
        const source = {sourceStatusLabel:p.statusLabel,sourceIsClosed:p.closed,sourceIsActive:p.active,sourceRecordId:p.sourceId,customer:p.customer, sourceDescription:p.description, sourcePlannedAt:p.planned ? new Date(p.planned) : null, sourceSeenAt:snapshot.sourceObservedAt};
        await tx.project.upsert({
          where:{companyId_externalSource_externalId:{companyId:company.id,externalSource:"PLENION",externalId:p.number}},
          create:{...source,companyId:company.id,externalSource:"PLENION",externalId:p.number,name:`${p.number} · ${p.description || p.customer || "Plenion-project"}`.slice(0,200),owner:"",status:"Actief",statusColor:"#2563eb"},
          // Local title, owner and status remain editable and are not overwritten.
          update:source,
        });
      }
      await tx.qboxImport.upsert({where:{companyCode},create:{companyCode,sourceKind:snapshot.sourceKind,captureSha256:snapshot.captureSha256,contractVersion:snapshot.version,snapshotId:snapshot.snapshotId,digest:snapshot.digest,sourceObservedAt:snapshot.sourceObservedAt,projectCount:snapshot.projects.length},update:{sourceKind:snapshot.sourceKind,captureSha256:snapshot.captureSha256,contractVersion:snapshot.version,snapshotId:snapshot.snapshotId,digest:snapshot.digest,sourceObservedAt:snapshot.sourceObservedAt,projectCount:snapshot.projects.length,receivedAt:new Date()}});
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
