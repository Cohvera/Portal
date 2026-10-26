import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {Project} from './projects';
import {operationsSummary,projectInWarranty,projectStatusIssue,projectStatusIssues,statusIssueGroups} from './operations';
const project=(patch:Partial<Project>={}):Project=>({id:'1',name:'Werf',customer:'',owner:'',status:'Actief',statusColor:'#123',dueDate:null,tasks:[],externalSource:'PLENION',sourceStatusCode:'07',sourceIsActive:true,sourceIsClosed:false,...patch});
test('warranty requires invoiced Plenion status and confirmed Uit WIP off',()=>{
 assert.equal(projectInWarranty(project({sourceStatusCode:'09',sourceIsActive:false})),true);
 for(const patch of [{sourceStatusCode:'09',sourceIsClosed:true},{sourceStatusCode:'09',sourceIsClosed:null},{sourceStatusCode:'07'},{externalSource:null,sourceStatusCode:'09'}])assert.equal(projectInWarranty(project(patch)),false);
 assert.equal(projectInWarranty(project({sourceStatusCode:null,sourceStatusLabel:'09 - Gefactureerd'})),true);
});
test('operations uses source deadlines and separates execution, warranty and closure',()=>{
 const rows=[project({id:'late',sourceDates:{deadline:'2026-10-22'}}),project({id:'today',sourceDates:{deadline:'2026-10-23'}}),project({id:'missing',dueDate:'2020-01-01'}),project({id:'warranty',sourceStatusCode:'09',sourceIsActive:false,sourceDates:{deadline:'2020-01-01'}}),project({id:'closed',sourceIsClosed:true,sourceDates:{deadline:'2020-01-01'}})];
 const result=operationsSummary(rows,'2026-10-23');
 assert.equal(result.active.length,3);assert.deepEqual(result.warranty.map(p=>p.id),['warranty']);
 assert.deepEqual(result.overdue.map(p=>p.id),['late']);assert.deepEqual(result.missingDeadline.map(p=>p.id),['missing']);
 assert.equal(result.unassigned.length,3);
 assert.equal(operationsSummary([],'2026-10-23').active.length,0);
});

test('status control counts closed execution projects even though they are not active',()=>{
 const inconsistent=project({sourceStatusCode:'07',sourceIsClosed:true,sourceIsActive:false});
 assert.ok(projectStatusIssue(inconsistent));
 assert.ok(projectStatusIssue(project({sourceStatusCode:null,sourceStatusLabel:'07 - In Uitvoering',sourceIsClosed:true})));
 const valid=[project(),project({sourceStatusCode:'09'}),project({sourceStatusCode:'09',sourceIsClosed:true}),project({sourceIsClosed:null}),project({externalSource:null,sourceIsClosed:true})];
 for(const p of valid)assert.equal(projectStatusIssue(p),null);
 const summary=operationsSummary([inconsistent,...valid],'2026-10-23');
 assert.deepEqual(summary.statusIssues,[inconsistent]);
 assert.ok(!summary.active.includes(inconsistent));
});

test('agreed project-map loss and closure combinations',()=>{
 for(const code of ['01','02','07'])assert.ok(projectStatusIssue(project({sourceStatusCode:code,sourceIsClosed:true})));
 for(const closed of [true,false])assert.ok(projectStatusIssue(project({sourceStatusCode:'14',sourceIsClosed:closed})));
 assert.ok(projectStatusIssue(project({sourceStatusCode:'04',sourceIsClosed:false})));
 assert.equal(projectStatusIssue(project({sourceStatusCode:'04',sourceIsClosed:true})),null);
 for(const closed of [true,false])assert.equal(projectStatusIssue(project({sourceStatusCode:'09',sourceIsClosed:closed})),null);
});
test('offers are checked separately, invoices are excluded and projects counted once',()=>{
 const doc=(statusCode:string,closed:boolean,documentType='601')=>({sourceId:'11379',number:'1809629',name:'Ventilatie',description:'',statusCode,statusLabel:'',closed,documentType,versionNumber:'1',revisionClosed:false});
 for(const [code,closed] of [['01',true],['02',true],['07',true],['14',false],['04',false],['04',true]] as const){
  const p=project({sourceDocuments:[doc(code,closed)]});
  assert.ok(projectStatusIssues(p).length,`${code}/${closed}`);
  assert.ok(projectStatusIssues(p)[0].record.includes('1809629'));
  assert.equal(operationsSummary([p],'2026-10-23').statusIssues.length,1);
 }
 for(const [code,closed] of [['14',true],['09',false],['09',true],['02',false]] as const)assert.deepEqual(projectStatusIssues(project({sourceDocuments:[doc(code,closed)]})),[]);
 assert.deepEqual(projectStatusIssues(project({sourceDocuments:[doc('04',false,'602')]})),[]);
 const multiple=project({sourceStatusCode:'07',sourceIsClosed:true,sourceDocuments:[doc('04',false)]});
 assert.equal(projectStatusIssues(multiple).length,3);
 assert.equal(operationsSummary([multiple],'2026-10-23').statusIssues.length,1);
});

test('problem groups count each project once and keep distinct wrong-status directions',()=>{
 const offer={sourceId:'1',number:'1809629',name:'Ventilatie',description:'',statusCode:'04',statusLabel:'',closed:false,documentType:'601',versionNumber:'1',revisionClosed:false};
 const offers=project({id:'offers',sourceDocuments:[offer,{...offer,sourceId:'2',number:'1809630'}]});
 const map=project({id:'map',sourceStatusCode:'14',sourceIsClosed:true});
 const groups=statusIssueGroups([offers,map,project({id:'valid'})]);
 assert.deepEqual(groups.find(g=>g.kind==='offer-wrong-status')!.projects.map(p=>p.id),['offers']);
 assert.deepEqual(groups.find(g=>g.kind==='map-wrong-status')!.projects.map(p=>p.id),['map']);
 assert.deepEqual(groups.find(g=>g.kind==='lost-not-closed')!.projects.map(p=>p.id),['offers']);
 assert.equal(groups.find(g=>g.kind==='execution-closed')!.projects.length,0);
 assert.equal(projectStatusIssues(offers).filter(issue=>issue.kind==='offer-wrong-status').length,2);
});
