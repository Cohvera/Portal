"use client";

import {useEffect,useRef,useState} from 'react';
import {request} from '../../../../lib/projects';
import {connectionDiagnostics,eventExplanation,eventLink,failurePhases,linkLabels,monitorTime,phaseLabels,stepLabels,type Monitor,type ReaderEvent} from '../../../../lib/qbox-monitor';
import {eventRemedy} from '../../../../lib/qbox-recovery';

const pollLabels = {unknown:'Nog geen contact',healthy:'Qbox haalt aanvragen op',stale:'Geen recente controle',error:'Ophalen mislukt'};
const hfsqlLabels = {unknown:'Nog geen resultaat',healthy:'HFSQL bereikbaar',stale:'Geen recente meting',error:'HFSQL-stap mislukt'};

export function ConnectionDiagnostics({data,companyCode}:{data:Monitor;companyCode:string}) {
 const {pollAt,pollFailure,pollState,upload,hfsql,hfsqlFailed,hfsqlState} = connectionDiagnostics(data);
 const dialog = useRef<HTMLDialogElement>(null);
 const [open,setOpen] = useState(false);
 const [filter,setFilter] = useState('errors');
 const [showJournal,setShowJournal] = useState(false);
 const events = data.events.filter(event => {
  if (filter === 'all') return true;
  if (filter === 'errors') return failurePhases.has(event.phase);
  if (filter === 'portal') return ['commands','portal'].includes(eventLink(event));
  return eventLink(event) === 'hfsql';
 });
 const waiting = data.configuration?.syncRequestId && data.configuration.syncRequestId !== data.configuration.syncAcknowledgedId;
 return <section className="card qbox-connection-summary" aria-label="Verbindingsstatus">
  <ul className="qbox-connection-indicators">
   <li><span className={`qbox-status-dot qbox-status-dot-${pollState}`} aria-hidden="true"/><div><strong>Portal ↔ Qbox</strong><small>{pollLabels[pollState]}</small></div></li>
   <li><span className={`qbox-status-dot qbox-status-dot-${hfsqlState}`} aria-hidden="true"/><div><strong>Qbox → HFSQL</strong><small>{hfsqlLabels[hfsqlState]}</small></div></li>
  </ul>
  <button className="qbox-action qbox-action-primary" type="button" aria-haspopup="dialog" onClick={()=>{
   dialog.current?.showModal();
   setOpen(true);
  }}>Verbindingsdiagnose</button>
  <dialog className="qbox-diagnostics-dialog" ref={dialog} aria-labelledby="qbox-diagnostics-title" onClose={()=>setOpen(false)}>
   <header className="qbox-dialog-heading">
    <h2 id="qbox-diagnostics-title">Verbindingsdiagnose</h2>
    <button className="qbox-action qbox-action-secondary" type="button" onClick={()=>dialog.current?.close()}>Sluiten</button>
   </header>
   {open && <div className="qbox-diagnostics">
  <div className="qbox-diagnostics-grid">
   <article className="card qbox-link-card">
    <h3 aria-label="Portal en Qbox">Portal ↔ Qbox</h3>
    <span className={`qbox-state qbox-state-${pollState}`}>{pollLabels[pollState]}</span>
    <dl>
     <dt>Qbox controleerde op sync-aanvragen</dt><dd>{monitorTime(pollAt)}</dd>
     {pollState === 'error' && pollFailure && <><dt>Laatste fout bij het ophalen</dt><dd>{eventExplanation(pollFailure)}{pollFailure.httpStatus && ` (HTTP ${pollFailure.httpStatus})`}<RecoveryHint event={pollFailure}/></dd></>}
     {waiting && <><dt>Openstaande sync-aanvraag</dt><dd>{monitorTime(data.configuration?.syncRequestedAt)}</dd></>}
     <dt>Laatste upload</dt><dd>{upload ? <><strong className={upload.phase === 'upload_failed' ? 'qbox-error-text' : undefined}>{phaseLabels[upload.phase]}</strong> · {monitorTime(upload.observedAt)}</> : 'Nog geen uploadresultaat gemeld'}</dd>
     {upload?.phase === 'upload_failed' && <><dt>Laatste uploadfout</dt><dd>{eventExplanation(upload)}<RecoveryHint event={upload}/></dd></>}
     {data.lastImport && <><dt>Laatst geïmporteerde bronstand</dt><dd>{monitorTime(data.lastImport.sourceObservedAt)} · {data.lastImport.projectCount} hoofdprojecten</dd></>}
     {data.state === 'interrupted' && <><dt>Laatste poging</dt><dd>De Qbox heeft de afronding nog niet gemeld.</dd></>}
    </dl>
   </article>
   <article className="card qbox-link-card">
    <h3 aria-label="Qbox naar HFSQL">Qbox → HFSQL</h3>
    <span className={`qbox-state qbox-state-${hfsqlState}`}>{hfsqlLabels[hfsqlState]}</span>
    <dl>
     <dt>Laatste resultaat</dt><dd>{monitorTime(hfsql?.observedAt)}</dd>
     {hfsqlFailed && hfsql && <><dt>{stepLabels[hfsql.diagnostic?.step ?? ''] ?? phaseLabels[hfsql.phase]}</dt><dd>{eventExplanation(hfsql)}<RecoveryHint event={hfsql}/></dd></>}
     {hfsql && !hfsqlFailed && <><dt>Bevestigd door</dt><dd>{hfsql.phase === 'configuration_failed' ? 'HFSQL-statussen gelezen' : 'HFSQL uitgelezen'}</dd></>}
    </dl>
   </article>
  </div>
  <section className="card">
   <div className="qbox-log-heading">
    <div className="qbox-log-switch" role="group" aria-label="Logweergave">
     <button type="button" aria-pressed={!showJournal} onClick={() => setShowJournal(false)}>Verbindingslog</button>
     <button type="button" aria-pressed={showJournal} onClick={() => setShowJournal(true)}>Qbox-journaal</button>
    </div>
    {!showJournal && <label>Toon <select value={filter} onChange={event => setFilter(event.target.value)}>
     <option value="errors">Alleen fouten</option><option value="all">Alle meldingen</option>
     <option value="portal">Portal ↔ Qbox</option><option value="hfsql">Qbox → HFSQL</option>
    </select></label>}
   </div>
   {showJournal ? <QboxJournal companyCode={companyCode}/> : events.length ? <EventLog events={events}/> : <p className="muted">{filter === 'errors' ? 'Geen fouten ontvangen in de getoonde logperiode.' : 'Geen meldingen voor deze selectie.'}</p>}
   <details><summary>Meer details op de Qbox</summary><p>Bij een verbroken Portal-verbinding ontvangt dit scherm de fout pas zodra de Qbox weer kan rapporteren.</p><pre>sudo ./plenion.sh debug</pre></details>
  </section>
   </div>}
  </dialog>
 </section>;
}

