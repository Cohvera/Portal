"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useCompany } from "../../PortalShell";
import { request, type Project } from "../../../lib/projects";
import {
  DAY,
  defaultTvSettings,
  fresh,
  inspection,
  planned,
  splitProjects,
  tvProjects,
  tvToday,
  type TvData,
  type TvSettings,
} from "../../../lib/tv";
import "./tv.css";
const fmt = (s: string) =>
  s ? s.slice(0, 10).split("-").reverse().join("/") : "Niet gepland";
const pct = (n: number | null | undefined) =>
  n == null ? "—" : `${Math.round(n)}%`;
export default function TvPage() {
  const { companyCode, companies, selectCompany, can } = useCompany();
  const [data, setData] = useState<TvData | null>(null),
    [error, setError] = useState(""),
    [now, setNow] = useState(Date.now()),
    [lastFetch, setLastFetch] = useState(0),
    [page, setPage] = useState(0),
    [paused, setPaused] = useState(false);
  const [draft, setDraft] = useState<TvSettings>(defaultTvSettings),
    [saving, setSaving] = useState(false),
    [saveError, setSaveError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null),
    board = useRef<HTMLElement>(null);
  const url = `/api/companies/${encodeURIComponent(companyCode)}/projects/tv`;
  const settings = { ...defaultTvSettings, ...data?.settings };
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      try {
        const next = await request<TvData>(url, {
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(10000),
          ]),
        });
        if (active) {
          setData(next);
          setLastFetch(Date.now());
          setError("");
        }
      } catch {
        if (active) setError("Verbinding met Cohvera onderbroken.");
      } finally {
        if (active) timer = setTimeout(refresh, 15000);
      }
    }
    void refresh();
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [url]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (paused) return;
    const t = setInterval(
      () => setPage((p) => p + 1),
      settings.rotationSeconds * 1000,
    );
    return () => clearInterval(t);
  }, [paused, settings.rotationSeconds]);
  const day = tvToday(now),
    connected = !!lastFetch && now - lastFetch < 120000 && !error;
  const all = data?.projects || [],
    selected = connected
      ? tvProjects(all, settings.selection, data?.source?.sourceObservedAt, now)
      : [];
  const groups = splitProjects(selected, day),
    current = [...groups.late, ...groups.current],
    pages = Math.max(1, Math.ceil(current.length / 8)),
    upPages = Math.max(1, Math.ceil(groups.upcoming.length / 6));
  const hidden = all.filter(
    (p) =>
      p.externalSource === "PLENION" && !selected.some((s) => s.id === p.id),
  ).length;
  const fleetOk =
    connected &&
    fresh(data?.fleet?.source_observed_at, now) &&
    data?.fleet?.snapshot_id === data?.source?.snapshotId;
  const vehicles = fleetOk ? data?.fleet?.vehicles || [] : [],
    vehiclePages = Math.max(1, Math.ceil(vehicles.length / 6));
  const nas = data?.nas,
    nasOk =
      connected && fresh(nas?.latest.checkedAt, now, 180000) && nas?.loggingOk;
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(`${day.slice(0, 7)}-01T12:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + i);
    const key = d.toISOString().slice(0, 7);
    return {
      key,
      label: d.toLocaleDateString("nl-BE", {
        month: "short",
        year: "2-digit",
        timeZone: "UTC",
      }),
      count: selected.filter(
        (p) => planned(p) >= day && planned(p).startsWith(key),
      ).length,
    };
  });
  const max = Math.max(1, ...months.map((m) => m.count));
  const waste = settings.waste
    .filter((e) => e.date >= day)
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
    .slice(0, 3);
  function edit() {
    setDraft(structuredClone(settings));
    setSaveError("");
    dialog.current?.showModal();
  }
  async function save() {
    setSaving(true);
    setSaveError("");
    try {
      const saved = await request<TvSettings>(url + "/settings", {
        method: "PUT",
        body: JSON.stringify(draft),
      });
      setData((d) => (d ? { ...d, settings: saved } : d));
      dialog.current?.close();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Opslaan mislukt.");
    } finally {
      setSaving(false);
    }
  }
  const row = (p: Project) => (
    <tr key={p.id} className={planned(p) && planned(p) < day ? "tv-late" : ""}>
      <td>{fmt(planned(p))}</td>
      <td>{p.externalId || "Portaal"}</td>
      <td>
        <strong>{p.customer || p.name}</strong>
        <span>{p.sourceDescription || p.name}</span>
      </td>
      <td>{p.owner || "—"}</td>
    </tr>
  );
  return (
    <main ref={board} className="tv-board">
      <header className="tv-header">
        <div>
          <p className="tv-eyebrow">COHVERA · BEDRIJFSOVERZICHT</p>
          <h1>Projecten & planning</h1>
        </div>
        <label className="tv-company">
          Actief bedrijf
          <select
            aria-label="Actief bedrijf"
            value={companyCode}
            onChange={(e) => selectCompany(e.target.value)}
          >
            {companies.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <div className="tv-clock">
          {new Date(now).toLocaleTimeString("nl-BE", {
            timeZone: "Europe/Brussels",
            hour: "2-digit",
            minute: "2-digit",
          })}
          <small>{fmt(day)}</small>
        </div>
      </header>
      <div className="tv-toolbar">
        <Link href="/projects">← Projecten</Link>
        <span>
          {settings.selection === "execution"
            ? "In uitvoering"
            : "Alle open projecten"}
        </span>
        <button onClick={() => setPaused((p) => !p)}>
          {paused ? "Rotatie starten" : "Rotatie pauzeren"}
        </button>
        <button
          onClick={() => {
            if (document.fullscreenElement) {
              void document.exitFullscreen();
            } else {
              void board.current
                ?.requestFullscreen()
                .catch(() =>
                  setError(
                    "Volledig scherm is niet beschikbaar in deze browser.",
                  ),
                );
            }
          }}
        >
          Volledig scherm
        </button>
        {can("projects.manage") && (
          <button disabled={!data} onClick={edit}>
            Instellingen
          </button>
        )}
      </div>
      <div
        className={`tv-health ${connected ? "" : "tv-warning"}`}
        role="status"
      >
        <strong>
          {!data && !error
            ? "Gegevens laden…"
            : connected
              ? "Cohvera verbonden"
              : error || "Geen actuele verbinding"}
        </strong>
        <span>
          {data?.source
            ? `Plenion-bronstand: ${new Date(data.source.sourceObservedAt).toLocaleString("nl-BE", { timeZone: "Europe/Brussels" })}${fresh(data.source.sourceObservedAt, now) ? "" : " · verouderd; Plenion-projecten verborgen"}`
            : "Geen Plenion-import voor dit bedrijf; handmatige projecten blijven beschikbaar."}
        </span>
      </div>
      <section className="tv-metrics" aria-label="Projectaantallen">
        {[
          ["Planning verstreken", groups.late.length],
          ["Vandaag / ongepland", groups.current.length],
          ["Toekomstig gepland", groups.upcoming.length],
          ["In selectie", selected.length],
        ].map(([label, count]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{connected ? count : "—"}</strong>
          </div>
        ))}
      </section>
      <div className="tv-main-grid">
        <section className="tv-panel">
          <header>
            <h2>Lopende projecten</h2>
            <span>
              Pagina {(page % pages) + 1}/{pages}
            </span>
          </header>
          <div className="tv-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Planning</th>
                  <th>Nummer</th>
                  <th>Klant / project</th>
                  <th>Opvolging</th>
                </tr>
              </thead>
              <tbody>
                {current
                  .slice((page % pages) * 8, (page % pages) * 8 + 8)
                  .map(row)}
              </tbody>
            </table>
          </div>
          {!current.length && (
            <p className="tv-empty">
              {connected
                ? "Geen lopende projecten in deze selectie."
                : "Projecten verborgen tot de verbinding hersteld is."}
            </p>
          )}
        </section>
        <section className="tv-panel">
          <header>
            <h2>Binnenkort</h2>
            <span>
              {(page % upPages) + 1}/{upPages}
            </span>
          </header>
          {groups.upcoming
            .slice((page % upPages) * 6, (page % upPages) * 6 + 6)
            .map((p) => (
              <article className="tv-upcoming" key={p.id}>
                <time>{fmt(planned(p))}</time>
                <div>
                  <strong>{p.customer || p.name}</strong>
                  <p>
                    {p.externalId} · {p.sourceDescription || p.name}
                  </p>
                </div>
              </article>
            ))}
          {!groups.upcoming.length && (
            <p className="tv-empty">Geen toekomstige planning.</p>
          )}
        </section>
      </div>
      <section className="tv-panel tv-planning">
        <header>
          <h2>Planning · komende 12 maanden</h2>
          <span>
            {selected.filter((p) => !planned(p)).length} zonder bronplanning
          </span>
        </header>
        <div className="tv-chart">
          {months.map((m) => (
            <div key={m.key}>
              <strong>{m.count}</strong>
              <i style={{ height: `${Math.max(3, (m.count / max) * 65)}px` }} />
              <span>{m.label}</span>
            </div>
          ))}
        </div>
      </section>
      <div className="tv-bottom-grid">
        <section className="tv-panel">
          <header>
            <h2>Voertuigen & keuringen</h2>
            <span>{vehicles.length} voertuigen</span>
          </header>
          {!fleetOk ? (
            <p className="tv-empty">
              Geen actuele voertuigenbron voor dit bedrijf. De Q-box moet
              tv-gegevens doorsturen.
            </p>
          ) : (
            <>
              <div className="tv-vehicles">
                {vehicles
                  .slice(
                    (page % vehiclePages) * 6,
                    (page % vehiclePages) * 6 + 6,
                  )
                  .map((v) => {
                    const state = inspection(v.next_inspection, day);
                    return (
                      <article
                        key={v.source_id}
                        className={`tv-vehicle ${state.color}`}
                      >
                        <strong>{v.plate}</strong>
                        <p>{v.name}</p>
                        <span>{fmt(v.next_inspection)}</span>
                        <b>{state.label}</b>
                      </article>
                    );
                  })}
              </div>
              <div
                className="tv-inspection-year"
                aria-label="Keuringen dit kalenderjaar"
              >
                {Array.from({ length: 12 }, (_, i) => {
                  const key =
                    day.slice(0, 4) + "-" + String(i + 1).padStart(2, "0");
                  return (
                    <span key={key}>
                      {i + 1}
                      <b>
                        {
                          vehicles.filter((v) =>
                            v.next_inspection.startsWith(key),
                          ).length
                        }
                      </b>
                    </span>
                  );
                })}
              </div>
            </>
          )}
        </section>
        <section className="tv-panel">
          <header>
            <h2>Afvalophalingen</h2>
          </header>
          {waste.length ? (
            waste.map((e, i) => (
              <article
                className={`tv-waste ${Date.parse(e.date) - Date.parse(day) <= DAY ? "soon" : ""}`}
                key={i}
              >
                <strong>{e.label}</strong>
                <span>
                  {fmt(e.date)} · {e.time}
                </span>
                <small>
                  {e.date === day
                    ? "Vandaag"
                    : Date.parse(e.date) - Date.parse(day) === DAY
                      ? "Morgen · klaarzetten"
                      : ""}
                </small>
              </article>
            ))
          ) : (
            <p className="tv-empty">
              Geen toekomstige ophalingen ingesteld voor dit bedrijf.
            </p>
          )}
        </section>
      </div>
      <section className="tv-panel tv-nas">
        <div>
          <h2>NAS-monitoring</h2>
          <p>
            {nasOk
              ? {
                  ok: "Belasting gezond",
                  warning: "Belasting verhoogd",
                  critical: "Hoge belasting",
                  unknown: "Meting controleren",
                }[nas!.status] || "Meting controleren"
              : "Geen actuele, bevestigde meting"}
          </p>
        </div>
        <div className="tv-nas-values">
          CPU {nasOk ? pct(nas?.latest.cpu) : "—"} · RAM{" "}
          {nasOk ? pct(nas?.latest.ram) : "—"} · Schijf{" "}
          {nasOk ? pct(nas?.latest.disk) : "—"} · I/O{" "}
          {nasOk ? pct(nas?.latest.io) : "—"}
          <small>24 uur · groen CPU · blauw RAM</small>
        </div>
        <svg
          viewBox="0 0 300 50"
          role="img"
          aria-label="NAS-belasting in de laatste 24 uur"
        >
          {(["cpu", "ram"] as const).map((key) => {
            let previous = 0;
            const d = (nas?.history || [])
              .filter((p) => Date.parse(p.checkedAt) >= now - DAY)
              .sort((a, b) => a.checkedAt.localeCompare(b.checkedAt))
              .map((p) => {
                const t = Date.parse(p.checkedAt),
                  v = p[key];
                if (v == null) return "";
                const op = previous && t - previous <= 660000 ? "L" : "M";
                previous = t;
                return `${op}${Math.max(0, Math.min(300, ((t - now + DAY) / DAY) * 300)).toFixed(1)},${(48 - v * 0.46).toFixed(1)}`;
              })
              .join(" ");
            return (
              <path
                key={key}
                d={d}
                fill="none"
                stroke={key === "cpu" ? "#40d799" : "#39baff"}
                strokeWidth="1.5"
              />
            );
          })}
        </svg>
      </section>
      <footer className="tv-footer">
        Automatisch verversen elke 15 seconden · Rotatie elke{" "}
        {settings.rotationSeconds} seconden · Alleen projecten binnen je
        bedrijfstoegang
        {hidden > 0 &&
          ` · ${hidden} Plenion-projecten buiten de selectie of zonder actuele bronbevestiging`}
      </footer>
      <dialog
        ref={dialog}
        className="tv-settings"
        onCancel={(e) => {
          if (saving) e.preventDefault();
        }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <h2>
            Tv-instellingen ·{" "}
            {companies.find((c) => c.code === companyCode)?.name}
          </h2>
          <p>Gedeeld voor alle schermen van dit bedrijf.</p>
          <fieldset disabled={saving}>
            <label>
              Projectselectie
              <select
                value={draft.selection}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    selection: e.target.value as TvSettings["selection"],
                  })
                }
              >
                <option value="execution">
                  In uitvoering (zoals het bestaande tv-scherm)
                </option>
                <option value="open">Alle open projecten</option>
              </select>
            </label>
            <label>
              Pagina wisselen na
              <select
                value={draft.rotationSeconds}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    rotationSeconds: Number(e.target.value),
                  })
                }
              >
                {[8, 12, 20, 30].map((n) => (
                  <option value={n} key={n}>
                    {n} seconden
                  </option>
                ))}
              </select>
            </label>
            <h3>Afvalkalender</h3>
            <p>Voeg bevestigde ophaalmomenten toe voor dit bedrijf.</p>
            {draft.waste.map((e, i) => (
              <div className="tv-event" key={i}>
                <input
                  aria-label="Ophaling"
                  placeholder="Bijv. Renewi · rolcontainer"
                  required
                  maxLength={100}
                  value={e.label}
                  onChange={(v) =>
                    setDraft({
                      ...draft,
                      waste: draft.waste.map((r, j) =>
                        j === i ? { ...r, label: v.target.value } : r,
                      ),
                    })
                  }
                />
                <input
                  aria-label="Ophaaldatum"
                  required
                  type="date"
                  value={e.date}
                  onChange={(v) =>
                    setDraft({
                      ...draft,
                      waste: draft.waste.map((r, j) =>
                        j === i ? { ...r, date: v.target.value } : r,
                      ),
                    })
                  }
                />
                <input
                  aria-label="Ophaaluur"
                  required
                  type="time"
                  value={e.time}
                  onChange={(v) =>
                    setDraft({
                      ...draft,
                      waste: draft.waste.map((r, j) =>
                        j === i ? { ...r, time: v.target.value } : r,
                      ),
                    })
                  }
                />
                <button
                  type="button"
                  aria-label="Ophaling verwijderen"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      waste: draft.waste.filter((_, j) => j !== i),
                    })
                  }
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              disabled={draft.waste.length >= 50}
              onClick={() =>
                setDraft({
                  ...draft,
                  waste: [
                    ...draft.waste,
                    { label: "", date: day, time: "07:00" },
                  ],
                })
              }
            >
              + Ophaling
            </button>
          </fieldset>
          {saveError && <p role="alert">{saveError}</p>}
          <footer>
            <button
              type="button"
              disabled={saving}
              onClick={() => dialog.current?.close()}
            >
              Annuleren
            </button>
            <button disabled={saving}>{saving ? "Opslaan…" : "Opslaan"}</button>
          </footer>
        </form>
      </dialog>
    </main>
  );
}
