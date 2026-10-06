export type ToolKpi = { label: string; value: string; note?: string };
export type ToolModule = {
  slug: string;
  name: string;
  category: string;
  description: string;
  status: "MVP" | "Beta" | "Planned";
  href?: string;
  actions: string[];
  workflow: string[];
};

export const tools: ToolModule[] = [
  {
    slug: "tv-screen", name: "Tv-scherm", category: "Projectmanagement", href: "/projects/tv",
    description: "Toon projecten, planning, voertuigen en ophalingen op een bedrijfsscherm, afgestemd op je bedrijfsselectie en accountrechten.",
    status: "MVP", actions: ["Bedrijfsoverzicht", "Automatische schermrotatie", "Volledig scherm"],
    workflow: ["Bedrijf kiezen", "Scherm instellen", "Overzicht tonen"]
  },
  {
    slug: "heat-loss", name: "Warmteverliescalculator", category: "Engineering",
    description: "Breng het warmteverlies per ruimte in kaart en bereid de dimensionering van verwarming en warmtepompen voor.",
    status: "Planned", actions: ["Berekening per ruimte", "Overzicht van het gebouw", "Rapport voor het dossier"],
    workflow: ["Gebouw & ontwerpcondities", "Ruimtes & bouwdelen", "Isolatie & ventilatie", "Warmteverlies", "Dimensionering & rapport"]
  },
  {
    slug: "warehouse-manager", name: "Warehouse Manager", category: "Logistiek", href: "http://84.247.132.149:8000/",
    description: "Eén overzicht van materialen, voorraadlocaties en reserveringen voor je projecten en installatieteams.",
    status: "MVP", actions: ["Voorraad per locatie", "Materiaal reserveren", "Ontvangst & uitgifte"],
    workflow: ["Artikel & locatie", "Ontvangst", "Projectreservering", "Picking & uitgifte", "Retour & inventaris"]
  },
  {
    slug: "q-portal", name: "Q-portal", category: "Klant & service", href: "https://my.q-home.be",
    description: "De toegang tot gebouwinformatie, documenten, opleveringen en servicevragen op één centrale plek.",
    status: "MVP", actions: ["Gebouwen & dossiers", "Documenten & opleveringen", "Service & opvolging"],
    workflow: ["Gebouw selecteren", "Dossier raadplegen", "Documenten & oplevering", "Servicevraag", "Opvolging"]
  },
  {
    slug: "project-tasks", name: "Projecttaken", category: "Projectmanagement", href: "/projects",
    description: "Verdeel het werk, volg deadlines op en houd overzicht met een takenbord en een persoonlijke takenlijst.",
    status: "MVP", actions: ["Projecten bekijken", "Taken toewijzen", "Voortgang opvolgen"],
    workflow: ["Project", "Taken", "Toewijzing", "Uitvoering", "Afronding"]
  },
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
    href: "/tools/inspections",
    category: "Quality & Compliance",
    description: "Beheer keuringsdossiers, planning, rapporten en periodieke opvolging binnen Cohvera.",
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

export function isExternalTool(tool: ToolModule): boolean {
  return /^https?:\/\//i.test(tool.href ?? "");
}

export function toolAvailability(tool: ToolModule) {
  if (isExternalTool(tool)) return { label: "Beschikbaar", className: "available", detail: "Opent in een nieuw tabblad" };
  if (tool.href) return { label: "Beschikbaar", className: "available", detail: "Klaar om te gebruiken" };
  if (tool.status === "Planned") return { label: "Binnenkort", className: "planned", detail: tool.slug === "q-portal" ? "Koppeling nog te configureren" : "Module in voorbereiding" };
  return { label: "Demo", className: "demo", detail: "Voorbeeld van de workflow" };
}
