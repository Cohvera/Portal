import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ALL_COMPANIES,projectCompanies,loadCompanyRecords} from './project-companies';
import {projectsCsv} from './project-csv';
const companies=[{code:'QHOME',name:'Q-Home'},{code:'WARCO',name:'Warco'},{code:'PRIVATE',name:'Private'}];
test('all companies includes only memberships with project read access',()=>{
 assert.deepEqual(projectCompanies(companies,ALL_COMPANIES,code=>code!=='PRIVATE'),companies.slice(0,2));
 assert.deepEqual(projectCompanies(companies,'WARCO',()=>true),[companies[1]]);
 assert.deepEqual(projectCompanies(companies,'PRIVATE',()=>false),[]);
 assert.deepEqual(projectCompanies(companies,'unknown',()=>true),[]);
});
test('aggregation retains source company, including equal project names',async()=>{
 const loaded=await loadCompanyRecords(companies.slice(0,2),async c=>[{id:c.code,name:'Zelfde naam',companyCode:'untrusted'}]);
 assert.equal(loaded.length,2);assert.equal(loaded[0].companyCode,'QHOME');assert.equal(loaded[1].companyName,'Warco');
});
test('failure never returns misleading partial totals',async()=>{
 await assert.rejects(()=>loadCompanyRecords(companies.slice(0,2),async c=>{if(c.code==='WARCO')throw new Error('Geen toegang');return [{id:'1'}];}),/Warco: Geen toegang/);
 assert.deepEqual(await loadCompanyRecords([],async()=>{throw new Error('No request expected');}),[]);
});
test('combined CSV exports the actual company for each project',()=>{
 const base={name:'Test',customer:'',owner:'',status:'Actief'};
 const csv=projectsCsv([{...base,companyName:'Q-Home'},{...base,companyName:'Warco'}],'Alle bedrijven');
 assert.match(csv,/"Q-Home";/);assert.match(csv,/"Warco";/);assert(!csv.includes('"Alle bedrijven";'));
});
