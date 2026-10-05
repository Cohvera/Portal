"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  useProjects,
  projectStatuses,
  request,
  type Project,
} from "../../lib/projects";
import { useCompany } from "../PortalShell";

export default function ProjectsPage() {
  const { projects, loading, error, refresh, url, companyCode } = useProjects();
  const { companies, can, displayName } = useCompany();
  const projectCompanies = companies.filter((company) => can("projects.create", company.code));
  const creatable = projectCompanies.length > 0;
  const [targetCompany, setTargetCompany] = useState("");
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
  const [plenion, setPlenion] = useState<{connected:boolean; stale:boolean; sourceObservedAt?:string; projectCount?:number} | null>(null);
  useEffect(() => {
    setPlenion(null);
    if (companyCode !== "TOMME") return;
    const controller = new AbortController();
    request<{connected:boolean; stale:boolean; sourceObservedAt?:string; projectCount?:number}>(`/api/companies/${encodeURIComponent(companyCode)}/integrations/plenion/status`, {signal:controller.signal})
      .then(setPlenion).catch(() => {});
    return () => controller.abort();
  }, [companyCode]);
  useEffect(() => {
    dialog.current?.close();
    setNotice("");
    setRefreshError("");
  }, [companyCode]);
  function open(project: Project | null = null) {
    setFormVersion((v) => v + 1);
    setEditing(project);
    setTargetCompany(project ? companyCode : projectCompanies.find((c) => c.code === companyCode)?.code || projectCompanies[0]?.code || "");
    setStatus(project?.status || "Gepland");
    setColor(project?.statusColor || projectStatuses.Gepland);
    setFormError("");
    dialog.current?.showModal();
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
    if (!editing && !projectCompanies.some((c) => c.code === targetCompany)) {
      setFormError("Kies een bedrijf waarvoor je projecten mag aanmaken.");
      return;
    }
    setBusy(true);
    setFormError("");
    setNotice("");
    setRefreshError("");
    try {
      await request(editing ? `${url}/${editing.id}` : `/api/companies/${encodeURIComponent(targetCompany)}/projects`, {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify({
          name,
          status,
          statusColor: color,
          owner: form.get("owner"),
          dueDate: editing?.dueDate?.slice(0, 10) || null,
        }),
      });
      dialog.current?.close();
      setNotice(editing ? "Project bijgewerkt." : `Project aangemaakt bij ${companies.find((c) => c.code === targetCompany)?.name || targetCompany}.${targetCompany !== companyCode ? " Kies dit bedrijf linksboven om het project te bekijken." : ""}`);
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
            {companies.find((c) => c.code === companyCode)?.name || companyCode}
          </p>
          <h1>Projecten</h1>
          <p className="muted">
            Een eenvoudig overzicht van wat er loopt en wie het opvolgt.
          </p>
        </div>
        <button
          className="button-primary"
          disabled={busy || !creatable}
          onClick={() => open()}
        >
          + Nieuw project
        </button>
      </header>
      {companyCode === "TOMME" && plenion?.connected && (
        <div className={plenion.stale ? "alert" : "success-box"} role="status">
          Plenion via Q-box · {plenion.projectCount} projecten in de laatste export · Bronstand {plenion.sourceObservedAt ? new Date(plenion.sourceObservedAt).toLocaleString("nl-BE") : "onbekend"}.
          {plenion.stale && " De bronstand is ouder dan 24 uur; bestaande projecten blijven beschikbaar."}
        </div>
      )}
      {!creatable && !loading && (
        <p className="muted">
          Je kunt projecten bekijken. Aanmaken vereist de bedrijfsrol Medewerker
          of hoger.
        </p>
      )}
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
        <section className="project-grid">
          {projects.map((p) => (
            <article className="card project-summary-card" key={p.id}>
              <div className="task-meta">
                <span className="project-status">
                  <span
                    style={{
                      backgroundColor:
                        p.statusColor || projectStatuses[p.status],
                    }}
                  />
                  {p.status}
                </span>
                <button
                  className="project-edit"
                  aria-label={`${p.name} bewerken`}
                  disabled={busy || !writable}
                  onClick={() => open(p)}
                >
                  Bewerken
                </button>
              </div>
              <h2>{p.name}</h2>
              <p className="muted">Verantwoordelijke · {p.owner || "Nog toe te wijzen"}</p>
              {p.externalSource === "PLENION" && <p className="muted">Plenion · {p.externalId}</p>}
            </article>
          ))}
          {!projects.length && !error && (
            <div className="empty-state">
              <h2>Je eerste project begint hier</h2>
              <p>
                Een titel en verantwoordelijke zijn voldoende om te starten.
              </p>
              <button
                className="button-primary"
                disabled={!creatable}
                onClick={() => open()}
              >
                + Nieuw project
              </button>
            </div>
          )}
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
                {companies.find((c) => c.code === targetCompany)?.name ||
                  targetCompany}
              </p>
              <h2 id="project-dialog-title">
                {editing ? "Project bewerken" : "Nieuw project"}
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
              Bedrijf
              <select name="companyCode" value={targetCompany} required disabled={!!editing}
                onChange={(event) => setTargetCompany(event.target.value)}>
                {(editing ? companies.filter((c) => c.code === companyCode) : projectCompanies).map((company) => (
                  <option key={company.code} value={company.code}>{company.name}</option>
                ))}
              </select>
            </label>
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
            <div className="form-grid">
              <label>
                Status
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
