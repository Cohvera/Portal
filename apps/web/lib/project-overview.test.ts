import {test} from 'node:test';
import assert from 'node:assert/strict';
import {filterProjects, projectScope, type ProjectFilters} from './project-overview';
const projects = [
  {name:'Werf 10',customer:'Klant A',owner:'Milan',status:'Actief',externalSource:'PLENION',externalId:'230001'},
  {name:'Werf 2',customer:'Klant B',owner:'',status:'Gepland',externalSource:null,externalId:null},
  {name:'Nazorg',customer:'Klant A',owner:'Milan',status:'Afgerond',externalSource:'PLENION',externalId:'230002'},
];
const base: ProjectFilters={query:'',status:'',owner:'',source:''};
test('Project filters combine status, source, owner and case-insensitive client/reference search',()=>{
  assert.equal(filterProjects(projects,{...base,status:'Actief',source:'PLENION',owner:'Milan',query:' KLANT a '}).length,1);
  assert.equal(filterProjects(projects,{...base,query:'230002'})[0].name,'Nazorg');
  assert.equal(filterProjects(projects,{...base,owner:'__unassigned__'})[0].name,'Werf 2');
  assert.equal(filterProjects(projects,{...base,source:'PORTAL'}).length,1);
  assert.equal(filterProjects(projects,{...base,status:'Gepland',source:'PLENION'}).length,0);
  assert.deepEqual(filterProjects(projects,base).map(p=>p.name),['Nazorg','Werf 2','Werf 10']);
  assert.equal(projects[0].name,'Werf 10');
});

test('Closure filter follows source checkbox, not a misleading status label',()=>{
  const rows=[{...projects[0],sourceStatusLabel:'07 - In Uitvoering',sourceIsClosed:true},{...projects[1],externalSource:'PLENION',sourceStatusLabel:'09 - Afgewerkt',sourceIsClosed:false}];
  assert.equal(filterProjects(rows,{...base,scope:'open'})[0].name,'Werf 2');
  assert.equal(filterProjects(rows,{...base,scope:'closed'})[0].name,'Werf 10');
  assert.equal(filterProjects(rows,{...base,status:'07 - In Uitvoering',scope:'closed'}).length,1);
  assert.equal(projectScope(projects[0]),'unknown');
  assert.equal(projectScope({...projects[1],status:'Afgerond'}),'closed');
});

test('in execution is separate from administratively open and invoiced',()=>{
 const root={...projects[0],sourceStatusLabel:'09 - Gefactureerd',sourceIsClosed:false,sourceIsActive:false};
 assert.equal(filterProjects([root],{...base,scope:'active'}).length,0);
 assert.equal(filterProjects([root],{...base,scope:'open'}).length,1);
 assert.equal(filterProjects([{...root,sourceIsActive:true,sourceIsClosed:true}],{...base,scope:'active'}).length,0);
});

test('year ranges use source dates, include boundaries and never use import dates or project numbers',()=>{
 const rows=[
  {...projects[0],name:'Old',sourceDates:{created_date:'2018-10-08T05:57:01.530Z'},createdAt:'2026-10-30T12:00:00Z'},
  {...projects[0],name:'New',sourceDates:{created_date:'2024-12-31'},createdAt:'2026-10-30T12:00:00Z'},
  {...projects[0],name:'Teamleader',externalSource:'TEAMLEADER',sourcePlannedAt:'2025-01-01T00:00:00Z'},
  {...projects[1],name:'Manual',createdAt:'2024-01-01T00:00:00Z'},
  {...projects[0],name:'Unknown',createdAt:'2026-10-30T12:00:00Z'},
  {...projects[0],name:'Invalid',sourceDates:{created_date:'0000-00-00'}},
 ];
 assert.deepEqual(filterProjects(rows,{...base,yearFrom:'2024',yearTo:'2024'}).map(p=>p.name),['Manual','New']);
 assert.deepEqual(filterProjects(rows,{...base,yearFrom:'2024',source:'PLENION'}).map(p=>p.name),['New']);
 assert.equal(filterProjects(rows,{...base,yearTo:'2018'}).length,1);
 assert.equal(filterProjects(rows,{...base,yearFrom:'2024',includeUnknownYear:true}).length,5);
 assert.equal(filterProjects(rows,base).length,6);
});
