import {projectDate, projectDateLabel, projectScope, projectStatus, type OverviewProject} from "./project-overview";

function cell(value: string) {
  // Spreadsheet applications must treat imported source text as text, not formulas.
  const safe = /^[\s]*[=+@-]/.test(value) || /^[\t\r\n]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function projectsCsv(projects: OverviewProject[], company: string): string {
  const rows = [["Bedrijf", "Projectnummer", "Project", "Klant", "Status", "Administratief afgesloten (Uit WIP voor Plenion)", "Verantwoordelijke", "Bron", "Planning", "Deadline", "Oplevering (bron)", "Uit WIP-datum", "Projectdatum", "Soort projectdatum"],
    ...projects.map(p => [p.companyName || company, p.externalId || "", p.name, p.customer, projectStatus(p),
      projectScope(p) === "unknown" ? "Nog niet bevestigd" : projectScope(p) === "closed" ? "Ja" : "Nee",
      p.owner, p.externalSource === "PLENION" ? "Plenion" : p.externalSource || "Portaal", p.sourceDates?.planned_date || "", p.externalSource === "PLENION" ? p.sourceDates?.deadline || "" : p.dueDate?.slice(0,10) || "", p.sourceDates?.delivery_date || "", p.sourceDates?.out_of_wip_date || "", projectDate(p) || "", projectDateLabel(p)]),
  ];
  return '\uFEFF' + rows.map(row => row.map(cell).join(';')).join('\r\n') + '\r\n';
}