function RecoveryHint({event}:{event:ReaderEvent}) {
 const steps = eventRemedy(event);
 if (!steps) return null;
 return <details className="qbox-recovery">
  <summary>Mogelijke oplossing</summary>
  <ol>{steps.map(step => <li key={step.text}>{step.text}{step.command && <pre><code>{step.command}</code></pre>}</li>)}</ol>
 </details>;
}

function EventLog({events,journal=false}:{events:ReaderEvent[];journal?:boolean}) {
 return <div className="qbox-table-scroll"><table role="table"><thead role="rowgroup"><tr role="row"><th role="columnheader">Tijdstip</th><th role="columnheader">Verbinding</th><th role="columnheader">Stap en diagnose</th><th role="columnheader">{journal ? 'Melding' : 'Poging'}</th></tr></thead>
    <tbody role="rowgroup">{events.map(event => {
     const diagnostic = event.diagnostic;
     const failed = failurePhases.has(event.phase);
     const codes = [event.httpStatus && `HTTP ${event.httpStatus}`, diagnostic?.sqlState && `SQLSTATE ${diagnostic.sqlState}`,
      diagnostic?.nativeCode != null && `HFSQL-code ${diagnostic.nativeCode}`, diagnostic?.errno && `errno ${diagnostic.errno}`].filter(Boolean);
     return <tr key={event.id} role="row" className={failed ? 'qbox-log-error' : undefined}>
      <td role="cell"><time dateTime={event.observedAt}>{monitorTime(event.observedAt)}</time></td>
      <td role="cell">{linkLabels[eventLink(event)]}</td>
      <td role="cell"><strong>{(diagnostic && stepLabels[diagnostic.step]) || phaseLabels[event.phase]}</strong>
       {failed && <div>{eventExplanation(event)}</div>}
       {codes.length > 0 && <div className="qbox-error-codes">{codes.map(code => <code key={String(code)}>{code}</code>)}</div>}
       <small className="muted">{diagnostic?.durationMs != null && `Poging ${Math.round(diagnostic.durationMs / 1000)} s`}
        {diagnostic?.durationMs != null && event.recordCount != null && ' · '}{event.recordCount != null && `${event.recordCount} exportrecords`}</small>
       {failed && <RecoveryHint event={event}/>}
      </td>
      <td role="cell"><details><summary aria-label={`Melding ${event.runId.slice(0,8)}`}><code>{event.runId.slice(0,8)}</code></summary><code className="qbox-full-run-id">{event.runId}</code><div>Ontvangen {monitorTime(event.receivedAt)}</div>{journal ? <div>{diagnostic?.journalUnit}</div> : <div>Reader {event.readerVersion}</div>}</details></td>
     </tr>;
    })}</tbody></table></div>;
}

function QboxJournal({companyCode}:{companyCode:string}) {
 const [page,setPage] = useState<{cursor:string|null}>({cursor:null});
 const [result,setResult] = useState<{events:ReaderEvent[];nextCursor:string|null}|null>(null);
 const [loading,setLoading] = useState(true);
 const [error,setError] = useState('');
 useEffect(() => {
  const controller = new AbortController();
  const params = page.cursor ? `?before=${encodeURIComponent(page.cursor)}` : '';
  setLoading(true);setError('');
  request<{events:ReaderEvent[];nextCursor:string|null}>(`/api/companies/${encodeURIComponent(companyCode)}/middleware/qbox/journal${params}`,{signal:controller.signal})
   .then(next=>{if(!controller.signal.aborted)setResult(previous=>page.cursor && previous ? {...next,events:[...previous.events,...next.events]} : next);})
   .catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error ? e.message : 'Qbox-journaal ophalen mislukt.');})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return () => controller.abort();
 },[companyCode,page]);
 return <>
  <p className="muted">Fouten uit de automatische sync-service en de service voor sync-aanvragen op de Qbox.</p>
  {error && <p role="alert">{error}</p>}
  {result?.events.length ? <EventLog events={result.events} journal/> : !loading && !error && <p className="muted">Nog geen journaalfouten ontvangen.</p>}
  <div className="qbox-actions">
   <button className="qbox-action qbox-action-secondary" type="button" disabled={loading} onClick={()=>setPage({cursor:null})}>{loading ? 'Ophalen…' : 'Journaal vernieuwen'}</button>
   {result?.nextCursor && <button className="qbox-action qbox-action-secondary" type="button" disabled={loading} onClick={()=>setPage({cursor:result.nextCursor})}>Oudere meldingen</button>}
  </div>
 </>;
}
