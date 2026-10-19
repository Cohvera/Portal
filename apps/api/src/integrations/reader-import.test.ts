import { test } from "node:test";
import assert from "node:assert/strict";
import { parseReaderImport } from "./reader-import";
const row = {source_id:"12",number:"1810184",name:"Project",description:"Werk",status_id:"31701",status_code:"07",status_label:"07 - In Uitvoering",revision_closed:"0",out_of_wip:"0"};
const batch = (rows = [row]) => ({schema_version:1,source:"plenion_reader_projects",fetched_at:new Date().toISOString(),truncated:false,count:rows.length,projects:rows});
test("Q-Home filters status in Portal, independent of internal ID", () => {
  const result = parseReaderImport("QHOME", batch([row, {...row,source_id:"13",number:"2",status_code:"02"}, {...row,source_id:"14",revision_closed:"1"}]));
  assert.equal(result.projects.length,1); assert.equal(result.skipped,2);
  assert.equal(result.projects[0].closed,false);
});
test("other companies and malformed batches fail", () => {
  assert.throws(()=>parseReaderImport("TOMME",batch()));
  assert.throws(()=>parseReaderImport("WARCO",batch()));
  assert.throws(()=>parseReaderImport("QHOME",{...batch(),truncated:true}));
  assert.throws(()=>parseReaderImport("QHOME",{...batch(),count:3}));
  assert.throws(()=>parseReaderImport("QHOME",{...batch(),fetched_at:"2020-01-01"}));
  assert.throws(()=>parseReaderImport("QHOME",batch([row,{...row,source_id:"13"}])));
});
test("out of WIP is preserved and an empty selection is allowed", () => {
  assert.equal(parseReaderImport("QHOME",batch([{...row,out_of_wip:"1"}])).projects[0].closed,true);
  assert.equal(parseReaderImport("QHOME",batch([{...row,status_code:"02"}])).projects.length,0);
});
test("import upserts only selected projects and preserves local fields", async () => {
  const { prisma } = await import("@cohvera/database");
  const { importReaderProjects } = await import("./reader-import");
  const calls: any[] = [];
  const original = prisma.$transaction;
  try {
    (prisma as any).$transaction = async (run: any) => run({
      $executeRaw: async () => 1,
      company: {findUnique: async () => ({id:"qhome-id",isActive:true})},
      qboxImport: {findUnique:async()=>null, upsert:async()=>({})},
      project: {upsert:async (args:any)=>{calls.push(args); return {};}},
    });
    const result = await importReaderProjects("QHOME", batch([row, {...row,source_id:"13",number:"2",status_code:"02"}]));
    assert.equal(result.count,1);
    assert.equal(calls.length,1);
    assert.equal(calls[0].where.companyId_externalSource_externalId.companyId,"qhome-id");
    assert.equal(calls[0].update.sourceRecordId,"12");
    assert.equal(calls[0].update.name,undefined);
    assert.equal(calls[0].update.owner,undefined);
  } finally { prisma.$transaction = original; }
});
