"use client";
import {useCompany} from "./PortalShell";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { members, overdue, priorities, request, statuses, today, useProjects, type Task } from "../lib/projects";
type Draft = {id?:string; projectId:string; title:string;description:string;assignee:string;priority:string;status:string;dueDate:string};
export default function TasksWorkspace({projectId}:{projectId?:string}) {
 const {can}=useCompany(); const writable=can("tasks.manage");
 const {projects,loading,error,setError,refresh,url,companyCode}=useProjects();
 const [view,setView]=useState("board");
 const [search,setSearch]=useState("");
 const [owner,setOwner]=useState(projectId?"all":"Remko");
 const [filter,setFilter]=useState("all");
 const [draft,setDraft]=useState<Draft|null>(null);
 const [busy,setBusy]=useState(false);
 const [formError,setFormError]=useState("");
 const [notice,setNotice]=useState("");
 const [deleting,setDeleting]=useState(false);
 useEffect(()=>{setDraft(null);setNotice("");setFormError("");},[companyCode,projectId]);
 const project=projects.find(p=>p.id===projectId);
 const allTasks=projects.filter(p=>!projectId||p.id===projectId).flatMap(p=>p.tasks);
 const tasks=allTasks.filter(t=>(owner==="all"||t.assignee===owner)&&t.title.toLowerCase().includes(search.toLowerCase())&&(filter==="all"||(filter==="overdue"?overdue(t):filter==="today"?t.dueDate?.slice(0,10)===today():t.status===filter)));
 function edit(task?:Task) {
   setFormError("");setDeleting(false);setNotice("");
   setDraft(task?{...task,dueDate:task.dueDate?.slice(0,10)||""}:{projectId:projectId||projects[0]?.id||"",title:"",description:"",assignee:"Remko",priority:"NORMAL",status:"TODO",dueDate:""});
 }
 async function save(e:FormEvent) {
   e.preventDefault();if(!draft||busy)return;const dueDate = String(new FormData(e.currentTarget as HTMLFormElement).get("dueDate") || "");setBusy(true);setFormError("");setError("");
   try {await request(`${url}/${encodeURIComponent(draft.projectId)}/tasks${draft.id?`/${draft.id}`:""}`,{method:draft.id?"PATCH":"POST",body:JSON.stringify({...draft,dueDate})});setDraft(null);setNotice("Taak opgeslagen.");await refresh();}
   catch(e){const message=e instanceof Error?e.message:"Opslaan mislukt.";setFormError(message);setError(message);}finally{setBusy(false);}
 }
 async function remove() {
   if(!draft?.id||busy)return;setBusy(true);setFormError("");
   try{await request(`${url}/${draft.projectId}/tasks/${draft.id}`,{method:"DELETE"});setDraft(null);setNotice("Taak verwijderd.");await refresh();}catch(e){setFormError(e instanceof Error?e.message:"Verwijderen mislukt.");}finally{setBusy(false);}
 }
 async function move(task:Task,status:string) {
   setBusy(true);setError("");setNotice("");
   try{await request(`${url}/${task.projectId}/tasks/${task.id}`,{method:"PATCH",body:JSON.stringify({...task,status,dueDate:task.dueDate?.slice(0,10)||null})});await refresh();setNotice("Status bijgewerkt.");}catch(e){setError(e instanceof Error?e.message:"Wijzigen mislukt.");}finally{setBusy(false);}
 }
 const renderTask=(task:Task)=><article className="task-card" key={task.id}><div className="task-meta"><span className={`priority priority-${task.priority}`}>{priorities[task.priority]}</span>{overdue(task)&&<span className="overdue">Over deadline</span>}</div><button className="task-title" disabled={!writable} onClick={()=>edit(task)}>{task.title}</button>{!projectId&&<span className="task-project">{projects.find(p=>p.id===task.projectId)?.name}</span>}{task.description&&<p className="task-description">{task.description}</p>}<div className="task-footer"><span>{task.assignee||"Niet toegewezen"}</span><time>{task.dueDate?new Date(task.dueDate.slice(0,10)+"T12:00:00").toLocaleDateString("nl-BE"):"Geen deadline"}</time></div><select aria-label={`Status van ${task.title}`} value={task.status} disabled={busy||!writable} onChange={e=>void move(task,e.target.value)}>{Object.entries(statuses).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></article>;
 return <main className="main tasks-page">
 <div className="hub-breadcrumb"><Link href="/projects">Projecten</Link><span>/</span><span>{projectId?project?.name||"Project":"Mijn taken"}</span></div>
 <header className="section-heading"><div><p className="eyebrow">{projectId?project?.customer||"Projecttaken":"Jouw werk, over alle projecten"}</p><h1>{projectId?project?.name||"Project":"Mijn taken"}</h1><p className="muted">{projectId?`Verantwoordelijke · ${project?.owner||"—"}`:"Gebruik de filters om het werk van je team te bekijken."}</p></div><button className="button-primary" disabled={!writable||loading||busy||!projects.length||!!projectId&&!project} onClick={()=>edit()}>+ Nieuwe taak</button></header>
 {project&&<p className="project-detail-meta"><span className="project-status"><span style={{backgroundColor:project.statusColor}}/>{project.status}</span><span className="muted">Deadline · {project.dueDate?new Date(project.dueDate.slice(0,10)+"T12:00:00").toLocaleDateString("nl-BE"):"Niet ingesteld"}</span></p>}
 {error&&<div className="alert" role="alert">{error}</div>}{notice&&<div className="success-box" role="status">{notice}</div>}
 {loading?<p role="status">Taken laden…</p>:projectId&&!project?<div className="empty-state">Dit project bestaat niet binnen het actieve bedrijf. <Link href="/projects" className="text-link">Bekijk projecten →</Link></div>:<>
 <div className="task-summary"><span><strong>{allTasks.length}</strong> taken</span><span><strong>{allTasks.filter(t=>t.status==="DONE").length}</strong> klaar</span><span><strong>{allTasks.filter(overdue).length}</strong> over deadline</span><span><strong>{allTasks.length?Math.round(allTasks.filter(t=>t.status==="DONE").length/allTasks.length*100):0}%</strong> afgerond</span></div>
 <div className="task-toolbar"><label>Zoeken<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Zoek een taak…"/></label><label>Verantwoordelijke<select value={owner} onChange={e=>setOwner(e.target.value)}><option value="all">Iedereen</option><option value="">Niet toegewezen</option>{members.map(m=><option key={m}>{m}</option>)}</select></label><label>Filter<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">Alle taken</option><option value="today">Vandaag</option><option value="overdue">Over deadline</option>{Object.entries(statuses).map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label><div className="view-toggle"><button aria-pressed={view==="board"} onClick={()=>setView("board")}>Bord</button><button aria-pressed={view==="list"} onClick={()=>setView("list")}>Lijst</button></div></div>
 {!allTasks.length&&<div className="empty-state"><h2>Ruimte voor de eerste stap</h2><p>Maak een taak aan en geef het project richting.</p></div>}
 {!!allTasks.length&&!tasks.length&&<div className="empty-state">Geen taken voor deze filters.</div>}
 {view==="board"?<div className="task-board">{Object.entries(statuses).map(([key,label])=><section className={`task-column column-${key}`} key={key}><h2>{label}<span>{tasks.filter(t=>t.status===key).length}</span></h2>{tasks.filter(t=>t.status===key).map(renderTask)}{!tasks.some(t=>t.status===key)&&<p className="column-empty">Geen taken</p>}</section>)}</div>:<div className="task-list">{tasks.map(renderTask)}</div>}</>}
 {draft&&<div className="modal-backdrop"><section className="task-dialog" role="dialog" aria-modal="true" aria-labelledby="task-dialog-title" onKeyDown={e=>{if(e.key==="Escape"&&!busy)setDraft(null);if(e.key==="Tab"){const nodes=e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input, textarea, select');const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}}}><header className="section-heading"><h2 id="task-dialog-title">{draft.id?"Taak bewerken":"Nieuwe taak"}</h2><button aria-label="Sluiten" disabled={busy} className="secondary-button" onClick={()=>setDraft(null)}>×</button></header><form onSubmit={save} className="task-form"><fieldset disabled={busy}>
 <label>Project<select value={draft.projectId} disabled={!!draft.id||!!projectId} onChange={e=>setDraft({...draft,projectId:e.target.value})}>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
 <label>Titel<input autoFocus required maxLength={200} value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})} placeholder="Wat moet er gebeuren?"/></label>
 <label>Beschrijving<textarea maxLength={10000} rows={4} value={draft.description} onChange={e=>setDraft({...draft,description:e.target.value})}/></label>
 <div className="form-grid"><label>Verantwoordelijke<select value={draft.assignee} onChange={e=>setDraft({...draft,assignee:e.target.value})}><option value="">Niet toegewezen</option>{members.map(m=><option key={m}>{m}</option>)}</select></label><label>Deadline<input type="date" name="dueDate" value={draft.dueDate} onChange={e=>setDraft({...draft,dueDate:e.target.value})}/></label><label>Prioriteit<select value={draft.priority} onChange={e=>setDraft({...draft,priority:e.target.value})}>{Object.entries(priorities).map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label><label>Status<select value={draft.status} onChange={e=>setDraft({...draft,status:e.target.value})}>{Object.entries(statuses).map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label></div>
 </fieldset>{formError&&<div className="alert" role="alert">{formError}</div>}<footer className="dialog-actions">{draft.id&&<button type="button" className="danger-button" disabled={busy} onClick={()=>setDeleting(true)}>Verwijderen</button>}<button type="button" className="secondary-button" disabled={busy} onClick={()=>setDraft(null)}>Annuleren</button><button className="button-primary" disabled={busy||!draft.title.trim()}>{busy?"Bezig…":"Taak opslaan"}</button></footer>{deleting&&<div className="delete-confirm"><p>Deze taak definitief verwijderen?</p><button type="button" className="danger-button" disabled={busy} onClick={()=>void remove()}>Ja, verwijderen</button> <button type="button" className="secondary-button" disabled={busy} onClick={()=>setDeleting(false)}>Behouden</button></div>}</form></section></div>}
 </main>;
}
