import {test} from 'node:test';
import assert from 'node:assert/strict';
import {calculateHeatLoss,newCalculation,newRoom,parseHeatFile,roomHeatLoss,type HeatRoom} from './heat-loss';
const room:HeatRoom={...newRoom(),name:'Test',area:20,height:2.5,temperature:20,ventilation:50,infiltration:0.2,recovery:80,bridges:2,surfaces:[{id:'wall',name:'Gevel',kind:'wall',area:10,u:0.3,boundary:'outside',adjacentTemperature:10}]};
test('Hand calculation separates transmission, recovery, infiltration and bridges',()=>{
 const r=roomHeatLoss(room,-10);
 assert.equal(r.transmission,90);assert.equal(r.bridges,60);
 assert.ok(Math.abs(r.ventilation-102)<1e-10);assert.ok(Math.abs(r.infiltration-102)<1e-10);
 assert.equal(Math.round(r.total),354);assert.equal(r.volume,50);
});
test('Recovery does not reduce infiltration and warmer neighbours do not give a heating credit',()=>{
 const r=roomHeatLoss({...room,recovery:0,surfaces:[{...room.surfaces[0],boundary:'adjacent',adjacentTemperature:25}]},-10);
 assert.equal(r.transmission,0);assert.ok(Math.abs(r.infiltration-102)<1e-10);assert.equal(r.ventilation,510);
});
test('Building totals and reserve use unrounded room losses',()=>{
 const d={...newCalculation(),outdoor:-10,allowance:10,rooms:[room,{...room,id:'two'}]};
 const r=calculateHeatLoss(d).result!;assert.equal(Math.round(r.total),708);assert.ok(Math.abs(r.withReserve-778.8)<1e-9);
});
test('Incomplete and invalid inputs suppress the result',()=>{
 assert.equal(calculateHeatLoss(newCalculation()).result,null);
 for(const area of [NaN,-1,0,Infinity])assert.equal(calculateHeatLoss({...newCalculation(),rooms:[{...room,area}]}).result,null);
 assert.equal(calculateHeatLoss({...newCalculation(),rooms:[{...room,recovery:100}]}).result,null);
});
test('Saved calculation roundtrips and rejects invalid shapes and excessive arrays',()=>{
 const d={...newCalculation(),rooms:[room]};const parsed=parseHeatFile(JSON.parse(JSON.stringify(d)));
 assert.equal(parsed.rooms[0].name,room.name);assert.deepEqual(calculateHeatLoss(parsed).result?.total,calculateHeatLoss(d).result?.total);
 for(const value of [{},null,{...d,rooms:[{}]},{...d,rooms:Array(101).fill(room)},{...d,rooms:[{...room,surfaces:[{...room.surfaces[0],kind:'bad'}]}]}])assert.throws(()=>parseHeatFile(value));
});
