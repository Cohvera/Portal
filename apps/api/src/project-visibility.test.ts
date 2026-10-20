import {test} from "node:test";
import assert from "node:assert/strict";
import {projectListWhere} from "./project-visibility";

test("successful reader selection excludes old Plenion timestamps but retains manual/other sources",()=>{
  const observed=new Date("2026-10-20T10:00:00Z");
  assert.deepEqual(projectListWhere("WARCO",{sourceKind:"reader_selection",sourceObservedAt:observed}),{
    company:{code:"WARCO"},sourceParentRecordId:null,OR:[
      {externalSource:null},{externalSource:{not:"PLENION"}},
      {externalSource:"PLENION",sourceSeenAt:observed},
    ],
  });
});
test("no successful reader import preserves existing list behavior",()=>{
  const base={company:{code:"QHOME"},sourceParentRecordId:null};
  assert.deepEqual(projectListWhere("QHOME",null),base);
  assert.deepEqual(projectListWhere("QHOME",{sourceKind:"central_datahub",sourceObservedAt:new Date()}),base);
});
test("stale accepted selections remain visible, with no wall clock expiry",()=>{
  const source={sourceKind:"reader_selection",sourceObservedAt:new Date("2020-01-01")};
  assert.deepEqual(projectListWhere("WARCO",source).OR?.[2],{externalSource:"PLENION",sourceSeenAt:source.sourceObservedAt});
});
