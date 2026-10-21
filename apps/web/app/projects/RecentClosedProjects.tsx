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
    <summary>Updates · laatste 30 dagen{!loading && !error && ` (${rows.length})`}</summary>
    <p className="muted">Hier zie je welke Plenion-projecten uit de actieve selectie zijn verdwenen en wanneer de synchronisatie dit vaststelde. De laatst ontvangen status staat erbij; de nieuwe status is niet meegeleverd.</p>
    <button type="button" className="button-secondary" disabled={loading} onClick={()=>setRevision(v=>v+1)}>Vernieuwen</button>
    {loading ? <p role="status">Updates laden…</p> : error ? <p role="alert">{error}</p> : rows.length === 0 ? <p>Nog geen updates in de afgelopen 30 dagen. Nieuwe wijzigingen in de selectie verschijnen hier na een succesvolle synchronisatie.</p> :
      <div className="projects-table-scroll"><table className="projects-table">
        <thead><tr><th>Project</th><th>Vastgesteld op</th><th>Laatst ontvangen status</th><th>Verantwoordelijke</th></tr></thead>
        <tbody>{rows.map(p=><tr key={p.id}><td><strong>{p.name}</strong><span className="projects-customer">Buiten actieve Plenion-selectie</span></td><td>{new Date(p.sourceOutOfSelectionAt).toLocaleString("nl-BE")}</td><td>{p.sourceStatusLabel || "Onbekend"}</td><td>{p.owner || "Niet toegewezen"}</td></tr>)}</tbody>
      </table></div>}
  </details>;
}
