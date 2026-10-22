const fs=require('node:fs');
const fields=['id','companyId','name','customer','owner','status','statusColor','dueDate','externalSource','externalId','sourceStatusLabel','sourceIsClosed','sourceIsActive','sourceRecordId','sourceParentRecordId','sourceStatusCode','sourceDates','sourceDocuments','sourceDescription','sourcePlannedAt','sourceOutOfSelectionAt','sourceSeenAt'];
async function restoreManualProjects(prisma,backup,{apply=false}={}){
 if(!backup || !Array.isArray(backup.projects))throw new Error('Geen geldige projectback-up. Gebruik het volledige JSON-bestand, niet de terminaluitvoer.');
 const ids=new Set();
 for(const p of backup.projects){
  if(!p || typeof p.id!=='string' || !p.id || ids.has(p.id) || !p.company?.code || !p.companyId || !['name','customer','owner','status','statusColor'].every(k=>typeof p[k]==='string') || p.externalSource!=null || p.externalId!=null || p.sourceRecordId!=null || p._count?.tasks!==0)throw new Error('Back-up bevat ongeldige, dubbele, geïmporteerde of onvolledige projecten. Niets hersteld.');
  ids.add(p.id);
 }
 return prisma.$transaction(async tx=>{
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(71620501)`;
  const restored=[],skipped=[];
  for(const p of backup.projects){
   const company=await tx.company.findUnique({where:{code:p.company.code}});
   if(!company || company.id!==p.companyId)throw new Error(`Bedrijf van ${p.id} komt niet overeen met de back-up. Niets hersteld.`);
   const existing=await tx.project.findUnique({where:{id:p.id}});
   if(existing){
    if(existing.companyId!==p.companyId)throw new Error(`ID-conflict bij ${p.id}. Niets hersteld.`);
    skipped.push({id:p.id,name:p.name,reason:'Bestaat al; niet overschreven'});continue;
   }
   const data={};
   for(const field of fields){
    if(p[field]===undefined || ((field==='sourceDates'||field==='sourceDocuments') && p[field]===null))continue;
    data[field]=p[field];
   }
   for(const field of ['dueDate','sourcePlannedAt','sourceOutOfSelectionAt','sourceSeenAt']){
    if(data[field]!=null){const date=new Date(data[field]);if(!Number.isFinite(date.getTime()))throw new Error('Ongeldige datum in back-up.');data[field]=date;}
   }
   if(apply)await tx.project.create({data});
   restored.push({id:p.id,name:p.name,company:p.company.code});
  }
  return {applied:apply,count:restored.length,projects:restored,skipped};
 },{timeout:60000});
}
module.exports={restoreManualProjects};
if(require.main===module){
 const {PrismaClient}=require('@prisma/client');const prisma=new PrismaClient();const args=process.argv.slice(2);
 Promise.resolve().then(()=>{
  if(!args[0] || args.length>2 || (args[1] && args[1]!=='--apply'))throw new Error('Gebruik: node restore-manual-projects.cjs /backup/bestand.json [--apply]');
  return restoreManualProjects(prisma,JSON.parse(fs.readFileSync(args[0],'utf8')),{apply:args[1]==='--apply'});
 }).then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>prisma.$disconnect());
}
