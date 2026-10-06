import type { Project } from "../../lib/projects";

const flag = (value: boolean | null | undefined) => value === true ? "Ja (true)" : value === false ? "Nee (false)" : "Niet ontvangen";
const text = (value: string | null | undefined) => value == null ? "Niet ontvangen" : value.trim() || "Leeg in de bron";

export function PlenionProjectDetails({ project }: { project: Project }) {
  const fields = [
    ["Projectnummer", "number", text(project.externalId)],
    ["Klant", "customer", text(project.customer)],
    ["Omschrijving", "description", text(project.sourceDescription)],
    ["Originele status", "status_label", text(project.sourceStatusLabel)],
    ["Afgesloten", "closed / is_closed", flag(project.sourceIsClosed)],
    ["Actief", "active / is_active", flag(project.sourceIsActive)],
    ["Planning uit Plenion", "planned", project.sourcePlannedAt ? new Date(project.sourcePlannedAt).toLocaleDateString("nl-BE", {timeZone:"UTC"}) : "Geen bronplanning opgeslagen"],
    ["Bronrecord", "source_id", text(project.sourceRecordId)],
    ["Bronstand van dit project", "source_observed_at", project.sourceSeenAt ? new Date(project.sourceSeenAt).toLocaleString("nl-BE") : "Niet ontvangen"],
  ];

  return (
    <details className="projects-plenion-details">
      <summary>Gegevens uit Plenion<span className="projects-visually-hidden"> voor {project.name}</span></summary>
      <p>De laatst opgeslagen brongegevens in Cohvera. Dit is geen rechtstreekse live-opvraag bij Plenion.</p>
      <dl>
        {fields.map(([label, key, value]) => (
          <div key={key}><dt>{label} <code>{key}</code></dt><dd>{value}</dd></div>
        ))}
      </dl>
      <p>De connector accepteert alleen huidige projectversies (is_current = true). Een verantwoordelijke wordt niet meegestuurd; die beheer je in Cohvera. ‘Niet ontvangen’ betekent niet ‘nee’.</p>
    </details>
  );
}
