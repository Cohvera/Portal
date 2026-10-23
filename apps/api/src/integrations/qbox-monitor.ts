import {extraColumns,saveReaderConfig} from "./qbox-config";
import {BadRequestException,Controller,ForbiddenException,Get,Param,Body,Put} from '@nestjs/common';
import {prisma} from '@cohvera/database';
const phases=['started','read_ok','configuration_failed','read_failed','upload_failed','success'] as const;
export function readerEvents(input:unknown,now=Date.now()){
 const body=input as {events?:unknown[]};
 if(!body || !Array.isArray(body.events) || !body.events.length || body.events.length>100)throw new BadRequestException('Ongeldige statusbatch.');
 return body.events.map(value=>{
  const e=value as Record<string,unknown>;
  const fail=():never=>{throw new BadRequestException('Ongeldige readerstatus.');};
  if(!e || typeof e!=='object' || typeof e.runId!=='string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(e.runId) || !phases.includes(e.phase as any))return fail();
  const time=typeof e.observedAt==='string'?Date.parse(e.observedAt):NaN;
  if(!Number.isFinite(time)||time>now+300000||time<now-30*86400000)return fail();
  if(typeof e.readerVersion!=='string'|| !/^[0-9]{1,3}\.[0-9]{1,3}(?:\.[0-9]{1,3})?$/.test(e.readerVersion))return fail();
  const number=(key:string,min:number,max:number)=>{const n=e[key];if(n==null)return null;if(typeof n!=='number'||!Number.isInteger(n)||n<min||n>max)return fail();return n;};
  return {runId:e.runId,phase:e.phase as string,observedAt:new Date(time),readerVersion:e.readerVersion,recordCount:number('recordCount',0,20000),httpStatus:number('httpStatus',100,599)};
 });
}
export async function ingestReaderEvents(companyCode:string,body:unknown){
 const events=readerEvents(body);
 const company=await prisma.company.findUnique({where:{code:companyCode},select:{isActive:true}});
 if(!company?.isActive)throw new ForbiddenException('Bedrijf niet actief.');
 await prisma.$transaction(async tx=>{
  await tx.qboxReaderEvent.createMany({data:events.map(e=>({...e,companyCode})),skipDuplicates:true});
  await tx.qboxReaderEvent.deleteMany({where:{companyCode,observedAt:{lt:new Date(Date.now()-30*86400000)}}});
 });
 return {accepted:true};
}
export function connectionState(event:{phase:string;observedAt:Date;receivedAt:Date}|null,lastContact:Date|null,now=Date.now()){
 if(!event)return lastContact?'stale':'unknown';
 if(!lastContact || now-lastContact.getTime()>35*60000 || now-event.observedAt.getTime()>35*60000)return 'stale';
 if(event.phase==='configuration_failed'||event.phase==='read_failed'||event.phase==='upload_failed')return 'error';
 if(event.phase==='started'||event.phase==='read_ok')return now-event.observedAt.getTime()>9*60000?'interrupted':'running';
 return 'healthy';
}
const columns=[
 ['IDProj','source_id'],['projnr','number'],['Naam','name'],['oms','description'],['STAT','status_id'],
 ['WERK.CODE','status_code'],['WERK.OMSCHR1','status_label'],['VersieAf','revision_closed'],['UITWIP','out_of_wip'],
 ['IDProjectMap','parent_source_id'],['ProjectMap','is_project_map'],['BSRTCD','document_type'],['VersieNr','version_number'],
 ['DatCre','created_date'],['CDATUM','document_date'],['DatumPlanning','planned_date'],['Deadline','deadline'],['Oplevering','delivery_date'],
 ['StatDat','status_date'],['DATUMUITWIP','out_of_wip_date'],['DatumVerkocht','sold_date'],['FAK_FakNr','invoice_number'],['FAK_CDatum','invoice_date'],['FAK_AfDatum','invoice_end_date'],
].map(([source,field])=>({source,field}));
@Controller('companies/:companyCode/middleware/qbox')
export class QboxMonitorController {
 @Put("columns")
 save(@Param("companyCode")companyCode:string,@Body()body:unknown){return saveReaderConfig(companyCode,body);}
 @Get()
 async get(@Param('companyCode')companyCode:string){
  const [lastImport,events,contact,configuration]=await Promise.all([
   prisma.qboxImport.findUnique({where:{companyCode},select:{receivedAt:true,sourceObservedAt:true,projectCount:true,contractVersion:true,sourceKind:true}}),
   prisma.qboxReaderEvent.findMany({where:{companyCode,observedAt:{gte:new Date(Date.now()-30*86400000)}},orderBy:[{observedAt:'desc'},{receivedAt:'desc'},{id:'desc'}],take:100}),
   prisma.qboxReaderEvent.findFirst({where:{companyCode},orderBy:{receivedAt:'desc'},select:{receivedAt:true}}),
   prisma.qboxReaderConfig.findUnique({where:{companyCode}}),
  ]);
  const phaseOrder:Record<string,number>={started:0,read_ok:1,configuration_failed:2,read_failed:2,upload_failed:2,success:2};
  events.sort((a,b)=>b.observedAt.getTime()-a.observedAt.getTime() || (a.runId===b.runId ? phaseOrder[b.phase]-phaseOrder[a.phase] : b.receivedAt.getTime()-a.receivedAt.getTime()));
  return {state:connectionState(events[0]??null,contact?.receivedAt??null),lastContactAt:contact?.receivedAt??null,lastImport,events,
   expectedIntervalMinutes:15,columnSelectionEnabled:true,configuration,extraColumns,columns,exportSchemaVersion:3};
 }
}
