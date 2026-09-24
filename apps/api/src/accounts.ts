import { BadRequestException, ConflictException, Controller, ForbiddenException, Get, NotFoundException, Param, Patch, Post, Body, UnauthorizedException } from "@nestjs/common";
import { prisma, Prisma } from "@cohvera/database";

const actorEmail = "remko@cohvera.be";
const roleInclude = {permissions:{include:{permission:true}}} as const;
const userInclude = {memberships:{include:{company:true,role:{include:roleInclude}}}} as const;

export async function requireAccountAdmin() {
  // No user-controlled identity headers. Replace this adapter when real login is wired in.
  if (process.env.AUTH_MODE !== "development") throw new UnauthorizedException("Accountbeheer vereist een geconfigureerde aanmelding.");
  const actor = await prisma.user.findUnique({where:{email:actorEmail},include:userInclude});
  if (!actor?.isActive || !actor.memberships.some(m=>m.company.isActive && m.role.permissions.some(p=>p.permission.key==="portal.admin"))) throw new ForbiddenException("Geen toegang tot accountbeheer.");
  return actor;
}

function accountInput(body: unknown) {
  if (!body || typeof body!=="object" || Array.isArray(body)) throw new BadRequestException("Ongeldige accountgegevens.");
  const b=body as Record<string,unknown>;
  if(typeof b.displayName!=="string" || !b.displayName.trim() || b.displayName.length>100) throw new BadRequestException("Vul een naam in van maximaal 100 tekens.");
  if(typeof b.email!=="string" || b.email.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email.trim())) throw new BadRequestException("Vul een geldig e-mailadres in.");
  if(typeof b.isActive!=="boolean") throw new BadRequestException("Ongeldige accountstatus.");
  if(!Array.isArray(b.memberships) || b.memberships.length>100) throw new BadRequestException("Ongeldige bedrijfstoegang.");
  const seen=new Set<string>();
  const memberships=b.memberships.map(m=>{
    if(!m || typeof m!=="object" || typeof m.companyId!=="string" || typeof m.roleId!=="string" || seen.has(m.companyId)) throw new BadRequestException("Kies één rol per bedrijf.");
    seen.add(m.companyId);return {companyId:m.companyId as string,roleId:m.roleId as string};
  });
  if(b.isActive && !memberships.length) throw new BadRequestException("Geef een actief account toegang tot minstens één bedrijf.");
  return {displayName:b.displayName.trim(),email:b.email.trim().toLowerCase(),isActive:b.isActive,memberships};
}

@Controller("admin/accounts")
export class AccountsController {
  @Get()
  async overview() {
    const actor=await requireAccountAdmin();
    const [users,roles,companies]=await Promise.all([
      prisma.user.findMany({include:userInclude,orderBy:{displayName:"asc"}}),
      prisma.role.findMany({include:roleInclude,orderBy:{name:"asc"}}),
      prisma.company.findMany({where:{isActive:true},orderBy:{name:"asc"}})
    ]);
    return {actorId:actor.id,authMode:"development",users,roles,companies};
  }
  @Post()
  async create(@Body() body: unknown) {return this.save(undefined,body);}
  @Patch(":id")
  async update(@Param("id") id:string,@Body() body:unknown) {return this.save(id,body);}

  private async save(id:string|undefined,body:unknown) {
    const actor=await requireAccountAdmin();
    const input=accountInput(body);
    // The active development identity must remain available until real login is configured.
    if(id===actor.id) throw new ForbiddenException("Het huidige beheeraccount kan in deze ontwikkelomgeving niet worden gewijzigd.");
    try {
      return await prisma.$transaction(async tx=>{
        const existing=id?await tx.user.findUnique({where:{id},include:userInclude}):null;
        if(id&&!existing) throw new NotFoundException("Account niet gevonden.");
        const [companies,roles]=await Promise.all([tx.company.findMany({where:{id:{in:input.memberships.map(m=>m.companyId)},isActive:true}}),tx.role.findMany({include:roleInclude})]);
        if(companies.length!==input.memberships.length || input.memberships.some(m=>!roles.some(r=>r.id===m.roleId))) throw new BadRequestException("Onbekend bedrijf of onbekende rol.");
        const adminRoles=roles.filter(r=>r.permissions.some(p=>p.permission.key==="portal.admin")).map(r=>r.id);
        for(const membership of existing?.memberships||[]) {
          if(!existing?.isActive || !adminRoles.includes(membership.roleId)) continue;
          const remains=input.isActive&&input.memberships.some(m=>m.companyId===membership.companyId&&adminRoles.includes(m.roleId));
          if(!remains && await tx.companyMembership.count({where:{companyId:membership.companyId,roleId:{in:adminRoles},user:{isActive:true},userId:{not:id}}})===0) throw new ConflictException(`Behoud minstens één actieve beheerder voor ${membership.company.name}.`);
        }
        const {memberships,...data}=input;
        const user=existing?await tx.user.update({where:{id},data}):await tx.user.create({data});
        if(existing) await tx.companyMembership.deleteMany({where:{userId:user.id}});
        if(memberships.length) await tx.companyMembership.createMany({data:memberships.map(m=>({...m,userId:user.id}))});
        const companyIds=[...new Set([...memberships.map(m=>m.companyId),...(existing?.memberships.map(m=>m.companyId)||[])])];
        // Accounts without memberships are still audited in the administrator's company.
        if(!companyIds.length) companyIds.push(actor.memberships.find(m=>m.company.isActive)!.companyId);
        await tx.auditLog.createMany({data:companyIds.map(companyId=>({companyId,userId:actor.id,action:existing?"account.updated":"account.created",entityType:"user",entityId:user.id,metadata:{isActive:user.isActive,memberships:memberships.map(m=>({companyId:m.companyId,roleId:m.roleId}))}}))});
        return tx.user.findUnique({where:{id:user.id},include:userInclude});
      },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
    } catch(error) {
      if(error instanceof Prisma.PrismaClientKnownRequestError) {
        if(error.code==="P2002") throw new ConflictException("Er bestaat al een account met dit e-mailadres.");
        if(error.code==="P2034") throw new ConflictException("Een ander beheerproces wijzigde deze gegevens. Vernieuw en probeer opnieuw.");
      }
      throw error;
    }
  }
}
