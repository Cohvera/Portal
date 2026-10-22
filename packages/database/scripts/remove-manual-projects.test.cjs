const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const {removeManualProjects}=require('./remove-manual-projects.cjs');
function fixture(tasks=0){
 const deleted=[];const rows=[{id:'manual',name:'Test',company:{code:'WARCO'},_count:{tasks}}];
 return {deleted,prisma:{$transaction:async run=>run({$executeRaw:async()=>1,$queryRaw:async()=>[],project:{findMany:async({where})=>{assert.deepEqual(where,{externalSource:null,externalId:null,sourceRecordId:null});return rows;},deleteMany:async(args)=>{deleted.push(args);return {count:1};}}})}};
}
test('preview keeps all records',async()=>{const f=fixture();assert.equal((await removeManualProjects(f.prisma)).count,1);assert.equal(f.deleted.length,0);});
test('apply backs up and deletes only selected manual IDs',async()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'manual-projects-'));try{const f=fixture();const backupPath=path.join(dir,'backup.json');await removeManualProjects(f.prisma,{apply:true,backupPath});assert.equal(JSON.parse(fs.readFileSync(backupPath)).projects[0].id,'manual');assert.deepEqual(f.deleted[0].where,{externalSource:null,externalId:null,sourceRecordId:null,id:{in:['manual']}});}finally{fs.rmSync(dir,{recursive:true,force:true});}});
test('linked tasks block deletion',async()=>{const f=fixture(1);await assert.rejects(removeManualProjects(f.prisma,{apply:true}),/Niets verwijderd/);assert.equal(f.deleted.length,0);});
test('missing backup blocks deletion',async()=>{const f=fixture();await assert.rejects(removeManualProjects(f.prisma,{apply:true}),/backup/);assert.equal(f.deleted.length,0);});
