"use client";
import Link from 'next/link';
import {useEffect,useRef,useState} from 'react';
import {calculateHeatLoss,id,newCalculation,newRoom,newSurface,parseHeatFile,roomHeatLoss,surfaceNames,type HeatCalculation,type HeatRoom,type Surface} from '../../../lib/heat-loss';
import './heat-loss.css';
const fmt=(n:number,d=0)=>n.toLocaleString('nl-BE',{maximumFractionDigits:d,minimumFractionDigits:d});
function NumberField({label,value,onChange,min=0,max=10000,step='any',hint}:{label:string;value:number;onChange:(n:number)=>void;min?:number;max?:number;step?:string;hint?:string}){
 return <label className="heat-field"><span>{label}</span><input type="number" min={min} max={max} step={step} value={Number.isFinite(value)?value:''} onChange={e=>onChange(e.target.value===''?NaN:Number(e.target.value))}/>{hint&&<small>{hint}</small>}</label>;
}
export default function HeatLossPage(){
 const [data,setData]=useState<HeatCalculation|null>(null),[selected,setSelected]=useState(''),[dirty,setDirty]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState('');
 const file=useRef<HTMLInputElement>(null);
 useEffect(()=>{const d=newCalculation();setData(d);setSelected(d.rooms[0].id);},[]);
 useEffect(()=>{const warn=(e:BeforeUnloadEvent)=>{if(dirty)e.preventDefault();};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty]);
 if(!data)return <main className="main">Berekening openen…</main>;
 const update=(next:HeatCalculation)=>{setData(next);setDirty(true);setNotice('');};
 const patch=(values:Partial<HeatCalculation>)=>update({...data,...values});
 const room=data.rooms.find(r=>r.id===selected)||data.rooms[0];
 const patchRoom=(values:Partial<HeatRoom>)=>patch({rooms:data.rooms.map(r=>r.id===room?.id?{...r,...values}:r)});
 const patchSurface=(surface:Surface,values:Partial<Surface>)=>patchRoom({surfaces:room.surfaces.map(s=>s.id===surface.id?{...s,...values}:s)});
 const {errors,result}=calculateHeatLoss(data);
 const current=room&&result?.rooms.find(r=>r.id===room.id);
 const replace=(d:HeatCalculation)=>{setData(d);setSelected(d.rooms[0]?.id||'');setDirty(false);setError('');setNotice('Berekening geopend.');};
 const confirmReplace=()=>!dirty||window.confirm('Je hebt niet-bewaarde wijzigingen. Wil je deze vervangen?');
 const save=()=>{try{
   const json=JSON.stringify(data,(_key,value)=>{if(typeof value==='number'&&!Number.isFinite(value))throw new Error('Vul de lege getalvelden in voordat je bewaart.');return value;},2);
   const url=URL.createObjectURL(new Blob([json],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`warmteverlies-${data.name.replace(/[^a-zA-Z0-9-]/g,'-').slice(0,70)||'berekening'}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setDirty(false);setError('');setNotice('Berekeningsbestand gedownload. Bewaar dit bestand om later verder te werken.');
 }catch(e){setError((e as Error).message);}};
 return <main className="main heat-page">
  <header className="heat-heading heat-no-print"><div><Link href="/tools">← Tools & Solutions</Link><p className="eyebrow">Engineering · eerste versie</p><h1>Warmteverliescalculator</h1><p>Van bouwdelen naar een helder resultaat per ruimte.</p></div><div className="heat-actions"><button className="secondary-button" onClick={()=>{if(confirmReplace()){replace(newCalculation());setNotice('Nieuwe berekening gestart.');}}}>Nieuwe berekening</button><button className="secondary-button" onClick={()=>file.current?.click()}>Bestand openen</button><button className="button-primary" onClick={save}>Berekening bewaren</button></div></header>
  <input ref={file} hidden type="file" accept=".json,application/json" onChange={async e=>{const f=e.target.files?.[0];e.target.value='';if(!f)return;try{if(f.size>2_000_000)throw new Error('Het bestand is te groot (maximaal 2 MB).');const d=parseHeatFile(JSON.parse(await f.text()));if(confirmReplace())replace(d);}catch(e){setError(e instanceof SyntaxError?'Dit is geen geldig berekeningsbestand.':(e as Error).message);}}}/>
  <div className="heat-intro heat-no-print"><strong>Indicatieve warmteverliesberekening</strong><p>Controleer alle voorbeeldwaarden voor jouw gebouw. Dit is geen genormeerde NBN EN 12831-berekening of EPB-attest. De berekening blijft in dit tabblad: gebruik ‘Berekening bewaren’ vóór je weggaat. Geen centrale opslag of automatische projectkoppeling.</p><span>{dirty?'Niet-bewaarde wijzigingen':'Bewaren en opnieuw openen via een berekeningsbestand'}</span></div>
  {notice&&<p className="heat-no-print" role="status">{notice}</p>}{error&&<p className="alert heat-no-print" role="alert">{error}</p>}
  <div className="heat-workspace heat-no-print"><div className="heat-editor">
   <section className="card"><p className="eyebrow">01 · Gebouw</p><h2>Project & ontwerpcondities</h2><div className="heat-fields">
    <label className="heat-field">Naam berekening<input value={data.name} maxLength={200} onChange={e=>patch({name:e.target.value})}/></label>
    <label className="heat-field">Projectreferentie<input value={data.reference} maxLength={200} placeholder="Projectnummer of klant" onChange={e=>patch({reference:e.target.value})}/></label>
    <label className="heat-field">Adres<input value={data.address} maxLength={200} onChange={e=>patch({address:e.target.value})}/></label>
    <NumberField label="Ontwerpbuitentemperatuur (°C)" value={data.outdoor} min={-40} max={20} onChange={outdoor=>patch({outdoor})} hint="−8 °C is een startwaarde, geen postcodebepaling. Controleer de lokale ontwerpconditie."/>
    <NumberField label="Extra reserve (%)" value={data.allowance} max={30} onChange={allowance=>patch({allowance})} hint="Optioneel, apart vermeld. Geen automatische opwarmtoeslag."/>
   </div></section>
   <section className="card"><div className="heat-heading"><div><p className="eyebrow">02 · Ruimtes</p><h2>Ruimtes & ventilatie</h2></div><button className="secondary-button" disabled={data.rooms.length>=100} onClick={()=>{const r=newRoom();patch({rooms:[...data.rooms,r]});setSelected(r.id);}}>+ Ruimte</button></div>
    <div className="heat-tabs" aria-label="Ruimte kiezen">{data.rooms.map(r=><button key={r.id} aria-pressed={r.id===room?.id} onClick={()=>setSelected(r.id)}>{r.name||'Naamloos'}</button>)}</div>
    {room&&<><div className="heat-fields">
     <label className="heat-field">Naam ruimte<input value={room.name} maxLength={200} onChange={e=>patchRoom({name:e.target.value})}/></label>
     <NumberField label="Vloeroppervlakte (m²)" value={room.area} min={0.1} onChange={area=>patchRoom({area})}/>
     <NumberField label="Gemiddelde hoogte (m)" value={room.height} min={0.1} max={30} onChange={height=>patchRoom({height})}/>
     <NumberField label="Gewenste binnentemperatuur (°C)" value={room.temperature} min={5} max={35} onChange={temperature=>patchRoom({temperature})}/>
     <NumberField label="Buitenluchtdebiet ventilatie (m³/h)" value={room.ventilation} max={50000} onChange={ventilation=>patchRoom({ventilation})} hint="Alleen verse buitenlucht; tel doorstroomlucht tussen kamers niet opnieuw mee."/>
     <NumberField label="Effectieve warmteterugwinning (%)" value={room.recovery} max={95} onChange={recovery=>patchRoom({recovery})} hint="0% zonder WTW. Gebruik het effectieve winterrendement voor deze luchtstroom."/>
     <NumberField label="Extra infiltratie (luchtwisselingen/h)" value={room.infiltration} max={10} onChange={infiltration=>patchRoom({infiltration})} hint="Werkelijk extra luchtlek bij ontwerpcondities, niet de n50-waarde van een blowerdoortest. Vermijd dubbeltelling met ventilatie."/>
     <NumberField label="Koudebruggen naar buiten (W/K)" value={room.bridges} onChange={bridges=>patchRoom({bridges})} hint="Som van ψ × lengte en puntverliezen. 0 betekent dat ze niet zijn meegerekend."/>
    </div><p className="muted">Ruimtevolume: {Number.isFinite(room.area*room.height)?fmt(room.area*room.height,1):'—'} m³. Ventilatie en infiltratie staan standaard op 0: vul beide bewust in.</p>
    <div className="heat-actions"><button className="secondary-button" disabled={data.rooms.length>=100} onClick={()=>{const copy={...room,id:id(),name:`${room.name.slice(0,190)} (kopie)`,surfaces:room.surfaces.map(s=>({...s,id:id()}))};patch({rooms:[...data.rooms,copy]});setSelected(copy.id);}}>Ruimte dupliceren</button><button className="secondary-button" disabled={data.rooms.length===1} onClick={()=>{if(window.confirm(`Ruimte “${room.name}” verwijderen?`)){patch({rooms:data.rooms.filter(r=>r.id!==room.id)});setSelected(data.rooms.find(r=>r.id!==room.id)!.id);}}}>Ruimte verwijderen</button></div></>}
   </section>
   {room&&<section className="card"><div className="heat-heading"><div><p className="eyebrow">03 · {room.name}</p><h2>Bouwdelen & isolatie</h2></div><button className="secondary-button" disabled={room.surfaces.length>=100} onClick={()=>patchRoom({surfaces:[...room.surfaces,newSurface()]})}>+ Bouwdeel</button></div>
    <p className="muted">Gebruik netto oppervlaktes: trek ramen en deuren af van de muur en voeg ze afzonderlijk toe. Vul de U-waarde van het volledige bouwdeel in (bij ramen Uw, niet alleen Ug). De startwaarde 0,24 is slechts een voorbeeld.</p>
    {!room.surfaces.length&&<div className="heat-empty">Voeg muren, ramen, deuren, vloer en dak toe die warmte verliezen.</div>}
    {room.surfaces.map((s,index)=><fieldset className="heat-surface" key={s.id}><legend>Bouwdeel {index+1}</legend><div className="heat-fields">
     <label className="heat-field">Type<select value={s.kind} onChange={e=>patchSurface(s,{kind:e.target.value as Surface['kind']})}>{Object.entries(surfaceNames).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
     <label className="heat-field">Omschrijving<input value={s.name} maxLength={200} placeholder="Bijvoorbeeld voorgevel" onChange={e=>patchSurface(s,{name:e.target.value})}/></label>
     <NumberField label="Netto verliesoppervlakte (m²)" value={s.area} min={0.01} onChange={area=>patchSurface(s,{area})}/>
     <NumberField label="U-waarde (W/m²K)" value={s.u} min={0.01} max={10} onChange={u=>patchSurface(s,{u})}/>
     <label className="heat-field">Grenst aan<select value={s.boundary} onChange={e=>patchSurface(s,{boundary:e.target.value as Surface['boundary']})}><option value="outside">Buitenlucht</option><option value="adjacent">Ruimte met gekende temperatuur</option></select></label>
     {s.boundary==='adjacent'&&<NumberField label="Aangrenzende temperatuur (°C)" value={s.adjacentTemperature} min={-40} max={35} onChange={adjacentTemperature=>patchSurface(s,{adjacentTemperature})}/>}
    </div>{s.kind==='floor'&&<p className="muted">Een vloer op volle grond vereist een afzonderlijke grondverliesberekening. Deze tool berekent geen grondcontact volgens EN ISO 13370; gebruik ze hiervoor niet als volledige dimensionering.</p>}<div className="heat-heading"><strong>{current?`${fmt(current.surfaces.find(x=>x.id===s.id)?.watts||0)} W`:'Vul alle ruimtes in voor het resultaat'}</strong><button className="secondary-button" onClick={()=>patchRoom({surfaces:room.surfaces.filter(x=>x.id!==s.id)})}>Bouwdeel {index+1} verwijderen</button></div></fieldset>)}
   </section>}
   <section className="card"><h2>Notities & aannames</h2><label className="heat-field">Bron van U-waarden, ventilatiedebieten en andere aannames<textarea rows={4} maxLength={5000} value={data.notes} onChange={e=>patch({notes:e.target.value})}/></label></section>
  </div><aside className="heat-result card"><p className="eyebrow">04 · Resultaat</p><h2>Warmteverlies gebouw</h2>
   {result?<><div className="heat-total">{fmt(result.total/1000,2)} <span>kW</span></div><p>Stationair warmteverlies · {fmt(result.area,1)} m²</p><dl>{[['Bouwdelen',result.transmission],['Koudebruggen',result.bridges],['Ventilatie',result.ventilation],['Infiltratie',result.infiltration]].map(([label,n])=><div key={String(label)}><dt>{label}</dt><dd>{fmt(Number(n))} W</dd></div>)}</dl><div className="heat-reserve"><span>Met {fmt(data.allowance,1)}% reserve</span><strong>{fmt(result.withReserve/1000,2)} kW</strong></div><p className="muted">Geen toesteladvies. Sanitair warm water, opwarmvermogen en zon-/interne warmtewinsten zijn niet meegerekend.</p><button className="button-primary" onClick={()=>window.print()}>Rapport afdrukken / PDF</button></>:<><div className="heat-total">— <span>kW</span></div><p>Vul de ontbrekende gegevens in om het resultaat te berekenen.</p><ul className="heat-errors">{errors.map((e,i)=><li key={i}>{e}</li>)}</ul></>}
   {data.rooms.some(r=>r.ventilation===0&&r.infiltration===0)&&<p className="heat-warning">Bij minstens één ruimte is geen luchtverlies meegerekend.</p>}
   {data.rooms.every(r=>r.bridges===0)&&<p className="heat-warning">Koudebruggen zijn niet meegerekend.</p>}
  </aside></div>
  <section className="card heat-report"><p className="eyebrow">Warmteverliesrapport · indicatief</p><h2>{data.name}</h2><p>{[data.reference,data.address].filter(Boolean).join(' · ')}</p><p>Buitentemperatuur: {fmt(data.outdoor,1)} °C · Extra reserve: {fmt(data.allowance,1)}%</p>
   {result?<><div className="heat-table-scroll"><table><caption>Warmteverlies per ruimte</caption><thead><tr><th>Ruimte</th><th>m²</th><th>Bouwdelen + koudebruggen</th><th>Ventilatie + infiltratie</th><th>Totaal</th><th>W/m²</th></tr></thead><tbody>{result.rooms.map(r=><tr key={r.id}><th>{r.name}</th><td>{fmt(r.area,1)}</td><td>{fmt(r.transmission+r.bridges)} W</td><td>{fmt(r.ventilation+r.infiltration)} W</td><td><strong>{fmt(r.total)} W</strong></td><td>{fmt(r.perM2,1)}</td></tr>)}</tbody></table></div><p><strong>Gebouw: {fmt(result.total/1000,2)} kW · Reserve: {fmt(result.reserve/1000,2)} kW · Totaal met reserve: {fmt(result.withReserve/1000,2)} kW</strong></p>
   <details className="heat-details" open><summary>Invoer & berekening per ruimte</summary>{data.rooms.map(r=><div className="heat-room-report" key={r.id}><h3>{r.name}</h3><p>{fmt(r.area,1)} m² × {fmt(r.height,2)} m · Binnen {fmt(r.temperature,1)} °C · Buitenlucht {fmt(r.ventilation,1)} m³/h · WTW {fmt(r.recovery,1)}% · Infiltratie {fmt(r.infiltration,2)}/h · Koudebruggen {fmt(r.bridges,2)} W/K</p><div className="heat-table-scroll"><table><thead><tr><th>Bouwdeel</th><th>m²</th><th>U (W/m²K)</th><th>Grenstemperatuur</th><th>Verlies</th></tr></thead><tbody>{roomHeatLoss(r,data.outdoor).surfaces.map(s=><tr key={s.id}><td>{s.name||surfaceNames[s.kind]}</td><td>{fmt(s.area,2)}</td><td>{fmt(s.u,2)}</td><td>{fmt(s.boundary==='outside'?data.outdoor:s.adjacentTemperature,1)} °C</td><td>{fmt(s.watts)} W</td></tr>)}</tbody></table></div></div>)}</details></>:<p>Het rapport wordt beschikbaar zodra alle invoer geldig is.</p>}
   {data.notes&&<p className="heat-notes">{data.notes}</p>}
   <h3>Rekenmethode & grenzen</h3><p>Transmissie = Σ(U × netto oppervlak × temperatuurverschil). Koudebruggen = H × temperatuurverschil naar buiten. Ventilatie = 0,34 × buitenluchtdebiet × (1 − WTW/100) × temperatuurverschil. Infiltratie = 0,34 × volume × effectieve luchtwisselingen × temperatuurverschil. Warme aangrenzende ruimtes leveren geen aftrek op. De gebouwsom telt ruimteverliezen op; interne warmte-uitwisseling wordt niet gesaldeerd.</p>
   <p>Dit is een vereenvoudigde stationaire schatting, geen NBN EN 12831-berekening of EPB-attest. Grondcontact, gedetailleerde luchtstromen tussen ruimtes, opwarmvermogen en sanitair warm water zijn niet berekend. Een reservepercentage vervangt die berekeningen niet. Waarden van 0 voor ventilatie, infiltratie of koudebruggen betekenen dat die verliezen buiten de berekening blijven.</p>
   <p>Referenties: <a href="https://www.buildwise.be/nl/vakgebieden/verwarming-ventilatie-en-klimaatregeling/verwarming/warmteverlies/" target="_blank" rel="noreferrer">Buildwise: warmteverlies</a> · <a href="https://arch.kuleuven.be/tuur/thermisch-comfort" target="_blank" rel="noreferrer">KU Leuven: thermisch comfort</a>. Workflow geïnspireerd op <a href="https://bouw-energie.be/nl-be/bereken/warmteverliesberekening" target="_blank" rel="noreferrer">Bouw-Energie</a>; zelfstandige berekening, niet hun rekenmotor.</p>
  </section>
 </main>;
}
