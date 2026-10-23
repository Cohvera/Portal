"use client";
import {useState} from 'react';
import {request} from '../../../../lib/projects';
import {Monitor,ProjectSelection} from '../../../../lib/qbox-monitor';
export function ColumnSettings({data,companyCode,canManage,onSaved}:{data:Monitor;companyCode:string;canManage:boolean;onSaved:()=>void}){
 const config=data.configuration;
 const [selected,setSelected]=useState(config?.selectedColumns??[]);
 const [filter,setFilter]=useState<ProjectSelection>(config?.projectFilter??{statusCodes:[],outOfWip:'any'});
 const [statusMode,setStatusMode]=useState(config?.projectFilter?.statusCodes.length?'selected':'all');
 const [major,minor]=(config?.readerVersion??'').split('.').map(Number);
 const supportsFilters=major>3||(major===3&&minor>=3);
 const selection=filter.statusCodes.length||filter.outOfWip!=='any'?filter:null;
 const knownStatuses=Array.from(new Map((config?.availableStatuses??[]).map(s=>[s.code,s])).values());
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const available=new Set(config?.schemaColumns.map(c=>c.toLowerCase())??[]);
 const changed=JSON.stringify(selection)!==JSON.stringify(config?.projectFilter??null)||JSON.stringify([...selected].sort())!==JSON.stringify([...(config?.selectedColumns??[])].sort());
 async function save(){
  if(statusMode==='selected'&&!filter.statusCodes.length){setMessage('Kies minstens één status of kies Alle statussen.');return;}
  setBusy(true);setMessage('');
  try{await request(`/api/companies/${encodeURIComponent(companyCode)}/middleware/qbox/columns`,{method:'PUT',body:JSON.stringify({revision:config?.revision,selectedColumns:selected,projectFilter:selection})});onSaved();setMessage('Opgeslagen. De Q-box neemt de keuze over bij de volgende sync.');}
  catch(error){setMessage(error instanceof Error?error.message:'Opslaan mislukt.');}finally{setBusy(false);}
 }
 return <section className="card"><h2>Projecten en gegevens</h2>
 <fieldset className="qbox-column-group" disabled={busy||!canManage||!supportsFilters}><legend>Welke hoofdprojecten ophalen?</legend>
 <p>Kies welke hoofdprojecten je wilt ophalen. Gekoppelde offertes en facturen worden mee opgehaald.</p>
 <label>Statussen<select value={statusMode} onChange={e=>{setStatusMode(e.target.value);if(e.target.value==='all')setFilter(f=>({...f,statusCodes:[]}));}}><option value="all">Alle statussen</option><option value="selected">Alleen gekozen statussen</option></select></label>
 {statusMode==='selected'&&<div>{!knownStatuses.length&&<p>Nog geen statuslijst ontvangen. Laat de bijgewerkte Q-box synchroniseren.</p>}{knownStatuses.map(s=><label key={s.code}><input type="checkbox" checked={filter.statusCodes.includes(s.code)} onChange={e=>setFilter(f=>({...f,statusCodes:e.target.checked?[...f.statusCodes,s.code].sort():f.statusCodes.filter(c=>c!==s.code)}))}/>{s.code} · {s.label}</label>)}{filter.statusCodes.filter(c=>!knownStatuses.some(s=>s.code===c)).map(c=><label key={c}><input type="checkbox" checked onChange={()=>setFilter(f=>({...f,statusCodes:f.statusCodes.filter(v=>v!==c)}))}/>{c} · Niet meer in gemelde statuslijst</label>)}</div>}
 <label>Uit WIP<select value={filter.outOfWip} onChange={e=>setFilter(f=>({...f,outOfWip:e.target.value as ProjectSelection['outOfWip']}))}><option value="any">Maakt niet uit (aan en uit)</option><option value="off">Alleen uit</option><option value="on">Alleen aan</option></select></label>
 </fieldset>
 {!supportsFilters&&<p>Projectselectie vereist reader 3.3 of nieuwer. Tot die tijd blijft de bestaande selectie behouden.</p>}
 <p>Projecten buiten deze selectie verdwijnen na de volgende geslaagde sync uit de actuele lijst. Hun gegevens blijven bewaard.</p>
 <h3>Extra gegevens</h3>
 <p>Vink aan welke extra gegevens je bij projecten, offertes en facturen wilt zien.</p>
 {config&&<p role="status">{config.appliedRevision===config.revision?'Opgeslagen instellingen toegepast.':'Opgeslagen instellingen wachten op de volgende sync.'}</p>}
 {!config?.schemaReportedAt&&<p role="status">Nog geen kolommen ontvangen van de Q-box. Na een eerste sync verschijnt de beschikbare selectie.</p>}
 {!canManage&&<p>Je hebt projectbeheerrechten nodig om deze instellingen te wijzigen.</p>}
 {Array.from(new Set(data.extraColumns.map(c=>c.group))).map(group=><fieldset key={group} className="qbox-column-group" disabled={busy||!canManage||!config?.schemaReportedAt}><legend>{group}</legend>{data.extraColumns.filter(c=>c.group===group).map(c=>{
  const present=available.has(c.source.toLowerCase());
  return <label key={c.source}><input type="checkbox" checked={selected.includes(c.source)} disabled={!present&&!selected.includes(c.source)} onChange={e=>setSelected(old=>e.target.checked?[...old,c.source]:old.filter(v=>v!==c.source))}/><span>{c.label} <code>{c.source}</code>{!present&&<small> · Niet aangetroffen in de gemelde database</small>}</span></label>;
 })}</fieldset>)}
 {canManage&&<button className="primary-button" disabled={busy||!changed||!config?.schemaReportedAt} onClick={save}>{busy?'Opslaan…':'Opslaan'}</button>}
 <p className="muted">Wijzigingen worden na opslaan bij de volgende sync toegepast. Gebruik ‘Nu synchroniseren’ om ze eerder op te halen.</p>
 {message&&<p role="status">{message}</p>}
 <details><summary>Verplichte exportvelden bekijken</summary><div className="qbox-table-scroll"><table><thead><tr><th>HFSQL-kolom</th><th>Exportveld</th></tr></thead><tbody>{data.columns.map(c=><tr key={c.field}><td>{c.source}</td><td><code>{c.field}</code></td></tr>)}</tbody></table></div></details>
 </section>;
}
