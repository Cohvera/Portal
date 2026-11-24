"use client";
import {useEffect,useState} from 'react';
import {request} from './projects';
export type ReaderDiagnostic={step:string;reason?:string;durationMs?:number;errno?:number;sqlState?:string;nativeCode?:number;journalUnit?:string};
export type ReaderEvent={id:string;runId:string;phase:string;observedAt:string;receivedAt:string;readerVersion:string;recordCount:number|null;httpStatus:number|null;diagnostic?:ReaderDiagnostic|null};
export type ProjectSelection={statusCodes:string[];statusIds?:string[];outOfWip:'any'|'on'|'off';relationshipType?:'any'|'prospect'|'customer'};
export type ReaderConfiguration={syncRequestId:string|null;syncAcknowledgedId:string|null;syncRequestedAt:string|null;commandPollAt:string|null;projectFilter:ProjectSelection|null;availableStatuses:{id?:string;code:string;label:string}[]|null;revision:number;appliedRevision:number|null;selectedColumns:string[];schemaColumns:string[];schemaReportedAt:string|null;readerVersion:string|null};
export type Monitor={configuration:ReaderConfiguration|null;extraColumns:{source:string;label:string;group:string}[];state:string;lastContactAt:string|null;lastImport:{receivedAt:string;sourceObservedAt:string;projectCount:number;contractVersion:number;sourceKind:string}|null;events:ReaderEvent[];expectedIntervalMinutes:number;columns:{source:string;field:string}[];columnSelectionEnabled:boolean;exportSchemaVersion:number};
export const stateLabels:Record<string,string>={unknown:'Status nog niet beschikbaar',stale:'Geen recente melding',error:'Laatste poging mislukt',interrupted:'Afronding niet bevestigd',running:'Synchronisatie bezig',healthy:'Laatste sync geslaagd'};
export const phaseLabels:Record<string,string>={started:'Synchronisatie gestart',read_ok:'HFSQL uitgelezen; export gemaakt',configuration_failed:'Configuratie ophalen of controleren mislukt',read_failed:'Uitlezen of export mislukt',upload_failed:'Upload naar Portal mislukt',success:'Upload bevestigd door Portal',command_poll_failed:'Sync-aanvragen ophalen mislukt'};
export const stepLabels:Record<string,string> = {
 local_configuration:'Lokale configuratie',hfsql_schema:'HFSQL-tabelstructuur lezen',
 hfsql_statuses:'HFSQL-statussen lezen',portal_configuration:'Portal-configuratie ophalen',
 configuration_validation:'Projectselectie controleren',hfsql_export:'HFSQL-projecten uitlezen',
 export_file:'Lokaal exportbestand lezen',portal_upload:'Projecten naar Portal uploaden',
 portal_accepted:'Portal heeft de import aanvaard',command_poll:'Sync-aanvragen ophalen',journal_sync:'Readerdienst op de Qbox',
};
const reasons:Record<string,string> = {
 docker_daemon_unreachable:'De Qbox kan Docker niet bereiken.',docker_image_missing:'De HFSQL-reader-image ontbreekt op de Qbox.',
 incomplete_status_catalog:'HFSQL gaf geen volledige statuslijst terug.',invalid_status_catalog:'De HFSQL-statuslijst bevat ontbrekende of dubbele ID’s of lege omschrijvingen.',
 hfsql_reader_timeout:'De HFSQL-reader heeft zijn tijdslimiet overschreden.',database_missing:'Er is geen HFSQL-database ingesteld.',
 export_row_limit:'De export overschrijdt de recordlimiet.',export_size_limit:'De export overschrijdt de bestandsgrootte.',
 invalid_project_flag:'Een project bevat een ongeldige vinkjeswaarde.',unknown_column:'Een geselecteerde HFSQL-kolom is onbekend.',
 status_not_in_hfsql:'Een in Portal geselecteerde status ontbreekt in HFSQL.',gaierror:'De Qbox kan de servernaam niet opzoeken.',
 TimeoutError:'De server antwoordde niet op tijd.',ConnectionRefusedError:'De server weigert de TCP-verbinding.',
 ConnectionResetError:'De server heeft de verbinding verbroken.',SSLError:'De HTTPS-verbinding is mislukt tijdens TLS.',
 SSLCertVerificationError:'De Qbox kan het TLS-certificaat van Portal niet verifiëren.',
 PermissionError:'De reader heeft onvoldoende bestandsrechten op de Qbox.',FileNotFoundError:'Een vereist readerbestand ontbreekt op de Qbox.',
 JSONDecodeError:'De reader kreeg ongeldige JSON terug of kon een JSON-bestand niet lezen.',TimeoutExpired:'De stap is gestopt na het overschrijden van de tijdslimiet.',
};
const errnoReasons:Record<number,string> = {
 13:'De reader heeft onvoldoende rechten om deze stap uit te voeren.',101:'Het netwerk is onbereikbaar.',
 110:'De netwerkverbinding antwoordde niet op tijd.',111:'De server weigert de TCP-verbinding.',
 113:'De doelhost is onbereikbaar vanaf de Qbox.',
};
export const failurePhases = new Set(['configuration_failed','read_failed','upload_failed','command_poll_failed','journal_error']);
export const linkLabels = {commands:'Portal → Qbox', hfsql:'Qbox → HFSQL', portal:'Qbox → Portal', local:'Op de Qbox'} as const;

