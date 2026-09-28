"use client";
import { request } from "../../lib/projects";
import ToolLaunchLink from "../ToolLaunchLink";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useCompany } from "../PortalShell";
import { tools, toolAvailability, isExternalTool } from "../../lib/tools";
import { CATALOG_ENTRIES_KEY, TOOL_COMPANIES_KEY, TOOL_COMPANIES_EVENT, entryCompanies, readToolCompanies, readCatalog, toolMatchesCompany, notifyToolCompanies } from "../../lib/tool-companies";
const symbols: Record<string,string> = {"heat-loss":"°C","warehouse-manager":"▦","q-portal":"Q","project-tasks":"✓","ventilation-cloud":"≋",inspections:"◎","solar-subcontracting":"☀","charging-workorders":"ϟ"};
type CustomEntry = { id: string; name: string; description: string; href: string; companyCode: string; companyCodes?: string[]; kind: "tool" | "integration" };
const storageKey = CATALOG_ENTRIES_KEY;
const integrations = [
  {name:"ERP & administratie", description:"Verbind klanten, projecten en orders met je administratie.", icon:"⇄"},
  {name:"Documenten & bestanden", description:"Bundel projectdocumenten en synchroniseer bestanden tussen je toepassingen.", icon:"▤"},
  {name:"API & automatisering", description:"Koppel systemen via API’s en automatiseer terugkerende stappen.", icon:"⌘"}
];
export default function ToolsPage() {
  const {companies,companyCode,canManageCatalog} = useCompany();
  const companyName = companies.find(c=>c.code===companyCode)?.name || ({COH:"Cohvera",QHOME:"Q-Home",TOMME:"Tomme Energie",WARCO:"Warco"}[companyCode] || companyCode);
  const [entries,setEntries] = useState<CustomEntry[]>([]);
  const [selections,setSelections] = useState<Record<string,string[]>>({});
  const [showAll,setShowAll] = useState(false);
  const [selectedCompanies,setSelectedCompanies] = useState<string[]>([]);
  const [assignment,setAssignment] = useState<{id:string;name:string;custom:boolean}|null>(null);
  const [assignmentError,setAssignmentError] = useState("");
  const assignmentDialog = useRef<HTMLDialogElement>(null);
  const [busy,setBusy]=useState(false);
  const [hasLocal,setHasLocal]=useState(false);
  const [ready,setReady] = useState(false);
  const [kind,setKind] = useState<"tool"|"integration">("tool");
  const [formError,setFormError] = useState("");
  const [storageError,setStorageError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  async function refreshCatalog() {const saved=await readCatalog();setEntries(saved.entries);setSelections(saved.selections);setReady(true);setStorageError("");}
  useEffect(()=>{
    let active=true;
    const load=()=>readCatalog().then(saved=>{if(active){setEntries(saved.entries);setSelections(saved.selections);setReady(true);setStorageError("");}}).catch(e=>{if(active){setReady(false);setStorageError(e.message);}});
    void load();window.addEventListener("focus",load);window.addEventListener(TOOL_COMPANIES_EVENT,load);
    try{setHasLocal((JSON.parse(localStorage.getItem(storageKey)||"[]")).length>0||Object.keys(readToolCompanies()).length>0);}catch{}
    return ()=>{active=false;window.removeEventListener("focus",load);window.removeEventListener(TOOL_COMPANIES_EVENT,load);};
  },[]);
  async function importLocal() {
    if(!canManageCatalog||busy)return;setBusy(true);
    try{await request("/api/catalog/import",{method:"POST",body:JSON.stringify({entries:JSON.parse(localStorage.getItem(storageKey)||"[]"),selections:readToolCompanies()})});await refreshCatalog();localStorage.removeItem(storageKey);localStorage.removeItem(TOOL_COMPANIES_KEY);setHasLocal(false);notifyToolCompanies();}
    catch(e){setStorageError(e instanceof Error?e.message:"Importeren mislukt.");}finally{setBusy(false);}
  }
  useEffect(()=>{dialog.current?.close();assignmentDialog.current?.close();setShowAll(false);setSearch("");setCategory("Alle tools");},[companyCode]);
  function openAdd(nextKind:"tool"|"integration") {if(!canManageCatalog)return;setKind(nextKind);setSelectedCompanies([companyCode]);setFormError("");dialog.current?.querySelector("form")?.reset();dialog.current?.showModal();}
  function openAssignment(id:string,name:string,custom:boolean) {
    if(!canManageCatalog)return;
    const codes=custom?entryCompanies(entries.find(e=>e.id===id)!):(selections[id]||companies.map(c=>c.code));
    setAssignment({id,name,custom});setSelectedCompanies(codes);setAssignmentError("");assignmentDialog.current?.showModal();
  }
  async function saveAssignment(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();if(!assignment||busy||!canManageCatalog)return;
    if(!selectedCompanies.length){setAssignmentError("Selecteer minstens één bedrijf.");return;}
    setBusy(true);
    try {
      await request(`/api/catalog/${encodeURIComponent(assignment.id)}/companies`,{method:"PATCH",body:JSON.stringify({companyCodes:selectedCompanies})});
      await refreshCatalog();notifyToolCompanies();assignmentDialog.current?.close();
    }catch(e){setAssignmentError(e instanceof Error?e.message:"Opslaan mislukt.");}finally{setBusy(false);}
  }
  const companyPicker = <fieldset className="tool-company-picker" disabled={busy}><legend>Bedrijven</legend><p className="muted">Selecteer één of meerdere bedrijven.</p>{companies.map(c=><label key={c.code}><input type="checkbox" checked={selectedCompanies.includes(c.code)} onChange={e=>setSelectedCompanies(current=>e.target.checked?[...current,c.code]:current.filter(code=>code!==c.code))}/><span>{c.name}</span></label>)}</fieldset>;
  const companyLabel=(codes:string[])=>codes.map(code=>companies.find(c=>c.code===code)?.name||code).join(", ");
  async function addEntry(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();if(busy||!canManageCatalog)return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    const href = String(data.get("href") || "").trim();
    if(!selectedCompanies.length){setFormError("Selecteer minstens één bedrijf.");return;}
    if(!name) {setFormError("Vul een naam in.");return;}
    try { const url = new URL(href); if(!["https:","http:"].includes(url.protocol) || url.username || url.password) throw new Error(); }
    catch {setFormError("Gebruik een geldige http- of https-URL zonder inloggegevens.");return;}
    try {
      setBusy(true);
      await request("/api/catalog",{method:"POST",body:JSON.stringify({name,href,description:String(data.get("description")||"").trim(),companyCodes:selectedCompanies,kind})});
      await refreshCatalog();notifyToolCompanies();form.reset();dialog.current?.close();
      setSearch("");setCategory("Alle tools");
    } catch(e) {setFormError(e instanceof Error?e.message:"Opslaan mislukt.");}finally{setBusy(false);}
  }

  const ownTools = entries.filter(e=>((canManageCatalog&&showAll)||entryCompanies(e).includes(companyCode))&&e.kind==="tool");
  const ownIntegrations = entries.filter(e=>((canManageCatalog&&showAll)||entryCompanies(e).includes(companyCode))&&e.kind==="integration");
  const [search,setSearch] = useState("");
  const [category,setCategory] = useState("Alle tools");
  const categories = ["Alle tools",...new Set(tools.map(t=>t.category)),...(ownTools.length?["Eigen tools"]:[])];
  const visibleCustom = ownTools.filter(t=>(category==="Alle tools"||category==="Eigen tools")&&`${t.name} ${t.description}`.toLocaleLowerCase("nl").includes(search.trim().toLocaleLowerCase("nl")));
  const visible = tools.filter(t=>((canManageCatalog&&showAll)||toolMatchesCompany(t.slug,companyCode,selections))&&(category === "Alle tools" || t.category === category) && `${t.name} ${t.description} ${t.category}`.toLocaleLowerCase("nl").includes(search.trim().toLocaleLowerCase("nl")));
  return <main className="main catalog-page">
    <header className="catalog-hero"><div><p className="eyebrow">Cohvera workspace</p><h1>Tools & Solutions<span>.</span></h1><p>De juiste tool voor elke stap.<br/>Van eerste berekening tot uitvoering en opvolging.</p><span className="catalog-scope">Werkplek van {companyName}</span></div><div className="catalog-hero-note"><span>ÉÉN WERKPLEK</span><strong>Berekenen.<br/>Organiseren.<br/>Uitvoeren.</strong></div></header>
    <section aria-labelledby="company-tools"><div className="catalog-toolbar"><div><p className="eyebrow">01 · Bedrijfstools</p><h2 id="company-tools">Tools voor {companyName}</h2><p className="muted">Je tools en snelkoppelingen voor het geselecteerde bedrijf.</p></div>{canManageCatalog&&<button className="button-primary" disabled={!ready||busy} onClick={()=>openAdd("tool")}>+ Tool toevoegen</button>}<label className="catalog-search"><span>Zoek een tool</span><input type="search" placeholder="Naam, toepassing of categorie…" value={search} onChange={e=>setSearch(e.target.value)}/></label></div>
    {canManageCatalog&&<label className="tool-manage-toggle"><input type="checkbox" checked={showAll} onChange={e=>{setShowAll(e.target.checked);setSearch("");setCategory("Alle tools");}}/> Alle bedrijven tonen om toewijzingen te beheren</label>}
    <div className="catalog-filters" aria-label="Filter op categorie">{categories.map(c=><button key={c} aria-pressed={category===c} onClick={()=>setCategory(c)}>{c}</button>)}</div>
    <div className="catalog-resultline"><span role="status">{visible.length+visibleCustom.length} {visible.length+visibleCustom.length===1?"tool":"tools"}{category!=="Alle tools"?` · ${category}`:" in je werkplek"}</span><span>Beschikbaar · Demo · Binnenkort</span></div>
    <div className="catalog-grid">{visible.map(tool=>{const availability=toolAvailability(tool);return <article key={tool.slug} className={`catalog-card catalog-${tool.slug}`}><ToolLaunchLink toolId={tool.slug} href={tool.href || `/tools/${tool.slug}`} target={isExternalTool(tool) ? "_blank" : undefined} rel={isExternalTool(tool) ? "noopener noreferrer" : undefined} className="catalog-card-content"><div className="catalog-card-top"><span className="catalog-icon" aria-hidden="true">{symbols[tool.slug]}</span><span className={`availability availability-${availability.className}`}>{availability.label}</span></div><span className="catalog-category">{tool.category}</span><h2>{tool.name}</h2><p>{tool.description}</p><div className="catalog-capabilities">{tool.actions.slice(0,2).map(a=><span key={a}>{a}</span>)}</div><footer><span>{availability.detail}</span><strong>{tool.href?"Open tool":tool.status==="Planned"?"Bekijk tool":"Bekijk demo"} ↗</strong></footer></ToolLaunchLink>{canManageCatalog&&<button className="tool-company-edit" disabled={!ready||busy} onClick={()=>openAssignment(tool.slug,tool.name,false)} aria-label={`Bedrijven voor ${tool.name}`} title={companyLabel(selections[tool.slug]||companies.map(c=>c.code))}>Bedrijven · {companyLabel(selections[tool.slug]||companies.map(c=>c.code))} <span>Wijzigen</span></button>}</article>;})}{visibleCustom.map(entry=><article className="catalog-card" key={entry.id}><ToolLaunchLink toolId={`custom:${entry.id}`} className="catalog-card-content" href={entry.href} target="_blank" rel="noopener noreferrer"><div className="catalog-card-top"><span className="catalog-icon">↗</span><span className="availability availability-available">Snelkoppeling</span></div><span className="catalog-category">Eigen tools</span><h2>{entry.name}</h2><p>{entry.description||"Eigen tool voor dit bedrijf."}</p><footer><span>Opent in een nieuw tabblad</span><strong>Open tool ↗</strong></footer></ToolLaunchLink>{canManageCatalog&&<button className="tool-company-edit" disabled={!ready||busy} onClick={()=>openAssignment(entry.id,entry.name,true)} aria-label={`Bedrijven voor ${entry.name}`} title={companyLabel(entryCompanies(entry))}>Bedrijven · {companyLabel(entryCompanies(entry))} <span>Wijzigen</span></button>}</article>)}{canManageCatalog&&<button className="catalog-card catalog-add" disabled={!ready||busy} onClick={()=>openAdd("tool")}><span className="catalog-plus" aria-hidden="true">+</span><strong>Tool toevoegen</strong><span>Breid de werkplek van {companyName} uit.</span></button>}</div>
    {!visible.length&&!visibleCustom.length&&<div className="empty-state"><h2>Geen tools gevonden</h2><p>Probeer een andere zoekterm of bekijk alle categorieën.</p><button className="secondary-button" onClick={()=>{setSearch("");setCategory("Alle tools");}}>Filters wissen</button></div>}
    </section>
    <section className="integrations-section" aria-labelledby="integrations-heading"><div className="catalog-toolbar"><div><p className="eyebrow">02 · Systemen verbinden</p><h2 id="integrations-heading">Middleware & Integrations</h2><p className="muted">Koppelingen en automatisering voor {companyName}.</p></div>{canManageCatalog&&<button className="button-primary" disabled={!ready||busy} onClick={()=>openAdd("integration")}>+ Integratie toevoegen</button>}</div>
    <div className="catalog-grid">{integrations.map(item=><article className="catalog-card integration-card" key={item.name}><div className="catalog-card-top"><span className="catalog-icon">{item.icon}</span><span className="availability availability-planned">In voorbereiding</span></div><span className="catalog-category">Middleware</span><h2>{item.name}</h2><p>{item.description}</p><footer><span>Nog geen verbinding ingesteld</span></footer></article>)}{ownIntegrations.map(entry=><a className="catalog-card integration-card" key={entry.id} href={entry.href} target="_blank" rel="noopener noreferrer"><div className="catalog-card-top"><span className="catalog-icon">⇄</span><span className="availability availability-demo">Snelkoppeling</span></div><span className="catalog-category">Eigen integratie</span><h2>{entry.name}</h2><p>{entry.description||"Open de beheeromgeving van deze integratie."}</p><footer><span>Opent in een nieuw tabblad</span><strong>Open omgeving ↗</strong></footer></a>)}{canManageCatalog&&<button className="catalog-card catalog-add" disabled={!ready||busy} onClick={()=>openAdd("integration")}><span className="catalog-plus" aria-hidden="true">+</span><strong>Integratie toevoegen</strong><span>Verbind je werkplek met je systemen.</span></button>}</div></section>
    {canManageCatalog&&hasLocal&&<aside className="catalog-note"><p>Er zijn nog lokale tools of toewijzingen uit de vorige versie. Neem ze over in de centrale catalogus. Bestaande centrale instellingen blijven behouden.</p><button className="secondary-button" disabled={busy} onClick={()=>void importLocal()}>Lokale tools overnemen</button></aside>}
    {storageError&&<div className="alert" role="alert">{storageError}</div>}
    <dialog ref={dialog} className="catalog-dialog" aria-labelledby="catalog-dialog-title"><form className="task-form" onSubmit={addEntry}><div className="section-heading"><div><p className="eyebrow">{companyName}</p><h2 id="catalog-dialog-title">{kind==="tool"?"Tool toevoegen":"Integratie toevoegen"}</h2></div><button type="button" className="secondary-button" aria-label="Sluiten" onClick={()=>dialog.current?.close()}>×</button></div><p className="muted">Voeg een snelkoppeling toe voor de geselecteerde bedrijven. Deze wordt centraal opgeslagen voor de geselecteerde bedrijven. Een integratie toevoegen activeert nog geen gegevensuitwisseling.</p><fieldset><label>Naam<input name="name" required maxLength={80} placeholder={kind==="tool"?"Naam van de tool":"Naam van de integratie"}/></label><label>Beschrijving<textarea name="description" maxLength={240} rows={3}/></label><label>Webadres<input name="href" type="url" required placeholder="https://…"/></label></fieldset>{companyPicker}{formError&&<div className="alert" role="alert">{formError}</div>}<footer className="dialog-actions"><button type="button" className="secondary-button" onClick={()=>dialog.current?.close()}>Annuleren</button><button className="button-primary" disabled={busy}>Toevoegen</button></footer></form></dialog>
    <dialog ref={assignmentDialog} className="catalog-dialog" aria-labelledby="tool-assignment-title"><form onSubmit={saveAssignment}><header className="section-heading"><div><p className="eyebrow">Bedrijfstoewijzing</p><h2 id="tool-assignment-title">{assignment?.name}</h2></div><button type="button" className="secondary-button" aria-label="Sluiten" onClick={()=>assignmentDialog.current?.close()}>×</button></header>{companyPicker}{assignmentError&&<p className="alert" role="alert">{assignmentError}</p>}<footer className="dialog-actions"><button type="button" className="secondary-button" onClick={()=>assignmentDialog.current?.close()}>Annuleren</button><button className="button-primary" disabled={busy}>Bedrijven opslaan</button></footer></form></dialog>
    <aside className="catalog-note"><strong>Een werkplek die meegroeit</strong><p>Selecteer per tool de bedrijven waarvoor die bedoeld is. Tools en bedrijfstoewijzingen worden centraal opgeslagen. Je kunt één of meerdere bedrijven per tool selecteren. Projecttaken kun je al gebruiken. Demo’s tonen een voorbeeldworkflow; tools met ‘Binnenkort’ worden nog uitgewerkt of gekoppeld.</p></aside>
  </main>;
}
