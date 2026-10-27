"use client";
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {useCompany} from '../../../PortalShell';
import {request} from '../../../../lib/projects';
import '../qbox/qbox.css';

type Status={configured:boolean;connected:boolean;mode:'legacy'|'v2'|null;running:boolean;connectedAt:string|null;lastAttemptAt:string|null;lastSuccessAt:string|null;nextSyncAt:string|null;lastError:string|null;projectCount:number;intervalMinutes:number;callbackUrl:string;runs:{id:string;startedAt:string;finishedAt:string;projectCount:number|null;error:string|null}[]};
const time=(value:string|null)=>value?new Date(value).toLocaleString('nl-BE'):'Nog niet beschikbaar';
export default function TeamleaderPage(){
 const {companyCode,can}=useCompany();
 if(companyCode!=='QHOME')return <main className="main"><h1>Teamleader</h1><p>Selecteer QHOME om deze koppeling te beheren.</p><Link href="/tools">Terug naar Middleware</Link></main>;
 if(!can('projects.read'))return <main className="main"><h1>Teamleader</h1><p>Je hebt geen toegang tot deze projectkoppeling.</p></main>;
 return <Dashboard canManage={can('projects.manage')}/>;
}
function Dashboard({canManage}:{canManage:boolean}){
 const [data,setData]=useState<Status|null>(null),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[mode,setMode]=useState<'legacy'|'v2'>('legacy');
 const base='/api/companies/QHOME/middleware/teamleader';
 const refresh=useCallback(async(signal?:AbortSignal)=>{
  try{const next=await request<Status>(base,{signal});if(signal?.aborted)return;setData(next);if(next.mode)setMode(next.mode);setError('');}
  catch(e){if(!signal?.aborted)setError(e instanceof Error?e.message:'Status ophalen mislukt.');}
 },[]);
 useEffect(()=>{const abort=new AbortController();void refresh(abort.signal);const timer=setInterval(()=>void refresh(abort.signal),15000);const result=new URLSearchParams(window.location.search).get('connection');if(result)setMessage(result==='connected'?'Verbonden. De eerste synchronisatie start automatisch.':'Verbinden mislukt. Controleer de instellingen en probeer opnieuw.');return()=>{abort.abort();clearInterval(timer);};},[refresh]);
 async function action(name:'connect'|'sync'|'disconnect'){
  setBusy(true);setMessage('');
  try{
   const result=await request<{url?:string}>(base+'/'+name,{method:'POST',body:JSON.stringify(name==='connect'?{mode}:{})});
   if(result.url){window.location.assign(result.url);return;}
   setMessage(name==='sync'?'Synchronisatie gestart. Het resultaat verschijnt hieronder.':'Automatische synchronisatie gestopt. Bestaande projecten blijven behouden.');
   await refresh();
  }catch(e){setError(e instanceof Error?e.message:'Aanvraag mislukt.');}
  finally{setBusy(false);}
 }
 return <main className="main qbox-monitor">
  <nav className="qbox-navigation" aria-label="Gerelateerde pagina’s"><Link href="/tools">← Tools & Middleware</Link><Link href="/projects">Projecten bekijken →</Link></nav>
  <header className="section-heading qbox-heading"><div><p className="eyebrow">Middleware · QHOME</p><h1>Teamleader-projecten</h1><p className="muted">Rechtstreeks vanuit Teamleader Focus naar Cohvera. Automatisch elke 15 minuten.</p></div>
   <div className="qbox-actions">{canManage&&<button className="qbox-action qbox-action-primary" disabled={busy||!data?.configured||!data.connected||data.running} onClick={()=>void action('sync')}>{data?.running?'Synchroniseren…':'Nu synchroniseren'}</button>}<button className="qbox-action qbox-action-secondary" disabled={busy} onClick={()=>void refresh()}>Status vernieuwen</button></div>
  </header>
  {error&&<div className="alert" role="alert">{error}</div>}{message&&<p role="status">{message}</p>}
  {!data?<p>Status ophalen…</p>:<>
   <section className="qbox-metrics" aria-label="Verbindingsstatus">
    <article className="card"><h2>Verbinding</h2><strong>{!data.configured?'Instellen op server':data.running?'Synchroniseren':!data.connected?'Niet verbonden':data.lastError?'Aandacht nodig':'Verbonden'}</strong><p>{data.connected?'Portal synchroniseert zelfstandig, ook als dit scherm gesloten is.':'Verbind met het Teamleader-account van QHOME.'}</p></article>
    <article className="card"><h2>Laatste geslaagde sync</h2><strong>{time(data.lastSuccessAt)}</strong><p>{data.lastSuccessAt?`${data.projectCount} projecten bevestigd`:'Nog geen directe import bevestigd'}</p></article>
    <article className="card"><h2>Volgende synchronisatie</h2><strong>{data.connected?time(data.nextSyncAt):'Na verbinden'}</strong><p>Laatste poging: {time(data.lastAttemptAt)}</p></article>
   </section>
   {data.lastError&&<div className="alert" role="alert">{data.lastError}</div>}
   {canManage&&<section className="card"><h2>Teamleader verbinden</h2>
    {!data.configured?<><p>Vul op de Portal-server de Teamleader-clientgegevens en versleutelingssleutel in. Herstart daarna de API.</p><p>Registreer dit callbackadres bij de Teamleader-app:</p><code style={{overflowWrap:'anywhere'}}>{data.callbackUrl}</code></>:<>
     <p>Gebruik een QHOME-gebruiker met toegang tot alle gewenste projecten. Geef de Teamleader-app toestemming om projecten te lezen.</p>
     <p className="muted">Portal controleert de projectmodule bij Teamleader. Vóór de eerste import wordt een verkeerde keuze automatisch gecorrigeerd.</p>
     <label>Projectmodule <select value={mode} disabled={busy||!!data.connectedAt} onChange={e=>setMode(e.target.value as 'legacy'|'v2')}><option value="legacy">Klassieke projecten</option><option value="v2">Nieuwe projecten</option></select></label>
     <div className="qbox-actions" style={{marginTop:'1rem'}}><button className="qbox-action qbox-action-primary" disabled={busy||data.running} onClick={()=>void action('connect')}>{data.connected?'Opnieuw verbinden':'Verbinden met Teamleader'}</button>{data.connected&&<button className="qbox-action qbox-action-secondary" disabled={busy||data.running} onClick={()=>void action('disconnect')}>Verbinding verbreken</button>}</div>
    </>}
   </section>}
   <section className="card"><h2>Synchronisatielog</h2>{data.runs.length?<div className="qbox-table-scroll"><table><thead><tr><th>Gestart</th><th>Afgerond</th><th>Resultaat</th></tr></thead><tbody>{data.runs.map(run=><tr key={run.id}><td>{time(run.startedAt)}</td><td>{time(run.finishedAt)}</td><td>{run.error||`${run.projectCount} projecten bijgewerkt`}</td></tr>)}</tbody></table></div>:<p>Nog geen directe synchronisaties uitgevoerd.</p>}</section>
  </>}
 </main>;
}
