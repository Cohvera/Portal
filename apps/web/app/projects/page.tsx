"use client";
import {ALL_COMPANIES} from "../../lib/project-companies";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  useProjects,
  projectStatuses,
  request,
  type Project,
} from "../../lib/projects";
import { projectYear, filterProjects, projectScope, projectStatus, projectInExecution, projectExplanation, type ProjectFilters } from "../../lib/project-overview";
import "./projects.css";
import { projectsCsv } from "../../lib/project-csv";
import { ProjectStatusHelp } from "./ProjectStatusHelp";
import { RecentClosedProjects } from "./RecentClosedProjects";
import { PlenionImport } from "./PlenionImport";
import { PlenionProjectDetails } from "./PlenionProjectDetails";
import { useCompany } from "../PortalShell";

export default function ProjectsPage() {
  const { projects, loading, error, refresh, url, companyCode } = useProjects();
  const { companies, can, displayName, selectCompany } = useCompany();
  const writable = can("projects.manage");
  const dialog = useRef<HTMLDialogElement>(null);
  const [formVersion, setFormVersion] = useState(0);
  const [editing, setEditing] = useState<Project | null>(null);
  const [status, setStatus] = useState("Gepland");
  const [color, setColor] = useState(projectStatuses.Gepland);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [refreshError, setRefreshError] = useState("");
  const [filters, setFilters] = useState<ProjectFilters>({query:"",status:"",owner:"",source:"",scope:"active"});
  const resetFilters = () => setFilters({query:"",status:"",owner:"",source:"",scope:"active"});
  const filteredProjects = filterProjects(projects, filters);
  const owners = [...new Set(projects.map(p => p.owner).filter(owner => owner.trim()))].sort((a,b) => a.localeCompare(b,"nl-BE"));
  const hasFilters = !!(filters.query || filters.status || filters.owner || filters.source || filters.yearFrom || filters.yearTo || filters.scope !== "active");
  const yearOptions = [...new Set(projects.map(projectYear).filter((year):year is number => year!==null))].sort((a,b)=>b-a);
  const unknownYears = projects.filter(p=>projectYear(p)===null).length;
  const statusOptions = [...new Set(projects.map(projectStatus))].sort((a,b) => a.localeCompare(b,"nl-BE",{numeric:true}));
  const [plenion, setPlenion] = useState<{connected:boolean; stale:boolean; sourceObservedAt?:string; projectCount?:number} | null>(null);
  useEffect(() => {
    setPlenion(null);
    if (!companyCode || companyCode === ALL_COMPANIES) return;
    const controller = new AbortController();
    request<{connected:boolean; stale:boolean; sourceObservedAt?:string; projectCount?:number}>(`/api/companies/${encodeURIComponent(companyCode)}/integrations/plenion/status`, {signal:controller.signal})
      .then(setPlenion).catch(() => {});
    return () => controller.abort();
  }, [companyCode]);
  useEffect(() => {
    dialog.current?.close();
    setNotice("");
    setRefreshError("");
    resetFilters();
  }, [companyCode]);
  function exportCsv() {
    const company = companies.find(c => c.code === companyCode)?.name || companyCode;
    const blob = new Blob([projectsCsv(filteredProjects, company)], {type:"text/csv;charset=utf-8;"});
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = `projecten-${companyCode.replace(/[^a-z0-9_-]/gi,"_")}-${new Date().toLocaleDateString("sv-SE")}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
  }
  function open(project: Project) {
    setFormVersion((v) => v + 1);
    setEditing(project);
    setStatus(project?.status || "Gepland");
    setColor(project?.statusColor || projectStatuses.Gepland);
    setFormError("");
    dialog.current?.showModal();
  }
  async function removeProject(project:Project) {
    if(busy || !writable || !window.confirm(`Handmatig project “${project.name}” definitief verwijderen?`)) return;
    setBusy(true);setNotice("");setRefreshError("");
    try {
      await request(`${url}/${project.id}`,{method:"DELETE"});
      setNotice(`Project “${project.name}” verwijderd.`);
      try {await refresh();} catch {setRefreshError("Project verwijderd, maar het overzicht kon niet vernieuwd worden. Herlaad de pagina.");}
    } catch(e) {setRefreshError(e instanceof Error ? e.message : "Verwijderen is niet gelukt.");}
    finally {setBusy(false);}
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    if (!name) {
      setFormError("Vul een titel in.");
      return;
    }
    if (!editing) return;
    setBusy(true);
    setFormError("");
    setNotice("");
    setRefreshError("");
    try {
      await request(`${url}/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name,
          status,
          statusColor: color,
          owner: form.get("owner"),
          dueDate: editing?.dueDate?.slice(0, 10) || null,
        }),
      });
      dialog.current?.close();
      setNotice("Project bijgewerkt.");
      try {
        await refresh();
      } catch {
        setRefreshError(
          "Het project is opgeslagen, maar het overzicht kon niet vernieuwd worden. Vernieuw de pagina.",
        );
      }
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Opslaan is niet gelukt.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="main">
      <header className="page-heading section-heading">
        <div>
          <p className="eyebrow">
            Van plan naar uitvoering ·{" "}
            {companyCode === ALL_COMPANIES ? "Alle bedrijven" : companies.find((c) => c.code === companyCode)?.name || companyCode}
          </p>
          <h1>Projecten</h1>
          <p className="muted">
            Een eenvoudig overzicht van wat er loopt en wie het opvolgt.
          </p>
        </div>
        {companyCode !== ALL_COMPANIES && can("projects.read") && <Link className="projects-middleware-link" href={companyCode === "QHOME" ? "/tools/middleware/teamleader" : "/tools/middleware/qbox"}>Koppeling & synchronisatie <span aria-hidden="true">→</span></Link>}
      </header>
      {companyCode === "QHOME" && writable && <PlenionImport key={companyCode} companyCode={companyCode} onImported={refresh} />}
      {plenion?.connected && (
        <div className={plenion.stale ? "alert" : "success-box"} role="status">
          Plenion via Q-box · {plenion.projectCount} projecten in de laatste export · Bronstand {plenion.sourceObservedAt ? new Date(plenion.sourceObservedAt).toLocaleString("nl-BE") : "onbekend"}.
          {plenion.stale && " De bronstand is ouder dan 24 uur; bestaande projecten blijven beschikbaar."}
        </div>
      )}
      <ProjectStatusHelp />
      <RecentClosedProjects key={companyCode} companyCode={companyCode} projects={projects} />
      {error && (
        <div className="alert" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="success-box" role="status">
          {notice}
        </div>
      )}
      {refreshError && (
        <div className="alert" role="alert">
          {refreshError}
        </div>
      )}
      {loading ? (
        <p role="status">Projecten laden…</p>
      ) : (
        <section className="projects-overview" aria-label="Projectoverzicht">
          <div className="projects-status-grid" aria-label="Filter op afsluiting">
            {[{value:"active",label:"In uitvoering",color:"#2563eb"},{value:"open",label:"Niet afgesloten",color:"#2563eb"},{value:"closed",label:"Administratief afgesloten",color:"#16834b"},{value:"unknown",label:"Nog niet bevestigd",color:"#d97706"},{value:"",label:"Alle projecten",color:"#0b2038"}].map(({value,label,color}) => (
              <button key={label} type="button" className="projects-status-tile"
                aria-pressed={filters.scope === value}
                onClick={() => setFilters(current => ({...current,scope:value}))}>
                <span><i style={{backgroundColor:color}} aria-hidden="true" />{label}</span>
                <strong>{value ? projects.filter(p => value === "active" ? projectInExecution(p) : projectScope(p) === value).length : projects.length}</strong>
              </button>
            ))}
          </div>
          {projects.some(p => projectScope(p) === "unknown") && (
            <div className="alert" role="status">
              Bij {projects.filter(p => projectScope(p) === "unknown").length} Plenion-projecten is het afsluitveld nog niet ontvangen. Daarom staan ze bij ‘Nog niet bevestigd’. Open ‘Gegevens uit Plenion’ bij een project om te zien welke velden beschikbaar zijn. Laat de bijgewerkte Q-box opnieuw importeren in datahub-modus om de bronstatus en afsluitvinkjes aan te vullen.
            </div>
          )}
          <div className="card projects-list-card">
            <div className="projects-filter-bar">
              <label className="projects-search">Zoeken
                <input type="search" placeholder="Project, klant of projectnummer…" value={filters.query}
                  onChange={event => setFilters(current => ({...current,query:event.target.value}))} />
              </label>
              <label>Vanaf jaar
                <select value={filters.yearFrom||""} onChange={event => setFilters(current => ({...current,yearFrom:event.target.value,yearTo:current.yearTo&&event.target.value&&Number(current.yearTo)<Number(event.target.value)?"":current.yearTo}))}>
                  <option value="">Alle jaren</option>
                  {yearOptions.map(year=><option key={year} value={year}>{year}</option>)}
                </select>
              </label>
              <label>Tot en met jaar
                <select value={filters.yearTo||""} onChange={event => setFilters(current => ({...current,yearTo:event.target.value}))}>
                  <option value="">Geen eindjaar</option>
                  {yearOptions.filter(year=>!filters.yearFrom||year>=Number(filters.yearFrom)).map(year=><option key={year} value={year}>{year}</option>)}
                </select>
              </label>
              <label>Status
                <select value={filters.status} onChange={event => setFilters(current => ({...current,status:event.target.value}))}>
                  <option value="">Alle statussen</option>
                  {statusOptions.map(value => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
              <label>Verantwoordelijke
                <select value={filters.owner} onChange={event => setFilters(current => ({...current,owner:event.target.value}))}>
                  <option value="">Iedereen</option><option value="__unassigned__">Nog toe te wijzen</option>
                  {owners.map(owner => <option key={owner} value={owner}>{owner}</option>)}
                </select>
              </label>
              <label>Bron
                <select value={filters.source} onChange={event => setFilters(current => ({...current,source:event.target.value}))}>
                  <option value="">Alle bronnen</option><option value="PLENION">Plenion</option><option value="TEAMLEADER">Teamleader</option><option value="PORTAL">Handmatig in portaal</option>
                </select>
              </label>
            </div>
            <p className="muted projects-source-note">Projectjaar: aanmaakdatum in Plenion, startdatum in Teamleader of aanmaakdatum voor handmatige projecten.</p>
            {(filters.yearFrom||filters.yearTo)&&unknownYears>0&&<label className="projects-year-unknown"><input type="checkbox" checked={filters.includeUnknownYear===true} onChange={event=>setFilters(current=>({...current,includeUnknownYear:event.target.checked}))}/> Projecten zonder bekend jaar ook tonen ({unknownYears})</label>}
            <div className="projects-results-heading">
              <p role="status" aria-live="polite"><strong>{filteredProjects.length}</strong> van {projects.length} projecten{filters.status && ` · ${filters.status}`}</p>
              <div className="projects-export-actions">
                <button type="button" className="secondary-button" disabled={loading || !!error || !filteredProjects.length} onClick={exportCsv} title="Download de projecten volgens de huidige filters">CSV exporteren ({filteredProjects.length})</button>
                {hasFilters && <button type="button" className="secondary-button" onClick={resetFilters}>Filters wissen</button>}
              </div>
            </div>
            {projects.some(p => p.externalSource === "PLENION") && <p className="muted projects-source-note">Status en administratieve afsluiting zijn onafhankelijk. Uit WIP geldt per record: een afgesloten offerte of nieuwe factuur sluit het hoofdproject niet automatisch af. Een oude datum betekent niet dat een project nog in uitvoering is.</p>}
            {filteredProjects.length > 0 ? (
              <div className="projects-table-scroll">
                <table className="projects-table">
                  <caption className="projects-visually-hidden">Projecten van het geselecteerde bedrijf, gefilterd op status, verantwoordelijke, bron, projectjaar en zoekterm</caption>
                  <thead><tr><th scope="col">Project / klant</th><th scope="col">Status</th><th scope="col">Administratief afgesloten</th><th scope="col">Deadline</th><th scope="col">Verantwoordelijke</th><th scope="col">Bron</th><th scope="col"><span className="projects-visually-hidden">Acties</span></th></tr></thead>
                  <tbody>{filteredProjects.map(p => (
                    <tr key={p.id}>
                      <td>{companyCode === ALL_COMPANIES && <span className="projects-source-badge">{p.companyName}</span>}<strong className="projects-project-name">{p.name}</strong>{p.customer && <span className="projects-customer">{p.customer}</span>}{p.externalSource === "PLENION" && <PlenionProjectDetails project={p} />}</td>
                      <td><span className="project-status"><span style={{backgroundColor:p.externalSource === "PLENION" ? (projectScope(p) === "closed" ? "#16834b" : "#2563eb") : p.statusColor || projectStatuses[p.status]}} />{projectStatus(p)}</span>{p.externalSource === "PLENION" && <span className="projects-customer">{projectExplanation(p)}</span>}</td>
                      <td>{projectScope(p) === "unknown" ? <span className="muted">Nog niet bevestigd</span> : <label className="projects-closed-flag"><input type="checkbox" checked={projectScope(p) === "closed"} disabled aria-label={`${p.name}: afgesloten volgens ${p.externalSource === "PLENION" ? "Plenion" : "portaalstatus"}`} />{projectScope(p) === "closed" ? "Ja" : "Nee"}</label>}</td>
                      <td>{(p.externalSource === "PLENION" ? p.sourceDates?.deadline : p.dueDate)?.slice(0,10) || "Niet ingevuld"}</td>
                      <td><span className={!p.owner.trim() ? "muted" : ""}>{p.owner || "Nog toe te wijzen"}</span></td>
                      <td><span className="projects-source-badge">{p.externalSource === "PLENION" ? "Plenion" : p.externalSource === "TEAMLEADER" ? "Teamleader" : "Portaal"}</span>{p.externalId && <span className="projects-customer">{p.externalSource === "TEAMLEADER" ? p.sourceExtraFields?.reference || p.externalId : p.externalId}</span>}</td>
                      <td>{companyCode === ALL_COMPANIES ? <button className="project-edit" onClick={()=>selectCompany(p.companyCode!)}>Open bedrijf</button> : <button className="project-edit" disabled={busy || !writable} aria-label={`${p.name} bewerken`} onClick={() => open(p)}>Bewerken</button>}
                        {writable && p.externalSource == null && p.externalId == null && p.sourceRecordId == null && <button className="project-edit" disabled={busy || p.tasks.length>0} title={p.tasks.length ? "Verplaats of verwijder eerst de gekoppelde taken" : "Handmatig project verwijderen"} aria-label={`${p.name} verwijderen`} onClick={()=>removeProject(p)}>Verwijderen</button>}
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            ) : !error && (
              <div className="empty-state">
                <h2>{projects.length ? "Geen projecten voor deze selectie" : "Nog geen projecten ontvangen"}</h2>
                <p>{projects.length ? "Pas de zoekterm of filters aan om meer projecten te zien." : "Projecten worden via de gekoppelde bron geïmporteerd."}</p>
                {hasFilters && <button className="secondary-button" onClick={resetFilters}>Filters wissen</button>}
              </div>
            )}
          </div>
        </section>
      )}
      <dialog
        ref={dialog}
        className="catalog-dialog"
        aria-labelledby="project-dialog-title"
        onCancel={(e) => {
          if (busy) e.preventDefault();
        }}
      >
        <form key={formVersion} className="task-form" onSubmit={save}>
          <header className="section-heading">
            <div>
              <p className="eyebrow">
                {companyCode === ALL_COMPANIES ? "Alle bedrijven" : companies.find((c) => c.code === companyCode)?.name || companyCode}
              </p>
              <h2 id="project-dialog-title">
                Project bewerken
              </h2>
            </div>
            <button
              type="button"
              className="secondary-button"
              disabled={busy}
              aria-label="Sluiten"
              onClick={() => dialog.current?.close()}
            >
              ×
            </button>
          </header>
          <fieldset disabled={busy}>
            <label>
              Titel
              <input
                name="name"
                required
                maxLength={200}
                defaultValue={editing?.name || ""}
                placeholder="Bijvoorbeeld: Renovatie kantoor"
              />
            </label>
            {editing?.externalSource === "TEAMLEADER" && <p className="muted">Projectnaam, status en deadline komen bij iedere synchronisatie opnieuw uit Teamleader. De verantwoordelijke en taken worden in het portaal beheerd.</p>}
            {editing?.externalSource === "PLENION" && <p className="muted">Plenion-status: {projectStatus(editing)} · Administratief afgesloten: {projectScope(editing) === "unknown" ? "onbekend" : projectScope(editing) === "closed" ? "ja" : "nee"}. Deze brongegevens worden in Plenion beheerd; de portaalstatus hieronder staat daar los van.</p>}
            <div className="form-grid">
              <label>
                Portaalstatus
                <select
                  name="status"
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    setColor(projectStatuses[e.target.value]);
                  }}
                >
                  {Object.keys(projectStatuses).map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label>
                Kleur
                <input
                  type="color"
                  aria-label="Statuskleur"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                />
              </label>
            </div>
            <div className="project-status">
              <span style={{ backgroundColor: color }} />
              {status}
            </div>
            <label>
              Verantwoordelijke
              <input
                name="owner"
                required
                maxLength={100}
                defaultValue={editing?.owner || displayName}
                placeholder="Naam van de verantwoordelijke"
              />
            </label>
          </fieldset>
          {formError && (
            <div className="alert" role="alert">
              {formError}
            </div>
          )}
          <footer className="dialog-actions">
            <button
              type="button"
              className="secondary-button"
              disabled={busy}
              onClick={() => dialog.current?.close()}
            >
              Annuleren
            </button>
            <button className="button-primary" disabled={busy}>
              {busy ? "Opslaan…" : "Project opslaan"}
            </button>
          </footer>
        </form>
      </dialog>
    </main>
  );
}
