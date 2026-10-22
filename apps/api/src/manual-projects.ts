import {ConflictException, ForbiddenException, NotFoundException} from '@nestjs/common';
import {prisma} from '@cohvera/database';
export async function deleteManualProject(companyCode:string,id:string){
 return prisma.$transaction(async tx=>{
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(71620501)`;
  await tx.$queryRaw`SELECT id FROM "Project" WHERE id = ${id} FOR UPDATE`;
  const project=await tx.project.findFirst({where:{id,company:{code:companyCode}}});
  if(!project)throw new NotFoundException('Project niet gevonden binnen dit bedrijf.');
  if(project.externalSource!==null || project.externalId!==null || project.sourceRecordId!==null)
   throw new ForbiddenException('Geïmporteerde projecten kun je hier niet verwijderen.');
  if(await tx.projectTask.count({where:{projectId:id}}))
   throw new ConflictException('Dit project heeft gekoppelde taken. Verplaats of verwijder die eerst.');
  await tx.project.delete({where:{id}});
  return {deleted:true};
 });
}
