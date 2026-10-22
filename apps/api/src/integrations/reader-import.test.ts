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
const parent = {...row, source_id:"11392",number:"1879",parent_source_id:"0",is_project_map:"1",document_type:"600",version_number:"1"};
const child = {...row,source_id:"12001",number:"1809642",parent_source_id:"11392",is_project_map:"0",document_type:"601",version_number:"1"};
const groupedBatch = (rows: unknown[]) => ({...batch(),schema_version:2,count:rows.length,projects:rows});
test("groups by parent ID, keeps documents with other statuses and historical versions", () => {
  const result = parseReaderImport("QHOME",groupedBatch([parent,child,{...child,source_id:"12002",status_code:"02",revision_closed:"1"}]));
  assert.equal(result.projects.length,1);
  assert.equal(result.documentCount,2);
  assert.equal(result.projects[0].documents[1].revisionClosed,true);
  assert.equal(result.skipped,0);
});
test("same names do not merge unrelated projects; missing or cyclic links fail", () => {
  assert.equal(parseReaderImport("QHOME",groupedBatch([parent,{...parent,source_id:"42",number:"1880"}])).projects.length,2);
  assert.throws(()=>parseReaderImport("QHOME",groupedBatch([child])),/projectmap/);
  assert.throws(()=>parseReaderImport("QHOME",groupedBatch([{...parent,parent_source_id:"11392"}])),/projectmap/);
  assert.throws(()=>parseReaderImport("QHOME",groupedBatch([{...parent,is_project_map:"0"},child])),/projectmap/);
});
test("status selection belongs to the parent, not the documents", () => {
  assert.equal(parseReaderImport("QHOME",groupedBatch([{...parent,status_code:"02"},child])).projects.length,0);
});
test("reimport marks old child projects without deleting data or moving other companies", async () => {
  const { prisma } = await import("@cohvera/database");
  const { importReaderProjects } = await import("./reader-import");
  const original = prisma.$transaction;
  const updates:any[] = [], roots:any[] = [];
  try {
    (prisma as any).$transaction = async (run:any) => run({
      $executeRaw:async()=>1, company:{findUnique:async()=>({id:"qhome-id",isActive:true})},
      qboxImport:{findUnique:async()=>null,upsert:async()=>({})},
      project:{upsert:async(args:any)=>{roots.push(args);},updateMany:async(args:any)=>{updates.push(args);}},
    });
    const result = await importReaderProjects("QHOME",groupedBatch([parent,child]));
    assert.equal(result.count,1); assert.equal(result.documentCount,1);
    assert.equal(roots[0].update.sourceDocuments[0].sourceId,child.source_id);
    assert.equal(roots[0].update.sourceParentRecordId,null);
    assert.deepEqual(updates[0],{where:{companyId:"qhome-id",externalSource:"PLENION",sourceRecordId:{in:[child.source_id]}},data:{sourceParentRecordId:parent.source_id}});
  } finally {prisma.$transaction = original;}
});

test("Warco profile selects status 07 and groups documents independently of Q-Home", () => {
  const result = parseReaderImport("WARCO", groupedBatch([
    parent, child, {...parent,source_id:"55",number:"999",status_code:"02"}
  ]));
  assert.equal(result.projects.length,1);
  assert.equal(result.projects[0].id,parent.source_id);
  assert.equal(result.documentCount,1);
  assert.equal(result.skipped,1);
});

test("departures preserve first date and returning projects clear it", async () => {
  const {prisma}=await import("@cohvera/database");
  const {importReaderProjects}=await import("./reader-import");
  const original=prisma.$transaction;
  const initial=new Date(Date.now()-60000), departed=new Date(Date.now()-30000);
  let previous:any={sourceKind:"reader_selection",sourceObservedAt:initial,contractVersion:6,digest:"previous"};
  const updates:any[]=[];const roots:any[]=[];
  try {
    (prisma as any).$transaction=async(run:any)=>run({
      $executeRaw:async()=>1,company:{findUnique:async()=>({id:"warco-id",isActive:true})},
      qboxImport:{findUnique:async()=>previous,upsert:async(args:any)=>{previous=args.update;}},
      project:{upsert:async(args:any)=>{roots.push(args);},updateMany:async(args:any)=>{updates.push(args);}},
    });
    const empty={...groupedBatch([]),fetched_at:departed.toISOString()};
    await importReaderProjects("WARCO",empty);
    assert.deepEqual(updates[0],{where:{companyId:"warco-id",externalSource:"PLENION",sourceParentRecordId:null,sourceSeenAt:initial,sourceOutOfSelectionAt:null},data:{sourceOutOfSelectionAt:departed}});
    await importReaderProjects("WARCO",empty);
    assert.equal(updates.length,1);
    await importReaderProjects("WARCO",{...groupedBatch([parent]),fetched_at:new Date().toISOString()});
    assert.equal(roots[0].update.sourceOutOfSelectionAt,null);
    assert.equal(updates[1].where.sourceOutOfSelectionAt,null);
  } finally {prisma.$transaction=original;}
});

