export type HubSlug =
  | "strategy"
  | "process"
  | "digital"
  | "operations"
  | "performance"
  | "improvement"
  | "innovation";

export type HubCard = {
  title: string;
  description: string;
  status: "active" | "planned" | "attention";
  metric?: string;
  href?: string;
};

export type HubDefinition = {
  slug: HubSlug;
  name: string;
  shortName: string;
  tagline: string;
  purpose: string;
  cards: HubCard[];
};

export const coefHubs: HubDefinition[] = [
  {
    slug: "strategy",
    name: "Strategy Hub",
    shortName: "Strategy",
    tagline: "Van groepsambitie naar concrete prioriteiten.",
    purpose: "Brengt visie, strategische thema's, jaarobjectieven en ownership samen over Cohvera en de business units.",
    cards: [
      { title: "Strategische thema's", description: "Groepsprioriteiten en belangrijkste initiatieven.", status: "active", metric: "6 thema's" },
      { title: "Doelstellingen", description: "Jaar- en kwartaaldoelen met eigenaar en voortgang.", status: "planned", metric: "Q4" },
      { title: "Portfolio", description: "Transformatieprogramma's, investeringen en beslissingen.", status: "active", metric: "COEF" }
    ]
  },
  {
    slug: "process",
    name: "Process Hub",
    shortName: "Process",
    tagline: "Eén manier van werken, zichtbaar en herhaalbaar.",
    purpose: "Documenteert kernprocessen, verantwoordelijkheden, SLA's en procesverbeteringen zodat elke business unit op dezelfde basis kan schalen.",
    cards: [
      { title: "Procesbibliotheek", description: "Sales, offerte, project, uitvoering, service en finance.", status: "active", metric: "7 domeinen" },
      { title: "SLA & ownership", description: "Doorlooptijden en verantwoordelijken per processtap.", status: "planned" },
      { title: "Procesissues", description: "Knelpunten die impact hebben op klant of cashflow.", status: "attention", metric: "Open" }
    ]
  },
  {
    slug: "digital",
    name: "Digital Hub",
    shortName: "Digital",
    tagline: "Applicaties, integraties en data als één platform.",
    purpose: "Beheert de Cohvera tools, middleware, integraties en digitale capabilities als modulair platform.",
    cards: [
      { title: "Tools & Solutions", description: "Ventilatie Cloud, keuringen, solar-onderaanneming en laadpaal-werkbon.", status: "active", href: "/#tools" },
      { title: "Middleware", description: "Koppelingen tussen portal, ERP, IoT en externe diensten.", status: "planned" },
      { title: "Platform health", description: "Web, API, database, cache en HTTPS-status.", status: "active", metric: "Healthy" }
    ]
  },
  {
    slug: "operations",
    name: "Operations Hub",
    shortName: "Operations",
    tagline: "Van planning tot oplevering: één operationeel beeld.",
    purpose: "Geeft management en projectteams realtime zicht op workload, uitvoering, materiaal, projecten, werkbonnen en uitzonderingen.",
    cards: [
      { title: "Projectcontrol", description: "Projectstatus, deadlines, risico's en volgende acties.", status: "planned" },
      { title: "Werkvoorraad", description: "Planning, installatieteams en capaciteit per business unit.", status: "planned" },
      { title: "Exceptions", description: "Blokkades, ontbrekend materiaal, laattijdige acties en escalaties.", status: "attention" },
      { title: "Field tools", description: "Werkbonnen, keuringen en onderaannemers rechtstreeks vanuit de operatie.", status: "active", href: "/#tools" }
    ]
  },
  {
    slug: "performance",
    name: "Performance Hub",
    shortName: "Performance",
    tagline: "Sturen op feiten in plaats van op gevoel.",
    purpose: "Bundelt commerciële, operationele en financiële KPI's in één managementbeeld met drill-down per business unit.",
    cards: [
      { title: "Sales", description: "Pipeline, offertes, conversie en snelheid van opvolging.", status: "planned" },
      { title: "Operations", description: "Bezetting, rendement, projectmarge en doorlooptijd.", status: "planned" },
      { title: "Finance", description: "Cash, marge, omzet, EBITDA en werkkapitaal.", status: "planned" },
      { title: "Data quality", description: "Betrouwbaarheid en volledigheid van brondata.", status: "attention" }
    ]
  },
  {
    slug: "improvement",
    name: "Improvement Hub",
    shortName: "Improvement",
    tagline: "Van probleem naar structurele verbetering.",
    purpose: "Centraliseert verbeteracties, root-cause analyses, lessons learned en eigenaarschap over business units heen.",
    cards: [
      { title: "Improvement backlog", description: "Geprioriteerde verbeterinitiatieven met impact en owner.", status: "planned" },
      { title: "Lessons learned", description: "Herbruikbare inzichten uit projecten en incidenten.", status: "planned" },
      { title: "Actions", description: "Acties met deadline, owner en verificatie van resultaat.", status: "planned" }
    ]
  },
  {
    slug: "innovation",
    name: "Innovation Hub",
    shortName: "Innovation",
    tagline: "Nieuwe ideeën snel valideren en productiseren.",
    purpose: "Beheert experimenten, AI-use-cases, prototypes en nieuwe digitale producten van idee tot pilot.",
    cards: [
      { title: "Experiments", description: "Kleine pilots met hypothese, succescriterium en evaluatie.", status: "planned" },
      { title: "AI & automation", description: "Lokale AI, MCP, offerte-automatisatie en operationele agents.", status: "planned" },
      { title: "Product pipeline", description: "Kandidaten voor Cohvera plugins en commerciële digitale diensten.", status: "active", metric: "MVP" }
    ]
  }
];

export function getHub(slug: string): HubDefinition | undefined {
  return coefHubs.find((hub) => hub.slug === slug);
}
