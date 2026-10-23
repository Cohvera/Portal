import {test} from "node:test";
import assert from "node:assert/strict";
import {projectChanges} from "./project-changes";
const old={sourceStatusLabel:"09 - Gefactureerd",sourceIsClosed:false,sourceDates:{deadline:"2026-10-31",planned_date:null},sourceDocuments:[{sourceId:"1",number:"123",name:"Ventilatie",statusLabel:"02 - Offerte",closed:false}]};
test("JSONB property order does not create false date updates",()=>{
 assert.deepEqual(projectChanges(old,{...old,sourceDates:{planned_date:null,deadline:"2026-10-31"}}),[]);
});
test("document closure stays separate from root closure; new documents are not assumed invoices",()=>{
 const result=projectChanges(old,{...old,sourceDocuments:[{...old.sourceDocuments[0],closed:true},{sourceId:"2",number:"124",name:"Voorschot",statusLabel:"09 - Gefactureerd",closed:false}]});
 assert.equal(result.length,2);assert.ok(result[0].includes("Uit WIP aan"));assert.ok(result[1].includes("Nieuw gekoppeld record"));
 assert.ok(!result.some(m=>m.includes("Hoofdproject administratief afgesloten")));
 assert.deepEqual(projectChanges(old,{...old,sourceIsClosed:true}),["Hoofdproject administratief afgesloten (Uit WIP aan)"]);
});

test('offers distinguish approval 02 to 07, loss 02 to 14, and project status 04',()=>{
 const before={...old,sourceDocuments:[{...old.sourceDocuments[0],number:'1809629',statusCode:'02'}]};
 for(const [code,label,outcome] of [['07','In Uitvoering','Offerte goedgekeurd'],['14','Verloren','Offerte verloren']]){
  const messages=projectChanges(before,{...before,sourceDocuments:[{...before.sourceDocuments[0],statusCode:code,statusLabel:`${code} - ${label}`}]});
  assert.equal(messages.length,1);assert.ok(messages[0].startsWith(`${outcome}: 1809629`));
 }
 const messages=projectChanges(before,{...before,sourceDocuments:[{...before.sourceDocuments[0],statusCode:'04',statusLabel:'04 - Verloren'}]});
 assert.ok(!messages[0].startsWith('Offerte verloren'));
 // Explicit status codes also reveal changes when the source label stays the same.
 assert.ok(projectChanges(before,{...before,sourceDocuments:[{...before.sourceDocuments[0],statusCode:'14'}]})[0].startsWith('Offerte verloren'));
});

test('existing offer events are displayed semantically without changing project events',async()=>{
 const {displayProjectUpdate}=await import('./project-changes');
 assert.equal(displayProjectUpdate('1809626 · Sanitair: 02 - Offerte → 07 - In Uitvoering'),'Offerte goedgekeurd: 1809626 · Sanitair (02 → 07)');
 assert.equal(displayProjectUpdate('1809629 · Verwarming: 02 - Offerte → 14 - Verloren'),'Offerte verloren: 1809629 · Verwarming (02 → 14)');
 const project='Projectstatus: 02 - Offerte → 07 - In Uitvoering';assert.equal(displayProjectUpdate(project),project);
 const formatted='Offerte goedgekeurd: 1809626 · Sanitair (02 → 07)';assert.equal(displayProjectUpdate(formatted),formatted);
});
