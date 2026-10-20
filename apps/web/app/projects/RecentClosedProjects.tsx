"use client";
import {useEffect, useState} from "react";
import {request, type Project} from "../../lib/projects";

type ClosedProject = {id:string;name:string;owner:string;sourceStatusLabel:string|null;sourceOutOfSelectionAt:string};
export function RecentClosedProjects({companyCode,projects}:{companyCode:string;projects:Project[]}) {
  const [rows,setRows]=useState<ClosedProject[]>([]);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(true);
  const [revision,setRevision]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();
    setLoading(true);setError("");
    request<ClosedProject[]>(`/api/companies/${encodeURIComponent(companyCode)}/projects/recent-closed`,{signal:controller.signal})
      .then(setRows).catch(e=>{if(!controller.signal.aborted)setError(e.message);})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[companyCode,projects,revision]);
  return <details className="projects-recent-closed">
    <summary>Recent afgesloten · laatste 30 dagen{!loading && !error && ` (${rows.length})`}</summary>
    <p className="muted">Plenion-projecten die uit de actieve importselectie verdwenen zijn. De datum is het moment waarop de sync dit vaststelde, niet de factuurdatum. De nieuwe status is niet meegeleverd; gefactureerd of verloren is dus niet bevestigd.</p>
    <button type="button" className="button-secondary" disabled={loading} onClick={()=>setRevision(v=>v+1)}>Vernieuwen</button>
    {loading ? <p role="status">Overzicht laden…</p> : error ? <p role="alert">{error}</p> : rows.length === 0 ? <p>Geen recent verdwenen projecten geregistreerd. Registratie begint vanaf de eerstvolgende succesvolle sync na deze update.</p> :
      <div className="projects-table-scroll"><table className="projects-table">
        <thead><tr><th>Project</th><th>Uit selectie sinds</th><th>Laatst ontvangen status</th><th>Verantwoordelijke</th></tr></thead>
        <tbody>{rows.map(p=><tr key={p.id}><td><strong>{p.name}</strong><span className="projects-customer">Buiten actieve Plenion-selectie</span></td><td>{new Date(p.sourceOutOfSelectionAt).toLocaleString("nl-BE")}</td><td>{p.sourceStatusLabel || "Onbekend"}</td><td>{p.owner || "Niet toegewezen"}</td></tr>)}</tbody>
      </table></div>}
  </details>;
}
