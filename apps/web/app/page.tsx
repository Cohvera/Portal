import { developmentIdentity } from "@cohvera/auth";
import { pluginCatalog } from "@cohvera/plugin-sdk";

const companies = ["Cohvera", "Q-Home", "Tomme Energie", "Warco"];
const hubs = ["Strategy Hub", "Process Hub", "Digital Hub", "Operations Hub", "Performance Hub", "Improvement Hub", "Innovation Hub"];

export default function HomePage() {
  const identity = developmentIdentity();
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">COHVERA<br/><small>DIGITAL HUB</small></div>
        <label className="muted" htmlFor="company">Actief bedrijf</label>
        <select id="company" className="company-select" defaultValue="Cohvera">
          {companies.map((company) => <option key={company}>{company}</option>)}
        </select>
        <nav className="nav">
          <a href="#overview">Overzicht</a>
          {hubs.map((hub) => <a key={hub} href={`#${hub.toLowerCase().replaceAll(" ", "-")}`}>{hub}</a>)}
          <a href="#tools">Tools & Solutions</a>
          <a href="#notifications">Notificaties</a>
          <a href="#audit">Audit</a>
        </nav>
      </aside>
      <main className="main">
        <header className="topbar"><div><p className="muted">COEF Operational Framework</p><h1>Welkom terug, {identity.displayName}</h1></div><div className="user-pill"><strong>{identity.displayName}</strong><small>CEO · Portal Admin</small></div></header>
        <div className="cards" id="overview">
          <article className="card"><span className="badge">Sprint 1</span><h3>Portal Core</h3><strong>Actief</strong><p className="muted">Auth, RBAC, multi-company en plugin registry</p></article>
          <article className="card"><h3>Actieve plugins</h3><strong>{pluginCatalog.filter((plugin) => plugin.status === "active").length}</strong><p className="muted">Per bedrijf schakelbaar</p></article>
          <article className="card"><h3>Bedrijven</h3><strong>{companies.length}</strong><p className="muted">Gescheiden context en rechten</p></article>
          <article className="card"><h3>Platformstatus</h3><strong>Healthy</strong><p className="muted">API en database voorbereid</p></article>
        </div>
        <section><h2 id="tools">Tools & Solutions</h2><div className="cards">{pluginCatalog.map((plugin) => <article className="card" key={plugin.id}><span className="badge">{plugin.status}</span><h3>{plugin.name}</h3><p className="muted">{plugin.description}</p><small>{plugin.route}</small></article>)}</div></section>
        <section className="split"><article className="card" id="notifications"><h2>Notificaties</h2><p className="muted">Het centrale notificatiemodel is beschikbaar via de API. Pluginmeldingen worden per bedrijf en gebruiker opgeslagen.</p></article><article className="card" id="audit"><h2>Audit logging</h2><p className="muted">Bedrijfswissels en toekomstige mutaties worden centraal vastgelegd met company-, user- en plugincontext.</p></article></section>
      </main>
    </div>
  );
}
