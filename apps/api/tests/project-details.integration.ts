import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@cohvera/database";

const base = process.env.TEST_API_URL;
test("projects validate fields, persist edits and isolate companies", {skip: !base}, async () => {
  const call = async (path: string, method="GET", body?: unknown) => {
    const response = await fetch(`${base}${path}`, {method,headers:{"Content-Type":"application/json"},body:body===undefined?undefined:JSON.stringify(body)});
    return {status:response.status,data:await response.json()};
  };
  const input = {name:"Integration test project",owner:"Milan",status:"Gepland",statusColor:"#64748b",dueDate:"2026-10-15"};
  for (const invalid of [{name:" "},{name:"x".repeat(201)},{status:"Unknown"},{statusColor:"red"},{owner:" "},{dueDate:"2026-02-30"}]) {
    assert.equal((await call("/companies/COH/projects","POST",{...input,...invalid})).status,400);
  }
  assert.equal((await call("/companies/UNKNOWN/projects","POST",input)).status,404);
  const created = await call("/companies/COH/projects","POST",input);
  assert.equal(created.status,201);
  const id=created.data.id;
  try {
    let projects = await call("/companies/COH/projects");
    let saved=projects.data.find((p: {id:string})=>p.id===id);
    assert.equal(saved.name,input.name);
    assert.equal(saved.statusColor,input.statusColor);
    assert.equal(saved.owner,input.owner);
    assert.equal(saved.dueDate.slice(0,10),input.dueDate);
    assert.deepEqual(saved.tasks,[]);
    assert.ok(!(await call("/companies/QHOME/projects")).data.some((p:{id:string})=>p.id===id));
    assert.equal((await call(`/companies/QHOME/projects/${id}`,"PATCH",input)).status,404);
    assert.equal((await call(`/companies/COH/projects/${id}`,"PATCH",{...input,status:"Afgerond",statusColor:"#16834b",dueDate:null})).status,200);
    projects=await call("/companies/COH/projects");saved=projects.data.find((p:{id:string})=>p.id===id);
    assert.equal(saved.status,"Afgerond");assert.equal(saved.dueDate,null);assert.equal(saved.statusColor,"#16834b");
  } finally {
    await prisma.project.delete({where:{id}});
    await prisma.$disconnect();
  }
});
