import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prisma} from '@cohvera/database';
import {requestReaderSync,pollReaderCommand} from './qbox-commands';
test('sync requests are company scoped, coalesced, and acknowledged only by matching id',async()=>{
 const originals=[prisma.company.findUnique,prisma.qboxReaderConfig.findUnique,prisma.qboxReaderConfig.updateMany,prisma.qboxReaderConfig.upsert];
 let active=true;
 const configs:any={WARCO:{companyCode:'WARCO',commandPollAt:null,syncRequestId:null,syncAcknowledgedId:null},QHOME:{companyCode:'QHOME',commandPollAt:null,syncRequestId:null,syncAcknowledgedId:null}};
 try{
  (prisma.company as any).findUnique=async()=>({isActive:active});
  (prisma.qboxReaderConfig as any).findUnique=async({where}:any)=>({...configs[where.companyCode]});
  (prisma.qboxReaderConfig as any).upsert=async({where,update}:any)=>Object.assign(configs[where.companyCode],update);
  (prisma.qboxReaderConfig as any).updateMany=async({where,data}:any)=>{
   const row=configs[where.companyCode];if(row.syncRequestId!==where.syncRequestId)return {count:0};
   Object.assign(row,data);return {count:1};
  };
  await assert.rejects(()=>requestReaderSync('WARCO'));
  assert.equal((await pollReaderCommand('WARCO',{})).requestId,null);
  const first=await requestReaderSync('WARCO');
  assert.deepEqual(await requestReaderSync('WARCO'),first);
  assert.deepEqual(await pollReaderCommand('WARCO',{}),first);
  assert.equal((await pollReaderCommand('QHOME',{acknowledgedId:first.requestId})).requestId,null);
  assert.equal(configs.WARCO.syncAcknowledgedId,null);
  assert.equal((await pollReaderCommand('WARCO',{acknowledgedId:first.requestId})).requestId,null);
  const next=await requestReaderSync('WARCO');assert.notEqual(next.requestId,first.requestId);
  assert.deepEqual(await pollReaderCommand('WARCO',{acknowledgedId:first.requestId}),next);
  await assert.rejects(()=>pollReaderCommand('WARCO',{acknowledgedId:'shell command'}));
  active=false;
  await assert.rejects(()=>pollReaderCommand('WARCO',{}));
  await assert.rejects(()=>requestReaderSync('WARCO'));
 }finally{[prisma.company.findUnique,prisma.qboxReaderConfig.findUnique,prisma.qboxReaderConfig.updateMany,prisma.qboxReaderConfig.upsert]=originals as any;}
});
