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
