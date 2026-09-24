"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { coefHubs } from "../lib/coef";
type Company = { id: string; code: string; name: string };
const exampleCompanies: Company[] = [{id:"demo-COH",code:"COH",name:"Cohvera"},{id:"demo-QHOME",code:"QHOME",name:"Q-Home"},{id:"demo-TOMME",code:"TOMME",name:"Tomme Energie"},{id:"demo-WARCO",code:"WARCO",name:"Warco"}];
const CompanyContext = createContext({ companies: [] as Company[], companyCode: "COH" });
export const useCompany = () => useContext(CompanyContext);
export default function PortalShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [companies, setCompanies] = useState<Company[]>(exampleCompanies);
  const [companyCode, setCompanyCode] = useState("COH");
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setCompanyCode(localStorage.getItem("cohvera.companyCode") || "COH");
    fetch("/api/companies").then(r => r.ok ? r.json() : []).then(rows=>{if(rows.length)setCompanies(rows);}).catch(() => {});
  }, []);
  useEffect(() => setOpen(false), [pathname]);
  const links = [{href:"/",name:"Overzicht"},{href:"/projects",name:"Projecten"},{href:"/tasks",name:"Mijn taken"},...coefHubs.map(h=>({href:`/hubs/${h.slug}`,name:h.name})),{href:"/tools",name:"Tools & Solutions"},{href:"/#notifications",name:"Notificaties"},{href:"/#audit",name:"Audit"},{href:"/admin/accounts",name:"Accounts & rechten"},{href:"/admin/plugins",name:"Plugin Manager"}];
  return <CompanyContext.Provider value={{companies, companyCode}}><div className="shell">
    <button className="mobile-menu" aria-expanded={open} aria-controls="portal-sidebar" onClick={()=>setOpen(!open)}>☰ Menu</button>
    <aside id="portal-sidebar" className={`sidebar ${open ? "is-open" : ""}`}>
      <Link href="/" className="brand">COHVERA<br/><small>DIGITAL HUB</small></Link>
      <label className="muted" htmlFor="company">Actief bedrijf</label>
      <select id="company" className="company-select" value={companyCode} onChange={e=>{setCompanyCode(e.target.value);localStorage.setItem("cohvera.companyCode",e.target.value);void fetch(`/api/companies/${encodeURIComponent(e.target.value)}/select`,{method:"POST"}).catch(()=>{});}}>
        {companies.length ? companies.map(c=><option key={c.id} value={c.code}>{c.name}</option>) : <option value="COH">Cohvera</option>}
      </select>
      <nav className="nav" aria-label="Hoofdnavigatie">{links.map(l=><Link key={l.href} href={l.href} onClick={()=>setOpen(false)} aria-current={(l.href === "/" ? pathname === "/" : pathname.startsWith(l.href)) ? "page" : undefined}>{l.name}</Link>)}</nav>
      <div className="sidebar-profile"><strong>Remko</strong><small>Ontwikkelomgeving</small></div>
    </aside><div className="portal-content">{children}</div>
  </div></CompanyContext.Provider>;
}
