import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {Request,Response} from 'express';
import {prisma} from '@cohvera/database';
import {hashToken,opaqueToken,requestContext} from './session';

const tenant='11111111-1111-4111-8111-111111111111';
test('persistent login survives old creation dates, renews its cookie and still respects revocation and account restrictions',async()=>{
 const keys=['AUTH_MODE','ENTRA_TENANT_ID','ENTRA_CLIENT_ID','ENTRA_CLIENT_SECRET','ENTRA_REDIRECT_URI','ENTRA_SESSION_MINUTES'];
 const previous=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 const original=prisma.portalSession.findUnique;
 const token=opaqueToken();
 const req={headers:{cookie:`cohvera_session=${token}`},path:'/auth/me'} as Request;
 const cookies:any[]=[];
 const res={cookie:(...args:any[])=>cookies.push(args)} as unknown as Response;
 let stored:any={expiresAt:null,createdAt:new Date('2020-01-01'),roles:['Portal.User'],tenantId:tenant,user:{id:'user',isActive:true,entraTenantId:tenant}};
 try{
  Object.assign(process.env,{AUTH_MODE:'entra',ENTRA_TENANT_ID:tenant,ENTRA_CLIENT_ID:'22222222-2222-4222-8222-222222222222',ENTRA_CLIENT_SECRET:'synthetic',ENTRA_REDIRECT_URI:'https://portal.example/auth/callback',ENTRA_SESSION_MINUTES:'15'});
  (prisma.portalSession as any).findUnique=async(args:any)=>{assert.equal(args.where.tokenHash,hashToken(token));return stored;};
  const authenticated=await requestContext(req,res);
  assert.equal(authenticated.actor?.id,'user');
  assert.equal(authenticated.sessionHash,hashToken(token));
  assert.equal(cookies.length,1);
  assert.deepEqual(cookies[0],["cohvera_session",token,{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:400*86400000}]);
  cookies.length=0;
  await requestContext({...req,path:'/auth/logout'} as Request,res);
  assert.equal(cookies.length,0);
  const valid=stored;
  for(const rejected of [null,{...valid,expiresAt:new Date(0)},{...valid,user:{...valid.user,isActive:false}},{...valid,roles:[]},{...valid,tenantId:'other'},{...valid,user:{...valid.user,entraTenantId:'other'}}]){
   stored=rejected;
   assert.equal((await requestContext(req,res)).actor,null);
   assert.equal(cookies.length,0);
  }
  stored=valid;
  assert.equal((await requestContext({...req,headers:{cookie:`cohvera_session=${token}; cohvera_session=${token}`}} as Request,res)).actor,null);
  assert.equal(cookies.length,0);
 }finally{
  prisma.portalSession.findUnique=original;
  for(const key of keys){if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];}
 }
});