export function eventLink(event: ReaderEvent): keyof typeof linkLabels {
 const step = event.diagnostic?.step;
 if (step === 'command_poll' || event.phase === 'command_poll_failed') return 'commands';
 if (step?.startsWith('hfsql_') || event.phase === 'read_ok' || (event.phase === 'read_failed' && !step)) return 'hfsql';
 if (step?.startsWith('portal_') || event.phase === 'upload_failed' || event.phase === 'success') return 'portal';
 return 'local';
}

export function eventExplanation(event: ReaderEvent) {
 const detail = event.diagnostic;
 if (detail?.reason && reasons[detail.reason]) return reasons[detail.reason];
 if (detail?.errno && errnoReasons[detail.errno]) return errnoReasons[detail.errno];
 if (detail?.sqlState === '08001') return 'De HFSQL-driver kon geen sessie openen. Controleer de server, database en aanmelding.';
 if (detail?.sqlState === '28000') return 'HFSQL heeft de aanmelding geweigerd.';
 if (detail?.sqlState) return 'De HFSQL-driver meldt een fout tijdens deze stap.';
 if (event.httpStatus === 401 || event.httpStatus === 403) return 'Portal weigert de aanvraag. Controleer de bedrijfs-API-sleutel en toegang.';
 if (event.httpStatus === 400) return 'Portal heeft de aangeleverde gegevens afgewezen. Zoek het poging-ID op in de API-log.';
 if (event.httpStatus === 409) return 'De aanvraag botst met de opgeslagen configuratie of laatste import. Zoek het poging-ID op in de API-log.';
 if (event.httpStatus && event.httpStatus >= 500) return 'Portal geeft een serverfout. Zoek het poging-ID op in de API-log.';
 return failurePhases.has(event.phase) ? 'Bekijk het Qbox-journaal voor extra informatie over deze poging.' : '';
}

export function connectionDiagnostics(data: Monitor, now = Date.now()) {
 const pollAt = data.configuration?.commandPollAt ?? null;
 const pollFailure = data.events.find(event => event.phase === 'command_poll_failed');
 const pollFailed = !!pollFailure && (!pollAt || Date.parse(pollFailure.observedAt) > Date.parse(pollAt));
 const pollState = pollFailed ? 'error' : !pollAt ? 'unknown' : now - Date.parse(pollAt) > 120000 ? 'stale' : 'healthy';
 const upload = data.events.find(event => event.phase === 'upload_failed' || event.phase === 'success');
 const hfsql = data.events.find(event => eventLink(event) === 'hfsql' || event.phase === 'success' || event.phase === 'upload_failed'
  || ['portal_configuration','configuration_validation','export_file'].includes(event.diagnostic?.step ?? ''));
 const hfsqlFailed = !!hfsql && eventLink(hfsql) === 'hfsql' && failurePhases.has(hfsql.phase);
 const hfsqlState = !hfsql ? 'unknown' : now - Date.parse(hfsql.observedAt) > 35 * 60000 ? 'stale' : hfsqlFailed ? 'error' : 'healthy';
 return {pollAt,pollFailure,pollState,upload,hfsql,hfsqlFailed,hfsqlState} as const;
}
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
