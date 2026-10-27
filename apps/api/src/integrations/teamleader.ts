import {BadRequestException, Body, ConflictException, Controller, ForbiddenException, Headers, Post, ServiceUnavailableException, UnauthorizedException} from "@nestjs/common";
import {createHash, timingSafeEqual} from "node:crypto";
import {prisma} from "@cohvera/database";

export function verifyTeamleaderKey(value: unknown) {
  const key = process.env.TEAMLEADER_IMPORT_KEY_QHOME;
  if (!key || !/^[A-Za-z0-9_-]{43,128}$/.test(key)) throw new ServiceUnavailableException("Teamleader importsleutel ontbreekt.");
  if (typeof value !== "string" || value.length > 128 || !timingSafeEqual(createHash("sha256").update(key).digest(), createHash("sha256").update(value).digest())) throw new UnauthorizedException("Ongeldige Teamleader sleutel.");
  return "QHOME";
}
const fail = (): never => {throw new BadRequestException("Ongeldige Teamleader-projectexport.");};
export function validateTeamleader(value: unknown, now = Date.now()) {
  if (!value || typeof value !== "object") return fail();
  const b = value as any;
  if (b.source !== "TEAMLEADER" || b.version !== 1 || b.complete !== true || !["legacy", "v2"].includes(b.mode) || !Array.isArray(b.projects) || b.projects.length > 10000) return fail();
  if(typeof b.fetched_at !== "string") return fail();
  const observed = Date.parse(b.fetched_at);
  if (!Number.isFinite(observed) || observed > now + 300000 || now - observed > 86400000) return fail();
  const str = (v: unknown, max: number) => typeof v === "string" && v.length <= max && !v.includes("\u0000") ? v : fail();
  const day = (v: unknown) => {if(v === null) return null; const s = str(v,10); if(!/^\d{4}-\d{2}-\d{2}$/.test(s) || !Number.isFinite(Date.parse(s)) || new Date(s).toISOString().slice(0,10)!==s) return fail(); return new Date(s);};
  const projects = b.projects.map((p:any) => {
    if(!p || typeof p!=="object") return fail();
    const id=str(p.id,100), name=str(p.name,500), status=str(p.status,30);
    if(!/^[a-f0-9-]{36}$/i.test(id) || !name.trim() || !(b.mode === "legacy" ? ["active","on_hold","done","cancelled"] : ["open","closed"]).includes(status)) return fail();
    return {id,name,status,reference:str(p.reference,100),description:str(p.description,20000),start:day(p.start_date),deadline:day(p.deadline)};
  });
  if(new Set(projects.map((p:any)=>p.id)).size!==projects.length) return fail();
  return {projects, observed:new Date(observed)};
}

@Controller("integrations/teamleader")
export class TeamleaderImportController {
  @Post("projects")
  async importProjects(@Headers("x-teamleader-key") key:unknown, @Body() body:unknown) {
    return importTeamleaderProjects(verifyTeamleaderKey(key), body);
  }
}

export async function importTeamleaderProjects(companyCode:string, body:unknown) {
    if(companyCode !== "QHOME") throw new ForbiddenException("Teamleader is alleen voor QHOME ingesteld.");
    const snapshot=validateTeamleader(body);
    return prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(78349021)`;
      const company=await tx.company.findUnique({where:{code:companyCode}});
      if(!company?.isActive) throw new ForbiddenException("QHOME is niet actief.");
      const last=await tx.project.findFirst({where:{companyId:company.id,externalSource:"TEAMLEADER"},orderBy:{sourceSeenAt:"desc"}});
      if(last?.sourceSeenAt && last.sourceSeenAt > snapshot.observed) throw new ConflictException("Deze export is ouder dan de vorige import.");
      for(const p of snapshot.projects) {
        const closed=["done","cancelled","closed"].includes(p.status);
        const label=({active:"Actief",open:"Actief",on_hold:"Gepauzeerd",done:"Afgerond",closed:"Afgerond",cancelled:"Geannuleerd"} as Record<string,string>)[p.status];
        const data={name:p.name,status:closed?"Afgerond":p.status==="on_hold"?"Gepauzeerd":"Actief",statusColor:closed?"#16834b":"#2563eb",dueDate:p.deadline,sourcePlannedAt:p.start,sourceRecordId:p.id,sourceStatusCode:p.status,sourceStatusLabel:label,sourceIsClosed:closed,sourceIsActive:!closed && p.status!=="on_hold",sourceDescription:p.description,sourceExtraFields:{reference:p.reference},sourceSeenAt:snapshot.observed};
        await tx.project.upsert({where:{companyId_externalSource_externalId:{companyId:company.id,externalSource:"TEAMLEADER",externalId:p.id}},create:{companyId:company.id,externalSource:"TEAMLEADER",externalId:p.id,customer:"",owner:"",...data},update:data});
      }
      return {accepted:true,companyCode,projectCount:snapshot.projects.length};
    },{timeout:120000});
  }
