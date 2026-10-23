"use client";
import Link from 'next/link';
import {useQboxMonitor,stateLabels,monitorTime} from '../../lib/qbox-monitor';
export function QboxConnectorCard({companyCode}:{companyCode:string}){
 const {data,error,loading}=useQboxMonitor(companyCode);
 return <Link href="/tools/middleware/qbox" className="catalog-card integration-card">
 <div className="catalog-card-top"><span className="catalog-icon">⇄</span><span className="availability">{error?'Status niet bereikbaar':loading?'Status ophalen…':stateLabels[data?.state||'unknown']}</span></div>
 <span className="catalog-category">Middleware · Q-box</span><h2>Plenion-connector</h2>
 <p>HFSQL → Q-box → Cohvera Portal. Bekijk synchronisaties, meldingen en de exportvelden van dit bedrijf.</p>
 <footer><span>Laatste import: {monitorTime(data?.lastImport?.receivedAt)}</span><strong>Status & logging →</strong></footer>
 </Link>;
}
