"use client";
import Link from 'next/link';
import {useState} from 'react';
import {useCompany} from '../../PortalShell';
import {useProjects} from '../../../lib/projects';
import {operationsSummary,projectDeadline,projectStatusIssues,statusIssueGroups,type StatusIssueKind} from '../../../lib/operations';
import {projectStatus} from '../../../lib/project-overview';
import {RecentClosedProjects} from '../../projects/RecentClosedProjects';
import '../../projects/projects.css';
import './operations-hub.css';
export default function OperationsHub(){
 const {can,companyCode}=useCompany();
 if(!can('projects.read'))return <main className="main"><h1>Operations Hub</h1><p>Je hebt geen toegang tot de projectgegevens van dit bedrijf.</p></main>;
 return <OperationsData key={companyCode}/>;
}
function OperationsData(){
 const {companies}=useCompany();
 const {projects,companyCode,loading,error,refresh,setError}=useProjects();
 const [refreshing,setRefreshing]=useState(false),[view,setView]=useState('active');
 const [issueFilter,setIssueFilter]=useState<StatusIssueKind|'all'>('all');
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Brussels'}).format(new Date());
 const summary=operationsSummary(projects,today);
 const groups=statusIssueGroups(projects);
 const filteredIssues=issueFilter==='all'?summary.statusIssues:groups.find(group=>group.kind===issueFilter)?.projects??[];
 const shown=view==='issues'?filteredIssues:view==='warranty'?summary.warranty:view==='overdue'?summary.overdue:view==='unassigned'?summary.unassigned:view==='missing'?summary.missingDeadline:summary.active;
 const latest=projects.map(p=>p.sourceSeenAt).filter((date):date is string=>!!date).sort().at(-1);
 async function reload(){setRefreshing(true);try{await refresh();setError('');}catch(e){setError(e instanceof Error?e.message:'Projecten ophalen mislukt.');}finally{setRefreshing(false);}}
 const dateLabel=(date:string)=>new Intl.DateTimeFormat('nl-BE',{timeZone:'Europe/Brussels',day:'numeric',month:'short',year:'numeric'}).format(new Date(date));
 return <main className="hub-page operations-hub"><div className="hub-page-inner">
 <nav className="hub-breadcrumb" aria-label="Navigatie"><Link href="/">Cohvera Digital Hub</Link><span>/</span><span>Operations</span></nav>
 <header className="hub-hero"><div><p className="eyebrow">Operations · {companies.find(c=>c.code===companyCode)?.name||companyCode}</p><h1>Projecten in beeld</h1><p className="hub-tagline">Uitvoering, deadlines en opvolging op één plek.</p><p className="muted">Gebaseerd op de actuele projectselectie in Portal.{latest&&` Laatste bronstand: ${new Date(latest).toLocaleString('nl-BE')}.`}</p></div>
 <div className="operations-actions"><Link className="secondary-button" href="/projects">Alle projecten →</Link><Link className="secondary-button" href="/tools/middleware/qbox">Koppeling & sync</Link><button type="button" className="secondary-button" disabled={loading||refreshing} onClick={reload}>{refreshing?'Ophalen…':'Gegevens vernieuwen'}</button></div></header>
 {error?<div className="alert" role="alert">Projectgegevens konden niet worden vernieuwd: {error}</div>:null}
 {loading?<p role="status">Projectgegevens laden…</p>:!projects.length?<section className="card"><h2>{error?'Geen gegevens beschikbaar':'Nog geen projecten'}</h2><p>Zodra projecten beschikbaar zijn voor dit bedrijf, verschijnt hier het operationele overzicht.</p></section>:<>
 <section className="operations-metrics" aria-label="Projectoverzicht">
 {[{key:'active',label:'In uitvoering',count:summary.active.length,detail:'Actieve hoofdprojecten'},{key:'issues',label:'Status controleren',count:summary.statusIssues.length,detail:'Projectmap of offerte wijkt af'},{key:'warranty',label:'In garantie',count:summary.warranty.length,detail:'Gefactureerd · Uit WIP uit'},{key:'overdue',label:'Deadline verstreken',count:summary.overdue.length,detail:'Bij projecten in uitvoering'},{key:'missing',label:'Deadline ontbreekt',count:summary.missingDeadline.length,detail:'Planning nog aan te vullen'},{key:'unassigned',label:'Zonder verantwoordelijke',count:summary.unassigned.length,detail:'Bij projecten in uitvoering'}].map(metric=><button type="button" className={metric.key==='issues'&&metric.count>0?'operations-metric operations-metric-warning':'operations-metric'} key={metric.key} aria-pressed={view===metric.key} onClick={()=>setView(metric.key)}><span>{metric.label}</span><strong>{metric.count}</strong><small>{metric.detail}</small></button>)}
 </section>
 <div className="operations-columns"><section className="card operations-projects"><div className="section-heading"><h2>{view==='issues'?'Projectstatus controleren':view==='warranty'?'Projecten in garantie':view==='overdue'?'Verstreken deadlines':view==='missing'?'Deadline aan te vullen':view==='unassigned'?'Verantwoordelijke aan te vullen':'Projecten in uitvoering'}</h2><span className="muted">{shown.length} projecten</span></div>
 {view==='issues'&&<p className="muted">Controle van projectmappen én gekoppelde offertes. Verloren projectmappen horen op 04, verloren offertes op 14, beide met Uit WIP aan. Calculatie, offerte of uitvoering met Uit WIP aan vraagt ook controle. Elke projectmap telt één keer per probleem en kan in meerdere groepen voorkomen. Alleen geïmporteerde projecten tellen mee.</p>}
 {view==='issues'&&<div className="operations-problem-filters" role="group" aria-label="Filter op probleem">
 <button type="button" aria-pressed={issueFilter==='all'} onClick={()=>setIssueFilter('all')}>Alle problemen <span>{summary.statusIssues.length}</span></button>
 {groups.map(group=><button type="button" key={group.kind} aria-pressed={issueFilter===group.kind} onClick={()=>setIssueFilter(group.kind)}>{group.label} <span>{group.projects.length}</span></button>)}
 </div>}
 {view==='issues'&&<p role="status" className="muted">{issueFilter==='all'?'Alle problemen':groups.find(group=>group.kind===issueFilter)?.label} · {shown.length} projecten</p>}
 {shown.length?<div className="projects-table-scroll"><table className="projects-table"><thead><tr><th>Project</th><th>Status</th><th>Deadline</th><th>Verantwoordelijke</th>{view==='issues'&&<th>Te controleren</th>}</tr></thead><tbody>{shown.slice(0,view==='issues'?shown.length:12).map(project=><tr key={project.id}><td><strong>{project.name}</strong>{project.customer&&<span className="projects-customer">{project.customer}</span>}</td><td>{projectStatus(project)}</td><td className={projectDeadline(project)&&projectDeadline(project)!<today?'operations-overdue':''}>{projectDeadline(project)?dateLabel(projectDeadline(project)!):'Niet ingevuld'}</td><td>{project.owner||'Nog toe te wijzen'}</td>{view==='issues'&&<td className="operations-issue-reason"><ul>{projectStatusIssues(project).filter(issue=>issueFilter==='all'||issue.kind===issueFilter).map((issue,index)=><li key={index}><strong>{issue.record}</strong><br/>{issue.reason}</li>)}</ul></td>}</tr>)}</tbody></table></div>:<p className="muted">Geen projecten in deze selectie.</p>}
 <Link className="text-link" href="/projects">{shown.length>12?'Bekijk alle projecten':'Open projectenoverzicht'} →</Link></section>
 <section className="card operations-followup"><h2>Opvolging</h2><div className="operations-task-count"><strong>{summary.openTasks.length}</strong><span>open taken in de huidige projectselectie</span></div><p>{summary.blockedTasks.length} taken geblokkeerd</p><Link className="text-link" href="/tasks">Taken opvolgen →</Link><hr/><h3>Eerstvolgende deadlines</h3>
 {summary.deadlines.filter(p=>projectDeadline(p)!>=today).length?<ul>{summary.deadlines.filter(p=>projectDeadline(p)!>=today).slice(0,5).map(p=><li key={p.id}><strong>{dateLabel(projectDeadline(p)!)}</strong><span>{p.name}</span></li>)}</ul>:<p className="muted">Geen toekomstige deadlines ingevuld bij projecten in uitvoering.</p>}
 </section></div>
 <section className="operations-updates" aria-label="Projectupdates"><RecentClosedProjects key={companyCode} companyCode={companyCode} projects={projects}/></section>
 </>}
 </div></main>;
}
