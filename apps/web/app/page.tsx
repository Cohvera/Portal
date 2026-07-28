import { pluginCatalog } from "@cohvera/plugin-sdk";

const hubs = ["Strategy Hub", "Process Hub", "Digital Hub", "Operations Hub", "Performance Hub", "Improvement Hub", "Innovation Hub"];

export default function HomePage() {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">COHVERA<br/><small>DIGITAL HUB</small></div>
        <nav className="nav">
          <a href="#overview">Overzicht</a>
          {hubs.map((hub) => <a key={hub} href={`#${hub.toLowerCase().replaceAll(" ", "-")}`}>{hub}</a>)}
          <a href="#tools">Tools & Solutions</a>
        </nav>
      </aside>
      <main className="main">
        <p className="muted">COEF Operational Framework</p>
        <h1>Welkom terug, Remko</h1>
        <div className="cards" id="overview">
          <article className="card"><span className="badge">MVP</span><h3>COEF Index</h3><strong>79%</strong><p className="muted">Platformbasis actief</p></article>
          <article className="card"><h3>Actieve plugins</h3><strong>{pluginCatalog.length}</strong><p className="muted">Geïsoleerd geregistreerd</p></article>
          <article className="card"><h3>Bedrijven</h3><strong>3</strong><p className="muted">Q-Home, Tomme Energie en Warco</p></article>
        </div>
        <h2 id="tools">Tools & Solutions</h2>
        <div className="cards">
          {pluginCatalog.map((plugin) => (
            <article className="card" key={plugin.id}>
              <span className="badge">{plugin.status}</span>
              <h3>{plugin.name}</h3>
              <p className="muted">{plugin.description}</p>
              <small>{plugin.route}</small>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}
