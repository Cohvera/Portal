import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@cohvera/database";
import { requireAccountAdmin } from "../src/accounts";

const base=process.env.TEST_API_URL;
test("accounts persist roles, reject invalid input and preserve administrators",{skip:!base},async()=>{
  const call=async(path:string,method="GET",body?:unknown)=>{
    const r=await fetch(`${base}/admin/accounts${path}`,{method,headers:{"Content-Type":"application/json"},body:body===undefined?undefined:JSON.stringify(body)});
    return {status:r.status,data:await r.json()};
  };
  const overview=await call("");assert.equal(overview.status,200);
  const {roles,companies,actorId}=overview.data;
  const viewer=roles.find((r:{key:string})=>r.key==="viewer");
  const manager=roles.find((r:{key:string})=>r.key==="manager");
  const admin=roles.find((r:{key:string})=>r.key==="portal-admin");
  const company=companies.find((c:{code:string})=>c.code==="COH");
  const email=`accounts-test-${Date.now()}@example.invalid`;
  const input={displayName:"Test account",email,isActive:true,memberships:[{companyId:company.id,roleId:viewer.id}]};
  const ids:string[]=[];let extraCompanyId:string|undefined;
  try{
    for(const invalid of [{displayName:" "},{email:"invalid"},{isActive:"yes"},{memberships:[]},{memberships:[{companyId:"missing",roleId:viewer.id}]},{memberships:[{companyId:company.id,roleId:"missing"}]},{memberships:[...input.memberships,...input.memberships]}]) assert.equal((await call("","POST",{...input,...invalid})).status,400);
    const created=await call("","POST",input);assert.equal(created.status,201);ids.push(created.data.id);
    assert.equal((await call("","POST",{...input,email:email.toUpperCase()})).status,409);
    assert.equal((await call(`/${actorId}`,"PATCH",{...input,isActive:false})).status,403);
    assert.equal((await call("/missing","PATCH",input)).status,404);
    const updated=await call(`/${created.data.id}`,"PATCH",{...input,isActive:false,memberships:[{companyId:company.id,roleId:manager.id}]});
    assert.equal(updated.status,200);assert.equal(updated.data.isActive,false);assert.equal(updated.data.memberships[0].role.key,"manager");
    const saved=(await call("")).data.users.find((u:{id:string})=>u.id===created.data.id);
    assert.equal(saved.isActive,false);
    assert.equal(await prisma.auditLog.count({where:{entityId:created.data.id,action:{in:["account.created","account.updated"]}}}),2);
    const temporary=await prisma.company.create({data:{code:`TEST-${Date.now()}`,name:"Temporary account test company"}});extraCompanyId=temporary.id;
    const sole=await call("","POST",{...input,email:`admin-${email}`,memberships:[{companyId:temporary.id,roleId:admin.id}]});assert.equal(sole.status,201);ids.push(sole.data.id);
    assert.equal((await call(`/${sole.data.id}`,"PATCH",{...input,email:`admin-${email}`,isActive:false,memberships:[]})).status,409);
    const originalMode=process.env.AUTH_MODE;
    try{process.env.AUTH_MODE="production";await assert.rejects(()=>requireAccountAdmin(),/geconfigureerde aanmelding/);}finally{process.env.AUTH_MODE=originalMode;}
  }finally{
    await prisma.auditLog.deleteMany({where:{entityId:{in:ids}}});
    await prisma.user.deleteMany({where:{id:{in:ids}}});
    if(extraCompanyId)await prisma.company.delete({where:{id:extraCompanyId}});
    await prisma.$disconnect();
  }
});
