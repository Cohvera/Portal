// Legacy receipt/selection notices describe Portal visibility, not changes in Plenion.
export const importVisibilityMessages = [
 "Nieuw hoofdproject ontvangen",
 "Hoofdproject opnieuw ontvangen",
 "Hoofdproject niet meer in readerselectie; afsluiting niet bevestigd",
 "Hoofdproject niet meer aangeleverd; afsluiting niet bevestigd",
];
type Document = {sourceId:string;number:string;name:string;statusLabel:string;statusCode?:string;closed:boolean;dates?:unknown};
type Snapshot = {sourceStatusLabel:string|null;sourceIsClosed:boolean|null;sourceDocuments?:unknown;sourceDates?:unknown};
function datesKey(value:unknown) {
  if(!value || typeof value!=="object" || Array.isArray(value))return "";
  return JSON.stringify(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)));
}
function statusCode(code:string|undefined,label:string|null){
 return code?.trim().padStart(2,'0') || /^(\d{1,2})(?:\s|$)/.exec(label??'')?.[1].padStart(2,'0');
}
function documentStatusChange(title:string,before:string,after:string,beforeCode?:string,afterCode?:string){
 const from=statusCode(beforeCode,before),to=statusCode(afterCode,after);
 const outcome=from==='02'&&to==='07'?'Offerte goedgekeurd':from==='02'&&to==='14'?'Offerte verloren':null;
 return outcome?`${outcome}: ${title} (${from} → ${to})`:`${title}: ${before || 'onbekend'} → ${after || 'onbekend'}`;
}
// Existing events keep their original observation date; only their display text changes.
export function displayProjectUpdate(message:string){
 const match=/^(.+): (0?2\s*-.*?) → ((?:0?7|14)\s*-.*)$/.exec(message);
 if(/^Projectstatus: .* → 0?4\s*-/.test(message))return `Project gaat niet door (${message.slice('Projectstatus: '.length)})`;
 if(!match||match[1]==='Projectstatus')return message;
 return documentStatusChange(match[1],match[2],match[3]);
}
export function projectChanges(old:Snapshot, current:Snapshot):string[] {
  const changes:string[]=[];
  if(old.sourceStatusLabel!==current.sourceStatusLabel) changes.push(`Projectstatus: ${old.sourceStatusLabel || "onbekend"} → ${current.sourceStatusLabel || "onbekend"}`);
  if(old.sourceIsClosed!==current.sourceIsClosed) changes.push(current.sourceIsClosed ? "Hoofdproject administratief afgesloten (Uit WIP aan)" : "Hoofdproject administratief heropend (Uit WIP uit)");
  if(datesKey(old.sourceDates)!==datesKey(current.sourceDates)) changes.push("Brondata of factuurreferentie van het hoofdproject gewijzigd");
  const before=new Map((Array.isArray(old.sourceDocuments)?old.sourceDocuments:[]).map((d:Document)=>[d.sourceId,d]));
  const after=Array.isArray(current.sourceDocuments)?current.sourceDocuments as Document[]:[];
  for(const d of after){
    const prev=before.get(d.sourceId);
    const title=`${d.number} · ${d.name || "Naam niet ontvangen"}`;
    if(!prev) changes.push(`Nieuw gekoppeld record: ${title} (${d.statusLabel || "status onbekend"})`);
    else {
      if(prev.statusLabel!==d.statusLabel || statusCode(prev.statusCode,prev.statusLabel)!==statusCode(d.statusCode,d.statusLabel)) changes.push(documentStatusChange(title,prev.statusLabel,d.statusLabel,prev.statusCode,d.statusCode));
      if(prev.closed!==d.closed) changes.push(`${title}: Uit WIP ${d.closed?"aan":"uit"}`);
      if(datesKey(prev.dates)!==datesKey(d.dates)) changes.push(`${title}: brondata of factuurreferentie gewijzigd`);
    }
    before.delete(d.sourceId);
  }
  for(const d of before.values()) changes.push(`Record niet meer aangeleverd: ${d.number} · ${d.name}`);
  return changes;
}
