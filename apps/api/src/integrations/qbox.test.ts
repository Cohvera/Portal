import { test } from "node:test";
import assert from "node:assert/strict";
import { validateSnapshot, verifyQboxKey, qboxCompanyCode, QboxImportController } from "./qbox";
import { PortalGuard } from "../auth/guard";
import type { ExecutionContext } from "@nestjs/common";
export function fixture(now = Date.now()) {
  return {schema_version:2,source_kind:"central_datahub",source_system:"PLENION",live:true,snapshot_id:"test-snapshot",batch_id:"test-batch",source_observed_at:new Date(now-60000).toISOString(),valid_until:new Date(now+3600000).toISOString(),projects:[{number:"123",customer:"Test klant",description:"Test project",planned:"",status_label:"07 - In Uitvoering",evidence:"central_datahub",active:true,is_current:true,closed:false}]};
}
test("Q-box validates live fresh snapshots and stable digest", () => {
  const data = fixture();
  assert.equal(validateSnapshot(data).projects.length,1);
  assert.equal(validateSnapshot({...data, generated_at:"changed"}).digest,validateSnapshot(data).digest);
  for (const patch of [{live:false},{source_kind:"user_screenshots"},{source_observed_at:"2000-01-01T00:00:00Z"},{valid_until:"2000-01-01T00:00:00Z"},{projects:[...data.projects,...data.projects]},{projects:[{...data.projects[0],closed:true}]},{projects:[{...data.projects[0],planned:"2026-02-30"}]}])
    assert.throws(()=>validateSnapshot({...data,...patch}));
});
test("Q-box key is mandatory and only allows JSON imports, no read/admin access", async () => {
  const before = process.env.QBOX_IMPORT_API_KEY;
  try {
    delete process.env.QBOX_IMPORT_API_KEY;
    assert.throws(()=>verifyQboxKey("x".repeat(43)));
    process.env.QBOX_IMPORT_API_KEY = "x".repeat(43);
    verifyQboxKey("x".repeat(43));
    assert.throws(()=>verifyQboxKey("wrong"));
    const run = (controller: unknown, method="POST", headers: Record<string,string> = {"x-qbox-key":"x".repeat(43)}, json=true) => new PortalGuard().canActivate({switchToHttp:()=>({getRequest:()=>({path:"/integrations/qbox/plenion/projects",method,headers,is:()=>json})}), getClass:()=>controller} as unknown as ExecutionContext);
    assert.equal(await run(QboxImportController),true);
    await assert.rejects(run(QboxImportController,"POST",{}));
    await assert.rejects(run(QboxImportController,"GET"));
    await assert.rejects(run(class Admin {}));
    await assert.rejects(run(QboxImportController,"POST",{"x-qbox-key":"x".repeat(43),"x-warehouse-key":"x".repeat(43)}));
    await assert.rejects(run(QboxImportController,"POST",{"x-qbox-key":"x".repeat(43)},false));
  } finally { if(before===undefined) delete process.env.QBOX_IMPORT_API_KEY; else process.env.QBOX_IMPORT_API_KEY=before; }
});

test("Import upserts stable source IDs, preserves local fields and rejects older source", async () => {
  const { prisma } = await import("@cohvera/database");
  const original = prisma.$transaction;
  const oldCompany = process.env.QBOX_IMPORT_COMPANY;
  process.env.QBOX_IMPORT_COMPANY = "QHOME";
  let previous: any = null;
  const projects = new Map<string, any>();
  const tx = {
    $executeRaw: async () => 1,
    company: {findUnique:async(args:any)=>{assert.equal(args.where.code,"QHOME");return {id:"company-qhome",isActive:true};}},
    qboxImport: {findUnique:async()=>previous,upsert:async(args:any)=>{previous=previous?{...previous,...args.update}:args.create;return previous;}},
    project: {upsert:async(args:any)=>{const key=args.where.companyId_externalSource_externalId.externalId;projects.set(key,projects.has(key)?{...projects.get(key),...args.update}:args.create);}},
  };
  prisma.$transaction = (async (fn:any)=>fn(tx)) as typeof original;
  try {
    const controller = new QboxImportController();
    const data = fixture();
    assert.equal((await controller.ingest(data)).duplicate,false);
    assert.equal(projects.get("123").companyId,"company-qhome");
    assert.equal(previous.companyCode,"QHOME");
    projects.get("123").owner="Lokale verantwoordelijke";
    projects.get("123").name="Eigen titel";
    assert.equal((await controller.ingest(data)).duplicate,true);
    assert.equal(projects.size,1);
    const newer={...data,source_observed_at:new Date(Date.parse(data.source_observed_at)+10000).toISOString(),projects:[{...data.projects[0],description:"Nieuwe bronomschrijving"}]};
    await controller.ingest(newer);
    assert.equal(projects.get("123").name,"Eigen titel");
    assert.equal(projects.get("123").owner,"Lokale verantwoordelijke");
    assert.equal(projects.get("123").sourceDescription,"Nieuwe bronomschrijving");
    await assert.rejects(controller.ingest(data));
    await controller.ingest({...newer,source_observed_at:new Date(Date.parse(newer.source_observed_at)+10000).toISOString(),projects:[]});
    assert.equal(projects.size,1); // Missing from a filtered export is not a deletion.
  } finally { prisma.$transaction=original; if(oldCompany===undefined) delete process.env.QBOX_IMPORT_COMPANY; else process.env.QBOX_IMPORT_COMPANY=oldCompany; }
});

test("Import company is explicit server configuration with a Tomme default", () => {
  const old = process.env.QBOX_IMPORT_COMPANY;
  try {
    delete process.env.QBOX_IMPORT_COMPANY;
    assert.equal(qboxCompanyCode(),"TOMME");
    process.env.QBOX_IMPORT_COMPANY="QHOME";
    assert.equal(qboxCompanyCode(),"QHOME");
    process.env.QBOX_IMPORT_COMPANY="UNKNOWN";
    assert.throws(()=>qboxCompanyCode());
  } finally { if(old===undefined) delete process.env.QBOX_IMPORT_COMPANY; else process.env.QBOX_IMPORT_COMPANY=old; }
});
