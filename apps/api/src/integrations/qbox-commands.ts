import {BadRequestException,ConflictException,ForbiddenException} from '@nestjs/common';
import {randomUUID} from 'node:crypto';
import {prisma} from '@cohvera/database';
async function activeCompany(companyCode:string){
 const company=await prisma.company.findUnique({where:{code:companyCode},select:{isActive:true}});
 if(!company?.isActive)throw new ForbiddenException('Bedrijf niet actief.');
}
export async function requestReaderSync(companyCode:string){
 await activeCompany(companyCode);
 const current=await prisma.qboxReaderConfig.findUnique({where:{companyCode}});
 if(!current?.commandPollAt)throw new ConflictException('Deze Q-box ondersteunt starten vanuit Portal nog niet. Werk de reader eenmalig bij.');
 if(current.syncRequestId&&current.syncRequestId!==current.syncAcknowledgedId)return {requestId:current.syncRequestId};
 const requestId=randomUUID();
 const result=await prisma.qboxReaderConfig.updateMany({where:{companyCode,syncRequestId:current.syncRequestId},data:{syncRequestId:requestId,syncRequestedAt:new Date()}});
 if(!result.count)throw new ConflictException('Er is al een sync aangevraagd. Vernieuw de status.');
 return {requestId};
}
export async function pollReaderCommand(companyCode:string,input:unknown){
 const body=input as {acknowledgedId?:unknown};
 if(!body||typeof body!=='object'||Array.isArray(body))throw new BadRequestException('Ongeldige sync-controle.');
 const ack=body.acknowledgedId;
 if(ack!==undefined&&(typeof ack!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(ack)))throw new BadRequestException('Ongeldige sync-bevestiging.');
 await activeCompany(companyCode);
 if(typeof ack==='string')await prisma.qboxReaderConfig.updateMany({where:{companyCode,syncRequestId:ack},data:{syncAcknowledgedId:ack}});
 const config=await prisma.qboxReaderConfig.upsert({where:{companyCode},create:{companyCode,commandPollAt:new Date()},update:{commandPollAt:new Date()}});
 return {requestId:config.syncRequestId!==config.syncAcknowledgedId?config.syncRequestId:null};
}
