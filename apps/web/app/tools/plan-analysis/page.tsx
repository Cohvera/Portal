"use client";
import Link from 'next/link';
import {useEffect,useRef,useState} from 'react';
import type {PDFDocumentProxy} from 'pdfjs-dist';
import {analysisCategories,distance,extractPlanFindings,measurementHeatDraft,polygonArea,validPolygon,type AnalysisCategory,type CountMark,type Finding,type Measurement,type PlanLine,type Point} from '../../../lib/plan-analysis';
import './plan-analysis.css';
type Calibration={metersPerPoint:number;referenceMeters:number};
type Mode='inspect'|'calibrate'|'area'|'count';
const number=(n:number)=>n.toLocaleString('nl-BE',{maximumFractionDigits:2});
const countColors = [
  '#2563eb', // blauw
  '#16a34a', // groen
  '#9333ea', // paars
  '#ea580c', // oranje
  '#0891b2', // turquoise
  '#db2777', // roze
  '#ca8a04', // geel
  '#4b5563', // grijs
];
function download(name:string,value:unknown){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export default function PlanAnalysis(){
 const [doc,setDoc]=useState<PDFDocumentProxy|null>(null),[fileName,setFileName]=useState(''),[page,setPage]=useState(1),[busy,setBusy]=useState(false),[progress,setProgress]=useState(''),[error,setError]=useState('');
 const [findings,setFindings]=useState<Finding[]>([]),[categories,setCategories]=useState<AnalysisCategory[]>(['areas']),[measurements,setMeasurements]=useState<Measurement[]>([]),[marks,setMarks]=useState<CountMark[]>([]);
 const [calibrations,setCalibrations]=useState<Record<number,Calibration>>({}),[mode,setMode]=useState<Mode>('inspect'),[points,setPoints]=useState<Point[]>([]),[reference,setReference]=useState(''),[roomName,setRoomName]=useState(''),[countName,setCountName]=useState('Stopcontact'),[countCategory,setCountCategory]=useState<AnalysisCategory>('electrical');
 const [view,setView]=useState({width:842,height:1191}),[rendering,setRendering]=useState(false),[zoom,setZoom]=useState(100),[highlight,setHighlight]=useState<Point|null>(null),[noText,setNoText]=useState(false);
 const canvas=useRef<HTMLCanvasElement>(null),docRef=useRef<PDFDocumentProxy|null>(null),generation=useRef(0),loadingTask=useRef<{destroy:()=>Promise<void>}|null>(null);
 useEffect(()=>()=>{generation.current++;void loadingTask.current?.destroy();void docRef.current?.destroy();},[]);
 useEffect(()=>{if(!doc)return;let cancelled=false;let task:{cancel:()=>void}|undefined;setRendering(true);
  void(async()=>{try{const p=await doc.getPage(page);if(cancelled)return;const v=p.getViewport({scale:1});setView({width:v.width,height:v.height});const scale=Math.min(2,1800/Math.max(v.width,v.height));const rendered=p.getViewport({scale});const c=canvas.current;if(!c)return;c.width=Math.ceil(rendered.width);c.height=Math.ceil(rendered.height);const t=p.render({canvas:c,viewport:rendered});task=t;await t.promise;}catch(e){if(!cancelled)setError('Deze pagina kon niet worden getoond. Probeer een andere PDF.');}finally{if(!cancelled)setRendering(false);}})();
  return()=>{cancelled=true;task?.cancel();};
 },[doc,page]);
 useEffect(()=>{
  if(!highlight||rendering)return;
  const viewport=canvas.current?.closest('.plan-canvas-scroll');
  const sheet=canvas.current?.parentElement;
  if(viewport&&sheet)viewport.scrollTo({left:highlight.x/view.width*sheet.clientWidth-viewport.clientWidth/2,top:highlight.y/view.height*sheet.clientHeight-viewport.clientHeight/2,behavior:'smooth'});
 },[highlight,rendering,view]);
 async function open(file:File){
  if(doc&&!window.confirm('Een ander plan openen? Bewaar eerst je analyse als je die wilt behouden.'))return;
  const current=++generation.current;setBusy(true);setError('');setProgress('PDF lokaal openen…');
  try{
   if(!file.name.toLowerCase().endsWith('.pdf')||file.size>20*1024*1024)throw new Error('Kies een PDF van maximaal 20 MB.');
   const bytes=new Uint8Array(await file.arrayBuffer());if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw new Error('Dit bestand is geen geldige PDF.');
   const pdfjs=await import('pdfjs-dist');pdfjs.GlobalWorkerOptions.workerSrc='/pdfjs/pdf.worker.min.mjs';
   const task=pdfjs.getDocument({data:bytes,isEvalSupported:false,cMapUrl:'/pdfjs/cmaps/',cMapPacked:true,standardFontDataUrl:'/pdfjs/standard_fonts/',wasmUrl:'/pdfjs/wasm/'});loadingTask.current=task;
   task.onPassword=()=>{void task.destroy();};
   const next=await task.promise;if(current!==generation.current){await next.destroy();return;}
   if(next.numPages>30){await next.destroy();throw new Error('Kies een PDF met maximaal 30 pagina’s. Splits een groter dossier eerst op.');}
   const lines:PlanLine[]=[];
   for(let n=1;n<=next.numPages;n++){
    setProgress(`Tekst uitlezen: pagina ${n} van ${next.numPages}…`);
    const p=await next.getPage(n),v=p.getViewport({scale:1}),content=await p.getTextContent();
    const tokens=content.items.flatMap(item=>{if(!('str' in item)||!item.str.trim())return [];const t=pdfjs.Util.transform(v.transform,item.transform);return [{text:item.str,x:t[4],y:t[5],width:item.width,rotated:Math.abs(t[1])>Math.abs(t[0])}];});
    const grouped:{text:string;x:number;y:number;right:number;rotated:boolean}[]=[];
    for(const t of tokens.sort((a,b)=>a.y-b.y||a.x-b.x)){
     const last=grouped.at(-1);
     if(last&&!last.rotated&&!t.rotated&&Math.abs(last.y-t.y)<2&&t.x-last.right>=-2&&t.x-last.right<18){last.text+=' '+t.text;last.right=t.x+t.width;}
     else grouped.push({...t,right:t.x+t.width});
    }
    lines.push(...grouped.map(t=>({text:t.text,page:n,x:t.x,y:t.y})));
   }
   if(current!==generation.current){await next.destroy();return;}
   const previous=docRef.current;docRef.current=next;setDoc(next);loadingTask.current=null;void previous?.destroy();
   setFileName(file.name);setFindings(extractPlanFindings(lines));setNoText(lines.length===0);setMeasurements([]);setMarks([]);setCalibrations({});setPoints([]);setPage(1);setMode('inspect');setZoom(100);setReference('');setRoomName('');setHighlight(null);
  }catch(e){if(current===generation.current){setError(e instanceof Error&&/Kies|bestand/.test(e.message)?e.message:'PDF uitlezen mislukt. Gebruik een onbeschadigde PDF zonder wachtwoord.');void loadingTask.current?.destroy();loadingTask.current=null;}}
  finally{if(current===generation.current){setBusy(false);setProgress('');}}
 }
 const switchMode=(next:Mode)=>{setMode(next);setPoints([]);setHighlight(null);setError('');};
 const calibration=calibrations[page];
 const visible=findings.filter(f=>categories.includes(f.category));
 const groupedMarks = Object.values(
  marks.reduce<
    Record<
      string,
      { name: string; category: AnalysisCategory; count: number; color: string }
    >
  >((groups, m) => {
    const key = JSON.stringify([m.category, m.name]);
    groups[key] ??= {
      name: m.name,
      category: m.category,
      count: 0,
      color: m.color,
    };
    groups[key].count++;
    return groups;
  }, {}),
);
 function clickPlan(e:React.MouseEvent<SVGSVGElement>){
  if(rendering||busy||mode==='inspect')return;const rect=e.currentTarget.getBoundingClientRect();const point={x:(e.clientX-rect.left)/rect.width*view.width,y:(e.clientY-rect.top)/rect.height*view.height};
  if(mode==='count'){if(!countName.trim()){setError('Geef eerst een naam voor het te tellen symbool.');return;}if(marks.length>=2000){setError('Maximaal 2.000 telmarkeringen per analyse.');return;}const name = countName.trim();
const existingMark = marks.find(
  m => m.category === countCategory && m.name === name,
);
const groupCount = new Set(
  marks.map(m => JSON.stringify([m.category, m.name])),
).size;
const color =
  existingMark?.color ?? countColors[groupCount % countColors.length];

setMarks([
  ...marks,
  {
    id: crypto.randomUUID(),
    page,
    name,
    category: countCategory,
    point,
    color,
  },
]);}
  else if(mode==='calibrate')setPoints(points.length>=2?[point]:[...points,point]);
  else if(points.length<100)setPoints([...points,point]);
 }
 function calibrate(){const meters=Number(reference.replace(',','.'));if(points.length!==2||distance(points[0],points[1])<5||!Number.isFinite(meters)||meters<=0||meters>1000){setError('Klik twee duidelijk gescheiden punten aan en geef hun echte afstand in meter.');return;}setCalibrations({...calibrations,[page]:{referenceMeters:meters,metersPerPoint:meters/distance(points[0],points[1])}});switchMode('area');}
 function saveArea(){if(!calibration||!validPolygon(points)||!roomName.trim()){setError('Geef een ruimtenaam en teken minstens drie hoeken zonder kruisende zijden.');return;}const area=polygonArea(points)*calibration.metersPerPoint**2;if(area<0.1||area>10000){setError('De oppervlakte valt buiten 0,1–10.000 m². Controleer je kalibratie.');return;}setMeasurements([...measurements,{id:crypto.randomUUID(),page,name:roomName.trim(),area,points,...calibration,reviewed:false}]);setPoints([]);setRoomName('');setError('');}
 return <main className="main plan-page"><header className="plan-header"><div><Link href="/tools">← Tools & Solutions</Link><p className="eyebrow">Engineering · lokale analyse</p><h1>Plananalyse</h1><p>Lees het plan, controleer de bron en meet wat nog ontbreekt.</p></div><Link className="secondary-button" href="/tools/heat-loss">Warmteverliescalculator →</Link></header>
  <div className="plan-private"><strong>Je plan blijft op dit apparaat.</strong><p>PDF-uitlezing, meten en tellen gebeuren in je browser. Geen upload naar Portal of externe AI. Dit is tekstherkenning uit de PDF, geen automatische interpretatie van alle tekens of lijnen. Bewaar je resultaten vóór je deze pagina verlaat.</p></div>
  <section className="card plan-setup"><div><h2>1. Kies je plan</h2><label className="plan-upload">PDF openen <input type="file" accept="application/pdf,.pdf" disabled={busy} onChange={e=>{const f=e.target.files?.[0];e.target.value='';if(f)void open(f);}}/></label><small>Maximaal 20 MB en 30 pagina’s. Scans kun je handmatig meten en tellen; lokale OCR is nog niet voorzien.</small>{fileName&&<p className="plan-filename">{fileName}</p>}</div><fieldset><legend>2. Wat wil je analyseren?</legend>{Object.entries(analysisCategories).map(([key,label])=><label key={key}><input type="checkbox" checked={categories.includes(key as AnalysisCategory)} onChange={e=>setCategories(e.target.checked?[...categories,key as AnalysisCategory]:categories.filter(c=>c!==key))}/>{label}</label>)}</fieldset></section>
  {busy&&<p role="status">{progress}</p>}{error&&<p className="alert" role="alert">{error}</p>}{noText&&<p className="plan-warning">Dit document bevat geen leesbare tekstlaag. Er worden geen automatische bevindingen verzonnen. Gebruik de meet- en telfunctie op de tekening.</p>}
  {doc&&<><section className="plan-workspace"><div className="card plan-viewer"><div className="plan-toolbar"><label>Pagina <select value={page} disabled={busy} onChange={e=>{setPage(Number(e.target.value));setPoints([]);setHighlight(null);}}>{Array.from({length:doc.numPages},(_,i)=><option key={i+1} value={i+1}>{i+1} / {doc.numPages}</option>)}</select></label><label>Zoom <select value={zoom} onChange={e=>setZoom(Number(e.target.value))}>{[100,150,200,300].map(z=><option key={z} value={z}>{z}%</option>)}</select></label><span>{rendering?'Pagina tekenen…':calibration?`Schaal gekalibreerd · referentie ${number(calibration.referenceMeters)} m`:'Nog geen meetschaal ingesteld'}</span></div>
   <div className="plan-modes">{([['inspect','Bekijken'],['calibrate','Schaal instellen'],['area','Oppervlakte meten'],['count','Symbolen tellen']] as const).map(([value,label])=><button className="secondary-button" key={value} aria-pressed={mode===value} disabled={busy||rendering||(value==='area'&&!calibration)} onClick={()=>switchMode(value)}>{label}</button>)}</div>
   <div className="plan-canvas-scroll"><div className="plan-sheet" style={{width:`${zoom}%`,aspectRatio:`${view.width}/${view.height}`}}><canvas ref={canvas} aria-label={`Planpagina ${page}`}/><svg viewBox={`0 0 ${view.width} ${view.height}`} onClick={clickPlan} aria-label="Meetlaag: klik op de hoeken of symbolen in het plan" style={{cursor:mode==='inspect'?'default':'crosshair'}}>
    {measurements.filter(m=>m.page===page).map(m=><polygon key={m.id} points={m.points.map(p=>`${p.x},${p.y}`).join(' ')} fill="#4660ef22" stroke="#394bdb" strokeWidth={1.5}><title>{m.name}: {number(m.area)} m²</title></polygon>)}
    {marks.filter(m=>m.page===page).map(m=><g key={m.id}><circle cx={m.point.x} cy={m.point.y} r={5} fill={m.color} stroke="white" strokeWidth={1.5}/><title>{m.name}</title></g>)}
    {points.length>0&&<><polyline points={points.map(p=>`${p.x},${p.y}`).join(' ')} fill={mode==='area'?'#1b9b7422':'none'} stroke="#11865b" strokeWidth={2}/>{points.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r={3} fill="#11865b"/>)}</>}
    {highlight&&<circle cx={highlight.x} cy={highlight.y} r={12} fill="#ffd45366" stroke="#ca8100" strokeWidth={2}/>}
   </svg></div></div>
  </div><aside className="card plan-controls"><h2>{mode==='inspect'?'Controleer de bron':mode==='calibrate'?'Stel de meetschaal in':mode==='area'?'Meet een ruimte':'Tel zichtbare symbolen'}</h2>
   {mode==='inspect'&&<p>Klik bij een bevinding op ‘Toon op plan’. De gele cirkel wijst de bijbehorende tekst aan. Controleer of die uit de tekening, een legenda of een algemene nota komt.</p>}
   {mode==='calibrate'&&<><p>Klik de twee uiteinden van een <strong>gekende bouwkundige maat</strong> aan. Gebruik geen afstand voor een stopcontactpositie. Elke pagina heeft een eigen kalibratie.</p><p>{points.length} van 2 punten gekozen</p><label>Echte afstand (meter)<input inputMode="decimal" value={reference} placeholder="Bijvoorbeeld 3,98" onChange={e=>setReference(e.target.value)}/></label><button className="button-primary" disabled={points.length!==2} onClick={calibrate}>Meetschaal toepassen</button><p className="muted">De gedrukte schaal wordt niet blind overgenomen. Kalibratie werkt ook bij een verschaalde PDF; perspectiefvervorming van een foto wordt niet gecorrigeerd.</p></>}
   {mode==='area'&&<><p>Klik in volgorde op de binnenhoeken van de ruimte. De laatste zijde wordt bij opslaan automatisch gesloten. Meet open keuken, eet- en leefruimte samen als ze één ruimte vormen.</p><label>Naam ruimte<input maxLength={120} value={roomName} onChange={e=>setRoomName(e.target.value)}/></label><p className="plan-area">{calibration&&validPolygon(points)?`${number(polygonArea(points)*calibration.metersPerPoint**2)} m²`:'Kies minstens 3 hoeken'}</p><button className="button-primary" disabled={!calibration||!validPolygon(points)||!roomName.trim()} onClick={saveArea}>Oppervlakte toevoegen</button></>}
   {mode==='count'&&<><p>Klik elk werkelijk geplaatst symbool één keer aan. De oranje stippen helpen dubbeltellingen vermijden. Symbolen in de legenda tellen niet mee.</p><label>Onderdeel<input maxLength={100} value={countName} onChange={e=>setCountName(e.target.value)}/></label><label>Categorie<select value={countCategory} onChange={e=>setCountCategory(e.target.value as AnalysisCategory)}>{Object.entries(analysisCategories).filter(([key])=>key!=='areas').map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><p>Elke klik telt als één. Spreek zelf af of een dubbel stopcontact als één combinatie of twee aansluitingen telt.</p><button className="secondary-button" disabled={!marks.some(m=>m.page===page)} onClick={()=>{const last=[...marks].reverse().find(m=>m.page===page);setMarks(marks.filter(m=>m.id!==last?.id));}}>Laatste telmarkering verwijderen</button></>}
   {(mode==='area'||mode==='calibrate')&&<button className="secondary-button" disabled={!points.length} onClick={()=>setPoints(points.slice(0,-1))}>Laatste punt verwijderen</button>}
  </aside></section>
  <section className="card plan-results"><div className="plan-header"><div><p className="eyebrow">3. Controleer de resultaten</p><h2>Vermeldingen uit het plan</h2><p>{visible.length} bevindingen binnen je selectie. Dit zijn tekstvermeldingen, geen volledige materiaalstaat. Een nota zoals ‘1x stopcontact’ wordt niet automatisch bij de handmatige telling opgeteld.</p></div></div>
   {!categories.length?<p>Selecteer minstens één analysecategorie.</p>:!visible.length?<p>Geen passende tekst gevonden. Je kunt het plan wel handmatig meten of tellen.</p>:<div className="plan-table-scroll"><table><thead><tr><th>Gecontroleerd</th><th>Categorie / type</th><th>Gevonden tekst</th><th>Waarde</th><th>Bron</th></tr></thead><tbody>{visible.map(f=><tr key={f.id}><td><input type="checkbox" aria-label={`Gecontroleerd: ${f.label}`} checked={f.reviewed} onChange={e=>setFindings(findings.map(x=>x.id===f.id?{...x,reviewed:e.target.checked}:x))}/></td><td>{analysisCategories[f.category]}<small>{{room:'Ruimtenaam',area:'Opgegeven oppervlakte',mention:'Tekstvermelding',quantity:'Aantal in tekst', 'u-value':'Opgegeven U-waarde'}[f.kind]}</small></td><td>{f.evidence}</td><td>{f.value===null?'Niet bepaald':`${number(f.value)} ${f.unit}`}</td><td><button className="secondary-button" onClick={()=>{setPage(f.page);setPoints([]);setMode('inspect');setHighlight(f.point);document.querySelector('.plan-viewer')?.scrollIntoView({behavior:'smooth',block:'start'});}}>Toon op plan · p. {f.page}</button></td></tr>)}</tbody></table></div>}
  </section>
  <section className="card plan-results"><h2>Gemeten ruimtes</h2><p>Vink een ruimte pas aan nadat naam, omtrek en meetschaal zijn gecontroleerd. Alleen deze ruimtes kunnen naar de warmteverliescalculator.</p>{!measurements.length?<p className="muted">Nog geen ruimtes gemeten. Stel eerst de schaal in.</p>:<div className="plan-table-scroll"><table><thead><tr><th>Gecontroleerd</th><th>Ruimte</th><th>Oppervlakte</th><th>Pagina</th><th>Actie</th></tr></thead><tbody>{measurements.map(m=><tr key={m.id}><td><input type="checkbox" aria-label={`Oppervlakte gecontroleerd: ${m.name}`} checked={m.reviewed} onChange={e=>setMeasurements(measurements.map(x=>x.id===m.id?{...x,reviewed:e.target.checked}:x))}/></td><td><input aria-label={`Ruimtenaam: ${m.name}`} value={m.name} maxLength={120} onChange={e=>setMeasurements(measurements.map(x=>x.id===m.id?{...x,name:e.target.value,reviewed:false}:x))}/></td><td>{number(m.area)} m²</td><td>{m.page}</td><td><button className="secondary-button" onClick={()=>setMeasurements(measurements.filter(x=>x.id!==m.id))}>Verwijderen</button></td></tr>)}</tbody></table></div>}</section>
  <section className="card plan-results"><h2>Handmatige tellingen</h2>{!marks.length?<p className="muted">Nog geen symbolen geteld.</p>:<ul>{groupedMarks.map(g=><li key={`${g.category}-${g.name}`}><strong>
  <span
    aria-hidden="true"
    style={{
      display: 'inline-block',
      width: 12,
      height: 12,
      borderRadius: '50%',
      backgroundColor: g.color,
      marginRight: 8,
    }}
  />
  {g.count} × {g.name}
</strong> · {analysisCategories[g.category]}</li>)}</ul>}<p>Deze aantallen komen alleen van jouw telmarkeringen, niet uit automatische symboolherkenning of tekstvermeldingen.</p></section>
  <section className="card plan-export"><h2>4. Exporteer je analyse</h2><p>Het analysebestand bevat de geselecteerde tekstbevindingen, jouw metingen, telmarkeringen en bronpagina’s. Het oorspronkelijke PDF-bestand wordt niet meegestuurd. Bewaar dat apart; heropenen van een analysesessie is nog niet voorzien.</p><div className="plan-actions"><button className="button-primary" onClick={()=>download('plananalyse.json',{version:1,kind:'cohvera-plan-analysis',source:fileName,createdAt:new Date().toISOString(),categories,findings:visible,measurements,marks,calibrations,limitations:['Geen externe AI of OCR','Geen automatische symbooltelling','U-waarden en hoogtes niet afgeleid uit geometrie','Niet-gecontroleerde bevindingen zijn voorstellen']})}>Analyse downloaden (JSON)</button><button className="secondary-button" disabled={!measurements.some(m=>m.reviewed&&m.name.trim())} onClick={()=>{try{download('warmteverlies-uit-plan.json',measurementHeatDraft(fileName,measurements.filter(m=>m.name.trim())));}catch(e){setError((e as Error).message);}}}>Warmteverliesvoorbereiding downloaden</button></div><p className="muted">Open de warmteverliesvoorbereiding via ‘Bestand openen’ in de calculator. Hoogtes blijven ontbrekend en er worden geen U-waarden of ventilatiedebieten verzonnen. Er verschijnt pas een rekenresultaat nadat je het dossier aanvult.</p></section>
  </>}
 </main>;
}
