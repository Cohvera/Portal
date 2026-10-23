import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {Project} from './projects';
import {operationsSummary,projectInWarranty} from './operations';
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
