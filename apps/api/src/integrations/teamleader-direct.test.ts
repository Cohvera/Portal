import {test,afterEach,beforeEach,mock} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {prisma} from '@cohvera/database';
import {authContext} from '../auth/context';
import {PortalGuard} from '../auth/guard';
import {TeamleaderImportController} from './teamleader';
import {TeamleaderDirectController,TeamleaderScheduler} from './teamleader-direct';
import {exchangeToken,fetchTeamleaderProjects,openToken,sealToken} from './teamleader-client';
const names=['TEAMLEADER_CLIENT_ID','TEAMLEADER_CLIENT_SECRET','TEAMLEADER_TOKEN_ENCRYPTION_KEY','TEAMLEADER_IMPORT_KEY_QHOME','AUTH_MODE','WEB_URL'];
let saved:(string|undefined)[];
const restorers:(()=>void)[]=[];
function stub(obj:any,key:string,fn:any){const old=obj[key];const wrapped=mock.fn(fn);obj[key]=wrapped;restorers.push(()=>{obj[key]=old;});return wrapped;}
beforeEach(()=>{saved=names.map(k=>process.env[k]);Object.assign(process.env,{TEAMLEADER_CLIENT_ID:'client',TEAMLEADER_CLIENT_SECRET:'secret',TEAMLEADER_TOKEN_ENCRYPTION_KEY:'ab'.repeat(32),TEAMLEADER_IMPORT_KEY_QHOME:'a'.repeat(43),AUTH_MODE:'development',WEB_URL:'http://localhost:3000'});});
afterEach(()=>{mock.restoreAll();while(restorers.length)restorers.pop()!();names.forEach((k,i)=>{if(saved[i]===undefined)delete process.env[k];else process.env[k]=saved[i];});});
const actor=(manage=true)=>({mode:'development',roles:['Portal.User'],actor:{id:'user-1',isActive:true,memberships:[{company:{code:'QHOME',isActive:true},role:{key:'member',permissions:[{permission:{key:'projects.read'}},...(manage?[{permission:{key:'projects.manage'}}]:[])]}}]}} as any);
const row=(id=1)=>({id:`${String(id).padStart(8,'0')}-1234-1234-1234-123456789abc`,title:'Testwoning',reference:'PRO-1',status:'active',starts_on:null,due_on:'2026-11-30'});
test('authenticated token encryption rejects tampering and wrong key',()=>{
 const encrypted=sealToken('private-token');assert(!encrypted.includes('private-token'));assert.equal(openToken(encrypted),'private-token');assert.notEqual(encrypted,sealToken('private-token'));
 const pieces=encrypted.split('.');pieces[2]=Buffer.from('changed').toString('base64url');assert.throws(()=>openToken(pieces.join('.')));
 process.env.TEAMLEADER_TOKEN_ENCRYPTION_KEY='cd'.repeat(32);assert.throws(()=>openToken(encrypted));
});
test('legacy/v2 pagination is complete and duplicates/errors abort',async()=>{
 let calls=0;const snapshot=await fetchTeamleaderProjects('legacy',async(_endpoint,body:any)=>{calls++;assert.equal(body.page.number,calls);return {data:calls===1?Array.from({length:100},(_,i)=>row(i)):calls===2?[row(101)]:[]};});assert.equal(snapshot.projects.length,101);assert.equal(calls,3);
 const v2=await fetchTeamleaderProjects('v2',async(endpoint,body:any)=>{assert.equal(endpoint,'projects-v2/projects.list');return {data:body.page.number===1?[{...row(),status:'closed',project_key:42,start_date:'2026-10-01',end_date:null}]:[]};});assert.equal(v2.projects[0].reference,'42');
 await assert.rejects(()=>fetchTeamleaderProjects('legacy',async()=>({data:[row(),row()]})));
 await assert.rejects(()=>fetchTeamleaderProjects('legacy',async(_e,b:any)=>{if(b.page.number===2)throw new Error('outage');return {data:[row()]};}));
});
test('OAuth uses fixed endpoint and stores rotated refresh token; errors hide bodies',async()=>{
 mock.method(globalThis,'fetch',async(url:any,init:any)=>{assert.equal(String(url),'https://focus.teamleader.eu/oauth2/access_token');assert.equal(init.redirect,'error');return new Response(JSON.stringify({access_token:'access',refresh_token:'rotated',expires_in:3600}));});
 const token=await exchangeToken({grant_type:'refresh_token',refresh_token:'old'});assert.equal(openToken(token.refreshToken),'rotated');
 mock.restoreAll();mock.method(globalThis,'fetch',async()=>new Response('secret-response',{status:401}));await assert.rejects(()=>exchangeToken({grant_type:'refresh_token'}),e=>e instanceof Error&&!e.message.includes('secret-response'));
});
test('import key cannot operate direct OAuth or sync routes',async()=>{
 const run=(controller:any,headers:any)=>new PortalGuard().canActivate({switchToHttp:()=>({getRequest:()=>({path:'/companies/QHOME/middleware/teamleader/sync',method:'POST',headers,is:()=>true})}),getClass:()=>controller} as any);
 assert.equal(await run(TeamleaderImportController,{'x-teamleader-key':'a'.repeat(43)}),true);
 await assert.rejects(()=>run(TeamleaderDirectController,{'x-teamleader-key':'a'.repeat(43)}));
 await assert.rejects(()=>run(TeamleaderImportController,{'x-teamleader-key':'a'.repeat(43),'x-qbox-key':'b'.repeat(43)}));
});
test('OAuth state is user-bound, expiring and single-use; status never exposes credentials',async()=>{
 const record:any={companyCode:'QHOME',mode:'legacy',stateHash:createHash('sha256').update('x'.repeat(43)).digest('hex'),stateActorId:'user-1',stateExpiresAt:new Date(Date.now()+60000),accessToken:null};
 stub(prisma.teamleaderConnection,'updateMany',async({where,data}:any)=>{if(where.stateHash&&(where.stateHash!==record.stateHash||where.stateActorId!==record.stateActorId||record.stateExpiresAt<=where.stateExpiresAt.gt))return {count:0};if(where.leaseId&&where.leaseId!==record.leaseId)return {count:0};Object.assign(record,data);return {count:1};});
 stub(prisma.teamleaderConnection,'findUnique',async()=>record);stub(prisma.teamleaderSyncRun,'findMany',async()=>[]);
 mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify({access_token:'access',refresh_token:'refresh',expires_in:3600})));
 const controller=new TeamleaderDirectController(new TeamleaderScheduler()),response:any={redirect:mock.fn()};
 await authContext.run(actor(),async()=>{
  await assert.rejects(()=>controller.callback('QHOME','y'.repeat(43),'code',undefined,response));
  record.stateActorId='another';await assert.rejects(()=>controller.callback('QHOME','x'.repeat(43),'code',undefined,response));record.stateActorId='user-1';
  record.stateExpiresAt=new Date(0);await assert.rejects(()=>controller.callback('QHOME','x'.repeat(43),'code',undefined,response));record.stateExpiresAt=new Date(Date.now()+60000);
  await controller.callback('QHOME','x'.repeat(43),'code',undefined,response);assert.equal(openToken(record.refreshToken),'refresh');assert.equal(record.stateHash,null);assert(record.nextSyncAt);
  await assert.rejects(()=>controller.callback('QHOME','x'.repeat(43),'code',undefined,response));
  const status=JSON.stringify(await controller.status('QHOME'));for(const key of ['accessToken','refreshToken','stateHash'])assert(!status.includes(key));
 });
 await authContext.run(actor(false),async()=>{await assert.rejects(()=>controller.connect('QHOME',{mode:'legacy'}));await assert.rejects(()=>controller.sync('QHOME'));await assert.rejects(()=>controller.disconnect('QHOME'));});
 await authContext.run(actor(),async()=>{await assert.rejects(()=>controller.connect('WARCO',{mode:'legacy'}));});
});
test('scheduler is optional and claims a company-specific lease to prevent overlap',async()=>{
 const scheduler=new TeamleaderScheduler();let runs=0;mock.method(scheduler as any,'run',async()=>{runs++;});stub(prisma.company,'findUnique',async()=>({isActive:true} as any));let locked=false;
 stub(prisma.teamleaderConnection,'updateMany',async({where,data}:any)=>{assert.equal(where.companyCode,'QHOME');assert(where.OR);if(locked)return {count:0};locked=true;assert(data.leaseId);return {count:1};});
 await Promise.all([scheduler.start(false),scheduler.start(false)]);assert.equal(runs,1);await assert.rejects(()=>scheduler.start());
 delete process.env.TEAMLEADER_CLIENT_ID;const find=stub(prisma.teamleaderConnection,'findUnique',async()=>{throw new Error('should not access DB');});await scheduler.tick();assert.equal(find.mock.callCount(),0);
});
test('partial export never imports projects and schedules a retry',async()=>{
 const scheduler=new TeamleaderScheduler(),now=new Date();const record:any={companyCode:'QHOME',mode:'legacy',leaseId:'lease',leaseUntil:new Date(Date.now()+720000),accessToken:sealToken('token'),refreshToken:sealToken('refresh'),expiresAt:new Date(Date.now()+3600000)};
 stub(prisma.teamleaderConnection,'findUniqueOrThrow',async()=>record);let page=0;mock.method(globalThis,'fetch',async(url:any)=>String(url).endsWith('/accounts.projects-v2-status')?new Response(JSON.stringify({data:{status:'legacy'}})):++page===1?new Response(JSON.stringify({data:[row()]})):new Response('error',{status:500}));
 let writes=0,result:any;stub(prisma,'$transaction',async(callback:any)=>callback({teamleaderConnection:{updateMany:async({data}:any)=>{result=data;return {count:1};}},teamleaderSyncRun:{create:async()=>{},deleteMany:async()=>{}},project:{upsert:async()=>{writes++;}}}) as any);
 await (scheduler as any).run('lease',now);assert.equal(writes,0);assert.match(result.lastError,/HTTP 500/);assert.equal(result.leaseId,null);assert(result.nextSyncAt>now);
});

