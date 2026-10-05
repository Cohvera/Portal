"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  processHealth,
  processStatuses,
  validateProcessMetadata,
  type ProcessRecord,
} from "@cohvera/contracts";
import { useCompany } from "../../PortalShell";
import "./process-hub.css";

const dateLabel = (value: string) =>
  value
    ? new Intl.DateTimeFormat("nl-BE").format(new Date(`${value}T12:00:00Z`))
    : "Nog te plannen";
const today = () =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Brussels",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const overdue = (p: ProcessRecord) =>
  !!p.nextReviewOn && p.nextReviewOn < today();
const needsAttention = (p: ProcessRecord) =>
  ["AMBER", "RED"].includes(p.health) || p.status === "REVIEW" || overdue(p);

async function responseData(response: Response) {
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      typeof data?.message === "string"
        ? data.message
        : "Het procesregister kon niet worden geladen of opgeslagen.",
    );
  return data;
}

export default function ProcessHub() {
  const { canManageCatalog } = useCompany();
  const [rows, setRows] = useState<ProcessRecord[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [query, setQuery] = useState(""),
    [status, setStatus] = useState(""),
    [category, setCategory] = useState(""),
    [attentionOnly, setAttentionOnly] = useState(false);
  const [selected, setSelected] = useState<ProcessRecord | null>(null),
    [editing, setEditing] = useState(false),
    [draft, setDraft] = useState<ProcessRecord | null>(null);
  const [saving, setSaving] = useState(false),
    [saveError, setSaveError] = useState(""),
    [notice, setNotice] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setRows(
        await responseData(
          await fetch("/api/processes", { cache: "no-store" }),
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (selected && !dialog.current?.open) dialog.current?.showModal();
  }, [selected]);
  function close() {
    if (saving) return;
    dialog.current?.close();
    setSelected(null);
    setDraft(null);
    setSaveError("");
  }
  function open(p: ProcessRecord) {
    setSelected(p);
    setDraft({ ...p });
    setEditing(false);
    setSaveError("");
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!draft) return;
    setSaveError("");
    setSaving(true);
    try {
      const payload = validateProcessMetadata(draft);
      const next = (await responseData(
        await fetch(`/api/processes/${draft.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }),
      )) as ProcessRecord;
      setRows((current) => current.map((p) => (p.id === next.id ? next : p)));
      setSelected(next);
      setDraft(next);
      setEditing(false);
      setNotice(`${next.name} is opgeslagen.`);
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  const filtered = rows.filter(
    (p) =>
      (!status || p.status === status) &&
      (!category || p.category === category) &&
      (!attentionOnly || needsAttention(p)) &&
      `${p.id} ${p.name} ${p.owner} ${p.ownerRole} ${p.nextAction}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const attention = rows.filter(needsAttention);
  const field = (
    key:
      | "owner"
      | "sharepointUrl"
      | "methodologyUrl"
      | "nextAction"
      | "nextReviewOn"
      | "target"
      | "measurement"
      | "problem"
      | "countermeasure"
      | "verification",
    label: string,
    type = "text",
  ) => (
    <label>
      {label}
      {type === "textarea" ? (
        <textarea
          rows={3}
          maxLength={1000}
          value={draft?.[key] || ""}
          onChange={(e) =>
            setDraft((d) => d && { ...d, [key]: e.target.value })
          }
        />
      ) : (
        <input
          type={type}
          maxLength={key.endsWith("Url") ? 2000 : key === "owner" ? 100 : 1000}
          value={draft?.[key] || ""}
          onChange={(e) =>
            setDraft((d) => d && { ...d, [key]: e.target.value })
          }
        />
      )}
    </label>
  );

  return (
    <main className="hub-page process-hub">
      <div className="hub-page-inner">
        <div className="hub-breadcrumb">
          <Link href="/">Cohvera Digital Hub</Link>
          <span>/</span>
          <span>Process Hub</span>
        </div>
        <header className="hub-hero">
          <div>
            <span className="badge">COEF · Bedrijfsprocessen</span>
            <h1>Process Hub</h1>
            <p className="hub-tagline">
              Een heldere standaard. Elke dag beter.
            </p>
            <p className="muted hub-purpose">
              De gezamenlijke procesbibliotheek van Cohvera, Q-Home, Tomme
              Energie en Warco. Hier volg je eigenaarschap, status en
              verbeteringen. De volledige processen staan in SharePoint.
            </p>
          </div>
          <Link className="secondary-button" href="/">
            Terug naar overzicht
          </Link>
        </header>
        {notice && (
          <p className="process-notice" role="status">
            {notice}
          </p>
        )}
        {error && (
          <div className="alert" role="alert">
            {error}{" "}
            <button className="secondary-button" onClick={() => void load()}>
              Opnieuw laden
            </button>
          </div>
        )}
        {loading ? (
          <p role="status">Procesbibliotheek laden…</p>
        ) : (
          !error && (
            <>
              <section className="process-stats" aria-label="Registeroverzicht">
                <article>
                  <strong>{rows.length}</strong>
                  <span>Bedrijfsprocessen</span>
                </article>
                <article>
                  <strong>
                    {rows.filter((p) => p.status === "ACTIVE").length}
                  </strong>
                  <span>Actieve standaarden</span>
                </article>
                <article>
                  <strong>
                    {rows.filter((p) => !!p.sharepointUrl).length} /{" "}
                    {rows.length}
                  </strong>
                  <span>Gekoppeld aan SharePoint</span>
                </article>
                <article>
                  <strong>{attention.length}</strong>
                  <span>Vragen aandacht</span>
                </article>
              </section>
              <details
                id="bibliotheek"
                className="process-panel process-library"
              >
                <summary className="process-library-summary">
                  <span className="process-library-heading">
                    <span className="process-eyebrow">
                      Van klantvraag tot resultaat
                    </span>
                    <span className="process-library-title">
                      Procesbibliotheek
                    </span>
                    <span className="muted">
                      Gemeenschappelijke groepsstandaarden voor alle business
                      units.
                    </span>
                  </span>
                  <span className="process-library-toggle">
                    <span>{rows.length} processen</span>
                    <span className="process-library-open-label">Openen</span>
                    <span className="process-library-close-label">
                      Inklappen
                    </span>
                    <svg
                      className="process-library-chevron"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="m6 9 6 6 6-6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </summary>
                <div className="process-library-content">
                  <div className="process-library-actions">
                    <button
                      className="secondary-button"
                      onClick={() => void load()}
                    >
                      Vernieuwen
                    </button>
                  </div>
                  <div className="process-filters">
                    <label>
                      Zoeken
                      <input
                        type="search"
                        placeholder="Proces, eigenaar of actie…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </label>
                    <label>
                      Type
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                      >
                        <option value="">Alle types</option>
                        {["Kernproces", "Ondersteuning", "Verbetering"].map(
                          (c) => (
                            <option key={c}>{c}</option>
                          ),
                        )}
                      </select>
                    </label>
                    <label>
                      Documentatiestatus
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                      >
                        <option value="">Alle statussen</option>
                        {Object.entries(processStatuses).map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="process-checkbox">
                      <input
                        type="checkbox"
                        checked={attentionOnly}
                        onChange={(e) => setAttentionOnly(e.target.checked)}
                      />{" "}
                      Alleen aandacht
                    </label>
                  </div>
                  <div
                    className="process-table-scroll"
                    tabIndex={0}
                    role="region"
                    aria-label="Procesoverzicht, horizontaal scrollbaar"
                  >
                    <table className="process-table">
                      <caption>
                        {filtered.length} van {rows.length} processen · klik op
                        een proces voor de overzichtsfiche
                      </caption>
                      <thead>
                        <tr>
                          <th scope="col">Proces</th>
                          <th scope="col">Eigenaar</th>
                          <th scope="col">Documentatie</th>
                          <th scope="col">Werking</th>
                          <th scope="col">Volgende actie / review</th>
                          <th scope="col">Procesdocument</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((p) => (
                          <tr key={p.id}>
                            <td>
                              <span className="process-id">
                                {p.id} · {p.category}
                              </span>
                              <button
                                className="process-name"
                                onClick={() => open(p)}
                              >
                                {p.name}
                              </button>
                              <span className="process-boundary">
                                {p.start} → {p.end}
                              </span>
                              <div className="process-tags">
                                {p.priority === "HIGH" && (
                                  <span className="process-chip priority-HIGH">
                                    Eerste uitwerking
                                  </span>
                                )}
                                {p.methodology && (
                                  <span className="process-chip">
                                    {p.methodology}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td>
                              {p.owner || (
                                <span className="muted">Nog toe te wijzen</span>
                              )}
                              <small className="process-owner-role">
                                Voorstel: {p.ownerRole}
                              </small>
                            </td>
                            <td>
                              <span className={`process-chip doc-${p.status}`}>
                                {processStatuses[p.status]}
                              </span>
                            </td>
                            <td>
                              <span
                                className={`process-chip health-${p.health}`}
                              >
                                {processHealth[p.health]}
                              </span>
                            </td>
                            <td>
                              <span>{p.nextAction || "Nog te bepalen"}</span>
                              <small
                                className={
                                  overdue(p)
                                    ? "process-review overdue"
                                    : "process-review"
                                }
                              >
                                Review: {dateLabel(p.nextReviewOn)}
                                {overdue(p) && " · achterstallig"}
                              </small>
                            </td>
                            <td>
                              {p.sharepointUrl ? (
                                <a
                                  className="text-link"
                                  href={p.sharepointUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  aria-label={`${p.name} openen in SharePoint (nieuw tabblad)`}
                                >
                                  SharePoint ↗
                                </a>
                              ) : (
                                <span className="muted">Nog te koppelen</span>
                              )}
                              {p.methodology &&
                                (p.methodologyUrl ? (
                                  <a
                                    className="process-method-link"
                                    href={p.methodologyUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    CPM-methodologie ↗
                                  </a>
                                ) : (
                                  <small className="process-owner-role">
                                    CPM-link ontbreekt
                                  </small>
                                ))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {!filtered.length && (
                    <p className="empty-state">
                      Geen processen voor deze filters. Pas je zoekopdracht of
                      filters aan.
                    </p>
                  )}
                  <p className="process-footnote">
                    Documentatiestatus geeft aan hoe ver de standaard is
                    uitgewerkt. Werking is een handmatige beoordeling met
                    onderbouwing, geen automatische KPI-meting.
                  </p>
                </div>
              </details>
              <section id="verbetering" className="process-panel">
                <span className="process-eyebrow">
                  Zichtbaar maken · oplossen · borgen
                </span>
                <h2>Verbeteropvolging</h2>
                <p className="muted">
                  Bespreek afwijkingen, kies een tegenmaatregel en controleer
                  het effect. Werk daarna de standaard in SharePoint bij.
                </p>
                {attention.length ? (
                  <div className="process-improvements">
                    {attention.map((p) => (
                      <article key={p.id}>
                        <div className="process-section-heading">
                          <button
                            className="process-name"
                            onClick={() => open(p)}
                          >
                            {p.name}
                          </button>
                          <span className={`process-chip health-${p.health}`}>
                            {processHealth[p.health]}
                          </span>
                        </div>
                        <p>
                          <strong>Knelpunt:</strong>{" "}
                          {p.problem ||
                            (overdue(p)
                              ? "Reviewdatum verstreken."
                              : "Standaard moet worden herzien.")}
                        </p>
                        <p>
                          <strong>Volgende actie:</strong>{" "}
                          {p.nextAction || "Nog te bepalen"}
                        </p>
                        <small>
                          {p.owner || "Eigenaar nog toe te wijzen"} · Review{" "}
                          {dateLabel(p.nextReviewOn)}
                        </small>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    Nog geen aandachtspunten geregistreerd.{" "}
                    {rows.filter((p) => p.health === "UNKNOWN").length}{" "}
                    processen zijn nog niet beoordeeld.
                  </div>
                )}
              </section>
            </>
          )
        )}
        <section className="framework-strip process-principles">
          <div>
            <strong>Standaardwerk</strong>
            <span>
              Eén afgesproken werkwijze in SharePoint, met heldere overdrachten.
            </span>
          </div>
          <div>
            <strong>Eigenaarschap</strong>
            <span>Eén eigenaar per proces en een concreet reviewmoment.</span>
          </div>
          <div>
            <strong>Visueel sturen</strong>
            <span>
              Maak resultaat en afwijkingen zichtbaar met een meetpunt.
            </span>
          </div>
          <div>
            <strong>Continu verbeteren</strong>
            <span>
              Plan, voer uit, controleer het effect en borg de verbetering.
            </span>
          </div>
        </section>
        <p className="process-footnote">
          Geïnspireerd door lean en{" "}
          <a
            href="https://www.danaher.com/how-we-work/danaher-business-system"
            target="_blank"
            rel="noopener noreferrer"
          >
            Danaher Business System ↗
          </a>
          . CPM blijft de methodologie voor projectmanagement.
        </p>
        <dialog
          ref={dialog}
          className="catalog-dialog process-dialog"
          aria-labelledby="process-dialog-title"
          onCancel={(e) => {
            e.preventDefault();
            close();
          }}
          onClose={() => {
            setSelected(null);
            setDraft(null);
          }}
        >
          {selected && draft && (
            <>
              <div className="process-section-heading">
                <div>
                  <span className="process-eyebrow">
                    {selected.id} · Overzichtsfiche
                  </span>
                  <h2 id="process-dialog-title">{selected.name}</h2>
                </div>
                <button
                  className="secondary-button"
                  disabled={saving}
                  onClick={close}
                >
                  Sluiten
                </button>
              </div>
              <p className="muted">{selected.outcome}</p>
              {!editing ? (
                <>
                  <dl className="process-details">
                    <div>
                      <dt>Start</dt>
                      <dd>{selected.start}</dd>
                    </div>
                    <div>
                      <dt>Einde</dt>
                      <dd>{selected.end}</dd>
                    </div>
                    <div>
                      <dt>Eigenaar</dt>
                      <dd>
                        {selected.owner ||
                          `Nog toe te wijzen · voorstel: ${selected.ownerRole}`}
                      </dd>
                    </div>
                    <div>
                      <dt>Documentatiestatus</dt>
                      <dd>{processStatuses[selected.status]}</dd>
                    </div>
                    <div>
                      <dt>Werking</dt>
                      <dd>{processHealth[selected.health]}</dd>
                    </div>
                    <div>
                      <dt>Voorgesteld meetpunt</dt>
                      <dd>{selected.indicator}</dd>
                    </div>
                    <div>
                      <dt>Doel / SLA</dt>
                      <dd>{selected.target || "Nog af te spreken"}</dd>
                    </div>
                    <div>
                      <dt>Meting / beoordeling</dt>
                      <dd>
                        {selected.measurement || "Nog niet geregistreerd"}
                      </dd>
                    </div>
                    <div>
                      <dt>Volgende actie</dt>
                      <dd>{selected.nextAction || "Nog te bepalen"}</dd>
                    </div>
                    <div>
                      <dt>Volgende review</dt>
                      <dd>{dateLabel(selected.nextReviewOn)}</dd>
                    </div>
                    <div>
                      <dt>Knelpunt / oorzaak</dt>
                      <dd>{selected.problem || "Nog niet geregistreerd"}</dd>
                    </div>
                    <div>
                      <dt>Tegenmaatregel</dt>
                      <dd>
                        {selected.countermeasure || "Nog niet geregistreerd"}
                      </dd>
                    </div>
                    <div>
                      <dt>Effectcontrole / borging</dt>
                      <dd>
                        {selected.verification || "Nog niet geregistreerd"}
                      </dd>
                    </div>
                  </dl>
                  <p className="process-footnote">
                    Bijgewerkt:{" "}
                    {selected.updatedAt
                      ? new Intl.DateTimeFormat("nl-BE", {
                          dateStyle: "medium",
                          timeStyle: "short",
                          timeZone: "Europe/Brussels",
                        }).format(new Date(selected.updatedAt))
                      : "Nog geen registratie"}
                  </p>
                  <div className="dialog-actions">
                    {selected.sharepointUrl && (
                      <a
                        className="secondary-button"
                        href={selected.sharepointUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Proces in SharePoint ↗
                      </a>
                    )}
                    {selected.methodologyUrl && (
                      <a
                        className="secondary-button"
                        href={selected.methodologyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        CPM ↗
                      </a>
                    )}
                    {canManageCatalog && (
                      <button
                        className="primary-button"
                        onClick={() => setEditing(true)}
                      >
                        Overzicht bijwerken
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <form className="process-form" onSubmit={save}>
                  <fieldset disabled={saving}>
                    <legend>Eigenaarschap en documentatie</legend>
                    <p>
                      Wijzig hier het overzicht. Bewerk de volledige procedure
                      rechtstreeks in SharePoint.
                    </p>
                    {field("owner", "Proceseigenaar")}
                    {field(
                      "sharepointUrl",
                      "Exacte SharePoint-link naar proces",
                      "url",
                    )}
                    {selected.methodology &&
                      field(
                        "methodologyUrl",
                        "SharePoint-link naar CPM-methodologie",
                        "url",
                      )}
                    <div className="form-grid">
                      <label>
                        Documentatiestatus
                        <select
                          value={draft.status}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              status: e.target.value as ProcessRecord["status"],
                            })
                          }
                        >
                          {Object.entries(processStatuses).map(
                            ([key, label]) => (
                              <option key={key} value={key}>
                                {label}
                              </option>
                            ),
                          )}
                        </select>
                      </label>
                      <label>
                        Prioriteit
                        <select
                          value={draft.priority}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              priority: e.target
                                .value as ProcessRecord["priority"],
                            })
                          }
                        >
                          <option value="HIGH">Eerste uitwerking</option>
                          <option value="NORMAL">Normaal</option>
                        </select>
                      </label>
                    </div>
                    <h3>Resultaat en review</h3>
                    <p>Voorgesteld meetpunt: {selected.indicator}</p>
                    {field(
                      "target",
                      "Doel / SLA (inclusief meetafspraak)",
                      "textarea",
                    )}
                    <label>
                      Werking
                      <select
                        value={draft.health}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            health: e.target.value as ProcessRecord["health"],
                          })
                        }
                      >
                        {Object.entries(processHealth).map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    {field(
                      "measurement",
                      "Onderbouwing: meting / beoordeling (met datum)",
                      "textarea",
                    )}
                    {field("nextAction", "Volgende actie", "textarea")}
                    {field("nextReviewOn", "Volgende review", "date")}
                    <h3>Verbetercyclus · PDCA</h3>
                    {field("problem", "Plan · knelpunt en oorzaak", "textarea")}
                    {field("countermeasure", "Do · tegenmaatregel", "textarea")}
                    {field(
                      "verification",
                      "Check / Act · effectcontrole en borging in SharePoint",
                      "textarea",
                    )}
                  </fieldset>
                  {saveError && (
                    <p role="alert" className="alert">
                      {saveError}
                    </p>
                  )}
                  <div className="dialog-actions">
                    <button
                      type="button"
                      disabled={saving}
                      className="secondary-button"
                      onClick={() => {
                        setDraft({ ...selected });
                        setEditing(false);
                        setSaveError("");
                      }}
                    >
                      Annuleren
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="primary-button"
                    >
                      {saving ? "Opslaan…" : "Opslaan"}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </dialog>
      </div>
    </main>
  );
}
