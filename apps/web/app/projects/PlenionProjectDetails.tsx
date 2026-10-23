import {SourceDates} from "./SourceDates";
import type { Project } from "../../lib/projects";

const flag = (value: boolean | null | undefined) => value === true ? "Ja (true)" : value === false ? "Nee (false)" : "Niet ontvangen";
const text = (value: string | null | undefined) => value == null ? "Niet ontvangen" : value.trim() || "Leeg in de bron";

function ExtraFields({values}:{values?:Record<string,string|null>|null}){
 if(!values||!Object.keys(values).length)return null;
 return <details><summary>Extra HFSQL-bronvelden ({Object.keys(values).length})</summary><dl>{Object.entries(values).map(([key,value])=><div key={key}><dt><code>{key}</code></dt><dd style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{text(value)}</dd></div>)}</dl></details>;
}
export function PlenionProjectDetails({ project }: { project: Project }) {
  const fields = [
    ["Projectnummer", "number", text(project.externalId)],
    ["Klant", "customer", text(project.customer)],
    ["Omschrijving", "description", text(project.sourceDescription)],
    ["Originele status", "status_label", text(project.sourceStatusLabel)],
    ["Administratief afgesloten (Uit WIP)", "UITWIP", flag(project.sourceIsClosed)],
    ["In uitvoering volgens portaalprofiel", "active / is_active", flag(project.sourceIsActive)],
    ["Planning uit Plenion", "planned", project.sourcePlannedAt ? new Date(project.sourcePlannedAt).toLocaleDateString("nl-BE", {timeZone:"UTC"}) : "Geen bronplanning opgeslagen"],
    ["Bronrecord", "source_id", text(project.sourceRecordId)],
    ["Bronstand van dit project", "source_observed_at", project.sourceSeenAt ? new Date(project.sourceSeenAt).toLocaleString("nl-BE") : "Niet ontvangen"],
  ];

  return (
    <>
    {Array.isArray(project.sourceDocuments) && project.sourceDocuments.length > 0 && <details className="projects-plenion-details">
      <summary>Offertes, facturen en andere records ({project.sourceDocuments.length})</summary>
      <p>Elk onderdeel heeft een eigen status en Uit WIP-vinkje. Een factuur kan ook een voorschot of deelfactuur zijn. Documentsoortcodes komen uit Plenion en zijn niet automatisch als factuur geïnterpreteerd.</p>
      <ul>{project.sourceDocuments.map(document => <li key={document.sourceId}>
        <strong>{document.number} · {document.name?.trim() || document.description?.trim() || "Naam niet ontvangen"}</strong>
        {document.name?.trim() && document.description?.trim() && document.description.trim() !== document.name.trim() && <span className="projects-customer">{document.description}</span>}
        <p>{document.statusLabel || "Status onbekend"} · Soort {document.documentType || "onbekend"} · Versie {document.versionNumber || "onbekend"}{document.revisionClosed ? " · Historische versie" : ""}{document.closed ? " · Administratief afgesloten (Uit WIP aan)" : " · Niet administratief afgesloten (Uit WIP uit)"}</p>
        <SourceDates dates={document.dates} /><ExtraFields values={document.extraFields}/>
      </li>)}</ul>
    </details>}
    <details className="projects-plenion-details">
      <summary>Gegevens uit Plenion<span className="projects-visually-hidden"> voor {project.name}</span></summary>
      <p>De laatst opgeslagen brongegevens in Cohvera. Dit is geen rechtstreekse live-opvraag bij Plenion.</p>
      <SourceDates dates={project.sourceDates} /><ExtraFields values={project.sourceExtraFields}/>
      <dl>
        {fields.map(([label, key, value]) => (
          <div key={key}><dt>{label} <code>{key}</code></dt><dd>{value}</dd></div>
        ))}
      </dl>
      <p>Hoofdprojecten tonen de huidige versie. Gekoppelde records kunnen ook historische versies bevatten. De lokale verantwoordelijke beheer je in Cohvera; extra bronvelden veranderen die niet. ‘Niet ontvangen’ betekent niet ‘nee’.</p>
    </details>
    </>
  );
}
