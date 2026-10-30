import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prisma} from '@cohvera/database';
import {CatalogController} from './catalog';
import {authContext,type AuthContext} from './auth/context';
import {toolMatchesCompany} from '../../web/lib/tool-companies';
test('tool visibility can be disabled everywhere and restored per company, only by portal admins',async()=>{
 const transaction=prisma.$transaction,count=prisma.company.count;
 const controller=new CatalogController();let writes=0;let saved:string[]=[];
 const actor={id:'admin',isActive:true,memberships:[]} as unknown as AuthContext['actor'];
 const run=(roles:string[],body:unknown,id='inspections')=>authContext.run({actor,roles,mode:'entra'},()=>controller.assign(id,body));
 try{
  (prisma.company as any).count=async({where}:any)=>where.code.in.filter((c:string)=>['WARCO','QHOME'].includes(c)).length;
  (prisma as any).$transaction=async(fn:any)=>fn({toolCatalog:{findUnique:async()=>null,upsert:async(args:any)=>{writes++;saved=args.update.companyCodes;return {id:args.where.id,companyCodes:saved};}},company:{findUniqueOrThrow:async()=>({id:'coh'})},auditLog:{create:async()=>({})}});
  await assert.rejects(run(['Portal.User'],{companyCodes:[]}),/portaalbeheerder/);assert.equal(writes,0);
  await run(['Portal.Admin'],{companyCodes:[]});assert.deepEqual(saved,[]);
  assert.equal(toolMatchesCompany('inspections','WARCO',{inspections:saved}),false);
  await run(['Portal.Admin'],{companyCodes:['WARCO']});
  assert.equal(toolMatchesCompany('inspections','WARCO',{inspections:saved}),true);
  assert.equal(toolMatchesCompany('inspections','QHOME',{inspections:saved}),false);
  await assert.rejects(run(['Portal.Admin'],{companyCodes:['UNKNOWN']}),/Onbekend/);
  await assert.rejects(run(['Portal.Admin'],{companyCodes:[]},'unknown-tool'),/Onbekende tool/);
  assert.equal(writes,2);
 }finally{prisma.$transaction=transaction;prisma.company.count=count;}
});
