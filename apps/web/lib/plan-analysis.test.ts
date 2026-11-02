import {test} from 'node:test';
import assert from 'node:assert/strict';
import {distance,extractPlanFindings,measurementHeatDraft,polygonArea,validPolygon} from './plan-analysis';
import {calculateHeatLoss,parseHeatFile} from './heat-loss';
test('Extracts explicit areas and room names; cable sections and bare lengths are not areas',()=>{
 const rows=extractPlanFindings(['60.12M² NVO','SLAAPKAMER 1','2x stopcontact wasmachine','voeding 3G4 mm2 + stadswater','398','VENTILATIESYSTEEM C of D','Uw = 1,1'].map((text,i)=>({text,page:1,x:10,y:i*20})));
 assert.deepEqual(rows.filter(r=>r.kind==='area').map(r=>r.value),[60.12]);
 assert.equal(rows.find(r=>r.kind==='room')?.label,'SLAAPKAMER 1');
 assert.equal(rows.find(r=>r.kind==='quantity')?.value,2);
 assert.equal(rows.find(r=>r.kind==='u-value')?.value,1.1);
 assert.ok(rows.every(r=>!r.reviewed));assert.ok(rows.some(r=>r.category==='hvac'));
});
test('Legend mentions do not become installed counts',()=>{
 const rows=extractPlanFindings([{text:'stopcontact wasmachine',page:1,x:5,y:20}]);
 assert.equal(rows[0].value,null);assert.equal(rows[0].kind,'mention');
 const ambiguous=extractPlanFindings([{text:'1x stopcontact deur - 2x stopcontact ventilatie',page:1,x:5,y:20}]);assert.ok(ambiguous.every(r=>r.value===null));
});
test('Calibrated polygon area is independent of PDF or screen scale',()=>{
 const points=[{x:0,y:0},{x:100,y:0},{x:100,y:80},{x:0,y:80}];
 assert.equal(validPolygon(points),true);const factor=5/distance(points[0],points[1]);
 assert.ok(Math.abs(polygonArea(points)*factor**2-20)<1e-9);
 const doubled=points.map(p=>({x:p.x*2,y:p.y*2}));assert.ok(Math.abs(polygonArea(doubled)*(factor/2)**2-20)<1e-9);
 assert.equal(validPolygon([points[0],points[2],points[1],points[3]]),false);
 assert.equal(validPolygon([points[0],points[1]]),false);
});
test('Heat preparation exports only confirmed rooms and never pretends missing data is complete',()=>{
 const base={id:'1',page:1,name:'Woonkamer',area:20,points:[],referenceMeters:5,metersPerPoint:.05,reviewed:true};
 const draft=measurementHeatDraft('Test',[base,{...base,id:'2',reviewed:false}]);
 assert.equal(draft.rooms.length,1);assert.equal(draft.rooms[0].height,0);assert.deepEqual(draft.rooms[0].surfaces,[]);
 assert.equal(calculateHeatLoss(parseHeatFile(draft)).result,null);assert.throws(()=>measurementHeatDraft('Test',[]));
});
