"use client";
import Link from "next/link";
import { TOOL_COMPANIES_EVENT } from "../lib/tool-companies";
import { useEffect, useState } from "react";
import { getRecentTools, RECENT_TOOLS_EVENT, type RecentTool } from "../lib/recent-tools";
import { useCompany } from "./PortalShell";
import ToolLaunchLink from "./ToolLaunchLink";

export default function RecentTools() {
  const {companyCode} = useCompany();
  const [snapshot,setSnapshot] = useState<{companyCode: string; tools: RecentTool[]}>({companyCode:"",tools:[]});
  useEffect(() => {
    let active=true;let version=0;
    const refresh = async () => {const current=++version;try{const tools=await getRecentTools(companyCode);if(active&&version===current)setSnapshot({companyCode,tools});}catch{if(active&&version===current)setSnapshot({companyCode,tools:[]});}};
    refresh();
    window.addEventListener(RECENT_TOOLS_EVENT,refresh);
    window.addEventListener("storage",refresh);
    window.addEventListener(TOOL_COMPANIES_EVENT,refresh);
    window.addEventListener("focus",refresh);
    return () => {
      active=false;
      window.removeEventListener(RECENT_TOOLS_EVENT,refresh);
      window.removeEventListener("storage",refresh);
      window.removeEventListener(TOOL_COMPANIES_EVENT,refresh);
      window.removeEventListener("focus",refresh);
    };
  },[companyCode]);
  const recent = snapshot.companyCode === companyCode ? snapshot.tools : [];
  return <section id="tools" aria-labelledby="recent-tools-heading">
    <div className="section-heading"><div><p className="eyebrow">Je digitale werkplek</p><h2 id="recent-tools-heading">Tools & Solutions</h2><p className="muted">Je drie laatst geopende tools voor dit bedrijf.</p></div><Link className="secondary-button" href="/tools">Bekijk alle tools →</Link></div>
    {snapshot.companyCode !== companyCode ? <p role="status">Recente tools laden…</p> : recent.length ? <div className="recent-tools-grid">{recent.map((tool,index)=>{
      const external = /^https?:\/\//i.test(tool.href);
      return <ToolLaunchLink toolId={tool.id} href={tool.href} key={tool.id} className="card recent-tool-card" target={external?"_blank":undefined} rel={external?"noopener noreferrer":undefined}>
        <div className="task-meta"><span>{tool.category}</span><span>{index===0?"Laatst geopend":`0${index+1}`}</span></div>
        <h3>{tool.name}</h3><p className="muted">{tool.description}</p>
        <footer><time dateTime={new Date(tool.openedAt).toISOString()}>{new Date(tool.openedAt).toLocaleString("nl-BE",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</time><span className="text-link">Open tool {external?"↗":"→"}</span></footer>
      </ToolLaunchLink>;
    })}</div> : <div className="empty-state"><h3>Nog geen recent gebruikte tools</h3><p>Open een tool via Tools & Solutions. Je vindt die daarna hier terug.</p><Link className="text-link" href="/tools">Ontdek je tools →</Link></div>}
  </section>;
}
