// Legacy receipt/selection notices describe Portal visibility, not changes in Plenion.
export const importVisibilityMessages = [
 "Nieuw hoofdproject ontvangen",
 "Hoofdproject opnieuw ontvangen",
 "Hoofdproject niet meer in readerselectie; afsluiting niet bevestigd",
 "Hoofdproject niet meer aangeleverd; afsluiting niet bevestigd",
];
type Document = {sourceId:string;number:string;name:string;statusLabel:string;closed:boolean;dates?:unknown};
type Snapshot = {sourceStatusLabel:string|null;sourceIsClosed:boolean|null;sourceDocuments?:unknown;sourceDates?:unknown};
function datesKey(value:unknown) {
  if(!value || typeof value!=="object" || Array.isArray(value))return "";
  return JSON.stringify(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)));
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
      if(prev.statusLabel!==d.statusLabel) changes.push(`${title}: ${prev.statusLabel || "onbekend"} → ${d.statusLabel || "onbekend"}`);
      if(prev.closed!==d.closed) changes.push(`${title}: Uit WIP ${d.closed?"aan":"uit"}`);
      if(datesKey(prev.dates)!==datesKey(d.dates)) changes.push(`${title}: brondata of factuurreferentie gewijzigd`);
    }
    before.delete(d.sourceId);
  }
  for(const d of before.values()) changes.push(`Record niet meer aangeleverd: ${d.number} · ${d.name}`);
  return changes;
}
