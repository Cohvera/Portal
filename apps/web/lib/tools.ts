export type ToolKpi = { label: string; value: string; note?: string };
export type ToolModule = {
  slug: string;
  name: string;
  category: string;
  description: string;
  status: "MVP" | "Beta" | "Planned";
  actions: string[];
  workflow: string[];
};

export const tools: ToolModule[] = [
  {
    slug: "ventilation-cloud",
    name: "Ventilatie Cloud",
    category: "Engineering",
    description: "Cloudgebaseerde ventilatieberekeningen, dossieropbouw en opvolging van ontwerp tot oplevering.",
    status: "MVP",
    actions: ["Nieuwe berekening", "Project openen", "Rapport exporteren"],
    workflow: ["Projectgegevens", "Ruimtes & debieten", "Dimensionering", "Controle", "Rapport"]
  },
  {
    slug: "inspections",
    name: "Keuringen",
    category: "Quality & Compliance",
    description: "Centrale planning en opvolging van elektrische keuringen, attesten, opmerkingen en herkeuringen.",
    status: "MVP",
    actions: ["Keuring aanvragen", "Attest registreren", "Herkeuring plannen"],
    workflow: ["Aanvraag", "Planning", "Keuring", "Attest", "Opvolging"]
  },
  {
    slug: "solar-subcontracting",
    name: "Solar Onderaanneming",
    category: "Field Operations",
    description: "Opdrachten naar PV-onderaannemers met planning, materiaalstatus, werfchecklist, foto's en oplevering.",
    status: "MVP",
    actions: ["Opdracht maken", "Onderaannemer toewijzen", "Oplevering controleren"],
    workflow: ["Opdracht", "Toewijzing", "Planning", "Uitvoering", "Oplevering"]
  },
  {
    slug: "charging-workorders",
    name: "Laadpaal Werkbon",
    category: "Field Operations",
    description: "Digitale werkbon voor installatie, interventie en onderhoud van laadpalen met meetwaarden, foto's en handtekening.",
    status: "MVP",
    actions: ["Nieuwe werkbon", "Interventie starten", "Werkbon afsluiten"],
    workflow: ["Klant & locatie", "Toestel", "Uitvoering", "Metingen", "Ondertekening"]
  }
];

export function findTool(slug: string): ToolModule | undefined {
  return tools.find((tool) => tool.slug === slug);
}
