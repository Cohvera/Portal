import "reflect-metadata";
import { test } from "node:test";
import assert from "node:assert/strict";
import { strategyCsv, strategySummary, validateStrategyInput, type StrategyRecord } from "@cohvera/contracts";
import { prisma, Prisma } from "@cohvera/database";
import { authContext, type AuthContext } from "./auth/context";
import { StrategyController } from "./strategy";
import { warcoActions } from "./strategy/warco";

const input = () => ({status: "REVIEW", ownerId: null, dueOn: "", nextStep: "", notes: "", version: 0});
const ctx = (permissions: string[], company = "WARCO", roles = ["Portal.User"]): AuthContext => ({
  mode: "entra", roles,
  actor: {id: "actor-1", isActive: true, memberships: [{company: {id: "warco-id", code: company, isActive: true},
    role: {key: "custom", permissions: permissions.map(key => ({permission: {key}}))}}]} as AuthContext["actor"],
});
test("source has 29 unique actions in the requested three phases", () => {
  assert.equal(warcoActions.length,29); assert.equal(new Set(warcoActions.map(a=>a.id)).size,29);
  assert.deepEqual(["1","23","5"].map(p=>warcoActions.filter(a=>a.phase===p).length),[13,9,7]);
});
test("input rejects malformed values, impossible dates and unsupported statuses", () => {
  for(const body of [null, [], {}, {...input(),status:"constructor"}, {...input(),version:-1}, {...input(),version:0.5},
    {...input(),dueOn:"2026-02-30"}, {...input(),dueOn:"2026-2-2"}, {...input(),ownerId:""}, {...input(),notes:"x".repeat(10001)}])
    assert.throws(()=>validateStrategyInput(body));
  assert.equal(validateStrategyInput({...input(),dueOn:"2028-02-29"}).dueOn,"2028-02-29");
});
test("progress deduplicates attention, ignores completed overdue actions, and escapes CSV formulas", () => {
  const row: StrategyRecord={...warcoActions[0],...validateStrategyInput(input()),ownerName:"=1+1",updatedAt:null};
  assert.deepEqual(strategySummary([{...row,status:"BLOCKED",dueOn:"2025-01-01"},{...row,status:"DONE",dueOn:"2025-01-01"}],"2026-10-10"),
    {total:2,done:1,percent:50,active:0,attention:1,unassigned:1});
  assert.equal(strategySummary([],"2026-10-10").percent,0);
  assert.match(strategyCsv([{...row,notes:'test; "quote"\nline'}]), /'=1\+1/);
  assert.match(strategyCsv([{...row,notes:'test; "quote"\nline'}]), /""quote""/);
});
test("anonymous, read-only, cross-company and platform-only admins cannot change roadmap data", async () => {
  const api = new StrategyController();
  await assert.rejects(api.overview("WARCO"),/Meld je aan/);
  for(const c of [ctx(["companies.read"]), ctx(["strategy.read"]),ctx(["strategy.manage"],"QHOME"),ctx([],"WARCO",["Portal.Admin"])])
    await authContext.run(c,async()=>assert.rejects(api.update("WARCO","J1-01",input()),/geen recht|Geen toegang/));
  await authContext.run(ctx(["strategy.read"],"QHOME"),async()=>assert.rejects(api.overview("QHOME"),/hoort bij Warco/));
  await authContext.run(ctx(["strategy.manage"]),async()=>assert.rejects(api.update("WARCO","unknown",input()),/Onbekende/));
});
test("reads are company-scoped, return defaults and never create records", async t => {
  const rows=prisma.strategyAction.findMany, users=prisma.user.findMany, logs=prisma.auditLog.findMany;
  prisma.strategyAction.findMany=(async (args:any)=>{assert.equal(args.where.companyId,"warco-id");return [];}) as typeof rows;
  prisma.user.findMany=(async(args:any)=>{assert.equal(args.where.memberships.some.companyId,"warco-id");return [];}) as typeof users;
  prisma.auditLog.findMany=(async(args:any)=>{assert.equal(args.where.companyId,"warco-id");return [];}) as typeof logs;
  t.after(()=>{prisma.strategyAction.findMany=rows;prisma.user.findMany=users;prisma.auditLog.findMany=logs;});
  await authContext.run(ctx(["strategy.read"]),async()=>{
    const result=await new StrategyController().overview("WARCO");
    assert.equal(result.actions.length,29);
    assert.ok(result.actions.every(a=>a.version===0&&a.status==="REVIEW"&&a.ownerId===null));
  });
});
test("stale updates do not reach audit, and owners must belong to Warco", async t => {
  const original=prisma.$transaction;
  t.after(()=>{prisma.$transaction=original;});
  prisma.$transaction=(async(callback:any)=>callback({strategyAction:{findUnique:async()=>null,updateMany:async()=>({count:0})},user:{findFirst:async()=>null},auditLog:{create:()=>assert.fail("must not audit")}})) as typeof original;
  await authContext.run(ctx(["strategy.manage"]),async()=>{
    await assert.rejects(new StrategyController().update("WARCO","J1-01",{...input(),version:3}),/intussen gewijzigd/);
    await assert.rejects(new StrategyController().update("WARCO","J1-01",{...input(),ownerId:"other-company-user"}),/actieve gebruiker/);
  });
});
test("first write and audit share a transaction; duplicate first writes return conflict", async t => {
  const original=prisma.$transaction; t.after(()=>{prisma.$transaction=original;});
  const events:string[]=[];
  prisma.$transaction=(async(callback:any)=>callback({strategyAction:{findUnique:async()=>null,create:async(args:any)=>{assert.equal(args.data.companyId,"warco-id");events.push("created");}},auditLog:{create:async(args:any)=>{
    assert.equal(args.data.userId,"actor-1");assert.equal(args.data.entityId,"J1-01");assert.equal(args.data.metadata.before.status,"REVIEW");assert.equal(args.data.metadata.after.status,"ACTIVE");events.push("audit");
  }}})) as typeof original;
  await authContext.run(ctx(["strategy.manage"]),async()=>new StrategyController().update("WARCO","J1-01",{...input(),status:"ACTIVE"}));
  assert.deepEqual(events,["created","audit"]);
  prisma.$transaction=(async()=>{throw new Prisma.PrismaClientKnownRequestError("duplicate",{code:"P2002",clientVersion:"6"});}) as typeof original;
  await authContext.run(ctx(["strategy.manage"]),async()=>assert.rejects(new StrategyController().update("WARCO","J1-01",input()),/intussen gewijzigd/));
});
