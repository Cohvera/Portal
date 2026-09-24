"use client";
import ToolLaunchLink from "../ToolLaunchLink";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useCompany } from "../PortalShell";
import { tools, toolAvailability, isExternalTool } from "../../lib/tools";
const symbols: Record<string,string> = {"heat-loss":"°C","warehouse-manager":"▦","q-portal":"Q","project-tasks":"✓","ventilation-cloud":"≋",inspections:"◎","solar-subcontracting":"☀","charging-workorders":"ϟ"};
type CustomEntry = { id: string; name: string; description: string; href: string; companyCode: string; kind: "tool" | "integration" };
const storageKey = "cohvera.catalog.entries.v1";
const integrations = [
  {name:"ERP & administratie", description:"Verbind klanten, projecten en orders met je administratie.", icon:"⇄"},
  {name:"Documenten & bestanden", description:"Bundel projectdocumenten en synchroniseer bestanden tussen je toepassingen.", icon:"▤"},
  {name:"API & automatisering", description:"Koppel systemen via API’s en automatiseer terugkerende stappen.", icon:"⌘"}
];
export default function ToolsPage() {
  const {companies,companyCode} = useCompany();
  const companyName = companies.find(c=>c.code===companyCode)?.name || ({COH:"Cohvera",QHOME:"Q-Home",TOMME:"Tomme Energie",WARCO:"Warco"}[companyCode] || companyCode);
  const [entries,setEntries] = useState<CustomEntry[]>([]);
  const [ready,setReady] = useState(false);
  const [kind,setKind] = useState<"tool"|"integration">("tool");
  const [formError,setFormError] = useState("");
  const [storageError,setStorageError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(()=>{
    try { const saved = JSON.parse(localStorage.getItem(storageKey) || "[]");
      if (!Array.isArray(saved) || !saved.every(e=>e && [e.id,e.name,e.description,e.companyCode,e.href].every(v=>typeof v === "string") && ["tool","integration"].includes(e.kind) && /^https?:\/\//i.test(e.href))) throw new Error();
      setEntries(saved);setReady(true);
    } catch {setStorageError("De lokaal opgeslagen toevoegingen konden niet worden geladen. Toevoegen is tijdelijk uitgeschakeld om bestaande gegevens te behouden.");}
  },[]);
  useEffect(()=>{dialog.current?.close();setSearch("");setCategory("Alle tools");},[companyCode]);
  function openAdd(nextKind:"tool"|"integration") {setKind(nextKind);setFormError("");dialog.current?.querySelector("form")?.reset();dialog.current?.showModal();}
  function addEntry(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    const href = String(data.get("href") || "").trim();
    if(!name) {setFormError("Vul een naam in.");return;}
    try { const url = new URL(href); if(!["https:","http:"].includes(url.protocol) || url.username || url.password) throw new Error(); }
    catch {setFormError("Gebruik een geldige http- of https-URL zonder inloggegevens.");return;}
    try {
      const latest: CustomEntry[] = JSON.parse(localStorage.getItem(storageKey) || "[]");
      const next = [...latest,{id:crypto.randomUUID(),name,href,description:String(data.get("description")||"").trim(),companyCode,kind}];
      localStorage.setItem(storageKey,JSON.stringify(next));setEntries(next);form.reset();dialog.current?.close();
      setSearch("");setCategory("Alle tools");
    } catch {setFormError("Opslaan is niet gelukt. Controleer of lokale browseropslag beschikbaar is.");}
  }
  const ownTools = entries.filter(e=>e.companyCode===companyCode&&e.kind==="tool");
  const ownIntegrations = entries.filter(e=>e.companyCode===companyCode&&e.kind==="integration");
  const [search,setSearch] = useState("");
  const [category,setCategory] = useState("Alle tools");
  const categories = ["Alle tools",...new Set(tools.map(t=>t.category)),...(ownTools.length?["Eigen tools"]:[])];
  const visibleCustom = ownTools.filter(t=>(category==="Alle tools"||category==="Eigen tools")&&`${t.name} ${t.description}`.toLocaleLowerCase("nl").includes(search.trim().toLocaleLowerCase("nl")));
  const visible = tools.filter(t=>(category === "Alle tools" || t.category === category) && `${t.name} ${t.description} ${t.category}`.toLocaleLowerCase("nl").includes(search.trim().toLocaleLowerCase("nl")));
  return <main className="main catalog-page">
    <header className="catalog-hero"><div><p className="eyebrow">Cohvera workspace</p><h1>Tools & Solutions<span>.</span></h1><p>De juiste tool voor elke stap.<br/>Van eerste berekening tot uitvoering en opvolging.</p><span className="catalog-scope">Werkplek van {companyName}</span></div><div className="catalog-hero-note"><span>ÉÉN WERKPLEK</span><strong>Berekenen.<br/>Organiseren.<br/>Uitvoeren.</strong></div></header>
    <section aria-labelledby="company-tools"><div className="catalog-toolbar"><div><p className="eyebrow">01 · Bedrijfstools</p><h2 id="company-tools">Tools voor {companyName}</h2><p className="muted">Je tools en snelkoppelingen voor het geselecteerde bedrijf.</p></div><button className="button-primary" disabled={!ready} onClick={()=>openAdd("tool")}>+ Tool toevoegen</button><label className="catalog-search"><span>Zoek een tool</span><input type="search" placeholder="Naam, toepassing of categorie…" value={search} onChange={e=>setSearch(e.target.value)}/></label></div>
    <div className="catalog-filters" aria-label="Filter op categorie">{categories.map(c=><button key={c} aria-pressed={category===c} onClick={()=>setCategory(c)}>{c}</button>)}</div>
    <div className="catalog-resultline"><span role="status">{visible.length+visibleCustom.length} {visible.length+visibleCustom.length===1?"tool":"tools"}{category!=="Alle tools"?` · ${category}`:" in je werkplek"}</span><span>Beschikbaar · Demo · Binnenkort</span></div>
    <div className="catalog-grid">{visible.map(tool=>{const availability=toolAvailability(tool);return <ToolLaunchLink toolId={tool.slug} key={tool.slug} href={tool.href || `/tools/${tool.slug}`} target={isExternalTool(tool) ? "_blank" : undefined} rel={isExternalTool(tool) ? "noopener noreferrer" : undefined} className={`catalog-card catalog-${tool.slug}`}><div className="catalog-card-top"><span className="catalog-icon" aria-hidden="true">{symbols[tool.slug]}</span><span className={`availability availability-${availability.className}`}>{availability.label}</span></div><span className="catalog-category">{tool.category}</span><h2>{tool.name}</h2><p>{tool.description}</p><div className="catalog-capabilities">{tool.actions.slice(0,2).map(a=><span key={a}>{a}</span>)}</div><footer><span>{availability.detail}</span><strong>{tool.href?"Open tool":tool.status==="Planned"?"Bekijk tool":"Bekijk demo"} ↗</strong></footer></ToolLaunchLink>;})}{visibleCustom.map(entry=><ToolLaunchLink toolId={`custom:${entry.id}`} className="catalog-card" key={entry.id} href={entry.href} target="_blank" rel="noopener noreferrer"><div className="catalog-card-top"><span className="catalog-icon">↗</span><span className="availability availability-available">Snelkoppeling</span></div><span className="catalog-category">Eigen tools · {companyName}</span><h2>{entry.name}</h2><p>{entry.description||"Eigen tool voor dit bedrijf."}</p><footer><span>Opent in een nieuw tabblad</span><strong>Open tool ↗</strong></footer></ToolLaunchLink>)}<button className="catalog-card catalog-add" disabled={!ready} onClick={()=>openAdd("tool")}><span className="catalog-plus" aria-hidden="true">+</span><strong>Tool toevoegen</strong><span>Breid de werkplek van {companyName} uit.</span></button></div>
    {!visible.length&&!visibleCustom.length&&<div className="empty-state"><h2>Geen tools gevonden</h2><p>Probeer een andere zoekterm of bekijk alle categorieën.</p><button className="secondary-button" onClick={()=>{setSearch("");setCategory("Alle tools");}}>Filters wissen</button></div>}
    </section>
    <section className="integrations-section" aria-labelledby="integrations-heading"><div className="catalog-toolbar"><div><p className="eyebrow">02 · Systemen verbinden</p><h2 id="integrations-heading">Middleware & Integrations</h2><p className="muted">Koppelingen en automatisering voor {companyName}.</p></div><button className="button-primary" disabled={!ready} onClick={()=>openAdd("integration")}>+ Integratie toevoegen</button></div>
    <div className="catalog-grid">{integrations.map(item=><article className="catalog-card integration-card" key={item.name}><div className="catalog-card-top"><span className="catalog-icon">{item.icon}</span><span className="availability availability-planned">In voorbereiding</span></div><span className="catalog-category">Middleware</span><h2>{item.name}</h2><p>{item.description}</p><footer><span>Nog geen verbinding ingesteld</span></footer></article>)}{ownIntegrations.map(entry=><a className="catalog-card integration-card" key={entry.id} href={entry.href} target="_blank" rel="noopener noreferrer"><div className="catalog-card-top"><span className="catalog-icon">⇄</span><span className="availability availability-demo">Snelkoppeling</span></div><span className="catalog-category">Eigen integratie</span><h2>{entry.name}</h2><p>{entry.description||"Open de beheeromgeving van deze integratie."}</p><footer><span>Opent in een nieuw tabblad</span><strong>Open omgeving ↗</strong></footer></a>)}<button className="catalog-card catalog-add" disabled={!ready} onClick={()=>openAdd("integration")}><span className="catalog-plus" aria-hidden="true">+</span><strong>Integratie toevoegen</strong><span>Verbind je werkplek met je systemen.</span></button></div></section>
    {storageError&&<div className="alert" role="alert">{storageError}</div>}
    <dialog ref={dialog} className="catalog-dialog" aria-labelledby="catalog-dialog-title"><form className="task-form" onSubmit={addEntry}><div className="section-heading"><div><p className="eyebrow">{companyName}</p><h2 id="catalog-dialog-title">{kind==="tool"?"Tool toevoegen":"Integratie toevoegen"}</h2></div><button type="button" className="secondary-button" aria-label="Sluiten" onClick={()=>dialog.current?.close()}>×</button></div><p className="muted">Voeg een snelkoppeling toe voor dit bedrijf. Deze wordt in deze browser bewaard. Een integratie toevoegen activeert nog geen gegevensuitwisseling.</p><fieldset><label>Naam<input name="name" required maxLength={80} placeholder={kind==="tool"?"Naam van de tool":"Naam van de integratie"}/></label><label>Beschrijving<textarea name="description" maxLength={240} rows={3}/></label><label>Webadres<input name="href" type="url" required placeholder="https://…"/></label></fieldset>{formError&&<div className="alert" role="alert">{formError}</div>}<footer className="dialog-actions"><button type="button" className="secondary-button" onClick={()=>dialog.current?.close()}>Annuleren</button><button className="button-primary">Toevoegen</button></footer></form></dialog>
    <aside className="catalog-note"><strong>Een werkplek die meegroeit</strong><p>De voorbeeldtools zijn voorlopig voor elk bedrijf gelijk. Eigen toevoegingen horen bij het geselecteerde bedrijf en worden lokaal in deze browser bewaard. Projecttaken kun je al gebruiken. Demo’s tonen een voorbeeldworkflow; tools met ‘Binnenkort’ worden nog uitgewerkt of gekoppeld.</p></aside>
  </main>;
}
