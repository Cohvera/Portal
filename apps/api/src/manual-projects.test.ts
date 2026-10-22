import {test} from 'node:test';import assert from 'node:assert/strict';
import {prisma} from '@cohvera/database';import {deleteManualProject} from './manual-projects';
test('individual deletion is company scoped and blocks imported projects and tasks',async()=>{
 const original=prisma.$transaction;let calls=0;let source:string|null=null;let tasks=0;let exists=true;
 try{
  (prisma as any).$transaction=async(fn:any)=>fn({$executeRaw:async()=>1,$queryRaw:async()=>[],project:{findFirst:async(args:any)=>{assert.deepEqual(args.where,{id:'p',company:{code:'WARCO'}});return exists?{externalSource:source,externalId:null,sourceRecordId:null}:null;},delete:async()=>{calls++;}},projectTask:{count:async()=>tasks}});
  await deleteManualProject('WARCO','p');assert.equal(calls,1);
  source='PLENION';await assert.rejects(deleteManualProject('WARCO','p'),/Geïmporteerde/);
  source=null;tasks=1;await assert.rejects(deleteManualProject('WARCO','p'),/gekoppelde taken/);
  tasks=0;exists=false;await assert.rejects(deleteManualProject('WARCO','p'),/niet gevonden/);
  assert.equal(calls,1);
 }finally{prisma.$transaction=original;}
});
