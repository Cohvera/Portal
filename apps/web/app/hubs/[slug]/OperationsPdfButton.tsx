"use client";
import {useEffect,useRef,useState} from 'react';
import type {OperationsReport} from '../../../lib/operations-pdf';
export function OperationsPdfButton({report,disabled}:{report:OperationsReport;disabled:boolean}){
 const dialog=useRef<HTMLDialogElement>(null),alive=useRef(true);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[preview,setPreview]=useState<{url:string;filename:string}|null>(null);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>{if(!preview)return;dialog.current?.showModal();return()=>URL.revokeObjectURL(preview.url);},[preview]);
 function close(){dialog.current?.close();setPreview(null);}
 async function generate(){
  setBusy(true);setError('');
  try{
   const {createOperationsPdf,loadReportFonts}=await import('../../../lib/operations-pdf');
   const pdf=createOperationsPdf(report,await loadReportFonts());
   if(!alive.current)return;
   const filename=`cohvera-${report.title.toLowerCase().replace(/[^a-z0-9]+/g,'-')}-${new Date().toLocaleDateString('sv-SE',{timeZone:'Europe/Brussels'})}.pdf`;
   setPreview({url:URL.createObjectURL(pdf.output('blob')),filename});
  }catch(e){if(alive.current)setError(e instanceof Error?e.message:'PDF maken mislukt.');}
  finally{if(alive.current)setBusy(false);}
 }
 return <>
  <button type="button" className="secondary-button" disabled={disabled||busy} onClick={()=>void generate()}>{busy?'PDF maken…':'PDF bekijken / exporteren'}</button>
  {error&&<p role="alert">{error}</p>}
  <dialog ref={dialog} className="operations-pdf-dialog" onCancel={close} aria-label="PDF-voorbeeld">
   <header><h2>PDF-voorbeeld</h2><div>{preview&&<a className="secondary-button" href={preview.url} download={preview.filename}>PDF downloaden</a>}<button type="button" className="secondary-button" onClick={close}>Sluiten</button></div></header>
   {preview&&<><p>Toont je selectie op het moment van exporteren. <a href={preview.url} target="_blank" rel="noopener noreferrer">Open PDF in een nieuw tabblad</a> als het voorbeeld niet zichtbaar is.</p><iframe src={preview.url} title="Projectrapport als PDF"/></>}
  </dialog>
 </>;
}
