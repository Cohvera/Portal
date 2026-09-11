"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ToolModule } from "../../../lib/tools";

type Snapshot = {
  open: number;
  planned: number;
  completed: number;
  attention: number;
  activity: { title: string; detail: string }[];
};

export default function ToolPageClient({ tool }: { tool: ToolModule }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/tools/${tool.slug}/summary`)
      .then((response) => {
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        return response.json() as Promise<Snapshot>;
      })
      .then(setSnapshot)
      .catch((e: Error) => setError(e.message));
  }, [tool.slug]);

  return (
    <main className="tool-page">
      <div className="tool-topline"><Link href="/">← Digital Hub</Link><span className="badge">{tool.status}</span></div>
      <header className="tool-header">
        <div><p className="eyebrow">{tool.category}</p><h1>{tool.name}</h1><p className="tool-description">{tool.description}</p></div>
        <button className="primary-action">{tool.actions[0]}</button>
      </header>

      {error && <div className="alert">API-fout: {error}</div>}

      <section className="tool-kpis">
        <article className="card"><span>Open</span><strong>{snapshot?.open ?? "—"}</strong><small>Actieve dossiers</small></article>
        <article className="card"><span>Gepland</span><strong>{snapshot?.planned ?? "—"}</strong><small>Komende uitvoering</small></article>
        <article className="card"><span>Afgerond</span><strong>{snapshot?.completed ?? "—"}</strong><small>Deze maand</small></article>
        <article className="card"><span>Aandacht</span><strong>{snapshot?.attention ?? "—"}</strong><small>Opvolging vereist</small></article>
      </section>

      <section className="tool-layout">
        <article className="card">
          <div className="section-heading"><div><p className="eyebrow">Workflow</p><h2>Proces</h2></div></div>
          <ol className="workflow-list">{tool.workflow.map((step, index) => <li key={step}><span>{index + 1}</span><div><strong>{step}</strong><small>{index === 0 ? "Startpunt" : index === tool.workflow.length - 1 ? "Resultaat" : "Volgende stap"}</small></div></li>)}</ol>
        </article>
        <article className="card">
          <div className="section-heading"><div><p className="eyebrow">Vandaag</p><h2>Recente activiteit</h2></div></div>
          <div className="activity-list">{(snapshot?.activity ?? []).map((item) => <div className="list-row" key={item.title}><strong>{item.title}</strong><span>{item.detail}</span></div>)}</div>
        </article>
      </section>

      <section className="card">
        <div className="section-heading"><div><p className="eyebrow">Acties</p><h2>Snel starten</h2></div></div>
        <div className="action-grid">{tool.actions.map((action, index) => <button key={action} className={index === 0 ? "action-tile action-tile-primary" : "action-tile"}><strong>{action}</strong><span>{index === 0 ? "Nieuwe flow starten" : "Open bestaande workflow"}</span></button>)}</div>
      </section>
    </main>
  );
}
