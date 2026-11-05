import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prisma} from '@cohvera/database';
import {extraColumns,selectedColumns,extraFields,schemaReport,exchangeReaderConfig,saveReaderConfig,projectFilter,supportsProjectFilter} from './qbox-config';

test('only explicit catalog fields can be selected',()=>{
 assert.equal(new Set(extraColumns.map(c=>c.source)).size,extraColumns.length);
 for(const value of [['PASS_IDRIJKSREG'],['IDProj; DROP TABLE PROJ'],['MEMO','MEMO'],['*'],[null]])assert.throws(()=>selectedColumns(value));
 assert.deepEqual(selectedColumns(['MEMO','A_PC']),['A_PC','MEMO']);
 assert.deepEqual(extraFields({MEMO:' a\u0000b ',A_PC:null}),{A_PC:null,MEMO:'ab'});
 assert.throws(()=>extraFields({MEMO:'a'.repeat(16001)}));
 assert.throws(()=>extraFields({password:'secret'}));
});
test('schema report rejects expressions, invalid versions and unbounded metadata',()=>{
 assert.equal(schemaReport({columns:['IDProj','MEMO'],readerVersion:'3.2',appliedRevision:1}).appliedRevision,1);
 for(const columns of [[],['P.MEMO'],['MEMO','MEMO'],Array(2001).fill('x')])assert.throws(()=>schemaReport({columns,readerVersion:'3.2'}));
 assert.throws(()=>schemaReport({columns:['MEMO'],readerVersion:'3.2',appliedRevision:-1}));
});
test('HFSQL trailing NUL padding is normalized, embedded NULs and duplicate names are rejected',()=>{
 assert.deepEqual(schemaReport({columns:['IDProj\u0000\u0000','MEMO\u0000'],readerVersion:'3.3'}).columns,['IDProj','MEMO']);
 for(const columns of [['ME\u0000MO'],['\u0000'],['MEMO','MEMO\u0000'],['MEMO'+'\u0000'.repeat(1024)]])
  assert.throws(()=>schemaReport({columns,readerVersion:'3.3'}));
});
test('configuration exchange uses key company and acknowledges only an existing revision',async()=>{
 const originals=[prisma.company.findUnique,prisma.qboxReaderConfig.upsert,prisma.qboxReaderConfig.updateMany];
 const updates:any[]=[];
 try{
  (prisma.company as any).findUnique=async()=>({isActive:true});
  (prisma.qboxReaderConfig as any).upsert=async(args:any)=>{assert.equal(args.where.companyCode,'WARCO');return {revision:2,selectedColumns:['MEMO']};};
  (prisma.qboxReaderConfig as any).updateMany=async(args:any)=>{updates.push(args);return {count:1};};
  const response=await exchangeReaderConfig('WARCO',{columns:['MEMO'],readerVersion:'3.2',companyCode:'QHOME',appliedRevision:1});
  assert.equal(response.revision,2);assert.equal(updates[0].where.companyCode,'WARCO');
  await exchangeReaderConfig('WARCO',{columns:['MEMO'],readerVersion:'3.2',appliedRevision:99});
  assert.equal(updates.length,1);
 }finally{[prisma.company.findUnique,prisma.qboxReaderConfig.upsert,prisma.qboxReaderConfig.updateMany]=originals as any;}
});
test('selection writes are scoped and optimistic; missing source columns cannot be enabled',async()=>{
 const original=prisma.$transaction;let writes=0;
 try{
  (prisma as any).$transaction=async(fn:any)=>fn({qboxReaderConfig:{
   findUnique:async(args:any)=>{assert.equal(args.where.companyCode,'WARCO');return {schemaReportedAt:new Date(),schemaColumns:['MEMO']};},
   updateMany:async(args:any)=>{writes++;assert.equal(args.where.companyCode,'WARCO');return {count:args.where.revision===2?1:0};},
  }});
  await assert.rejects(()=>saveReaderConfig('WARCO',{revision:2,selectedColumns:['A_PC']}));assert.equal(writes,0);
  assert.equal((await saveReaderConfig('WARCO',{revision:2,selectedColumns:['MEMO']})).revision,3);
  await assert.rejects(()=>saveReaderConfig('WARCO',{revision:1,selectedColumns:['MEMO']}));
 }finally{prisma.$transaction=original;}
});