test('first sync corrects legacy to detected v2, but existing projects prevent a silent migration',async()=>{
 for(const existing of [0,1]) {
  const scheduler=new TeamleaderScheduler(),now=new Date();
  const record:any={companyCode:'QHOME',mode:'legacy',leaseId:'lease',leaseUntil:new Date(Date.now()+720000),accessToken:sealToken('token'),refreshToken:sealToken('refresh'),expiresAt:new Date(Date.now()+3600000),lastSuccessAt:null};
  stub(prisma.teamleaderConnection,'findUniqueOrThrow',async()=>record);
  stub(prisma.project,'count',async()=>existing);
  stub(prisma.teamleaderConnection,'updateMany',async({data}:any)=>{Object.assign(record,data);return {count:1};});
  const paths:string[]=[];
  mock.method(globalThis,'fetch',async(url:any)=>{paths.push(String(url));if(String(url).endsWith('/accounts.projects-v2-status'))return new Response(JSON.stringify({data:{status:'projects-v2'}}));return new Response('unavailable',{status:503});});
  let result:any;
  stub(prisma,'$transaction',async(callback:any)=>callback({teamleaderConnection:{updateMany:async({data}:any)=>{result=data;return {count:1};}},teamleaderSyncRun:{create:async()=>{},deleteMany:async()=>{}}}) as any);
  await (scheduler as any).run('lease',now);
  if(existing){assert.equal(record.mode,'legacy');assert.equal(paths.length,1);assert.match(result.lastError,/Migreer/);}
  else {assert.equal(record.mode,'v2');assert(paths[1].endsWith('/projects-v2/projects.list'));assert.match(result.lastError,/nieuwe projecten/);}
  mock.restoreAll();while(restorers.length)restorers.pop()!();
 }
});
