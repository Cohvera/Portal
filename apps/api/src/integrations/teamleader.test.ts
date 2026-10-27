import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateTeamleader,verifyTeamleaderKey} from './teamleader';
const project={id:'12345678-1234-1234-1234-123456789abc',name:'Test',status:'active',reference:'PRO-1',description:'',start_date:null,deadline:'2026-11-30'};
const snapshot=()=>({source:'TEAMLEADER',version:1,complete:true,mode:'legacy',fetched_at:new Date().toISOString(),projects:[{...project}]});
test('validates complete legacy and v2 project snapshots',()=>{
 assert.equal(validateTeamleader(snapshot()).projects[0].name,'Test');
 const s=snapshot();s.mode='v2';s.projects[0].status='closed';assert.equal(validateTeamleader(s).projects[0].status,'closed');
});
test('rejects incomplete, duplicate, stale, malformed and unknown statuses',()=>{
 for(const patch of [{complete:false},{projects:[project,project]},{fetched_at:'2000-01-01'},{projects:[{...project,deadline:'2026-02-30'}]},{projects:[{...project,name:'bad\0name'}]},{projects:[{...project,status:'mystery'}]}]) assert.throws(()=>validateTeamleader({...snapshot(),...patch}));
});
test('key scopes imports to QHOME and rejects other credentials',()=>{
 const old=process.env.TEAMLEADER_IMPORT_KEY_QHOME;
 try {process.env.TEAMLEADER_IMPORT_KEY_QHOME='a'.repeat(43);assert.equal(verifyTeamleaderKey('a'.repeat(43)),'QHOME');assert.throws(()=>verifyTeamleaderKey('b'.repeat(43)));assert.throws(()=>verifyTeamleaderKey(undefined));}
 finally {if(old===undefined) delete process.env.TEAMLEADER_IMPORT_KEY_QHOME;else process.env.TEAMLEADER_IMPORT_KEY_QHOME=old;}
});

test('repeated imports preserve local fields and other companies/sources; older snapshots fail',async()=>{
 const {prisma}=await import('@cohvera/database');
 const {importTeamleaderProjects}=await import('./teamleader');
 const original=prisma.$transaction;
 const records:any[]=[{companyId:'warco',externalSource:'PLENION',externalId:project.id,name:'Untouched'},{companyId:'qhome',externalSource:'TEAMLEADER',externalId:project.id,owner:'Milan',customer:'Klant',tasks:['task-1']}];
 try{
  (prisma as any).$transaction=async(callback:any)=>callback({
   $executeRaw:async()=>{},company:{findUnique:async()=>({id:'qhome',isActive:true})},
   project:{findFirst:async()=>records.find(r=>r.companyId==='qhome'&&r.externalSource==='TEAMLEADER'),upsert:async({where,create,update}:any)=>{const key=where.companyId_externalSource_externalId;const existing=records.find(r=>Object.entries(key).every(([k,v])=>r[k]===v));if(existing)Object.assign(existing,update);else records.push(create);}},
  });
  const s=snapshot();await importTeamleaderProjects('QHOME',s);await importTeamleaderProjects('QHOME',s);
  assert.equal(records.length,2);assert.equal(records[0].name,'Untouched');assert.equal(records[1].owner,'Milan');assert.deepEqual(records[1].tasks,['task-1']);assert.equal(records[1].customer,'Klant');
  await assert.rejects(()=>importTeamleaderProjects('WARCO',s));
  await assert.rejects(()=>importTeamleaderProjects('QHOME',{...s,fetched_at:new Date(Date.parse(s.fetched_at)-1000).toISOString()}));
 }finally{prisma.$transaction=original;}
});
