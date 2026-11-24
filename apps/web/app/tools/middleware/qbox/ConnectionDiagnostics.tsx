"use client";

import {useState} from 'react';
import {connectionDiagnostics,eventExplanation,eventLink,failurePhases,linkLabels,monitorTime,phaseLabels,stepLabels,type Monitor} from '../../../../lib/qbox-monitor';

const pollLabels = {unknown:'Nog geen contact',healthy:'Qbox haalt aanvragen op',stale:'Geen recente controle',error:'Ophalen mislukt'};
const hfsqlLabels = {unknown:'Nog geen resultaat',healthy:'HFSQL bereikbaar',stale:'Geen recente meting',error:'HFSQL-stap mislukt'};

export function ConnectionDiagnostics({data}:{data:Monitor}) {
 const {pollAt,pollFailure,pollState,upload,hfsql,hfsqlFailed,hfsqlState} = connectionDiagnostics(data);
 const [filter,setFilter] = useState('errors');
 const events = data.events.filter(event => {
  if (filter === 'all') return true;
  if (filter === 'errors') return failurePhases.has(event.phase);
  if (filter === 'portal') return ['commands','portal'].includes(eventLink(event));
  return eventLink(event) === 'hfsql';
 });
 const waiting = data.configuration?.syncRequestId && data.configuration.syncRequestId !== data.configuration.syncAcknowledgedId;
 return <section className="qbox-diagnostics" aria-labelledby="qbox-diagnostics-title">
  <h2 id="qbox-diagnostics-title">Verbindingsdiagnose</h2>
  <div className="qbox-diagnostics-grid">
   <article className="card qbox-link-card">
    <h3 aria-label="Portal en Qbox">Portal ↔ Qbox</h3>
    <span className={`qbox-state qbox-state-${pollState}`}>{pollLabels[pollState]}</span>
    <dl>
     <dt>Qbox controleerde op sync-aanvragen</dt><dd>{monitorTime(pollAt)}</dd>
     {pollState === 'error' && pollFailure && <><dt>Laatste fout bij het ophalen</dt><dd>{eventExplanation(pollFailure)}{pollFailure.httpStatus && ` (HTTP ${pollFailure.httpStatus})`}</dd></>}
     {waiting && <><dt>Openstaande sync-aanvraag</dt><dd>{monitorTime(data.configuration?.syncRequestedAt)}</dd></>}
     <dt>Laatste upload</dt><dd>{upload ? <><strong className={upload.phase === 'upload_failed' ? 'qbox-error-text' : undefined}>{phaseLabels[upload.phase]}</strong> · {monitorTime(upload.observedAt)}</> : 'Nog geen uploadresultaat gemeld'}</dd>
     {data.lastImport && <><dt>Laatst geïmporteerde bronstand</dt><dd>{monitorTime(data.lastImport.sourceObservedAt)} · {data.lastImport.projectCount} hoofdprojecten</dd></>}
     {data.state === 'interrupted' && <><dt>Laatste poging</dt><dd>De Qbox heeft de afronding nog niet gemeld.</dd></>}
    </dl>
   </article>
   <article className="card qbox-link-card">
    <h3 aria-label="Qbox naar HFSQL">Qbox → HFSQL</h3>
    <span className={`qbox-state qbox-state-${hfsqlState}`}>{hfsqlLabels[hfsqlState]}</span>
    <dl>
     <dt>Laatste resultaat</dt><dd>{monitorTime(hfsql?.observedAt)}</dd>
     {hfsqlFailed && hfsql && <><dt>{stepLabels[hfsql.diagnostic?.step ?? ''] ?? phaseLabels[hfsql.phase]}</dt><dd>{eventExplanation(hfsql)}</dd></>}
     {hfsql && !hfsqlFailed && <><dt>Bevestigd door</dt><dd>{hfsql.phase === 'configuration_failed' ? 'HFSQL-statussen gelezen' : 'HFSQL uitgelezen'}</dd></>}
    </dl>
   </article>
  </div>
  <section className="card">
   <div className="qbox-log-heading">
    <h3>Verbindingslog</h3>
    <label>Toon <select value={filter} onChange={event => setFilter(event.target.value)}>
     <option value="errors">Alleen fouten</option><option value="all">Alle meldingen</option>
     <option value="portal">Portal ↔ Qbox</option><option value="hfsql">Qbox → HFSQL</option>
    </select></label>
   </div>
   {events.length ? <div className="qbox-table-scroll"><table role="table"><thead role="rowgroup"><tr role="row"><th role="columnheader">Tijdstip</th><th role="columnheader">Verbinding</th><th role="columnheader">Stap en diagnose</th><th role="columnheader">Poging</th></tr></thead>
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
      </td>
      <td role="cell"><details><summary aria-label={`Poging ${event.runId.slice(0,8)}`}><code>{event.runId.slice(0,8)}</code></summary><code className="qbox-full-run-id">{event.runId}</code><div>Ontvangen {monitorTime(event.receivedAt)}</div><div>Reader {event.readerVersion}</div></details></td>
     </tr>;
    })}</tbody></table></div> : <p className="muted">{filter === 'errors' ? 'Geen fouten ontvangen in de getoonde logperiode.' : 'Geen meldingen voor deze selectie.'}</p>}
   <details><summary>Meer details op de Qbox</summary><p>Bij een verbroken Portal-verbinding ontvangt dit scherm de fout pas zodra de Qbox weer kan rapporteren.</p><pre>sudo ./plenion.sh debug</pre></details>
  </section>
 </section>;
}
