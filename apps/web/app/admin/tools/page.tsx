"use client";
import "./tools-admin.css";
import {useEffect,useState} from 'react';
import {request} from '../../../lib/projects';
import {tools} from '../../../lib/tools';
import {readCatalog,entryCompanies,notifyToolCompanies,type CatalogSnapshot} from '../../../lib/tool-companies';
type Company={code:string;name:string};
export default function ToolVisibilityPage(){
 const [catalog,setCatalog]=useState<CatalogSnapshot|null>(null),[companies,setCompanies]=useState<Company[]>([]);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[search,setSearch]=useState('');
 useEffect(()=>{let active=true;Promise.all([readCatalog(),request<Company[]>('/api/admin/companies')]).then(([data,rows])=>{if(active){setCatalog(data);setCompanies(rows);}}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[]);
 async function toggle(id:string,codes:string[],company:Company){
  if(busy)return;setBusy(true);setError('');setMessage('');
  const visible=!codes.includes(company.code);
  const companyCodes=visible?[...codes,company.code]:codes.filter(c=>c!==company.code);
  try{
   await request(`/api/catalog/${encodeURIComponent(id)}/companies`,{method:'PATCH',body:JSON.stringify({companyCodes})});
   setCatalog(current=>current?{entries:current.entries.map(e=>e.id===id?{...e,companyCodes}:e),selections:{...current.selections,...(tools.some(t=>t.slug===id)?{[id]:companyCodes}:{})}}:current);
   notifyToolCompanies();setMessage(`Opgeslagen: ${visible?'zichtbaar':'verborgen'} bij ${company.name}.`);
  }catch(e){setError(e instanceof Error?e.message:'Opslaan mislukt.');}finally{setBusy(false);}
 }
 const rows=catalog?[
  ...tools.map(t=>({id:t.slug,name:t.name,category:t.category,codes:catalog.selections[t.slug]??companies.map(c=>c.code)})),
  ...catalog.entries.map(e=>({id:e.id,name:e.name,category:e.kind==='integration'?'Eigen integratie':'Eigen tool',codes:entryCompanies(e)}))
 ].filter(t=>`${t.name} ${t.category}`.toLocaleLowerCase('nl').includes(search.toLocaleLowerCase('nl'))):[];
 return <main className="main"><header className="section-heading"><div><p className="eyebrow">Cohvera Admin</p><h1>Tools per bedrijf</h1><p className="muted">Bepaal welke tools elk bedrijf ziet. Elke wijziging wordt meteen opgeslagen voor alle accounts en apparaten.</p></div></header>
 <p>Verborgen tools verdwijnen uit Tools &amp; Solutions en recente tools. De gegevens en synchronisaties blijven behouden.</p>
 <label>Zoek een tool <input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Naam of categorie"/></label>
 {error&&<p className="alert" role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
 {!catalog&&!error&&<p role="status">Tools laden…</p>}
 {catalog&&<div style={{overflowX:'auto',marginTop:24}}><table className="tool-visibility-table"><caption className="muted">Zichtbaarheid per bedrijf — klik op een schakelaar om te wijzigen.</caption><thead><tr><th scope="col">Tool</th>{companies.map(c=><th scope="col" key={c.code}>{c.name}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={row.id}><th scope="row" style={{textAlign:'left',minWidth:220}}>{row.name}<div className="muted" style={{fontWeight:400}}>{row.category}</div></th>{companies.map(c=>{const visible=row.codes.includes(c.code);return <td key={c.code}><button type="button" role="switch" aria-checked={visible} aria-label={`${row.name} zichtbaar bij ${c.name}`} className={`company-toggle${visible?' enabled':''}`} disabled={busy} onClick={()=>void toggle(row.id,row.codes,c)}><span aria-hidden="true">{visible?'✓ Zichtbaar':'− Verborgen'}</span></button></td>;})}</tr>)}</tbody></table>{!rows.length&&<p>Geen tools gevonden.</p>}</div>}
 </main>;
}
