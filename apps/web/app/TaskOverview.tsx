"use client";
import Link from "next/link";
import { overdue, useProjects } from "../lib/projects";
export default function TaskOverview() {
 const {projects,loading,error} = useProjects();
 const tasks=projects.flatMap(p=>p.tasks);
 return <section><div className="section-heading"><div><p className="eyebrow">Projectwerk</p><h2>Dit vraagt aandacht</h2></div><Link className="text-link" href="/projects">Naar projecten →</Link></div>
 {error ? <div className="alert">{error}</div> : <div className="cards task-stats">{[["Open taken",tasks.filter(t=>t.status!=="DONE").length],["Over deadline",tasks.filter(overdue).length],["Geblokkeerd",tasks.filter(t=>t.status==="BLOCKED").length],["Afgerond",tasks.filter(t=>t.status==="DONE").length]].map(([label,value])=><article className="card" key={label}><span className="muted">{label}</span><strong>{loading?"—":value}</strong></article>)}</div>}</section>;
}
