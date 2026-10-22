const fs = require('node:fs');
// Only projects created without any external source/identity; imports are excluded.
const where = {externalSource:null,externalId:null,sourceRecordId:null};
async function removeManualProjects(prisma, {apply=false, backupPath}={}) {
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(71620501)`;
    await tx.$queryRaw`SELECT id FROM "Project" WHERE "externalSource" IS NULL AND "externalId" IS NULL AND "sourceRecordId" IS NULL FOR UPDATE`;
    const projects=await tx.project.findMany({where,include:{company:{select:{code:true}},_count:{select:{tasks:true}}}});
    const tasks=projects.reduce((sum,p)=>sum+p._count.tasks,0);
    const result={applied:false,count:projects.length,tasks,projects:projects.map(p=>({id:p.id,name:p.name,company:p.company.code}))};
    if(!apply)return result;
    if(tasks)throw new Error(`${tasks} gekoppelde taken gevonden. Niets verwijderd; eerst taken veiligstellen.`);
    if(!projects.length)return {...result,applied:true};
    if(!backupPath)throw new Error('Geef --backup /pad/bestand.json op. Niets verwijderd.');
    fs.writeFileSync(backupPath,JSON.stringify({createdAt:new Date().toISOString(),projects},null,2),{flag:'wx',mode:0o600});
    const removed=await tx.project.deleteMany({where:{...where,id:{in:projects.map(p=>p.id)}}});
    return {...result,applied:true,count:removed.count,backupPath};
  },{timeout:60000});
}
module.exports={removeManualProjects};
if(require.main===module){
 const {PrismaClient}=require('@prisma/client');const prisma=new PrismaClient();
 const args=process.argv.slice(2);
 Promise.resolve().then(()=>{
  if(args.length && !(args.length===3 && args[0]==='--apply' && args[1]==='--backup'))throw new Error('Gebruik zonder argumenten voor controle, of --apply --backup /pad/bestand.json.');
  return removeManualProjects(prisma,{apply:args[0]==='--apply',backupPath:args[2]});
 }).then(result=>console.log(JSON.stringify(result,null,2))).catch(error=>{console.error(error.message);process.exitCode=1;}).finally(()=>prisma.$disconnect());
}
