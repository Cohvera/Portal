"use client";
import {ColumnSettings} from "./ColumnSettings";
import Link from 'next/link';
import {useCompany} from '../../../PortalShell';
import {useQboxMonitor,stateLabels,phaseLabels,monitorTime} from '../../../../lib/qbox-monitor';
import './qbox.css';
export default function QboxPage(){
 const {companyCode,companies,can}=useCompany();
 if(!can('projects.read'))return <main className="main"><h1>Q-box-connector</h1><p>Je hebt geen toegang tot de projectkoppeling van dit bedrijf.</p></main>;
 return <QboxDashboard key={companyCode} companyCode={companyCode} canManage={can("projects.manage")} companyName={companies.find(c=>c.code===companyCode)?.name||companyCode}/>;
}
function QboxDashboard({companyCode,companyName,canManage}:{companyCode:string;companyName:string;canManage:boolean}){
 const {data,error,loading,refresh}=useQboxMonitor(companyCode);
 const latest=data?.events[0];
 return <main className="main qbox-monitor">
 <Link href="/tools">← Tools & Middleware</Link>
 <header className="section-heading"><div><p className="eyebrow">Middleware · {companyName}</p><h1>Q-box · Plenion-connector</h1><p className="muted">HFSQL uitlezen, export maken en projecten synchroniseren met Portal.</p></div><button className="secondary-button" disabled={loading} onClick={refresh}>Vernieuwen</button></header>
 {error&&<div className="alert" role="alert">Status kon niet worden vernieuwd: {error}. Eventuele gegevens hieronder zijn van de vorige controle.</div>}
 {loading&&!data?<p role="status">Koppeling ophalen…</p>:data&&<>
 <section className="qbox-metrics" aria-label="Status van de koppeling">
 <article className="card"><h2>Verbinding</h2><strong className={`qbox-state qbox-state-${data.state}`}>{stateLabels[data.state]||data.state}</strong><p>Laatste contact: {monitorTime(data.lastContactAt)}</p><p className="muted">Een geslaagde sync bevestigt de verbinding op dat moment; dit is geen live ping.</p></article>
 <article className="card"><h2>Laatste geslaagde import</h2><strong>{monitorTime(data.lastImport?.receivedAt)}</strong><p>Bronstand: {monitorTime(data.lastImport?.sourceObservedAt)}</p><p>{data.lastImport?`${data.lastImport.projectCount} hoofdprojecten ontvangen`:'Nog geen import ontvangen'}</p></article>
 <article className="card"><h2>Laatste melding</h2><strong>{latest?phaseLabels[latest.phase]:'Nog geen readerstatus'}</strong><p>{monitorTime(latest?.observedAt)}</p><p>Reader: {latest?.readerVersion||'onbekend'} · verwacht interval {data.expectedIntervalMinutes} minuten</p></article>
 </section>
 {!latest&&<div className="alert">De bestaande import kan al werken, maar deze Q-box heeft nog geen statusmeldingen verstuurd. Installeer de bijgewerkte reader en voer een sync uit om logging te activeren.</div>}
 {(data.state==='stale'||data.state==='interrupted')&&<div className="alert">Er is geen recente afgeronde synchronisatie bevestigd. De Q-box, timer of netwerkverbinding kan onbereikbaar zijn. De laatst geslaagde projectimport blijft behouden.</div>}
 <section className="card"><h2>Synchronisatielog</h2><p className="muted">De 100 nieuwste meldingen uit de laatste 30 dagen. Bij netwerkuitval worden maximaal 100 meldingen lokaal bewaard en later doorgestuurd. Tijdstip komt van de Q-box; ontvangst is het tijdstip in Portal. Geen wachtwoorden, sleutels of projectinhoud.</p>
 {data.events.length?<div className="qbox-table-scroll"><table><thead><tr><th>Tijdstip Q-box</th><th>Ontvangen</th><th>Stap / resultaat</th><th>Exportrecords</th><th>Poging</th></tr></thead><tbody>{data.events.map(e=><tr key={e.id}><td>{monitorTime(e.observedAt)}</td><td>{monitorTime(e.receivedAt)}</td><td>{phaseLabels[e.phase]||e.phase}{e.httpStatus?` (HTTP ${e.httpStatus})`:''}</td><td>{e.recordCount??'—'}</td><td title={e.runId}><code>{e.runId.slice(0,8)}</code></td></tr>)}</tbody></table></div>:<p>Nog geen statusmeldingen ontvangen.</p>}
 <details><summary>Meer foutdetails op de Q-box</summary><p>Dit overzicht toont de stappen en resultaten. De volledige readeruitvoer blijft lokaal beschikbaar:</p><pre>sudo journalctl -u cohvera-reader-sync.service -n 100 --no-pager</pre></details>
 </section>
 <ColumnSettings key={data.configuration?.revision??"new"} data={data} companyCode={companyCode} canManage={canManage} onSaved={refresh}/><p className="muted">Dit scherm vernieuwt automatisch elke 30 seconden. De Q-box blijft zelfstandig synchroniseren; dit scherm hoeft niet open te blijven.</p>
 </>}
 </main>;
}
