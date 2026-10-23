"use client";
import {ColumnSettings} from "./ColumnSettings";
import {useState} from 'react';
import {request} from '../../../../lib/projects';
import Link from 'next/link';
import {useCompany} from '../../../PortalShell';
import {useQboxMonitor,stateLabels,phaseLabels,monitorTime} from '../../../../lib/qbox-monitor';
import './qbox.css';
function SyncIcon({spinning=false}:{spinning?:boolean}){
 return <svg className={spinning?'qbox-action-icon qbox-action-icon-spinning':'qbox-action-icon'} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 7a7 7 0 0 1 11.6-1L20 9M4 15l2.3 3A7 7 0 0 0 17.9 17"/></svg>;
}
export default function QboxPage(){
 const {companyCode,companies,can}=useCompany();
 if(!can('projects.read'))return <main className="main"><h1>Q-box-connector</h1><p>Je hebt geen toegang tot de projectkoppeling van dit bedrijf.</p></main>;
 return <QboxDashboard key={companyCode} companyCode={companyCode} canManage={can("projects.manage")} companyName={companies.find(c=>c.code===companyCode)?.name||companyCode}/>;
}
function QboxDashboard({companyCode,companyName,canManage}:{companyCode:string;companyName:string;canManage:boolean}){
 const {data,error,loading,refresh}=useQboxMonitor(companyCode);
 const latest=data?.events[0];
 const [requesting,setRequesting]=useState(false),[syncMessage,setSyncMessage]=useState('');
 const config=data?.configuration;
 const pending=!!config?.syncRequestId&&config.syncRequestId!==config.syncAcknowledgedId;
 const manualEvent=data?.events.find(e=>e.runId===config?.syncRequestId);
 const waiting=pending&&!manualEvent;
 const running=data?.state==='running';
 const syncDisabled=requesting||pending||running||!config?.commandPollAt;
 const syncLabel=requesting?'Aanvragen…':running?'Synchroniseren…':pending?'Sync aangevraagd':'Nu synchroniseren';
 const syncHint=running?'De Q-box is bezig. Het resultaat verschijnt hieronder.':pending?'De aanvraag staat klaar voor de Q-box.':!config?.commandPollAt?'Nog niet beschikbaar: de Q-box heeft de controle op sync-aanvragen nog niet uitgevoerd.':'Start een nieuwe import. De Q-box reageert normaal binnen 30 seconden.';
 async function synchronize(){
  setRequesting(true);setSyncMessage('');
  try{await request(`/api/companies/${encodeURIComponent(companyCode)}/middleware/qbox/sync`,{method:'POST',body:'{}'});setSyncMessage('Sync aangevraagd. De Q-box haalt de aanvraag normaal binnen 30 seconden op.');refresh();}
  catch(e){setSyncMessage(e instanceof Error?e.message:'Sync aanvragen mislukt.');}
  finally{setRequesting(false);}
 }

 return <main className="main qbox-monitor">
 <nav className="qbox-navigation" aria-label="Gerelateerde pagina’s"><Link href="/tools">← Tools & Middleware</Link><Link href="/projects">Projecten bekijken <span aria-hidden="true">→</span></Link></nav>
 <header className="section-heading qbox-heading"><div><p className="eyebrow">Middleware · {companyName}</p><h1>Q-box · Plenion-connector</h1><p className="muted">HFSQL uitlezen, export maken en projecten synchroniseren met Portal.</p></div>
 <div className="qbox-actions-panel"><div className="qbox-actions">
 {canManage&&<button type="button" className="qbox-action qbox-action-primary" disabled={syncDisabled} aria-describedby="qbox-sync-hint" onClick={synchronize}><SyncIcon spinning={requesting||running}/>{syncLabel}</button>}
 <button type="button" className="qbox-action qbox-action-secondary" disabled={loading} onClick={refresh} title="Alleen de getoonde status vernieuwen"><SyncIcon spinning={loading}/>{loading?'Ophalen…':'Status vernieuwen'}</button>
 </div>{canManage&&<p id="qbox-sync-hint" className="qbox-action-hint">{syncHint}</p>}</div></header>
 {syncMessage&&<p role="status">{syncMessage}</p>}
 {waiting&&<p role="status">Wachten tot de Q-box de sync-aanvraag ophaalt. Bij een offline Q-box blijft de aanvraag klaarstaan.</p>}
 {error&&<div className="alert" role="alert">Status kon niet worden vernieuwd: {error}. Eventuele gegevens hieronder zijn van de vorige controle.</div>}
 {loading&&!data?<p role="status">Koppeling ophalen…</p>:data&&<>
 <section className="qbox-metrics" aria-label="Status van de koppeling">
 <article className="card"><h2>Verbinding</h2><strong className={`qbox-state qbox-state-${data.state}`}>{stateLabels[data.state]||data.state}</strong><p>Laatste contact: {monitorTime(data.lastContactAt)}</p></article>
 <article className="card"><h2>Laatste geslaagde import</h2><strong>{monitorTime(data.lastImport?.receivedAt)}</strong><p>Bronstand: {monitorTime(data.lastImport?.sourceObservedAt)}</p><p>{data.lastImport?`${data.lastImport.projectCount} hoofdprojecten ontvangen`:'Nog geen import ontvangen'}</p></article>
 <article className="card"><h2>Laatste melding</h2><strong>{latest?phaseLabels[latest.phase]:'Nog geen readerstatus'}</strong><p>{monitorTime(latest?.observedAt)}</p><p>Reader: {latest?.readerVersion||'onbekend'} · verwacht interval {data.expectedIntervalMinutes} minuten</p></article>
 </section>
 {!latest&&<div className="alert">Nog geen statusmeldingen ontvangen van deze Q-box.</div>}
 {(data.state==='stale'||data.state==='interrupted')&&<div className="alert">Er is geen recente afgeronde synchronisatie bevestigd. De Q-box, timer of netwerkverbinding kan onbereikbaar zijn. De laatst geslaagde projectimport blijft behouden.</div>}
 <section className="card"><h2>Synchronisatielog</h2><p className="muted">De laatste synchronisaties en eventuele fouten, tot 30 dagen terug.</p>
 {data.events.length?<div className="qbox-table-scroll"><table><thead><tr><th>Tijdstip Q-box</th><th>Ontvangen</th><th>Stap / resultaat</th><th>Exportrecords</th><th>Poging</th></tr></thead><tbody>{data.events.map(e=><tr key={e.id}><td>{monitorTime(e.observedAt)}</td><td>{monitorTime(e.receivedAt)}</td><td>{phaseLabels[e.phase]||e.phase}{e.httpStatus?` (HTTP ${e.httpStatus})`:''}</td><td>{e.recordCount??'—'}</td><td title={e.runId}><code>{e.runId.slice(0,8)}</code></td></tr>)}</tbody></table></div>:<p>Nog geen statusmeldingen ontvangen.</p>}
 <details><summary>Meer foutdetails op de Q-box</summary><p>Dit overzicht toont de stappen en resultaten. De volledige readeruitvoer blijft lokaal beschikbaar:</p><pre>sudo journalctl -u cohvera-reader-sync.service -u cohvera-reader-command.service -n 100 --no-pager</pre></details>
 </section>
 <ColumnSettings key={data.configuration?.revision??"new"} data={data} companyCode={companyCode} canManage={canManage} onSaved={refresh}/><p className="muted">Dit scherm vernieuwt automatisch elke 30 seconden. De Q-box blijft zelfstandig synchroniseren; dit scherm hoeft niet open te blijven.</p>
 </>}
 </main>;
}
