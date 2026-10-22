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
