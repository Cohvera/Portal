"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  attentionReasons,
  inspectionStatuses,
  type InspectionRecord,
} from "@cohvera/contracts";
import { useCompany } from "../../PortalShell";
import Editor from "./Editor";
import { dateLabel, inspectionRequest, today } from "./api";
import "./inspections.css";

const views = ["Dossiers", "Planning", "Periodiek", "Opvolging", "Archief"];
export default function InspectionsPage() {
  const { companyCode, companies } = useCompany();
  return (
    <Workspace
      key={companyCode}
      code={companyCode}
      name={companies.find((c) => c.code === companyCode)?.name || companyCode}
    />
  );
}
function Workspace({ code, name }: { code: string; name: string }) {
  const {can}=useCompany();
  const writable=can("inspections.write");
  const url = `/api/companies/${encodeURIComponent(code)}/inspections`;
  const [rows, setRows] = useState<InspectionRecord[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [view, setView] = useState("Dossiers"),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState(""),
    [attention, setAttention] = useState(false);
  const [selected, setSelected] = useState<InspectionRecord | null | undefined>(
    undefined,
  );
  const refresh = useCallback(async () => {
    setError("");
    try {
      setRows(await inspectionRequest<InspectionRecord[]>(url));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [url]);
  useEffect(() => {
    let active = true;
    inspectionRequest<InspectionRecord[]>(url)
      .then((data) => {
        if (active) setRows(data);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [url]);
  const current = today(),
    active = rows.filter(
      (r) => !["ARCHIVED", "OUT_OF_SERVICE"].includes(r.data.status),
    );
  const filtered = rows
    .filter((r) => {
      const d = r.data,
        archived = ["ARCHIVED", "OUT_OF_SERVICE"].includes(d.status);
      return (
        (view === "Archief" ? archived : !archived) &&
        (!status || d.status === status) &&
        (!attention || attentionReasons(d, current).length > 0) &&
        (!query ||
          `${d.title} ${d.customer} ${d.address} ${d.owner} ${d.reportNumber}`
            .toLocaleLowerCase("nl")
            .includes(query.toLocaleLowerCase("nl"))) &&
        (view !== "Planning" || !!d.plannedDate) &&
        (view !== "Periodiek" || d.intervalMonths > 0) &&
        (view !== "Opvolging" ||
          d.followUps.some((f) => !f.done) ||
          attentionReasons(d, current).length > 0)
      );
    })
    .sort((a, b) =>
      view === "Planning"
        ? `${a.data.plannedDate}${a.data.round}${a.data.plannedTime}`.localeCompare(
            `${b.data.plannedDate}${b.data.round}${b.data.plannedTime}`,
          )
        : view === "Periodiek"
          ? (a.data.nextDate || "9999").localeCompare(b.data.nextDate || "9999")
          : 0,
    );
  function exportCsv() {
    const esc = (value: string) =>
      `"${(/^[=+@\-\t\r\n]/.test(value) ? "'" : "") + value.replace(/"/g, '""')}"`;
    const lines = [
      [
        "Dossier",
        "Klant",
        "Adres",
        "Type",
        "Status",
        "Verantwoordelijke",
        "Keuring",
        "Volgende datum",
        "Open acties",
      ],
      ...filtered.map((r) => [
        r.data.title,
        r.data.customer,
        r.data.address,
        r.data.type,
        inspectionStatuses[r.data.status],
        r.data.owner,
        r.data.plannedDate,
        r.data.nextDate,
        String(r.data.followUps.filter((f) => !f.done).length),
      ]),
    ];
    const objectUrl = URL.createObjectURL(
      new Blob(
        ["\ufeff" + lines.map((line) => line.map(esc).join(";")).join("\r\n")],
        { type: "text/csv;charset=utf-8" },
      ),
    );
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = `keuringen-${code}-${current}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }
  async function saved(row: InspectionRecord) {
    setRows((old) => [row, ...old.filter((r) => r.id !== row.id)]);
    setSelected(row);
    setNotice("Dossier opgeslagen.");
    await refresh();
  }
  const card = (r: InspectionRecord) => (
    <button
      className="inspection-card"
      key={r.id}
      onClick={() => {
        setSelected(r);
        setNotice("");
      }}
    >
      <div className="section-heading">
        <span className="eyebrow">{r.data.type}</span>
        <span className={`inspection-status s-${r.data.status}`}>
          {inspectionStatuses[r.data.status]}
        </span>
      </div>
      <h3>{r.data.title}</h3>
      <p>{r.data.customer}</p>
      <p className="muted">{r.data.address}</p>
      <div className="inspection-card-meta">
        <span>
          Verantwoordelijke
          <strong>{r.data.owner || "Nog toe te wijzen"}</strong>
        </span>
        <span>
          {view === "Periodiek" ? "Volgende keuring" : "Gepland"}
          <strong>
            {dateLabel(
              view === "Periodiek" ? r.data.nextDate : r.data.plannedDate,
            )}{" "}
            {view === "Planning" ? r.data.plannedTime : ""}
          </strong>
        </span>
      </div>
      <div className="inspection-card-footer">
        <span>
          {r.documents.length} documenten ·{" "}
          {r.data.followUps.filter((f) => !f.done).length} open acties
        </span>
        <span>Open dossier →</span>
      </div>
      {attentionReasons(r.data, current).map((reason) => (
        <span className="inspection-warning" key={reason}>
          {reason}
        </span>
      ))}
    </button>
  );
  return (
    <main className="main inspections-workspace">
      <div className="inspection-topline no-print">
        <Link href="/tools">← Tools & Solutions</Link>
        {code === "TOMME" && (
          <a
            href="https://www.tomme-energie.lan/keuringen/"
            target="_blank"
            rel="noreferrer"
          >
            Tomme Keuringen · bestaand portaal ↗
          </a>
        )}
      </div>
      <header className="page-heading section-heading no-print">
        <div>
          <p className="eyebrow">Quality & compliance · {name}</p>
          <h1>Keuringen</h1>
          <p className="muted">
            Van voorbereid dossier tot aantoonbaar opgevolgde keuring.
          </p>
        </div>
        {selected === undefined && (
          <button
            className="button-primary"
            disabled={loading || !!error || !writable}
            onClick={() => {
              setSelected(null);
              setNotice("");
            }}
          >
            + Nieuw dossier
          </button>
        )}
      </header>
      {notice && (
        <div className="success-box no-print" role="status">
          {notice}
        </div>
      )}
      {error && (
        <div className="alert no-print" role="alert">
          {error}{" "}
          <button className="secondary-button" onClick={() => void refresh()}>
            Opnieuw laden
          </button>
        </div>
      )}
      {selected !== undefined ? (
        <Editor
          writable={writable}
          key={selected?.id || "new"}
          record={selected}
          url={url}
          nextId={
            selected
              ? rows.find((r) => r.previousId === selected.id)?.id || null
              : null
          }
          onOpen={(id) => {
            const r = rows.find((r) => r.id === id);
            if (r) setSelected(r);
          }}
          onSaved={(r) => void saved(r)}
          onClose={() => setSelected(undefined)}
        />
      ) : (
        <>
          <section className="tool-kpis">
            <article className="card">
              <span>Actieve dossiers</span>
              <strong>{loading ? "—" : active.length}</strong>
              <small>Alle lopende keuringen</small>
            </article>
            <article className="card">
              <span>Ingepland</span>
              <strong>
                {loading
                  ? "—"
                  : active.filter((r) => r.data.status === "PLANNED").length}
              </strong>
              <small>Datum en keurder vastgelegd</small>
            </article>
            <article className="card">
              <span>Aandacht nodig</span>
              <strong>
                {loading
                  ? "—"
                  : active.filter(
                      (r) => attentionReasons(r.data, current).length,
                    ).length}
              </strong>
              <small>Herkeuringen en vervallen acties</small>
            </article>
            <article className="card">
              <span>Open opvolgacties</span>
              <strong>
                {loading
                  ? "—"
                  : active.reduce(
                      (n, r) =>
                        n + r.data.followUps.filter((f) => !f.done).length,
                      0,
                    )}
              </strong>
              <small>Werk dat nog moet gebeuren</small>
            </article>
          </section>
          <nav className="inspection-tabs" aria-label="Keuringenoverzichten">
            {views.map((v) => (
              <button
                key={v}
                aria-current={view === v ? "page" : undefined}
                onClick={() => {
                  setView(v);
                  setStatus("");
                  setAttention(false);
                }}
              >
                {v}
              </button>
            ))}
          </nav>
          <div className="inspection-filters">
            <input
              aria-label="Dossiers zoeken"
              placeholder="Zoek klant, adres, dossier of verantwoordelijke…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select
              aria-label="Filter op status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">Alle statussen</option>
              {Object.entries(inspectionStatuses).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <label>
              <input
                type="checkbox"
                checked={attention}
                onChange={(e) => setAttention(e.target.checked)}
              />
              Aandacht nodig
            </label>
            <button
              className="secondary-button"
              disabled={!filtered.length}
              onClick={exportCsv}
            >
              Exporteer CSV
            </button>
          </div>
          {loading ? (
            <div className="inspection-empty" role="status">
              Keuringsdossiers laden…
            </div>
          ) : !error && !filtered.length ? (
            <div className="inspection-empty">
              <h2>
                {rows.length
                  ? "Geen dossiers in deze selectie"
                  : "Je eerste keuringsdossier"}
              </h2>
              <p>
                {rows.length
                  ? "Pas de filters aan of kies een ander overzicht."
                  : "Maak een dossier aan en volg voorbereiding, documenten en resultaten op één plek op. De bestaande Tomme-dossiers blijven in het externe portaal."}
              </p>
              {!rows.length && (
                <button
                  className="button-primary"
                  disabled={!writable} onClick={() => setSelected(null)}
                >
                  + Nieuw dossier
                </button>
              )}
            </div>
          ) : view === "Planning" ? (
            <div>
              {Array.from(
                new Set(
                  filtered.map((r) => `${r.data.plannedDate}|${r.data.round}`),
                ),
              ).map((group) => {
                const [date, round] = group.split("|");
                return (
                  <section className="inspection-round" key={group}>
                    <div className="section-heading">
                      <h2>
                        {dateLabel(date)} · {round || "Losse afspraken"}
                      </h2>
                      <span className="muted">
                        {
                          filtered.filter(
                            (r) =>
                              `${r.data.plannedDate}|${r.data.round}` === group,
                          ).length
                        }{" "}
                        dossiers
                      </span>
                    </div>
                    <div className="inspection-grid">
                      {filtered
                        .filter(
                          (r) =>
                            `${r.data.plannedDate}|${r.data.round}` === group,
                        )
                        .map(card)}
                    </div>
                  </section>
                );
              })}
            </div>
          ) : view === "Opvolging" ? (
            <div className="inspection-grid">
              {filtered.map((r) => (
                <article className="card" key={r.id}>
                  <button
                    className="inspection-text-button"
                    onClick={() => setSelected(r)}
                  >
                    <h3>{r.data.title} →</h3>
                  </button>
                  <p className="muted">
                    {r.data.customer} · {r.data.owner || "Niet toegewezen"}
                  </p>
                  {attentionReasons(r.data, current).map((reason) => (
                    <p className="inspection-warning" key={reason}>
                      {reason}
                    </p>
                  ))}
                  {r.data.followUps
                    .filter((f) => !f.done)
                    .map((f) => (
                      <div className="inspection-action" key={f.id}>
                        <strong>{f.title}</strong>
                        <span>
                          {f.owner || "Niet toegewezen"} ·{" "}
                          {dateLabel(f.dueDate)}
                        </span>
                      </div>
                    ))}
                </article>
              ))}
            </div>
          ) : (
            <div className="inspection-grid">{filtered.map(card)}</div>
          )}
        </>
      )}
    </main>
  );
}
