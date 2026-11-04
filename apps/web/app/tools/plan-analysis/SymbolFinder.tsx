"use client";
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {boxFromPoints,type Box,type Match} from '../../../lib/symbol-match';
import type {Point} from '../../../lib/plan-analysis';
type Proposal=Match&{id:number;selected:boolean};
export default function SymbolFinder({canvas,view,onAccept}:{canvas:HTMLCanvasElement;view:{width:number;height:number};onAccept:(matches:Match[],name:string)=>void}){
 const [step,setStep]=useState<'template'|'region'|'review'>('template'),[points,setPoints]=useState<Point[]>([]),[template,setTemplate]=useState<Box|null>(null),[region,setRegion]=useState<Box|null>(null),[name,setName]=useState('Stopcontact'),[threshold,setThreshold]=useState(.88),[rotations,setRotations]=useState(true),[proposals,setProposals]=useState<Proposal[]>([]),[running,setRunning]=useState(false),[progress,setProgress]=useState(0),[error,setError]=useState(''),[done,setDone]=useState(false);
 const worker=useRef<Worker|null>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null),preview=useRef<HTMLCanvasElement>(null);
 const stop=()=>{worker.current?.terminate();worker.current=null;if(timer.current)clearTimeout(timer.current);setRunning(false);};
 useEffect(()=>()=>{worker.current?.terminate();if(timer.current)clearTimeout(timer.current);},[]);
 const sx=canvas.width/view.width,sy=canvas.height/view.height;
 const pixels=(b:Box)=>({x:b.x*sx,y:b.y*sy,width:b.width*sx,height:b.height*sy});
 useEffect(()=>{if(!template||!preview.current)return;const p=pixels(template),c=preview.current;c.width=Math.max(1,Math.round(p.width));c.height=Math.max(1,Math.round(p.height));c.getContext('2d')?.drawImage(canvas,p.x,p.y,p.width,p.height,0,0,c.width,c.height);},[template,canvas]);
 function pick(point:Point){if(running||step==='review')return;const next=points.length===1?[points[0],point]:[point];setPoints(next);if(next.length===2){const b=boxFromPoints(next[0],next[1]);if(b.width*sx<6||b.height*sy<6){setError('Selecteer een groter kader.');setPoints([]);return;}if(step==='template'){if(b.width*sx>160||b.height*sy>160){setError('Selecteer alleen het symbool, zonder beschrijving. Het kader is te groot.');setPoints([]);return;}setTemplate(b);setRegion(null);setStep('region');}else{setRegion(b);setStep('review');}setPoints([]);setProposals([]);setDone(false);setError('');}}
 function search(){if(!template||!region||!name.trim())return;stop();setRunning(true);setProgress(0);setError('');setProposals([]);setDone(false);
  try{const data=canvas.getContext('2d')!.getImageData(0,0,canvas.width,canvas.height);const w=new Worker(new URL('../../../lib/symbol-match.worker.ts',import.meta.url));worker.current=w;
   timer.current=setTimeout(()=>{stop();setError('De zoekopdracht duurde te lang. Kies een kleiner zoekgebied.');},60000);
   w.onmessage=e=>{if(e.data.progress!==undefined)setProgress(e.data.progress);if(e.data.error){stop();setError(e.data.error);}if(e.data.matches){stop();setDone(true);setProposals((e.data.matches as Match[]).map((m,id)=>({...m,x:m.x/sx,y:m.y/sy,width:m.width/sx,height:m.height/sy,id,selected:true})));}};
   w.onerror=()=>{stop();setError('Lokale herkenning kon niet starten. Herlaad de pagina of probeer een kleiner plan.');};
   w.postMessage({width:canvas.width,height:canvas.height,pixels:data.data,template:pixels(template),region:pixels(region),threshold,rotations},[data.data.buffer]);
  }catch{stop();setError('De planpixels konden niet worden gelezen.');}
 }
 const rectangle=(b:Box,color:string)=><rect x={b.x} y={b.y} width={b.width} height={b.height} fill="none" stroke={color} strokeWidth={2} strokeDasharray="5 3"/>;
 return <><h2>Symbolen automatisch zoeken</h2><p>Kies een voorbeeld van een stopcontact, schakelaar of lichtpunt. De herkenning zoekt vergelijkbare vormen op <strong>deze pagina</strong>, met kleine schaalverschillen en eventueel kwartslagen. Scores zijn gelijkenis, geen zekerheid.</p>
 <label>Naam symbool<input maxLength={100} value={name} disabled={running} onChange={e=>setName(e.target.value)}/></label>
 <p><strong>{step==='template'?'1. Klik twee tegenoverliggende hoeken rond één voorbeeldsymbool.':step==='region'?'2. Klik twee hoeken rond het te doorzoeken plangebied. Laat de legenda buiten dit kader.':'3. Zoek en controleer de voorgestelde markeringen.'}</strong></p>
 <p>Neem wat witte marge mee, maar geen tekst. Gebruik zo mogelijk een vrijstaand symbool uit de legenda. Zoom in voor nauwkeurig aanklikken.</p>
 {points.length===1&&<p>Eerste hoek gekozen; klik de tweede hoek.</p>}
 {template&&<div>Gekozen voorbeeld<canvas ref={preview} className="symbol-preview"/></div>}
 <div className="plan-actions"><button className="secondary-button" disabled={running} onClick={()=>{setStep('template');setPoints([]);setTemplate(null);setRegion(null);setProposals([]);setDone(false);}}>Nieuw voorbeeld</button><button className="secondary-button" disabled={running||!template} onClick={()=>{setStep('region');setPoints([]);setRegion(null);setProposals([]);setDone(false);}}>Zoekgebied kiezen</button></div>
 <label>Minimale gelijkenis: {Math.round(threshold*100)}%<input type="range" min="70" max="98" step="1" value={threshold*100} disabled={running} onChange={e=>{setThreshold(Number(e.target.value)/100);setProposals([]);setDone(false);}}/></label>
 <label><input type="checkbox" checked={rotations} disabled={running} onChange={e=>{setRotations(e.target.checked);setProposals([]);setDone(false);}}/> Ook 90°, 180° en 270°</label>
 <button className="button-primary" disabled={running||!template||!region||!name.trim()} onClick={search}>Vergelijkbare symbolen zoeken</button>
 {running&&<><p role="status">Lokaal zoeken… {progress}%</p><button className="secondary-button" onClick={()=>{stop();setError('Zoeken geannuleerd.');}}>Annuleren</button></>}{error&&<p role="alert">{error}</p>}
 {done&&<><p role="status">{proposals.length} voorstellen. {proposals.filter(p=>p.selected).length} geselecteerd. {proposals.length===500?'Limiet bereikt: verklein het zoekgebied.':''}</p><p>Klik een cirkel of een regel om een fout voorstel uit te zetten. Controleer vooral enkel/dubbel en overlappende lijnen. Gemiste symbolen kun je daarna handmatig toevoegen.</p><button className="secondary-button" onClick={()=>setProposals(proposals.map(p=>({...p,selected:false})))}>Alles uitvinken</button><div className="symbol-proposals">{proposals.map(p=><label key={p.id}><input type="checkbox" checked={p.selected} onChange={e=>setProposals(proposals.map(x=>x.id===p.id?{...x,selected:e.target.checked}:x))}/>#{p.id+1} · gelijkenis {Math.round(p.score*100)}%</label>)}</div><button className="button-primary" disabled={!proposals.some(p=>p.selected)} onClick={()=>{onAccept(proposals.filter(p=>p.selected),name.trim());setProposals([]);setDone(false);}}>Geselecteerde voorstellen bevestigen</button></>}
 {canvas.parentElement&&createPortal(<svg className="symbol-overlay" viewBox={`0 0 ${view.width} ${view.height}`} aria-label="Selecteer voorbeeld en zoekgebied" onClick={e=>{const rect=e.currentTarget.getBoundingClientRect();pick({x:(e.clientX-rect.left)/rect.width*view.width,y:(e.clientY-rect.top)/rect.height*view.height});}}>
 {template&&rectangle(template,'#2563eb')}{region&&rectangle(region,'#168350')}{points.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r={4} fill="#2563eb"/>)}
 {proposals.map(p=><g key={p.id} onClick={e=>{e.stopPropagation();setProposals(proposals.map(x=>x.id===p.id?{...x,selected:!x.selected}:x));}} style={{cursor:'pointer'}}><circle cx={p.x} cy={p.y} r={Math.max(5,Math.min(p.width,p.height)/2)} fill={p.selected?'#f59e0b66':'#ffffff66'} stroke={p.selected?'#b45309':'#777'} strokeWidth={1.5}/><text x={p.x+5} y={p.y-5} fontSize={8} fill="#7a3600">{p.id+1}</text></g>)}
 </svg>,canvas.parentElement)}
 </>;
}
