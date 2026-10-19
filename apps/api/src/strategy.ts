import { BadRequestException, Body, ConflictException, Controller, Get, NotFoundException, Param, Patch } from "@nestjs/common";
import { prisma, Prisma } from "@cohvera/database";
import { validateStrategyInput, type StrategyOverview, type StrategyStatus } from "@cohvera/contracts";
import { currentActor, membership } from "./auth/context";
import { warcoActions } from "./strategy/warco";

@Controller("companies/:companyCode/strategy/warco")
export class StrategyController {
  private company(code: string, permission: string) {
    const access = membership(code, permission);
    if (code !== "WARCO") throw new NotFoundException("Deze roadmap hoort bij Warco.");
    return access.company;
  }
  @Get()
  async overview(@Param("companyCode") code: string): Promise<StrategyOverview> {
    const company = this.company(code, "strategy.read");
    const [rows, owners, history] = await Promise.all([
      prisma.strategyAction.findMany({where: {companyId: company.id, roadmap: "warco"}, include: {owner: {select: {displayName: true}}}}),
      prisma.user.findMany({where: {isActive: true, memberships: {some: {companyId: company.id}}}, select: {id: true, displayName: true}, orderBy: {displayName: "asc"}}),
      prisma.auditLog.findMany({where: {companyId: company.id, entityType: "strategy.warco"}, orderBy: {createdAt: "desc"}, take: 30, include: {user: {select: {displayName: true}}}}),
    ]);
    return {actions: warcoActions.map(def => {
      const row = rows.find(r => r.actionCode === def.id);
      return {...def, status: (row?.status ?? "REVIEW") as StrategyStatus, ownerId: row?.ownerId ?? null,
        ownerName: row?.owner?.displayName ?? "", dueOn: row?.dueOn ?? "", nextStep: row?.nextStep ?? "",
        notes: row?.notes ?? "", version: row?.version ?? 0, updatedAt: row?.updatedAt.toISOString() ?? null};
    }), owners, history: history.map(h => ({id: h.id, actionId: h.entityId ?? "", actor: h.user?.displayName ?? "Verwijderde gebruiker", createdAt: h.createdAt.toISOString()}))};
  }
  @Patch("actions/:id")
  async update(@Param("companyCode") code: string, @Param("id") id: string, @Body() body: unknown) {
    const company = this.company(code, "strategy.manage");
    if (!warcoActions.some(a => a.id === id)) throw new NotFoundException("Onbekende roadmapactie.");
    let input;
    try { input = validateStrategyInput(body); } catch(e) { throw new BadRequestException((e as Error).message); }
    const actor = currentActor();
    const {version, ...data} = input;
    try {
      await prisma.$transaction(async tx => {
        if (data.ownerId && !await tx.user.findFirst({where: {id: data.ownerId, isActive: true, memberships: {some: {companyId: company.id}}}}))
          throw new BadRequestException("Kies een actieve gebruiker met toegang tot Warco.");
        const key = {companyId: company.id, roadmap: "warco", actionCode: id};
        const before = await tx.strategyAction.findUnique({where: {companyId_roadmap_actionCode: key}});
        if (version === 0) {
          await tx.strategyAction.create({data: {...key, ...data}});
        } else {
          const result = await tx.strategyAction.updateMany({where: {...key, version}, data: {...data, version: {increment: 1}}});
          if (!result.count) throw new ConflictException("Deze actie is intussen gewijzigd. Herlaad de actuele versie vóór je opnieuw opslaat.");
        }
        const previous = before ? {status: before.status, ownerId: before.ownerId, dueOn: before.dueOn, nextStep: before.nextStep, notes: before.notes} : {status: "REVIEW", ownerId: null, dueOn: "", nextStep: "", notes: ""};
        await tx.auditLog.create({data: {companyId: company.id, userId: actor.id, entityType: "strategy.warco", entityId: id,
          action: "strategy.action.updated", metadata: {before: previous, after: data, version: version + 1}}});
      });
    } catch(e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
        throw new ConflictException("Deze actie is intussen gewijzigd. Herlaad de actuele versie vóór je opnieuw opslaat.");
      throw e;
    }
    return {updated: true};
  }
}
