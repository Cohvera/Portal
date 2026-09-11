"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type CompanyLink = { enabled: boolean; company: { code: string; name: string } };
type PluginRow = {
  id: string;
  name: string;
  description?: string | null;
  version: string;
  apiVersion: string;
  runtime: "BUILTIN" | "EXTERNAL";
  state: string;
  entrypointUrl?: string | null;
  manifestUrl?: string | null;
  sourceUrl?: string | null;
  companies: CompanyLink[];
};
type Company = { code: string; name: string };

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((payload as { message?: string }).message ?? `${response.status} ${response.statusText}`);
  return payload as T;
}

export default function PluginAdminPage() {
  const [plugins, setPlugins] = useState<PluginRow[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [token, setToken] = useState("");
  const [manifestUrl, setManifestUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const [pluginRows, companyRows] = await Promise.all([
      request<PluginRow[]>("/api/admin/plugins"),
      request<Company[]>("/api/companies")
    ]);
    setPlugins(pluginRows);
    setCompanies(companyRows);
  }

  useEffect(() => {
    const saved = window.sessionStorage.getItem("cohvera.pluginAdminToken");
    if (saved) setToken(saved);
    void refresh().catch((e: Error) => setError(e.message));
  }, []);

  const enabledCount = useMemo(() => plugins.reduce((sum, plugin) => sum + plugin.companies.filter((link) => link.enabled).length, 0), [plugins]);

  async function mutate(url: string, method = "POST", body?: unknown) {
    setBusy(true);
    setError(null);
    setMessage(null);
    window.sessionStorage.setItem("cohvera.pluginAdminToken", token);
    try {
      await request(url, {
        method,
        headers: { "Content-Type": "application/json", "x-plugin-admin-token": token },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      await refresh();
      setMessage("Wijziging uitgevoerd.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Onbekende fout");
    } finally {
      setBusy(false);
    }
  }

  async function install() {
    if (!manifestUrl.trim()) return;
    await mutate("/api/admin/plugins/install", "POST", { manifestUrl: manifestUrl.trim() });
    setManifestUrl("");
  }

  return (
    <main className="admin-page">
      <div className="admin-inner">
        <div className="admin-topbar">
          <div>
            <p className="eyebrow">Cohvera Admin</p>
            <h1>Plugin Manager</h1>
            <p className="muted">Installeer, activeer en beheer Cohvera plugins per business unit.</p>
          </div>
          <Link className="secondary-button" href="/">← Terug naar portal</Link>
        </div>

        <section className="admin-stats">
          <article className="card"><h3>Geïnstalleerd</h3><strong>{plugins.length}</strong><p className="muted">Built-in + externe plugins</p></article>
          <article className="card"><h3>Externe plugins</h3><strong>{plugins.filter((p) => p.runtime === "EXTERNAL").length}</strong><p className="muted">Via manifest geïnstalleerd</p></article>
          <article className="card"><h3>Activaties</h3><strong>{enabledCount}</strong><p className="muted">Over alle bedrijven</p></article>
        </section>

        <section className="admin-panel">
          <div className="section-heading">
            <div><p className="eyebrow">Installeren</p><h2>Plugin toevoegen</h2></div>
            <p className="muted section-copy">Zoals LoxBerry: geef de HTTPS-URL van een Cohvera plugin manifest. De portal downloadt, valideert en registreert de plugin.</p>
          </div>
          <div className="install-form">
            <label>Admin token<input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="PLUGIN_ADMIN_TOKEN" /></label>
            <label>Manifest URL<input type="url" value={manifestUrl} onChange={(e) => setManifestUrl(e.target.value)} placeholder="https://example.org/cohvera-plugin.json" /></label>
            <button disabled={busy || !token || !manifestUrl} onClick={() => void install()}>{busy ? "Bezig…" : "Download & installeer"}</button>
          </div>
          {message && <div className="success-box">{message}</div>}
          {error && <div className="alert">{error}</div>}
        </section>

        <section>
          <div className="section-heading"><div><p className="eyebrow">Registry</p><h2>Geïnstalleerde plugins</h2></div></div>
          <div className="plugin-admin-list">
            {plugins.map((plugin) => (
              <article className="plugin-admin-card" key={plugin.id}>
                <div className="plugin-admin-head">
                  <div><div className="plugin-meta"><span className="badge">{plugin.runtime}</span><span>{plugin.state}</span><span>v{plugin.version}</span></div><h3>{plugin.name}</h3><p className="muted">{plugin.description ?? plugin.id}</p></div>
                  {plugin.runtime === "EXTERNAL" && <button className="danger-button" disabled={busy} onClick={() => void mutate(`/api/admin/plugins/${plugin.id}`, "DELETE")}>Verwijderen</button>}
                </div>
                <div className="company-toggle-grid">
                  {companies.map((company) => {
                    const enabled = plugin.companies.some((link) => link.company.code === company.code && link.enabled);
                    return <button key={company.code} className={enabled ? "company-toggle enabled" : "company-toggle"} disabled={busy} onClick={() => void mutate(`/api/admin/plugins/${plugin.id}/companies/${company.code}/${enabled ? "disable" : "enable"}`)}><strong>{company.name}</strong><span>{enabled ? "Actief" : "Uitgeschakeld"}</span></button>;
                  })}
                </div>
                {plugin.entrypointUrl && <div className="plugin-links"><a href={plugin.entrypointUrl} target="_blank" rel="noreferrer">Open plugin ↗</a>{plugin.manifestUrl && <a href={plugin.manifestUrl} target="_blank" rel="noreferrer">Manifest ↗</a>}{plugin.sourceUrl && <a href={plugin.sourceUrl} target="_blank" rel="noreferrer">Broncode ↗</a>}</div>}
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
