"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { strategyCsv, strategyStatuses, strategySummary, type StrategyOverview, type StrategyRecord, type StrategyStatus } from "@cohvera/contracts";
import { useCompany } from "../../../PortalShell";
import "./roadmap.css";

const endpoint = "/api/companies/WARCO/strategy/warco";
const phases = [
  {id: "1", label: "Jaar 1", title: "Fundament & controle"},
  {id: "23", label: "Jaar 2–3", title: "Schalen & standaardiseren"},
  {id: "5", label: "Jaar 5", title: "Optimalisatie & winstmaximalisatie"},
];
const empty: StrategyOverview = {actions: [], owners: [], history: []};
const today = () => new Intl.DateTimeFormat("sv-SE", {timeZone: "Europe/Brussels", year: "numeric", month: "2-digit", day: "2-digit"}).format(new Date());
const late = (a: StrategyRecord) => a.status !== "DONE" && !!a.dueOn && a.dueOn < today();
const date = (value: string) => value ? new Intl.DateTimeFormat("nl-BE").format(new Date(value + "T12:00:00Z")) : "Nog te bepalen";
async function responseData(response: Response) {
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(typeof body?.message === "string" ? body.message : "Laden of opslaan mislukt. Probeer opnieuw.");
  return body;
}
export default function WarcoRoadmap() {
  const {can} = useCompany();
  const canRead = can("strategy.read", "WARCO"), canWrite = can("strategy.manage", "WARCO");
  const [data, setData] = useState<StrategyOverview>(empty), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [phase, setPhase] = useState(""), [status, setStatus] = useState(""), [owner, setOwner] = useState(""), [query, setQuery] = useState(""), [board, setBoard] = useState(false);
  const [draft, setDraft] = useState<StrategyRecord | null>(null), [original, setOriginal] = useState(""), [saving, setSaving] = useState(false), [saveError, setSaveError] = useState(""), [notice, setNotice] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const load = useCallback(async (signal?: AbortSignal) => {
    if (!canRead) { setData(empty); setLoading(false); return; }
    setLoading(true); setError("");
    try { const next = await responseData(await fetch(endpoint, {cache: "no-store", signal})); if (!signal?.aborted) setData(next); }
    catch(e) { if (!signal?.aborted) { setData(empty); setError((e as Error).message); } }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [canRead]);
  useEffect(() => {const controller = new AbortController(); void load(controller.signal); return () => controller.abort();}, [load]);
  useEffect(() => { if (draft && !dialog.current?.open) dialog.current?.showModal(); }, [draft]);
  useEffect(() => { if (!canRead) { dialog.current?.close(); setDraft(null); } }, [canRead]);
  const dirty = draft !== null && JSON.stringify(draft) !== original;
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {event.preventDefault(); event.returnValue = "";};
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function open(row: StrategyRecord) {setDraft({...row}); setOriginal(JSON.stringify(row)); setSaveError("");}
  function close() {
    if (saving || (dirty && !window.confirm("Niet-opgeslagen wijzigingen verwerpen?"))) return;
    dialog.current?.close(); setDraft(null); setSaveError("");
  }
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (!draft || !canWrite || saving) return;
    setSaving(true); setSaveError("");
    try {
      const {status, ownerId, dueOn, nextStep, notes, version} = draft;
      await responseData(await fetch(`${endpoint}/actions/${draft.id}`, {method: "PATCH", headers: {"Content-Type": "application/json"}, body: JSON.stringify({status, ownerId, dueOn, nextStep, notes, version})}));
      dialog.current?.close(); setDraft(null); setNotice("Actie opgeslagen."); await load();
    } catch(e) {setSaveError((e as Error).message);}
    finally {setSaving(false);}
  }
  function download() {
    const url = URL.createObjectURL(new Blob([strategyCsv(data.actions)], {type: "text/csv;charset=utf-8"}));
    const link = document.createElement("a"); link.href = url; link.download = "warco-roadmap.csv"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function reset() {setPhase("");setStatus("");setOwner("");setQuery("");}
  const summary = strategySummary(data.actions, today());
  const visible = data.actions.filter(a => (!phase || a.phase === phase) && (!status || a.status === status) && (!owner || (owner === "none" ? !a.ownerId : a.ownerId === owner)) && (!query.trim() || [a.id,a.title,a.description,a.ownerName,a.nextStep,a.notes].join(" ").toLowerCase().includes(query.trim().toLowerCase())));
  const badge = (a: StrategyRecord) => <span className={`roadmap-status status-${a.status}`}>{strategyStatuses[a.status]}</span>;
  return <main className="hub-page warco-roadmap"><div className="hub-page-inner">
    <div className="hub-breadcrumb"><Link href="/">Cohvera Digital Hub</Link><span>/</span><Link href="/hubs/strategy">Strategy Hub</Link><span>/</span><span>Warco Roadmap</span></div>
    <header className="hub-hero"><div><span className="badge">STRATEGY · WARCO</span><h1>Van ambitie naar uitvoering.</h1><p className="hub-tagline">Warco Roadmap · vijf jaar, drie fasen.</p></div><Link className="secondary-button" href="/hubs/strategy">Terug naar Strategy Hub</Link></header>
    {!canRead ? <p role="status">Je hebt geen leesrechten voor de Warco Roadmap. Vraag je beheerder om toegang voor Warco.</p> : <>
      <div className="roadmap-toolbar"><p>Jaar 5 omvat de bronfase jaar 4–5. Startdatum van de roadmap nog te bevestigen.</p><div><button className="secondary-button" disabled={loading} onClick={() => void load()}>Vernieuwen</button><button className="secondary-button" disabled={loading || !data.actions.length} onClick={download}>Exporteer alle acties</button></div></div>
      {loading && <p role="status">Roadmap laden…</p>}{error && <p className="roadmap-error" role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
      {!loading && !error && <>
        <section className="roadmap-stats" aria-label="Voortgang volledige roadmap"><article><small>Totale voortgang</small><strong>{summary.percent}%</strong><span>{summary.done} van {summary.total} acties afgerond</span></article><article><small>In uitvoering</small><strong>{summary.active}</strong><span>Acties met status Bezig</span></article><article><small>Aandacht nodig</small><strong>{summary.attention}</strong><span>Geblokkeerd of over deadline</span></article><article><small>Geen eigenaar</small><strong>{summary.unassigned}</strong><span>Open acties nog toe te wijzen</span></article></section>
        <section className="roadmap-phases" aria-label="Filter per fase">{phases.map(p => {const s = strategySummary(data.actions.filter(a => a.phase === p.id), today()); return <button key={p.id} aria-pressed={phase === p.id} onClick={() => setPhase(phase === p.id ? "" : p.id)}><span>{p.label}</span><h2>{p.title}</h2><progress value={s.done} max={s.total || 1} aria-label={`${p.label}: ${s.done} van ${s.total} afgerond`}/><small>{s.done} van {s.total} acties afgerond</small></button>;})}</section>
        <section aria-label="Actieregister"><div className="roadmap-toolbar"><h2>Actieregister <small>({visible.length})</small></h2><div><button className="secondary-button" aria-pressed={!board} onClick={() => setBoard(false)}>Lijst</button><button className="secondary-button" aria-pressed={board} onClick={() => setBoard(true)}>Bord</button></div></div>
          <div className="roadmap-filters"><input aria-label="Zoek acties" placeholder="Zoek actie of eigenaar…" value={query} onChange={e => setQuery(e.target.value)}/><select aria-label="Fase" value={phase} onChange={e => setPhase(e.target.value)}><option value="">Alle fasen</option>{phases.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select><select aria-label="Statusfilter" value={status} onChange={e => setStatus(e.target.value)}><option value="">Alle statussen</option>{Object.entries(strategyStatuses).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select><select aria-label="Eigenaarfilter" value={owner} onChange={e => setOwner(e.target.value)}><option value="">Alle eigenaars</option><option value="none">Niet toegewezen</option>{data.owners.map(o => <option key={o.id} value={o.id}>{o.displayName}</option>)}</select><button className="secondary-button" onClick={reset}>Wis filters</button></div>
          {!visible.length ? <p>Geen acties gevonden. Pas de filters aan.</p> : board ? <div className="roadmap-board">{Object.entries(strategyStatuses).map(([key,label]) => <section key={key}><h3>{label} ({visible.filter(a => a.status === key).length})</h3>{visible.filter(a => a.status === key).map(a => <button key={a.id} className="roadmap-card" onClick={() => open(a)}><small>{a.id}</small><strong>{a.title}</strong><span>{a.ownerName || "Nog geen eigenaar"}</span><span className={late(a) ? "roadmap-late" : ""}>{date(a.dueOn)}</span></button>)}</section>)}</div> : <div className="roadmap-table-wrap"><table className="roadmap-table"><thead><tr><th>Actie</th><th>Fase</th><th>Status</th><th>Eigenaar</th><th>Deadline</th></tr></thead><tbody>{visible.map(a => <tr key={a.id}><td><button onClick={() => open(a)}>{a.title}</button><small>{a.id}</small></td><td>{phases.find(p => p.id === a.phase)?.label}</td><td>{badge(a)}</td><td>{a.ownerName || "Nog toe te wijzen"}</td><td className={late(a) ? "roadmap-late" : ""}>{date(a.dueOn)}{late(a) && <small>Over deadline</small>}</td></tr>)}</tbody></table></div>}
        </section>
        <section className="roadmap-bottom"><article><h2>Doelen uit het plan</h2><ul><li>Jaar 1: maximaal 15 minuten laden in het magazijn.</li><li>Jaar 1: 20 onderhoudsbeurten per maand.</li><li>Jaar 2–3: 80% van projecten met templates.</li><li>Jaar 5: 15–20% terugkerende omzet.</li></ul><p>Dit zijn doelstellingen, geen gemeten resultaten.</p></article><article><h2>Laatste wijzigingen</h2>{!data.history.length ? <p>Nog geen voortgang geregistreerd.</p> : <ul>{data.history.slice(0,8).map(h => <li key={h.id}><button onClick={() => {const a=data.actions.find(a => a.id === h.actionId);if(a)open(a);}}>{h.actionId}</button> · {h.actor} · {new Date(h.createdAt).toLocaleString("nl-BE", {timeZone:"Europe/Brussels"})}</li>)}</ul>}</article></section>
        <p className="muted">Bron: Operationeel Plan – Roadmap 5Y, p. 4–11. Financiële bedragen zijn indicaties waarvan aard en periode te valideren zijn. Er wordt geen totaalbudget verondersteld. Geen automatische synchronisatie met OneNote.</p>
      </>}
    </>}
    <dialog ref={dialog} className="roadmap-dialog" aria-labelledby="roadmap-dialog-title" onCancel={e => {e.preventDefault();close();}}>{draft && canRead && <form onSubmit={save}><div className="roadmap-toolbar"><span>{draft.id} · {phases.find(p => p.id === draft.phase)?.label}</span><button type="button" aria-label="Sluiten" onClick={close} disabled={saving}>✕</button></div><h2 id="roadmap-dialog-title">{draft.title}</h2><p>{draft.description}</p><div className="roadmap-result"><strong>Resultaat / meetpunt</strong><p>{draft.result}</p></div>{draft.amount && draft.amount !== "Geen bedrag genoemd." && <p><strong>Indicatie uit bron:</strong> {draft.amount} Aard en periode te valideren.</p>}
      <fieldset disabled={!canWrite || saving}><legend>Opvolging</legend><div className="roadmap-edit-grid"><label>Status<select value={draft.status} onChange={e => setDraft({...draft,status:e.target.value as StrategyStatus})}>{Object.entries(strategyStatuses).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></label><label>Verantwoordelijke<select value={draft.ownerId ?? ""} onChange={e => setDraft({...draft,ownerId:e.target.value || null})}><option value="">Nog toe te wijzen</option>{draft.ownerId && !data.owners.some(o => o.id === draft.ownerId) && <option value={draft.ownerId}>Niet meer beschikbaar: {draft.ownerName}</option>}{data.owners.map(o => <option key={o.id} value={o.id}>{o.displayName}</option>)}</select></label><label>Deadline<input type="date" value={draft.dueOn} onChange={e => setDraft({...draft,dueOn:e.target.value})}/></label></div><label>Volgende stap / blokkade<textarea maxLength={2000} rows={3} value={draft.nextStep} onChange={e => setDraft({...draft,nextStep:e.target.value})}/></label><label>Notities en besluiten<textarea maxLength={10000} rows={5} value={draft.notes} onChange={e => setDraft({...draft,notes:e.target.value})}/></label></fieldset>
      {!canWrite && <p>Je hebt alleen leesrechten.</p>}{saveError && <div className="roadmap-error" role="alert"><p>{saveError}</p><p>Je invoer blijft behouden. Kopieer die indien nodig vóór je dit venster sluit en vernieuwt.</p></div>}<div className="roadmap-toolbar"><small>{draft.updatedAt ? `Laatst gewijzigd: ${new Date(draft.updatedAt).toLocaleString("nl-BE")}` : "Nog geen voortgang geregistreerd"}</small>{canWrite && <button type="submit" className="primary-button" disabled={saving}>{saving ? "Opslaan…" : "Wijzigingen opslaan"}</button>}</div>
    </form>}</dialog>
  </div></main>;
}
