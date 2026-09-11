import Link from "next/link";
import { notFound } from "next/navigation";
import { coefHubs, getHub } from "../../../lib/coef";

export function generateStaticParams() {
  return coefHubs.map((hub) => ({ slug: hub.slug }));
}

export default async function HubPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const hub = getHub(slug);
  if (!hub) notFound();

  return (
    <main className="hub-page">
      <div className="hub-page-inner">
        <div className="hub-breadcrumb"><Link href="/">Cohvera Digital Hub</Link><span>/</span><span>{hub.name}</span></div>
        <header className="hub-hero">
          <div>
            <span className="badge">COEF · Sprint 2</span>
            <h1>{hub.name}</h1>
            <p className="hub-tagline">{hub.tagline}</p>
            <p className="muted hub-purpose">{hub.purpose}</p>
          </div>
          <Link className="secondary-button" href="/">Terug naar overzicht</Link>
        </header>

        <section className="hub-grid">
          {hub.cards.map((card) => (
            <article className="hub-module" key={card.title}>
              <div className="hub-module-top">
                <span className={`status-dot status-${card.status}`}></span>
                <span className="status-label">{card.status === "active" ? "Actief" : card.status === "attention" ? "Aandacht" : "Gepland"}</span>
                {card.metric && <strong className="module-metric">{card.metric}</strong>}
              </div>
              <h2>{card.title}</h2>
              <p className="muted">{card.description}</p>
              {card.href && <Link className="text-link" href={card.href}>Open onderdeel →</Link>}
            </article>
          ))}
        </section>

        <section className="framework-strip">
          <div><strong>Doel</strong><span>Strategie vertalen naar dagelijks gedrag en meetbare output.</span></div>
          <div><strong>Eigenaarschap</strong><span>Elk onderdeel krijgt een owner, status en volgende actie.</span></div>
          <div><strong>Data</strong><span>Waar mogelijk gevoed vanuit centrale API's en business-systemen.</span></div>
          <div><strong>Verbetering</strong><span>Afwijkingen leiden tot acties, niet tot losse rapportering.</span></div>
        </section>
      </div>
    </main>
  );
}
