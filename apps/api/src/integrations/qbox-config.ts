import {BadRequestException, ConflictException, ForbiddenException} from '@nestjs/common';
import {prisma,Prisma} from '@cohvera/database';
import catalog from './hfsql-columns.json';
export const extraColumns = catalog;
const allowed = new Set(catalog.map(c=>c.source));
export function selectedColumns(input:unknown):string[]{
 if(!Array.isArray(input)||input.length>catalog.length||input.some(c=>typeof c!=='string'||!allowed.has(c))||new Set(input).size!==input.length)
  throw new BadRequestException('Kies alleen ondersteunde HFSQL-kolommen.');
 return [...input].sort();
}
export function extraFields(input:unknown):Record<string,string|null>{
 if(input==null)return {};
 if(typeof input!=='object'||Array.isArray(input))throw new BadRequestException('Ongeldige extra bronvelden.');
 const entries=Object.entries(input);
 selectedColumns(entries.map(([key])=>key));
 return Object.fromEntries(entries.sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>{
  if(value!==null&&(typeof value!=='string'||value.length>16000))throw new BadRequestException(`Ongeldig extra bronveld: ${key}`);
  return [key,typeof value==='string'?value.replace(/\u0000/g,'').trim():null];
 }));
}
export type ProjectFilter={statusCodes:string[];outOfWip:'any'|'on'|'off'};
export function projectFilter(input:unknown):ProjectFilter|null{
 if(input==null)return null;
 const f=input as ProjectFilter;
 if(typeof f!=='object'||Array.isArray(f)||!Array.isArray(f.statusCodes)||f.statusCodes.length>100||f.statusCodes.some(c=>typeof c!=='string'||!/^[A-Za-z0-9_-]{1,30}$/.test(c))||new Set(f.statusCodes).size!==f.statusCodes.length||!['any','on','off'].includes(f.outOfWip))throw new BadRequestException('Ongeldige status- of Uit WIP-filter.');
 return f.statusCodes.length||f.outOfWip!=='any'?{statusCodes:[...f.statusCodes].sort(),outOfWip:f.outOfWip}:null;
}
export function supportsProjectFilter(version:string){
 const [major,minor]=version.split('.').map(Number);return major>3||(major===3&&minor>=3);
}
function statuses(input:unknown):{code:string;label:string}[]|undefined{
 if(input===undefined)return undefined;
 if(!Array.isArray(input)||input.length>2000)throw new BadRequestException('Ongeldige bronstatussen.');
 return input.map(value=>{
  const s=value as {code:string;label:string};
  if(!s||typeof s.code!=='string'||!/^[A-Za-z0-9_-]{1,30}$/.test(s.code)||typeof s.label!=='string'||s.label.length>200||s.label.includes('\u0000'))throw new BadRequestException('Ongeldige bronstatus.');
  return {code:s.code,label:s.label};
 });
}
export function schemaReport(input:unknown){
 const b=input as Record<string,unknown>;
 if(!b||typeof b!=='object'||!Array.isArray(b.columns)||!b.columns.length||b.columns.length>2000||b.columns.some(c=>typeof c!=='string'||!/^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(c))||new Set(b.columns).size!==b.columns.length)
  throw new BadRequestException('Ongeldige PROJ-kolommetadata.');
 if(typeof b.readerVersion!=='string'||!/^\d{1,3}\.\d{1,3}(?:\.\d{1,3})?$/.test(b.readerVersion))throw new BadRequestException('Ongeldige readerversie.');
 const applied=b.appliedRevision;
 if(applied!=null&&(!Number.isSafeInteger(applied)||Number(applied)<0))throw new BadRequestException('Ongeldige configuratieversie.');
 return {statuses:statuses(b.statuses),columns:b.columns as string[],readerVersion:b.readerVersion,appliedRevision:applied as number|undefined};
}
export async function exchangeReaderConfig(companyCode:string,input:unknown){
 const report=schemaReport(input);
 const company=await prisma.company.findUnique({where:{code:companyCode},select:{isActive:true}});
 if(!company?.isActive)throw new ForbiddenException('Bedrijf niet actief.');
 const data={...(report.statuses!==undefined?{availableStatuses:report.statuses}:{}),schemaColumns:report.columns,schemaReportedAt:new Date(),readerVersion:report.readerVersion};
 const config=await prisma.qboxReaderConfig.upsert({where:{companyCode},create:{companyCode,...data},update:data});
 if(report.appliedRevision!=null&&report.appliedRevision<=config.revision)
  await prisma.qboxReaderConfig.updateMany({where:{companyCode,OR:[{appliedRevision:null},{appliedRevision:{lt:report.appliedRevision}}]},data:{appliedRevision:report.appliedRevision}});
 const filter=projectFilter(config.projectFilter);
 if(filter&&!supportsProjectFilter(report.readerVersion))throw new ConflictException('Deze projectselectie vereist reader 3.3 of nieuwer.');
 return {revision:config.revision,selectedColumns:config.selectedColumns,projectFilter:filter,minimumReaderVersion:filter?'3.3':'3.2'};
}
export async function saveReaderConfig(companyCode:string,input:unknown){
 const b=input as {selectedColumns?:unknown;revision?:unknown;projectFilter?:unknown};
 if(!b||!Number.isSafeInteger(b.revision)||Number(b.revision)<0)throw new BadRequestException('Ongeldige configuratieversie.');
 const columns=selectedColumns(b.selectedColumns);
 return prisma.$transaction(async tx=>{
  const current=await tx.qboxReaderConfig.findUnique({where:{companyCode}});
  if(!current?.schemaReportedAt)throw new ConflictException('Werk eerst de reader bij en voer een sync uit om beschikbare kolommen op te vragen.');
  const filter=projectFilter(b.projectFilter===undefined?current.projectFilter:b.projectFilter);
  if(filter&&!supportsProjectFilter(current.readerVersion??''))throw new ConflictException('Werk eerst de Q-box bij naar reader 3.3 en voer een sync uit.');
  const known=statuses(current.availableStatuses??[])??[];
  if(filter?.statusCodes.some(code=>!known.some(s=>s.code===code)))throw new BadRequestException('Een gekozen status komt niet voor in de gemelde Plenion-statussen.');
  const available=new Set(current.schemaColumns.map(c=>c.toLowerCase()));
  if(columns.some(c=>!available.has(c.toLowerCase())))throw new BadRequestException('Een geselecteerde kolom ontbreekt in de gemelde PROJ-tabel.');
  const result=await tx.qboxReaderConfig.updateMany({where:{companyCode,revision:Number(b.revision)},data:{selectedColumns:columns,projectFilter:filter??Prisma.DbNull,revision:{increment:1}}});
  if(!result.count)throw new ConflictException('Instellingen zijn ondertussen gewijzigd. Vernieuw de pagina.');
  return {revision:Number(b.revision)+1,selectedColumns:columns,projectFilter:filter};
 });
}
