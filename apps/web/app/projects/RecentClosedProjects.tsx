"use client";
import {useCompany} from "../PortalShell";
import {ALL_COMPANIES,projectCompanies,loadCompanyRecords} from "../../lib/project-companies";
import {useEffect, useState} from "react";
import {request, type Project} from "../../lib/projects";
type Update={companyName?:string;id:string;observedAt:string;message:string;project:{name:string;externalId:string|null}};
export function RecentClosedProjects({companyCode,projects}:{companyCode:string;projects:Project[]}) {
 const {companies,can}=useCompany();
 const companyKey=JSON.stringify(projectCompanies(companies,companyCode,code=>can("projects.read",code)));
 const [rows,setRows]=useState<Update[]>([]),[error,setError]=useState(""),[loading,setLoading]=useState(true),[revision,setRevision]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();setLoading(true);setError("");
  loadCompanyRecords<Update>(JSON.parse(companyKey),company=>request<Update[]>(`/api/companies/${encodeURIComponent(company.code)}/projects/updates`,{signal:controller.signal}))
   .then(rows=>setRows(rows.sort((a,b)=>b.observedAt.localeCompare(a.observedAt)).slice(0,200))).catch(e=>{if(!controller.signal.aborted)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return ()=>controller.abort();
 },[companyCode,companyKey,projects,revision]);
 return <details className="projects-recent-closed"><summary>Updates · laatste 30 dagen{!loading&&!error&&` (${rows.length}${rows.length===200?" nieuwste":""})`}</summary>
 <p className="muted">Wijzigingen in statussen, Uit WIP, brondata en gekoppelde records. De eerste ontvangst van elk project vormt de uitgangssituatie. Projecten die door een filter zichtbaar worden of verdwijnen, zijn geen update. Het tijdstip is de sync die de wijziging vaststelde.</p>
 <button type="button" className="secondary-button" disabled={loading} onClick={()=>setRevision(v=>v+1)}>Vernieuwen</button>
 {loading?<p role="status">Updates laden…</p>:error?<p role="alert">{error}</p>:!rows.length?<p>Nog geen wijzigingen geregistreerd. Wijzigingen verschijnen na de volgende volledige synchronisaties met reader v3.</p>:<div className="projects-table-scroll"><table className="projects-table"><thead><tr><th>Project</th><th>Vastgesteld op</th><th>Wijziging</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td>{companyCode===ALL_COMPANIES&&<span className="projects-source-badge">{row.companyName}</span>}{row.project.name}</td><td>{new Date(row.observedAt).toLocaleString("nl-BE")}</td><td>{row.message}</td></tr>)}</tbody></table></div>}
 </details>;
}
