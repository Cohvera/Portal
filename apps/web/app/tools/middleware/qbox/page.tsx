"use client";
import {ColumnSettings} from "./ColumnSettings";
import {ConnectionDiagnostics} from './ConnectionDiagnostics';
import {useState} from 'react';
import {request} from '../../../../lib/projects';
import Link from 'next/link';
import {useCompany} from '../../../PortalShell';
import {useQboxMonitor} from '../../../../lib/qbox-monitor';
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
 const [requesting,setRequesting]=useState(false),[syncMessage,setSyncMessage]=useState('');
 const config=data?.configuration;
 const pending=!!config?.syncRequestId&&config.syncRequestId!==config.syncAcknowledgedId;
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
 {error&&<div className="alert" role="alert">Status kon niet worden vernieuwd: {error}. Eventuele gegevens hieronder zijn van de vorige controle.</div>}
 {loading&&!data?<p role="status">Koppeling ophalen…</p>:data&&<>
 <ConnectionDiagnostics data={data} companyCode={companyCode}/>
 <ColumnSettings key={data.configuration?.revision??"new"} data={data} companyCode={companyCode} canManage={canManage} onSaved={refresh}/><p className="muted">De status vernieuwt automatisch elke 30 seconden.</p>
 </>}
 </main>;
}
