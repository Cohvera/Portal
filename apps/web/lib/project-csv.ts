import {projectScope, projectStatus, type OverviewProject} from "./project-overview";

function cell(value: string) {
  // Spreadsheet applications must treat imported source text as text, not formulas.
  const safe = /^[\s]*[=+@-]/.test(value) || /^[\t\r\n]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function projectsCsv(projects: OverviewProject[], company: string): string {
  const rows = [["Bedrijf", "Projectnummer", "Project", "Klant", "Status", "Afgesloten", "Verantwoordelijke", "Bron"],
    ...projects.map(p => [company, p.externalId || "", p.name, p.customer, projectStatus(p),
      projectScope(p) === "unknown" ? "Nog niet bevestigd" : projectScope(p) === "closed" ? "Ja" : "Nee",
      p.owner, p.externalSource === "PLENION" ? "Plenion" : p.externalSource || "Portaal"]),
  ];
  return '\uFEFF' + rows.map(row => row.map(cell).join(';')).join('\r\n') + '\r\n';
}
