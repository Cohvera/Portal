import {test} from 'node:test';import assert from 'node:assert/strict';
import {readerEvents,connectionState,ingestReaderEvents,QboxMonitorController} from './qbox-monitor';
import {prisma} from '@cohvera/database';
const now=Date.parse('2026-10-23T10:00:00Z');
const event={runId:'e8cc7845-48c6-49e8-b330-eaee4599bcde',phase:'started',observedAt:new Date(now).toISOString(),readerVersion:'3.1'};
test('telemetry validation allows only safe operational fields and bounded batches',()=>{
 const rows=readerEvents({events:[{...event,companyCode:'OTHER',password:'secret',message:'secret',recordCount:10}]},now);
 assert.equal(rows[0].recordCount,10);assert.equal((rows[0] as any).password,undefined);assert.equal((rows[0] as any).companyCode,undefined);
 for(const e of [{...event,phase:'arbitrary log text'},{...event,runId:'x'},{...event,readerVersion:'password'},{...event,recordCount:-1},{...event,observedAt:new Date(now+600000).toISOString()}])assert.throws(()=>readerEvents({events:[e]},now));
 assert.throws(()=>readerEvents({events:Array(101).fill(event)},now));
});
test('old success is not online; missing completion and failures are distinct',()=>{
 const current={phase:'success',observedAt:new Date(now),receivedAt:new Date(now)};
 assert.equal(connectionState(null,null,now),'unknown');assert.equal(connectionState(current,current.receivedAt,now),'healthy');
 assert.equal(connectionState(current,current.receivedAt,now+36*60000),'stale');
 assert.equal(connectionState({...current,phase:'started'},current.receivedAt,now+10*60000),'interrupted');
 assert.equal(connectionState({...current,phase:'read_ok'},current.receivedAt,now),'running');
 assert.equal(connectionState({...current,phase:'read_failed'},current.receivedAt,now),'error');
 assert.equal(connectionState({...current,observedAt:new Date(now-3600000)},current.receivedAt,now),'stale');
});
test('ingest derives company from key context, deduplicates phases and prunes only its own history',async()=>{
 const originalCompany=prisma.company.findUnique,originalTransaction=prisma.$transaction;const calls:any[]=[];
 try{
  (prisma.company as any).findUnique=async()=>({isActive:true});
  (prisma as any).$transaction=async(run:any)=>run({qboxReaderEvent:{createMany:async(args:any)=>calls.push(args),deleteMany:async(args:any)=>calls.push(args)}});
  await ingestReaderEvents('WARCO',{events:[{...event,observedAt:new Date().toISOString(),companyCode:'QHOME'}]});
  assert.equal(calls[0].data[0].companyCode,'WARCO');assert.equal(calls[0].skipDuplicates,true);assert.equal(calls[1].where.companyCode,'WARCO');
 }finally{prisma.company.findUnique=originalCompany;prisma.$transaction=originalTransaction;}
});
test('dashboard queries are all company scoped',async()=>{
 const originalConfig=prisma.qboxReaderConfig.findUnique;
 const originalImport=prisma.qboxImport.findUnique,originalMany=prisma.qboxReaderEvent.findMany,originalFirst=prisma.qboxReaderEvent.findFirst;
 try{
  (prisma.qboxReaderConfig as any).findUnique=async(args:any)=>{assert.equal(args.where.companyCode,'QHOME');return null;};
  (prisma.qboxImport as any).findUnique=async(args:any)=>{assert.equal(args.where.companyCode,'QHOME');return null;};
  (prisma.qboxReaderEvent as any).findMany=async(args:any)=>{assert.equal(args.where.companyCode,'QHOME');return [];};
  (prisma.qboxReaderEvent as any).findFirst=async(args:any)=>{assert.equal(args.where.companyCode,'QHOME');return null;};
  const result=await new QboxMonitorController().get('QHOME');assert.equal(result.state,'unknown');assert.equal(result.columnSelectionEnabled,true);assert.equal(result.columns.length,24);
 }finally{prisma.qboxReaderConfig.findUnique=originalConfig;prisma.qboxImport.findUnique=originalImport;prisma.qboxReaderEvent.findMany=originalMany;prisma.qboxReaderEvent.findFirst=originalFirst;}
});