test('status filters preserve leading zeros, combine with WIP, and reject ambiguous or injected values',()=>{
 assert.deepEqual(projectFilter({statusCodes:['09','07'],outOfWip:'off'}),{statusCodes:['07','09'],outOfWip:'off'});
 assert.equal(projectFilter({statusCodes:[],outOfWip:'any'}),null);
 assert.equal(supportsProjectFilter('3.2'),false);assert.equal(supportsProjectFilter('3.3'),true);
 for(const filter of [{statusCodes:["07' OR 1=1"],outOfWip:'any'},{statusCodes:['07','07'],outOfWip:'on'},{statusCodes:[],outOfWip:true}])assert.throws(()=>projectFilter(filter));
});
test('filter changes require a capable reader and statuses from this company',async()=>{
 const original=prisma.$transaction;let version='3.2';const writes:any[]=[];
 try{
  (prisma as any).$transaction=async(fn:any)=>fn({qboxReaderConfig:{
   findUnique:async()=>({schemaReportedAt:new Date(),schemaColumns:[],readerVersion:version,availableStatuses:[{code:'07',label:'Uitvoering'}]}),
   updateMany:async(args:any)=>{writes.push(args);return {count:1};},
  }});
  const body={revision:0,selectedColumns:[],projectFilter:{statusCodes:['07'],outOfWip:'off'}};
  await assert.rejects(()=>saveReaderConfig('WARCO',body));version='3.3';
  await assert.rejects(()=>saveReaderConfig('WARCO',{...body,projectFilter:{statusCodes:['09'],outOfWip:'off'}}));
  await saveReaderConfig('WARCO',body);assert.equal(writes.length,1);
  assert.deepEqual(writes[0].data.projectFilter,body.projectFilter);
 }finally{prisma.$transaction=original;}
});

test('relationship filter normalizes all and rejects invalid values',()=>{
 assert.equal(projectFilter({statusCodes:[],outOfWip:'any',relationshipType:'any'}),null);
 assert.deepEqual(projectFilter({statusCodes:[],outOfWip:'any',relationshipType:'prospect'}),{statusCodes:[],outOfWip:'any',relationshipType:'prospect'});
 for(const relationshipType of [null,true,'invalid',"customer' OR 1=1"])assert.throws(()=>projectFilter({statusCodes:[],outOfWip:'any',relationshipType}));
});
test('relationship filters require reader 3.5 and the reported source column',async()=>{
 const original=prisma.$transaction;let version='3.4';let columns=['KLCLEUNIK'];let writes=0;
 try{
  (prisma as any).$transaction=async(fn:any)=>fn({qboxReaderConfig:{
   findUnique:async()=>({schemaReportedAt:new Date(),schemaColumns:columns,readerVersion:version}),
   updateMany:async()=>{writes++;return {count:1};},
  }});
  const body={revision:0,selectedColumns:[],projectFilter:{statusCodes:[],outOfWip:'any',relationshipType:'prospect'}};
  await assert.rejects(()=>saveReaderConfig('WARCO',body));version='3.5';
  await assert.rejects(()=>saveReaderConfig('WARCO',body));assert.equal(writes,0);
  columns=['IDProsPect','KLCLEUNIK'];
  await saveReaderConfig('WARCO',body);
  await saveReaderConfig('WARCO',{...body,projectFilter:{...body.projectFilter,relationshipType:'customer'}});
  assert.equal(writes,2);
 }finally{prisma.$transaction=original;}
});

test('configuration exchange rejects older readers with an active relationship filter',async()=>{
 const originals=[prisma.company.findUnique,prisma.qboxReaderConfig.upsert];
 try{
  (prisma.company as any).findUnique=async()=>({isActive:true});
  (prisma.qboxReaderConfig as any).upsert=async()=>({revision:1,selectedColumns:[],projectFilter:{statusCodes:[],outOfWip:'any',relationshipType:'customer'}});
  await assert.rejects(()=>exchangeReaderConfig('WARCO',{columns:['KLCLEUNIK'],readerVersion:'3.4'}));
  const response=await exchangeReaderConfig('WARCO',{columns:['KLCLEUNIK'],readerVersion:'3.5'});
  assert.equal(response.minimumReaderVersion,'3.5');
  assert.equal(response.projectFilter?.relationshipType,'customer');
 }finally{[prisma.company.findUnique,prisma.qboxReaderConfig.upsert]=originals as any;}
});

test('status IDs stay distinct when codes coincide and require reader 3.7',async()=>{
 const selection={statusCodes:[],statusIds:['200','100'],outOfWip:'any'};
 assert.deepEqual(projectFilter(selection),{statusCodes:[],outOfWip:'any',statusIds:['100','200']});
 for(const statusIds of [[100],['100','100'],["100) OR 1=1"],['0']])assert.throws(()=>projectFilter({...selection,statusIds}));
 assert.throws(()=>projectFilter({...selection,statusCodes:['02']}));
 const original=prisma.$transaction;let version='3.6';let writes=0;
 try{
  (prisma as any).$transaction=async(fn:any)=>fn({qboxReaderConfig:{
   findUnique:async()=>({schemaReportedAt:new Date(),schemaColumns:[],readerVersion:version,availableStatuses:[{id:'100',code:'02',label:'Offerte A'},{id:'200',code:'02',label:'Offerte B'}]}),
   updateMany:async(args:any)=>{writes++;assert.deepEqual(args.data.projectFilter.statusIds,['100','200']);return {count:1};},
  }});
  const body={revision:0,selectedColumns:[],projectFilter:selection};
  await assert.rejects(()=>saveReaderConfig('WARCO',body));version='3.7';
  await assert.rejects(()=>saveReaderConfig('WARCO',{...body,projectFilter:{...selection,statusIds:['999']}}));
  assert.equal(writes,0);await saveReaderConfig('WARCO',body);assert.equal(writes,1);
 }finally{prisma.$transaction=original;}
});
