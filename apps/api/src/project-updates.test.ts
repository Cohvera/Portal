import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prisma} from '@cohvera/database';
import {ProjectsController} from './projects';
test('updates exclude old receipt notices before pagination and retain real changes',async()=>{
 const original=prisma.projectSourceEvent.findMany;
 try{
  (prisma.projectSourceEvent as any).findMany=async({where,take}:any)=>{
   assert.equal(where.project.company.code,'WARCO');assert.equal(take,200);
   for(const message of ['Nieuw hoofdproject ontvangen','Hoofdproject opnieuw ontvangen','Hoofdproject niet meer in readerselectie; afsluiting niet bevestigd','Hoofdproject niet meer aangeleverd; afsluiting niet bevestigd'])assert.ok(where.message.notIn.includes(message));
   const message='Projectstatus: 02 - Offerte → 07 - In Uitvoering';assert.ok(!where.message.notIn.includes(message));return [{message}];
  };
  assert.equal((await new ProjectsController().updates('WARCO')).length,1);
 }finally{prisma.projectSourceEvent.findMany=original;}
});
