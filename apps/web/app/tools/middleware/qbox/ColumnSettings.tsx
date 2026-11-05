"use client";
import {useState} from 'react';
import {request} from '../../../../lib/projects';
import {Monitor,ProjectSelection} from '../../../../lib/qbox-monitor';
export function ColumnSettings({data,companyCode,canManage,onSaved}:{data:Monitor;companyCode:string;canManage:boolean;onSaved:()=>void}){
 const config=data.configuration;
 const [selected,setSelected]=useState(config?.selectedColumns??[]);
 const [major,minor]=(config?.readerVersion??'').split('.').map(Number);
 const supportsFilters=major>3||(major===3&&minor>=3);
 const supportsRelationshipFilter=major>3||(major===3&&minor>=5);
 const supportsStatusIds=major>3||(major===3&&minor>=7);
 const knownStatuses=Array.from(new Map((config?.availableStatuses??[]).map(s=>[s.id??s.code,s])).values());
 const useIds=supportsStatusIds&&knownStatuses.length>0&&knownStatuses.every(s=>s.id);
 const [filter,setFilter]=useState<ProjectSelection>(()=>{
  const current=config?.projectFilter??{statusCodes:[],outOfWip:'any'};
  if(useIds&&current.statusCodes.length&&current.statusCodes.every(c=>knownStatuses.some(s=>s.code===c)))return {...current,statusCodes:[],statusIds:knownStatuses.filter(s=>current.statusCodes.includes(s.code)).map(s=>s.id!).sort()};
  return current;
 });
 const [statusMode,setStatusMode]=useState(config?.projectFilter?.statusCodes.length||config?.projectFilter?.statusIds?.length?'selected':'all');
 const selectedStatuses=useIds?filter.statusIds??[]:filter.statusCodes;
 const {statusIds,...baseFilter}=filter;
 const selection=filter.statusCodes.length||statusIds?.length||filter.outOfWip!=='any'||filter.relationshipType?{...baseFilter,...(statusIds?.length?{statusIds}:{})}:null;
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const available=new Set(config?.schemaColumns.map(c=>c.toLowerCase())??[]);
 const changed=JSON.stringify(selection)!==JSON.stringify(config?.projectFilter??null)||JSON.stringify([...selected].sort())!==JSON.stringify([...(config?.selectedColumns??[])].sort());
 async function save(){
  if(statusMode==='selected'&&!selectedStatuses.length){setMessage('Kies minstens één status of kies Alle statussen.');return;}
  if(filter.relationshipType&&!supportsRelationshipFilter){setMessage(`De Q-box meldt reader ${config?.readerVersion??'onbekend'}. Werk ook sync.py bij en voer een sync uit; alleen de Docker-image herbouwen werkt deze versie niet bij.`);return;}
  if(filter.relationshipType&&!available.has(filter.relationshipType==='prospect'?'idprospect':'klcleunik')){setMessage('Het benodigde prospect- of klantnummerveld is nog niet gemeld. Vernieuw de Q-box-metadata en synchroniseer opnieuw.');return;}
  setBusy(true);setMessage('');
  try{await request(`/api/companies/${encodeURIComponent(companyCode)}/middleware/qbox/columns`,{method:'PUT',body:JSON.stringify({revision:config?.revision,selectedColumns:selected,projectFilter:selection})});onSaved();setMessage('Opgeslagen. De Q-box neemt de keuze over bij de volgende sync.');}
  catch(error){setMessage(error instanceof Error?error.message:'Opslaan mislukt.');}finally{setBusy(false);}
 }
 return <section className="card"><h2>Projecten en gegevens</h2>
 <fieldset className="qbox-column-group" disabled={busy||!canManage||!supportsFilters}><legend>Welke hoofdprojecten ophalen?</legend>
 <p>Kies welke hoofdprojecten je wilt ophalen. Gekoppelde offertes en facturen worden mee opgehaald.</p>
 <label>Statussen<select value={statusMode} onChange={e=>{setStatusMode(e.target.value);if(e.target.value==='all')setFilter(f=>{const {statusIds,...rest}=f;return {...rest,statusCodes:[]};});}}><option value="all">Alle statussen</option><option value="selected">Alleen gekozen statussen</option></select></label>
 {statusMode==='selected'&&<div>{!knownStatuses.length&&<p>Nog geen statuslijst ontvangen. Laat de bijgewerkte Q-box synchroniseren.</p>}{knownStatuses.map(s=>{
  const key=useIds?s.id!:s.code;
  return <label key={s.id??s.code}><input type="checkbox" checked={selectedStatuses.includes(key)} onChange={e=>setFilter(f=>{
   const old=useIds?f.statusIds??[]:f.statusCodes;
   const chosen=e.target.checked?[...old,key].sort():old.filter(c=>c!==key);
   return useIds?{...f,statusCodes:[],statusIds:chosen}:{...f,statusCodes:chosen};
  })}/>{s.code} · {s.label}{s.id&&<small> · ID {s.id}</small>}</label>;
 })}{selectedStatuses.filter(c=>!knownStatuses.some(s=>(useIds?s.id:s.code)===c)).map(c=><label key={c}><input type="checkbox" checked onChange={()=>setFilter(f=>useIds?{...f,statusIds:f.statusIds?.filter(v=>v!==c)}:{...f,statusCodes:f.statusCodes.filter(v=>v!==c)})}/>{c} · Niet meer in gemelde statuslijst</label>)}</div>}
 {!useIds&&<p>Werk de Q-box bij naar reader 3.7 en vernieuw de statuslijst om op unieke status-ID’s te selecteren. De bestaande selectie gebruikt nog statuscodes.</p>}
 <label>Uit WIP<select value={filter.outOfWip} onChange={e=>setFilter(f=>({...f,outOfWip:e.target.value as ProjectSelection['outOfWip']}))}><option value="any">Maakt niet uit (aan en uit)</option><option value="off">Alleen uit</option><option value="on">Alleen aan</option></select></label>
 </fieldset>
 <fieldset className="qbox-column-group" disabled={busy||!canManage}><legend>Prospect of klant</legend>
 <label>Relatie<select value={filter.relationshipType??'any'} onChange={e=>setFilter(f=>{const {relationshipType,...rest}=f;return e.target.value==='any'?rest:{...rest,relationshipType:e.target.value as 'prospect'|'customer'};})}><option value="any">Alle</option><option value="prospect">Prospect</option><option value="customer">Klant</option></select></label>
 {!supportsRelationshipFilter&&<p>De Q-box meldt reader {config?.readerVersion??'onbekend'}. Werk ook het Q-box-script bij en synchroniseer om deze keuze op te slaan. Alleen de Docker-image herbouwen werkt het script niet bij.</p>}
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
  const automatic=present&&(c.source==='STAT'||((major>3||(major===3&&minor>=6))&&['IDProsPect','KLCLEUNIK'].includes(c.source)));
  return <label key={c.source}><input type="checkbox" checked={automatic||selected.includes(c.source)} disabled={automatic||(!present&&!selected.includes(c.source))} onChange={e=>setSelected(old=>e.target.checked?[...old,c.source]:old.filter(v=>v!==c.source))}/><span>{c.label} <code>{c.source}</code>{automatic&&<small> · Automatisch meegestuurd voor de projectfilter</small>}{!present&&<small> · Niet aangetroffen in de gemelde database</small>}</span></label>;
 })}</fieldset>)}
 {canManage&&<button className="primary-button" disabled={busy||!changed||!config?.schemaReportedAt} onClick={save}>{busy?'Opslaan…':'Opslaan'}</button>}
 <p className="muted">Wijzigingen worden na opslaan bij de volgende sync toegepast. Gebruik ‘Nu synchroniseren’ om ze eerder op te halen.</p>
 {message&&<p role="status">{message}</p>}
 <details><summary>Verplichte exportvelden bekijken</summary><div className="qbox-table-scroll"><table><thead><tr><th>HFSQL-kolom</th><th>Exportveld</th></tr></thead><tbody>{data.columns.map(c=><tr key={c.field}><td>{c.source}</td><td><code>{c.field}</code></td></tr>)}</tbody></table></div></details>
 </section>;
}
