import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import ToolPageClient from "./ToolPageClient";
import { findTool, tools } from "../../../lib/tools";

export function generateStaticParams() {
  return tools.map((tool) => ({ slug: tool.slug }));
}

export default async function ToolPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tool = findTool(slug);
  if (!tool) notFound();
  if (tool.href) redirect(tool.href);
  if (tool.status === "Planned") return <main className="main tool-preview">
    <div className="hub-breadcrumb"><Link href="/tools">Tools & Solutions</Link><span>/</span><span>{tool.name}</span></div>
    <header className="catalog-hero"><div><span className="availability availability-planned">Binnenkort</span><p className="eyebrow">{tool.category}</p><h1>{tool.name}</h1><p>{tool.description}</p></div></header>
    <div className="tool-preview-notice"><strong>{tool.slug === "q-portal" ? "Koppeling in voorbereiding" : "Deze tool is in voorbereiding"}</strong><p>{tool.slug === "q-portal" ? "Q-portal krijgt hier een vaste toegang. De bestemming en koppeling zijn nog niet ingesteld." : "Hieronder zie je de voorziene mogelijkheden. De interactieve module is nog niet beschikbaar."}</p></div>
    <section><div className="section-heading"><h2>Wat je hier straks kunt doen</h2></div><div className="cards">{tool.actions.map((action,index)=><article className="card" key={action}><span className="eyebrow">0{index+1}</span><h3>{action}</h3></article>)}</div></section>
    <section className="card"><p className="eyebrow">Voorziene workflow</p><h2>Van start tot resultaat</h2><ol className="workflow-list">{tool.workflow.map((step,index)=><li key={step}><span>{index+1}</span><strong>{step}</strong></li>)}</ol></section>
    <Link className="secondary-button preview-back" href="/tools">← Alle tools bekijken</Link>
  </main>;
  return <ToolPageClient tool={tool} />;
}
