import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { validateSnapshot, verifyQboxKey, qboxCompanyCode, QboxImportController } from "./qbox";
import { PortalGuard } from "../auth/guard";
import type { ExecutionContext } from "@nestjs/common";
const keyVars = ["QBOX_IMPORT_API_KEY","QBOX_IMPORT_COMPANY","QBOX_IMPORT_KEY_QHOME","QBOX_IMPORT_KEY_TOMME","QBOX_IMPORT_KEY_WARCO"];
let savedEnv: (string | undefined)[];
beforeEach(() => {
  savedEnv = keyVars.map(name => process.env[name]);
  keyVars.forEach(name => delete process.env[name]);
  process.env.QBOX_IMPORT_API_KEY = "x".repeat(43);
});
afterEach(() => keyVars.forEach((name,index) => {
  if (savedEnv[index] === undefined) delete process.env[name];
  else process.env[name] = savedEnv[index];
}));
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
    qboxReaderConfig:{findUnique:async()=>null},
      qboxImport: {findUnique:async()=>previous,upsert:async(args:any)=>{previous=previous?{...previous,...args.update}:args.create;return previous;}},
    project: {upsert:async(args:any)=>{const key=args.where.companyId_externalSource_externalId.externalId;projects.set(key,projects.has(key)?{...projects.get(key),...args.update}:args.create);}},
  };
  prisma.$transaction = (async (fn:any)=>fn(tx)) as typeof original;
  try {
    const controller = new QboxImportController();
    const ingest = (body:unknown) => controller.ingest(body, "x".repeat(43));
    const data = fixture();
    assert.equal((await ingest(data)).duplicate,false);
    assert.equal(projects.get("123").companyId,"company-qhome");
    assert.equal(previous.companyCode,"QHOME");
    projects.get("123").owner="Lokale verantwoordelijke";
    projects.get("123").name="Eigen titel";
    assert.equal((await ingest(data)).duplicate,true);
    assert.equal(projects.size,1);
    const newer={...data,source_observed_at:new Date(Date.parse(data.source_observed_at)+10000).toISOString(),projects:[{...data.projects[0],description:"Nieuwe bronomschrijving"}]};
    await ingest(newer);
    assert.equal(projects.get("123").name,"Eigen titel");
    assert.equal(projects.get("123").owner,"Lokale verantwoordelijke");
    assert.equal(projects.get("123").sourceDescription,"Nieuwe bronomschrijving");
    await assert.rejects(ingest(data));
    await ingest({...newer,source_observed_at:new Date(Date.parse(newer.source_observed_at)+10000).toISOString(),projects:[]});
    assert.equal(projects.size,1); // Missing from a filtered export is not a deletion.
    const full={...newer,schema_version:3,scope:"ALL_CURRENT_PROJECTS",complete:true,source_observed_at:previous.sourceObservedAt.toISOString(),projects:[{...data.projects[0],source_id:"revision-2",closed:true,active:false}]};
    await ingest(full); // Upgrade of the same source snapshot is permitted once.
    assert.equal(previous.contractVersion,3);
    assert.equal(projects.get("123").sourceIsClosed,true);
    assert.equal(projects.get("123").sourceStatusLabel,"07 - In Uitvoering");
    assert.equal(projects.get("123").name,"Eigen titel");
    assert.equal(projects.size,1);
    assert.equal((await ingest(full)).duplicate,true);
    await assert.rejects(ingest({...full,schema_version:2}));
    const reopened={...full,source_observed_at:new Date(Date.parse(full.source_observed_at)+10000).toISOString(),projects:[{...full.projects[0],closed:false,status_label:"09 - Afgewerkt"}]};
    await ingest(reopened);
    assert.equal(projects.get("123").sourceIsClosed,false);
    assert.equal(projects.get("123").sourceStatusLabel,"09 - Afgewerkt");
    const direct={...reopened,schema_version:4,source_kind:"qbox_capture",capture_sha256:"a".repeat(64),projects:reopened.projects.map(p=>({...p,evidence:"qbox_capture"}))};
    await ingest(direct);
    assert.equal(previous.sourceKind,"qbox_capture");
    assert.equal(previous.captureSha256,"a".repeat(64));
    assert.equal((await ingest(direct)).duplicate,true);
    await assert.rejects(ingest({...reopened,source_observed_at:new Date(Date.parse(reopened.source_observed_at)+10000).toISOString()}));
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

test("Full snapshot preserves the checkbox independently of status label", () => {
  const data={...fixture(),schema_version:3,scope:"ALL_CURRENT_PROJECTS",complete:true};
  const p={...data.projects[0],source_id:"r1",active:false,closed:true};
  assert.equal(validateSnapshot({...data,projects:[p]}).projects[0].closed,true);
  for(const patch of [{closed:null},{closed:1},{is_current:false},{source_id:""}]) assert.throws(()=>validateSnapshot({...data,projects:[{...p,...patch}]}));
  assert.throws(()=>validateSnapshot({...data,complete:false,projects:[p]}));
});

test("Direct Q-box capture has distinct provenance and requires a complete verified snapshot", () => {
  const old=fixture();
  const data={...old,schema_version:4,source_kind:"qbox_capture",scope:"ALL_CURRENT_PROJECTS",complete:true,capture_sha256:"a".repeat(64),projects:old.projects.map(p=>({...p,source_id:"r1",evidence:"qbox_capture"}))};
  const valid=validateSnapshot(data);
  assert.equal(valid.sourceKind,"qbox_capture");
  assert.equal(valid.captureSha256,"a".repeat(64));
  for(const patch of [{capture_sha256:null},{capture_sha256:"wrong"},{source_kind:"central_datahub"},{complete:false},{projects:[{...data.projects[0],evidence:"central_datahub"}]},{projects:[data.projects[0],{...data.projects[0],number:"456"}]}])
    assert.throws(()=>validateSnapshot({...data,...patch}));
  assert.notEqual(valid.digest,validateSnapshot({...data,capture_sha256:"b".repeat(64)}).digest);
});
test("reader endpoint imports into server-selected company, ignoring payload company", async () => {
  const { prisma } = await import("@cohvera/database");
  const before = process.env.QBOX_IMPORT_COMPANY;
  const transaction = prisma.$transaction;
  let selected = "";
  try {
    process.env.QBOX_IMPORT_COMPANY = "QHOME";
    (prisma as any).$transaction = async (run:any) => run({
      $executeRaw:async()=>1,
      company:{findUnique:async(args:any)=>{selected=args.where.code;return {id:"qhome",isActive:true};}},
      qboxReaderConfig:{findUnique:async()=>null},
      qboxImport:{findUnique:async()=>null,upsert:async()=>({})},
    });
    const result = await new QboxImportController().readerProjects({
      schema_version:2, source:"plenion_reader_projects", company_code:"WARCO",
      fetched_at:new Date().toISOString(),truncated:false,count:0,projects:[],
    }, "x".repeat(43));
    assert.equal(result.accepted,true);
    assert.equal(result.companyCode,"QHOME");
    assert.equal(selected,"QHOME");
  } finally {
    prisma.$transaction=transaction;
    if (before === undefined) delete process.env.QBOX_IMPORT_COMPANY;
    else process.env.QBOX_IMPORT_COMPANY=before;
  }
});
test("company keys are isolated, legacy key stays scoped and duplicates fail closed", () => {
  process.env.QBOX_IMPORT_COMPANY = "QHOME";
  process.env.QBOX_IMPORT_KEY_QHOME = "q".repeat(43);
  process.env.QBOX_IMPORT_KEY_TOMME = "t".repeat(43);
  process.env.QBOX_IMPORT_KEY_WARCO = "w".repeat(43);
  assert.equal(verifyQboxKey("q".repeat(43)), "QHOME");
  assert.equal(verifyQboxKey("t".repeat(43)), "TOMME");
  assert.equal(verifyQboxKey("w".repeat(43)), "WARCO");
  assert.equal(verifyQboxKey("x".repeat(43)), "QHOME");
  assert.throws(()=>verifyQboxKey("z".repeat(43)));
  process.env.QBOX_IMPORT_KEY_WARCO = "q".repeat(43);
  assert.throws(()=>verifyQboxKey("q".repeat(43)), /verschillende/);
  delete process.env.QBOX_IMPORT_KEY_WARCO;
  process.env.QBOX_IMPORT_KEY_TOMME = "short";
  assert.throws(()=>verifyQboxKey("q".repeat(43)), /correct ingesteld/);
});
test("per-company key decides reader destination even when legacy target and payload differ", async () => {
  const { prisma } = await import("@cohvera/database");
  const original = prisma.$transaction;
  process.env.QBOX_IMPORT_COMPANY = "TOMME";
  process.env.QBOX_IMPORT_KEY_QHOME = "q".repeat(43);
  try {
    (prisma as any).$transaction = async (run:any) => run({
      $executeRaw:async()=>1,
      company:{findUnique:async(args:any)=>{assert.equal(args.where.code,"QHOME"); return {id:"qhome",isActive:true};}},
      qboxReaderConfig:{findUnique:async()=>null},
      qboxImport:{findUnique:async()=>null,upsert:async(args:any)=>{assert.equal(args.where.companyCode,"QHOME");}},
    });
    const result = await new QboxImportController().readerProjects({
      schema_version:2,source:"plenion_reader_projects",company_code:"WARCO",
      fetched_at:new Date().toISOString(),truncated:false,count:0,projects:[],
    }, "q".repeat(43));
    assert.equal(result.companyCode,"QHOME");
    await assert.rejects(new QboxImportController().readerProjects({}, "invalid"));
  } finally {prisma.$transaction=original;}
});

test("Warco reader key writes exclusively to Warco despite a Q-Home payload", async () => {
  const { prisma } = await import("@cohvera/database");
  const original = prisma.$transaction;
  process.env.QBOX_IMPORT_KEY_WARCO = "w".repeat(43);
  process.env.QBOX_IMPORT_COMPANY = "QHOME";
  try {
    (prisma as any).$transaction = async (run:any) => run({
      $executeRaw:async()=>1,
      company:{findUnique:async(args:any)=>{assert.equal(args.where.code,"WARCO");return {id:"warco",isActive:true};}},
      qboxReaderConfig:{findUnique:async()=>null},
      qboxImport:{findUnique:async()=>null,upsert:async(args:any)=>{assert.equal(args.where.companyCode,"WARCO");}},
      project:{upsert:async(args:any)=>{assert.equal(args.create.companyId,"warco");assert.equal(args.where.companyId_externalSource_externalId.companyId,"warco");}},
    });
    const result = await new QboxImportController().readerProjects({
      schema_version:2,source:"plenion_reader_projects",company_code:"QHOME",
      fetched_at:new Date().toISOString(),truncated:false,count:1,
      projects:[{source_id:"1",number:"123",name:"Test",description:"",status_id:"31701",
        status_code:"07",status_label:"07 - In Uitvoering",revision_closed:"0",out_of_wip:"0",
        parent_source_id:"0",is_project_map:"1",document_type:"600",version_number:"1"}],
    }, "w".repeat(43));
    assert.equal(result.companyCode,"WARCO");
    assert.equal(result.count,1);
  } finally {prisma.$transaction=original;}
});
