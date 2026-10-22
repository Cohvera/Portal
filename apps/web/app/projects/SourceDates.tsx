import type {SourceDates as Dates} from "../../lib/projects";
const labels:Record<string,string>={
 created_date:"Aanmaakdatum (DatCre)",document_date:"Documentdatum (CDATUM)",
 planned_date:"Planning (DatumPlanning)",deadline:"Deadline",delivery_date:"Oplevering (Oplevering)",
 status_date:"Statusdatum (StatDat)",out_of_wip_date:"Uit WIP-datum (DATUMUITWIP)",sold_date:"Verkoopdatum (DatumVerkocht)",
 invoice_number:"Factuurreferentie (FAK_FakNr)",invoice_date:"Factuurdatumveld (FAK_CDatum)",invoice_end_date:"Factuurdatumveld (FAK_AfDatum)",
};
export function SourceDates({dates}:{dates?:Dates|null}){
 if(!dates) return <p className="muted">Datumvelden nog niet ontvangen. Hiervoor is readerexport v3 nodig.</p>;
 const entries=Object.entries(labels).filter(([key])=>dates[key]);
 if(!entries.length)return <p className="muted">Geen datumvelden of factuurreferentie ingevuld in deze bronexport.</p>;
 return <details><summary>Datums en factuurreferentie ({entries.length})</summary>
 <p className="muted">Bronwaarden uit Plenion. Aanmaak en planning bewijzen geen werkelijke startdatum. Oplevering en factuurdatumvelden zijn nog niet als werkelijke afsluitdatum bevestigd.</p>
 <dl>{entries.map(([key,label])=><div key={key}><dt>{label}</dt><dd>{key==="invoice_number"?dates[key]:new Date(`${dates[key]}T00:00:00Z`).toLocaleDateString("nl-BE",{timeZone:"UTC"})}</dd></div>)}</dl></details>;
}
