import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reportRows} from './operations-pdf';
import type {Project} from './projects';
const project={id:'one',name:'Project René',companyName:'Warco',externalId:'123',externalSource:'PLENION',sourceStatusCode:'14',sourceStatusLabel:'14 - Geen uitvoering',sourceIsClosed:false,status:'Actief',customer:'',owner:'',sourceDocuments:[{number:'456',name:'Offerte ventilatie',documentType:'601',statusCode:'04',closed:false}]} as Project;
test('PDF groups issues per record and respects the selected problem filter',()=>{
 const report={title:'Controle',company:'Alle bedrijven',filter:'Alle problemen',projects:[project],issueFilter:'all' as const};
 const all=reportRows(report);assert.equal(all.length,2);assert.equal(all[0][0],'Warco');assert.match(all[0][1],/123/);assert.match(all[0][3],/status 04/);assert.match(all[0][3],/Uit WIP/);
 const offers=reportRows({...report,issueFilter:'offer-wrong-status'});assert.equal(offers.length,1);assert.match(offers[0][2],/456/);assert.match(offers[0][3],/status 14/);assert(!offers[0][3].includes('Uit WIP'));
});
test('other operations reports retain every project, not just twelve visible rows',()=>{
 const projects=Array.from({length:27},(_,i)=>({...project,id:String(i),externalId:String(i)}));
 const rows=reportRows({title:'Uitvoering',company:'Warco',filter:'Actief',projects});assert.equal(rows.length,27);assert.match(rows.at(-1)![1],/Nr. 26/);assert.equal(rows[0][3],'Nog toe te wijzen');
});
