"use client";
import {useState} from 'react';
import {request} from '../../../../lib/projects';
import {Monitor,monitorTime,ProjectSelection} from '../../../../lib/qbox-monitor';
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
 return <section className="card"><h2>Projectselectie en HFSQL-kolommen</h2>
 <fieldset className="qbox-column-group" disabled={busy||!canManage||!supportsFilters}><legend>Welke hoofdprojecten ophalen?</legend>
 <p>De statuskeuze en Uit WIP-keuze gelden samen (EN). Alle gekoppelde offertes en facturen blijven bij hun hoofdproject, ongeacht hun eigen status of Uit WIP-vinkje.</p>
 <label>Statussen<select value={statusMode} onChange={e=>{setStatusMode(e.target.value);if(e.target.value==='all')setFilter(f=>({...f,statusCodes:[]}));}}><option value="all">Alle statussen</option><option value="selected">Alleen gekozen statussen</option></select></label>
 {statusMode==='selected'&&<div>{!knownStatuses.length&&<p>Nog geen statuslijst ontvangen. Laat de bijgewerkte Q-box synchroniseren.</p>}{knownStatuses.map(s=><label key={s.code}><input type="checkbox" checked={filter.statusCodes.includes(s.code)} onChange={e=>setFilter(f=>({...f,statusCodes:e.target.checked?[...f.statusCodes,s.code].sort():f.statusCodes.filter(c=>c!==s.code)}))}/>{s.code} · {s.label}</label>)}{filter.statusCodes.filter(c=>!knownStatuses.some(s=>s.code===c)).map(c=><label key={c}><input type="checkbox" checked onChange={()=>setFilter(f=>({...f,statusCodes:f.statusCodes.filter(v=>v!==c)}))}/>{c} · Niet meer in gemelde statuslijst</label>)}</div>}
 <label>Uit WIP<select value={filter.outOfWip} onChange={e=>setFilter(f=>({...f,outOfWip:e.target.value as ProjectSelection['outOfWip']}))}><option value="any">Maakt niet uit (aan en uit)</option><option value="off">Alleen uit (0)</option><option value="on">Alleen aan (1)</option></select></label>
 </fieldset>
 {!supportsFilters&&<p>Projectselectie vereist reader 3.3 of nieuwer. Tot die tijd blijft de bestaande selectie behouden.</p>}
 <p>Na een geslaagde sync verdwijnen hoofdprojecten buiten de keuze uit de actuele importlijst. Bestaande gegevens en koppelingen worden bewaard; Plenion wordt niet gewijzigd. De weergave ‘In uitvoering’ en het TV-scherm hebben daarnaast hun eigen weergavefilters. Kies bij Projecten ‘Alles’ om ook geïmporteerde gefactureerde of afgesloten projecten te zien.</p>
 <h3>Extra HFSQL-kolommen</h3>
 <p>De {data.columns.length} bestaande exportvelden blijven verplicht voor koppelingen, statussen en datums. Hieronder kies je extra PROJ-velden voor dit bedrijf. Ze worden als brongegevens getoond bij hoofdprojecten en onderliggende offertes/facturen; ze overschrijven geen lokale velden.</p>
 <p>Beschikbare kolommen gecontroleerd op de Q-box: {monitorTime(config?.schemaReportedAt)}. Reader: {config?.readerVersion??'nog niet bijgewerkt'}.</p>
 {config&&<p>Opgeslagen keuze: versie {config.revision} · Laatst bevestigd na geslaagde import: {config.appliedRevision??'nog niet bevestigd'}. De bevestiging verschijnt bij de volgende configuratie-opvraag.</p>}
 {!config?.schemaReportedAt&&<p role="status">Werk eerst de reader bij en voer een sync uit. Daarna kun je kiezen uit de kolommen die werkelijk in jullie database staan.</p>}
 {!canManage&&<p>Je hebt projectbeheerrechten nodig om deze instellingen te wijzigen.</p>}
 <p className="muted">Omschrijvingen zijn gebaseerd op de eerder onderzochte PROJ-velden, niet op een officiële datadictionary. Bedragen, notities en referenties blijven onbewerkte bronwaarden; een ID wordt niet automatisch een klantnaam. Uitgevinkte extra velden verdwijnen bij de volgende geslaagde import uit de opgeslagen brongegevens.</p>
 {Array.from(new Set(data.extraColumns.map(c=>c.group))).map(group=><fieldset key={group} className="qbox-column-group" disabled={busy||!canManage||!config?.schemaReportedAt}><legend>{group}</legend>{data.extraColumns.filter(c=>c.group===group).map(c=>{
  const present=available.has(c.source.toLowerCase());
  return <label key={c.source}><input type="checkbox" checked={selected.includes(c.source)} disabled={!present&&!selected.includes(c.source)} onChange={e=>setSelected(old=>e.target.checked?[...old,c.source]:old.filter(v=>v!==c.source))}/><span>{c.label} <code>{c.source}</code>{!present&&<small> · Niet aangetroffen in de gemelde database</small>}</span></label>;
 })}</fieldset>)}
 {canManage&&<button className="primary-button" disabled={busy||!changed||!config?.schemaReportedAt} onClick={save}>{busy?'Opslaan…':'Selectie en kolommen opslaan'}</button>}
 {message&&<p role="status">{message}</p>}
 <details><summary>Verplichte exportvelden bekijken</summary><div className="qbox-table-scroll"><table><thead><tr><th>HFSQL-kolom</th><th>Exportveld</th></tr></thead><tbody>{data.columns.map(c=><tr key={c.field}><td>{c.source}</td><td><code>{c.field}</code></td></tr>)}</tbody></table></div></details>
 <details><summary>Reader op de Q-box bijwerken</summary><p>Voer dit uit op de Q-box, vanuit de qbox-connector repository. Het installatiecommando bouwt en controleert eerst een nieuwe Docker-image, bewaart een reservekopie en behoudt de data/configuratie.</p><pre>{`git pull --ff-only\nsudo python3 scripts/install_reader.py --target "$HOME/plenion-reader"\ncd "$HOME/plenion-reader"\nsudo ./plenion.sh sync`}</pre><p>Installeer eerst de bijbehorende Portal-update. Er wordt vanuit dit scherm geen willekeurige code op de Q-box uitgevoerd.</p></details>
 </section>;
}
