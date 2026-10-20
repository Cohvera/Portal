const {test} = require("node:test");
const assert = require("node:assert/strict");
const {undoQhomeImport} = require("./undo-qhome-import.cjs");
function fixture(tasks=0) {
  const calls=[];
  const tx={
    $executeRaw:async()=>1,$queryRaw:async()=>[],
    company:{findUnique:async(args)=>{assert.equal(args.where.code,"QHOME");return {id:"qhome-id"};}},
    project:{count:async()=>4,deleteMany:async(args)=>{calls.push(args);return {count:4};}},
    projectTask:{count:async()=>tasks},
    qboxImport:{deleteMany:async(args)=>{calls.push(args);return {count:1};}},
  };
  return {calls,prisma:{$transaction:async run=>run(tx)}};
}
test("preview never deletes",async()=>{
  const f=fixture(); assert.equal((await undoQhomeImport(f.prisma)).projects,4);assert.equal(f.calls.length,0);
});
test("apply scopes both deletions to QHOME and Plenion",async()=>{
  const f=fixture();assert.equal((await undoQhomeImport(f.prisma,true)).applied,true);
  assert.deepEqual(f.calls,[{where:{companyId:"qhome-id",externalSource:"PLENION"}},{where:{companyCode:"QHOME"}}]);
});
test("linked tasks block the entire cleanup",async()=>{
  const f=fixture(1);await assert.rejects(undoQhomeImport(f.prisma,true),/Niets verwijderd/);assert.equal(f.calls.length,0);
});
