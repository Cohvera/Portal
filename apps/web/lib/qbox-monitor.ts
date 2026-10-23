"use client";
import {useEffect,useState} from 'react';
import {request} from './projects';
export type ReaderEvent={id:string;runId:string;phase:string;observedAt:string;receivedAt:string;readerVersion:string;recordCount:number|null;httpStatus:number|null};
export type ProjectSelection={statusCodes:string[];outOfWip:'any'|'on'|'off'};
export type ReaderConfiguration={syncRequestId:string|null;syncAcknowledgedId:string|null;syncRequestedAt:string|null;commandPollAt:string|null;projectFilter:ProjectSelection|null;availableStatuses:{code:string;label:string}[]|null;revision:number;appliedRevision:number|null;selectedColumns:string[];schemaColumns:string[];schemaReportedAt:string|null;readerVersion:string|null};
export type Monitor={configuration:ReaderConfiguration|null;extraColumns:{source:string;label:string;group:string}[];state:string;lastContactAt:string|null;lastImport:{receivedAt:string;sourceObservedAt:string;projectCount:number;contractVersion:number;sourceKind:string}|null;events:ReaderEvent[];expectedIntervalMinutes:number;columns:{source:string;field:string}[];columnSelectionEnabled:boolean;exportSchemaVersion:number};
export const stateLabels:Record<string,string>={unknown:'Status nog niet beschikbaar',stale:'Geen recente melding',error:'Laatste poging mislukt',interrupted:'Afronding niet bevestigd',running:'Synchronisatie bezig',healthy:'Laatste sync geslaagd'};
export const phaseLabels:Record<string,string>={started:'Synchronisatie gestart',read_ok:'HFSQL uitgelezen; export gemaakt',configuration_failed:'Configuratie ophalen of controleren mislukt',read_failed:'Uitlezen of export mislukt',upload_failed:'Upload naar Portal mislukt',success:'Upload bevestigd door Portal'};
export const monitorTime=(value?:string|null)=>value?new Date(value).toLocaleString('nl-BE'):'Nog niet ontvangen';
export function useQboxMonitor(companyCode:string){
 const [result,setResult]=useState<{code:string;data:Monitor}|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[revision,setRevision]=useState(0);
 useEffect(()=>{
  let stopped=false;let controller:AbortController;let timer:ReturnType<typeof setTimeout>;
  async function load(){
   controller=new AbortController();
   try{const data=await request<Monitor>(`/api/companies/${encodeURIComponent(companyCode)}/middleware/qbox`,{signal:controller.signal});if(!stopped){setResult({code:companyCode,data});setError('');}}
   catch(e){if(!stopped)setError(e instanceof Error?e.message:'Status ophalen mislukt.');}
   finally{if(!stopped){setLoading(false);timer=setTimeout(load,30000);}}
  }
  setLoading(true);setError('');void load();
  return ()=>{stopped=true;controller?.abort();clearTimeout(timer);};
 },[companyCode,revision]);
 return {data:result?.code===companyCode?result.data:null,error,loading,refresh:()=>setRevision(v=>v+1)};
}
