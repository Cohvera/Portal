"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useProjects, members, projectStatuses, request, type Project } from "../../lib/projects";
import { useCompany } from "../PortalShell";

export default function ProjectsPage() {
 const {projects,loading,error,refresh,url,companyCode} = useProjects();
 const {companies,can} = useCompany();
 const writable=can("projects.manage");
 const dialog = useRef<HTMLDialogElement>(null);
 const [formVersion,setFormVersion] = useState(0);
 const [editing,setEditing] = useState<Project|null>(null);
 const [status,setStatus] = useState("Gepland");
 const [color,setColor] = useState(projectStatuses.Gepland);
 const [busy,setBusy] = useState(false);
 const [formError,setFormError] = useState("");
 const [notice,setNotice] = useState("");
 const [refreshError,setRefreshError] = useState("");
 useEffect(()=>{dialog.current?.close();setNotice("");setRefreshError("");},[companyCode]);
 function open(project:Project|null=null) {
   setFormVersion(v=>v+1);setEditing(project);setStatus(project?.status||"Gepland");setColor(project?.statusColor||projectStatuses.Gepland);setFormError("");
   dialog.current?.showModal();
 }
 async function save(event:FormEvent<HTMLFormElement>) {
   event.preventDefault();if(busy)return;
   const form = new FormData(event.currentTarget);
   const name=String(form.get("name")||"").trim();
   if(!name){setFormError("Vul een titel in.");return;}
   setBusy(true);setFormError("");setNotice("");setRefreshError("");
   try {
     await request(`${url}${editing?`/${editing.id}`:""}`,{method:editing?"PATCH":"POST",body:JSON.stringify({name,status,statusColor:color,owner:form.get("owner"),dueDate:editing?.dueDate?.slice(0,10)||null})});
     dialog.current?.close();setNotice(editing?"Project bijgewerkt.":"Project aangemaakt.");
     try {await refresh();} catch {setRefreshError("Het project is opgeslagen, maar het overzicht kon niet vernieuwd worden. Vernieuw de pagina.");}
   } catch(e){setFormError(e instanceof Error?e.message:"Opslaan is niet gelukt.");}finally{setBusy(false);}
 }
 return <main className="main"><header className="page-heading section-heading"><div><p className="eyebrow">Van plan naar uitvoering · {companies.find(c=>c.code===companyCode)?.name||companyCode}</p><h1>Projecten</h1><p className="muted">Een eenvoudig overzicht van wat er loopt en wie het opvolgt.</p></div><button className="button-primary" disabled={busy||!writable} onClick={()=>open()}>+ Nieuw project</button></header>
 {error && <div className="alert" role="alert">{error}</div>}{notice&&<div className="success-box" role="status">{notice}</div>}{refreshError&&<div className="alert" role="alert">{refreshError}</div>}
 {loading ? <p role="status">Projecten laden…</p> : <section className="project-grid">{projects.map(p=><article className="card project-summary-card" key={p.id}><div className="task-meta"><span className="project-status"><span style={{backgroundColor:p.statusColor||projectStatuses[p.status]}}/>{p.status}</span><button className="project-edit" aria-label={`${p.name} bewerken`} disabled={busy||!writable} onClick={()=>open(p)}>Bewerken</button></div><h2>{p.name}</h2><p className="muted">Verantwoordelijke · {p.owner}</p></article>)}{!projects.length&&!error&&<div className="empty-state"><h2>Je eerste project begint hier</h2><p>Een titel en verantwoordelijke zijn voldoende om te starten.</p><button className="button-primary" disabled={!writable} onClick={()=>open()}>+ Nieuw project</button></div>}</section>}
 <dialog ref={dialog} className="catalog-dialog" aria-labelledby="project-dialog-title" onCancel={e=>{if(busy)e.preventDefault();}}><form key={formVersion} className="task-form" onSubmit={save}><header className="section-heading"><div><p className="eyebrow">{companies.find(c=>c.code===companyCode)?.name||companyCode}</p><h2 id="project-dialog-title">{editing?"Project bewerken":"Nieuw project"}</h2></div><button type="button" className="secondary-button" disabled={busy} aria-label="Sluiten" onClick={()=>dialog.current?.close()}>×</button></header><fieldset disabled={busy}>
 <label>Titel<input name="name" required maxLength={200} defaultValue={editing?.name||""} placeholder="Bijvoorbeeld: Renovatie kantoor"/></label>
 <div className="form-grid"><label>Status<select name="status" value={status} onChange={e=>{setStatus(e.target.value);setColor(projectStatuses[e.target.value]);}}>{Object.keys(projectStatuses).map(s=><option key={s}>{s}</option>)}</select></label><label>Kleur<input type="color" aria-label="Statuskleur" value={color} onChange={e=>setColor(e.target.value)}/></label></div>
 <div className="project-status"><span style={{backgroundColor:color}}/>{status}</div>
 <label>Verantwoordelijke<select name="owner" required defaultValue={editing?.owner||"Remko"}>{members.map(m=><option key={m}>{m}</option>)}</select></label>
 </fieldset>{formError&&<div className="alert" role="alert">{formError}</div>}<footer className="dialog-actions"><button type="button" className="secondary-button" disabled={busy} onClick={()=>dialog.current?.close()}>Annuleren</button><button className="button-primary" disabled={busy}>{busy?"Opslaan…":"Project opslaan"}</button></footer></form></dialog>
 </main>;
}
