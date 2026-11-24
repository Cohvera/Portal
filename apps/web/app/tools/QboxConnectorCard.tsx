"use client";
import Link from 'next/link';
import {connectionDiagnostics,monitorTime,useQboxMonitor} from '../../lib/qbox-monitor';
import {QboxConnectionIndicators} from './QboxConnectionIndicators';
export function QboxConnectorCard({companyCode}:{companyCode:string}){
 const {data,error,loading}=useQboxMonitor(companyCode);
 const diagnostics = data && !error ? connectionDiagnostics(data) : null;
 const statusText = error ? 'Status niet beschikbaar' : loading && !data ? 'Status ophalen…' : undefined;
 return <Link href="/tools/middleware/qbox" className="catalog-card integration-card qbox-catalog-card">
 <div className="catalog-card-top">
  <span className="catalog-icon" aria-hidden="true">⇄</span>
  <QboxConnectionIndicators pollState={diagnostics?.pollState ?? 'unknown'} hfsqlState={diagnostics?.hfsqlState ?? 'unknown'} statusText={statusText}/>
 </div>
 <span className="catalog-category">Middleware · Q-box</span><h2>Plenion-connector</h2>
 <p>HFSQL → Q-box → Cohvera Portal. Bekijk synchronisaties, meldingen en de exportvelden van dit bedrijf.</p>
 <footer><span>Laatste import: {monitorTime(data?.lastImport?.receivedAt)}</span><strong>Status & logging →</strong></footer>
 </Link>;
}
