"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { PluginManifest } from "@cohvera/contracts";
import { coefHubs } from "../lib/coef";

type Company = { id: string; code: string; name: string };
type Session = { displayName: string; companyCode: string; companyName?: string; role?: string; permissions: string[] };
type Notification = { id: string; title: string; body: string; createdAt: string };
type Audit = { id: string; action: string; createdAt: string };

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json() as Promise<T>;
}

export default function PortalDashboard() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyCode, setCompanyCode] = useState("COH");
  const [session, setSession] = useState<Session | null>(null);
  const [plugins, setPlugins] = useState<PluginManifest[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem("cohvera.companyCode");
    if (saved) setCompanyCode(saved);
    json<Company[]>("/api/companies").then(setCompanies).catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    Promise.all([
      json<Session>(`/api/session?companyCode=${encodeURIComponent(companyCode)}`),
      json<PluginManifest[]>(`/api/companies/${encodeURIComponent(companyCode)}/plugins`),
      json<Notification[]>(`/api/companies/${encodeURIComponent(companyCode)}/notifications`),
      json<Audit[]>(`/api/companies/${encodeURIComponent(companyCode)}/audit`)
    ]).then(([nextSession, nextPlugins, nextNotifications, nextAudit]) => {
      if (!active) return;
      setSession(nextSession);
      setPlugins(nextPlugins);
      setNotifications(nextNotifications);
      setAudit(nextAudit);
    }).catch((e: Error) => active && setError(e.message)).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [companyCode]);

  const selectedCompany = useMemo(() => companies.find((company) => company.code === companyCode), [companies, companyCode]);

  async function switchCompany(nextCode: string) {
    setCompanyCode(nextCode);
    window.localStorage.setItem("cohvera.companyCode", nextCode);
    try { await json(`/api/companies/${encodeURIComponent(nextCode)}/select`, { method: "POST" }); } catch { /* audit must not block switching */ }
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">COHVERA<br/><small>DIGITAL HUB</small></div>
        <label className="muted" htmlFor="company">Actief bedrijf</label>
        <select id="company" className="company-select" value={companyCode} onChange={(event) => void switchCompany(event.target.value)}>
          {companies.length === 0 && <option value="COH">Cohvera</option>}
          {companies.map((company) => <option key={company.id} value={company.code}>{company.name}</option>)}
        </select>
        <nav className="nav">
          <a href="#overview">Overzicht</a>
          {coefHubs.map((hub) => <Link key={hub.slug} href={`/hubs/${hub.slug}`}>{hub.name}</Link>)}
          <a href="#tools">Tools & Solutions</a>
          <a href="#notifications">Notificaties</a>
          <a href="#audit">Audit</a>
          <Link href="/admin/plugins">Admin · Plugin Manager</Link>
        </nav>
      </aside>
      <main className="main">
        <header className="topbar">
          <div><p className="muted">COEF Operational Framework · {selectedCompany?.name ?? session?.companyName ?? "Cohvera"}</p><h1>Welkom terug, {session?.displayName ?? "Remko"}</h1></div>
          <div className="user-pill"><strong>{session?.displayName ?? "Remko"}</strong><small>CEO · {session?.role ?? "Portal Admin"}</small></div>
        </header>

        {error && <div className="alert">API-fout: {error}</div>}

        <div className="cards" id="overview">
          <article className="card"><span className="badge">Sprint 4</span><h3>Plugin Platform</h3><strong>{loading ? "Laden..." : "Actief"}</strong><p className="muted">COEF-hubs, tools en centraal plugin management.</p></article>
          <article className="card"><h3>Actieve plugins</h3><strong>{plugins.length}</strong><p className="muted">Per bedrijf vanuit de database</p></article>
          <article className="card"><h3>Bedrijven</h3><strong>{companies.length || 4}</strong><p className="muted">Gescheiden context en rechten</p></article>
          <article className="card"><h3>Platformstatus</h3><strong>Healthy</strong><p className="muted">Web, API, PostgreSQL, Redis en HTTPS</p></article>
        </div>

        <section>
          <div className="section-heading"><div><p className="eyebrow">COEF Operational Framework</p><h2>Management Hubs</h2></div><p className="muted section-copy">Van strategie naar operatie, performance en continue verbetering in één omgeving.</p></div>
          <div className="hub-cards">
            {coefHubs.map((hub, index) => (
              <Link className="hub-card" href={`/hubs/${hub.slug}`} key={hub.slug}>
                <span className="hub-number">0{index + 1}</span>
                <h3>{hub.name}</h3>
                <p>{hub.tagline}</p>
                <span className="text-link">Open hub →</span>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <div className="section-heading"><div><p className="eyebrow">Digital Hub</p><h2 id="tools">Tools & Solutions</h2></div><p className="muted section-copy">Modulaire tools die per business unit kunnen worden geactiveerd.</p></div>
          <div className="cards">
            {plugins.map((plugin) => (
              <Link className="tool-card-link" href={plugin.route} key={plugin.id}>
                <article className="card tool-card">
                  <span className="badge">{plugin.status}</span>
                  <h3>{plugin.name}</h3>
                  <p className="muted">{plugin.description}</p>
                  <span className="text-link">Open tool →</span>
                </article>
              </Link>
            ))}
          </div>
        </section>

        <section className="split">
          <article className="card" id="notifications"><h2>Notificaties</h2>{notifications.length === 0 ? <p className="muted">Geen nieuwe meldingen voor dit bedrijf.</p> : notifications.map((item) => <div className="list-row" key={item.id}><strong>{item.title}</strong><span>{item.body}</span></div>)}</article>
          <article className="card" id="audit"><h2>Recente activiteit</h2>{audit.length === 0 ? <p className="muted">Nog geen audit-events voor dit bedrijf.</p> : audit.slice(0, 8).map((item) => <div className="list-row" key={item.id}><strong>{item.action}</strong><span>{new Date(item.createdAt).toLocaleString("nl-BE")}</span></div>)}</article>
        </section>
      </main>
    </div>
  );
}
