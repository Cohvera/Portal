/** Indicative steady-state calculation, not an implementation of EN 12831. */
export type Surface = { id:string; name:string; kind:'wall'|'window'|'roof'|'floor'|'door'; area:number; u:number; boundary:'outside'|'adjacent'; adjacentTemperature:number };
export type HeatRoom = {id:string; name:string; area:number; height:number; temperature:number; ventilation:number; infiltration:number; recovery:number; bridges:number; surfaces:Surface[]};
export type HeatCalculation = {version:1; name:string; address:string; reference:string; outdoor:number; allowance:number; notes:string; rooms:HeatRoom[]};
export const surfaceNames:Record<Surface['kind'],string>={wall:'Muur',window:'Raam',roof:'Dak / plafond',floor:'Vloer',door:'Deur'};
export const id = () => crypto.randomUUID();
export function newRoom():HeatRoom {return {id:id(),name:'Nieuwe ruimte',area:0,height:2.6,temperature:20,ventilation:0,infiltration:0,recovery:0,bridges:0,surfaces:[]};}
export function newCalculation():HeatCalculation {return {version:1,name:'Nieuwe warmteverliesberekening',address:'',reference:'',outdoor:-8,allowance:0,notes:'',rooms:[newRoom()]};}
export function newSurface():Surface {return {id:id(),name:'',kind:'wall',area:0,u:0.24,boundary:'outside',adjacentTemperature:10};}
export function validateHeatCalculation(d:HeatCalculation):string[] {
  const errors:string[]=[];
  const range=(n:number,min:number,max:number,label:string)=>{if(!Number.isFinite(n)||n<min||n>max)errors.push(`${label}: vul een getal van ${min} tot ${max} in.`);};
  if(!d.name.trim())errors.push('Vul een naam voor de berekening in.');
  range(d.outdoor,-40,20,'Buitentemperatuur');range(d.allowance,0,30,'Reserve');
  if(!d.rooms.length)errors.push('Voeg minstens één ruimte toe.');
  for(const [i,r] of d.rooms.entries()){
    const label=r.name.trim()||`Ruimte ${i+1}`;
    if(!r.name.trim())errors.push(`${label}: vul een naam in.`);
    range(r.area,0.1,10000,`${label} · vloeroppervlakte`);range(r.height,0.1,30,`${label} · hoogte`);
    range(r.temperature,5,35,`${label} · binnentemperatuur`);
    if(r.temperature<=d.outdoor)errors.push(`${label}: de binnentemperatuur moet hoger zijn dan de buitentemperatuur.`);
    range(r.ventilation,0,50000,`${label} · ventilatie`);range(r.infiltration,0,10,`${label} · infiltratie`);
    range(r.recovery,0,95,`${label} · warmteterugwinning`);range(r.bridges,0,10000,`${label} · koudebruggen`);
    if(!r.surfaces.length)errors.push(`${label}: voeg minstens één verliesoppervlak toe.`);
    for(const s of r.surfaces){
      range(s.area,0.01,10000,`${label} · ${s.name||surfaceNames[s.kind]} oppervlakte`);
      range(s.u,0.01,10,`${label} · ${s.name||surfaceNames[s.kind]} U-waarde`);
      range(s.adjacentTemperature,-40,35,`${label} · aangrenzende temperatuur`);
    }
  }
  return errors;
}
export function roomHeatLoss(r:HeatRoom,outdoor:number){
  const delta=Math.max(0,r.temperature-outdoor),volume=r.area*r.height;
  const surfaces=r.surfaces.map(s=>({...s,watts:s.area*s.u*Math.max(0,r.temperature-(s.boundary==='outside'?outdoor:s.adjacentTemperature))}));
  const transmission=surfaces.reduce((sum,s)=>sum+s.watts,0);
  const bridges=r.bridges*delta;
  const ventilation=0.34*r.ventilation*(1-r.recovery/100)*delta;
  // Infiltration is an effective air change rate, not a blower-door n50 value.
  const infiltration=0.34*volume*r.infiltration*delta;
  const total=transmission+bridges+ventilation+infiltration;
  return {surfaces,volume,transmission,bridges,ventilation,infiltration,total,perM2:r.area>0?total/r.area:0};
}
export function calculateHeatLoss(d:HeatCalculation){
  const errors=validateHeatCalculation(d);
  if(errors.length)return {errors,result:null};
  const rooms=d.rooms.map(r=>({...roomHeatLoss(r,d.outdoor),id:r.id,name:r.name,area:r.area}));
  const sum=(key:'transmission'|'bridges'|'ventilation'|'infiltration'|'total'|'area')=>rooms.reduce((n,r)=>n+r[key],0);
  const total=sum('total'),reserve=total*d.allowance/100;
  return {errors,result:{rooms,transmission:sum('transmission'),bridges:sum('bridges'),ventilation:sum('ventilation'),infiltration:sum('infiltration'),area:sum('area'),total,reserve,withReserve:total+reserve}};
}
// Explicit shape validation keeps imported files out of unchecked UI/calculation paths.
export function parseHeatFile(value:unknown):HeatCalculation {
  const bad=():never=>{throw new Error('Ongeldig berekeningsbestand. Open een bestand dat met deze tool is bewaard.');};
  const obj=(v:unknown):Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:bad();
  const str=(v:unknown,max=200):string=>typeof v==='string'&&v.length<=max?v:bad();
  const num=(v:unknown):number=>typeof v==='number'&&Number.isFinite(v)?v:bad();
  const list=(v:unknown,max:number):unknown[]=>Array.isArray(v)&&v.length<=max?v:bad();
  const one=<T extends string>(v:unknown,values:readonly T[]):T=>values.includes(v as T)?v as T:bad();
  const d=obj(value);if(d.version!==1)bad();
  const rooms=list(d.rooms,100).map(value=>{
    const r=obj(value);
    return {id:id(),name:str(r.name),area:num(r.area),height:num(r.height),temperature:num(r.temperature),ventilation:num(r.ventilation),infiltration:num(r.infiltration),recovery:num(r.recovery),bridges:num(r.bridges),surfaces:list(r.surfaces,100).map(value=>{
      const s=obj(value);return {id:id(),name:str(s.name),kind:one(s.kind,['wall','window','roof','floor','door']),area:num(s.area),u:num(s.u),boundary:one(s.boundary,['outside','adjacent']),adjacentTemperature:num(s.adjacentTemperature)} as Surface;
    })};
  });
  return {version:1,name:str(d.name),address:str(d.address),reference:str(d.reference),outdoor:num(d.outdoor),allowance:num(d.allowance),notes:str(d.notes,5000),rooms};
}