const lifecycleBatch = (rows:unknown[])=>({...groupedBatch(rows),schema_version:3});
test("v3 retains invoiced/closed roots and validates dates without guessing a closure date",()=>{
  const parsed=parseReaderImport("WARCO",lifecycleBatch([{...parent,status_code:"09",status_label:"09 - Gefactureerd",out_of_wip:"0",deadline:"20261031",invoice_date:"00000000"},child]));
  assert.equal(parsed.projects.length,1);
  assert.equal(parsed.projects[0].closed,false);
  assert.equal(parsed.projects[0].dates.deadline,"2026-10-31");
  assert.equal(parsed.projects[0].dates.invoice_date,null);
  assert.equal(parsed.documentCount,1);
  assert.equal(parseReaderImport("WARCO",lifecycleBatch([{...parent,out_of_wip:"1"}])).projects.length,1);
  assert.throws(()=>parseReaderImport("WARCO",lifecycleBatch([{...parent,deadline:"20260230"}])));
});
test("v3 establishes baseline, then records changes, rejects downgrade and duplicate events",async()=>{
 const {prisma}=await import("@cohvera/database");
 const {importReaderProjects}=await import("./reader-import");
 const original=prisma.$transaction;
 let previous:any=null,stored:any=null;const events:any[]=[];
 try{
  (prisma as any).$transaction=async(run:any)=>run({
   $executeRaw:async()=>1,company:{findUnique:async()=>({id:"warco-id",isActive:true})},
   qboxImport:{findUnique:async()=>previous,upsert:async(args:any)=>{previous=args.update;}},
   project:{findMany:async(args:any)=>{assert.equal(args.where.companyId,"warco-id");return stored?[stored]:[];},
    upsert:async(args:any)=>{stored={...(stored || args.create),...args.update,id:"root-id",externalId:parent.number};return stored;},updateMany:async()=>({count:0})},
   projectSourceEvent:{createMany:async(args:any)=>events.push(...args.data),create:async(args:any)=>events.push(args.data)},
  });
  const now=Date.now();
  await importReaderProjects("WARCO",{...lifecycleBatch([parent]),fetched_at:new Date(now-30000).toISOString()});
  assert.equal(events.length,0);
  const next={...lifecycleBatch([{...parent,status_code:"09",status_label:"09 - Gefactureerd"},child]),fetched_at:new Date(now).toISOString()};
  await importReaderProjects("WARCO",next);
  assert.equal(stored.sourceIsActive,false);assert.equal(stored.sourceIsClosed,false);
  assert.equal(events.length,2);assert.ok(events.some(e=>e.message.includes("Nieuw gekoppeld record")));
  await importReaderProjects("WARCO",next);assert.equal(events.length,2);
  await assert.rejects(importReaderProjects("WARCO",groupedBatch([parent])),/nieuwste/);
 }finally{prisma.$transaction=original;}
});

test("HFSQL date-times retain source wall time alongside plain dates",()=>{
 const result=parseReaderImport("WARCO",lifecycleBatch([{...parent,created_date:"2018-10-08 05:57:01.530",document_date:"2018-10-08",deadline:"20261031"}]));
 assert.equal(result.projects[0].dates.created_date,"2018-10-08T05:57:01.530");
 assert.equal(result.projects[0].dates.document_date,"2018-10-08");
 assert.equal(result.projects[0].dates.deadline,"2026-10-31");
 for(const raw of ["2018-02-30 05:57:01.530","2018-10-08 25:00:00","2018-10-08 05:60:00","2018-10-08 05:57:60","not a date"])
  assert.throws(()=>parseReaderImport("WARCO",lifecycleBatch([{...parent,created_date:raw}])),/Ongeldige brondatum/);
});

test("NUL padding is removed from root text, nested documents and invoice references",()=>{
 const cleanRows=[{...parent,name:"Résidence",description:"Lijn 1\nLijn 2",invoice_number:"FAK-123"},
  {...child,name:"Ventilatie",description:"Beschrijving",status_label:"01 - Calculatie",invoice_number:"FAK-456"}];
 const dirtyRows=[{...cleanRows[0],name:"Rés\u0000idence\u0000",description:"Lijn 1\u0000\nLijn 2",invoice_number:"FAK-123\u0000"},
  {...cleanRows[1],name:"Ventilatie\u0000",description:"Beschrij\u0000ving",status_label:"01 - Calculatie\u0000",invoice_number:"FAK-456\u0000"}];
 const payload=lifecycleBatch(cleanRows);
 const clean=parseReaderImport("WARCO",payload);
 const dirty=parseReaderImport("WARCO",{...payload,projects:dirtyRows});
 assert.deepEqual(dirty.projects,clean.projects);
 assert.equal(dirty.digest,clean.digest);
 assert.equal(dirty.projects[0].name,"Résidence");
 assert.equal(dirty.projects[0].description,"Lijn 1\nLijn 2");
 assert.equal(dirty.projects[0].documents[0].dates?.invoice_number,"FAK-456");
});
test("NUL normalization cannot silently merge duplicate source IDs",()=>{
 assert.throws(()=>parseReaderImport("WARCO",lifecycleBatch([parent,{...parent,source_id:parent.source_id+"\u0000",number:"999"}])),/dubbele/);
});
