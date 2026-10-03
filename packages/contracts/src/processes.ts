export const processStatuses = {
  PLANNED: "Te beschrijven",
  DRAFT: "In uitwerking",
  PILOT: "In test",
  APPROVED: "Goedgekeurd",
  ACTIVE: "Actief",
  REVIEW: "Te herzien",
} as const;
export const processHealth = {
  UNKNOWN: "Nog niet beoordeeld",
  GREEN: "Op koers",
  AMBER: "Aandacht",
  RED: "Geblokkeerd",
} as const;
export type ProcessStatus = keyof typeof processStatuses;
export type ProcessHealth = keyof typeof processHealth;
export type ProcessDefinition = {
  id: string;
  name: string;
  category: "Kernproces" | "Ondersteuning" | "Verbetering";
  start: string;
  end: string;
  outcome: string;
  ownerRole: string;
  indicator: string;
  priority: "HIGH" | "NORMAL";
  nextAction: string;
  methodology?: string;
};
export const processDefinitions: ProcessDefinition[] = [
  {
    id: "BP-01",
    name: "Sales to Order",
    category: "Kernproces",
    start: "Klantaanvraag",
    end: "Bevestigde bestelling en volledig overdrachtsdossier",
    outcome:
      "Een haalbare opdracht met duidelijke scope, prijs en klantafspraken.",
    ownerRole: "Commercieel verantwoordelijke",
    indicator: "Offertedoorlooptijd en conversie",
    priority: "HIGH",
    nextAction:
      "Intake, offertegoedkeuring en overdracht naar uitvoering beschrijven.",
  },
  {
    id: "BP-02",
    name: "Order to Delivery",
    category: "Kernproces",
    start: "Bevestigde bestelling",
    end: "Opgeleverd project en afgesloten projectdossier",
    outcome:
      "Een correct uitgevoerde en geaccepteerde installatie binnen projectafspraken.",
    ownerRole: "Operationeel verantwoordelijke",
    indicator: "Tijdige oplevering en herstelwerk",
    priority: "HIGH",
    nextAction:
      "Procesgrenzen en overdrachten aan de bestaande CPM-methodologie koppelen.",
    methodology: "CPM",
  },
  {
    id: "BP-03",
    name: "Order to Cash",
    category: "Kernproces",
    start: "Bevestigde bestelling met facturatieafspraken",
    end: "Volledige betaling ontvangen",
    outcome:
      "Uitgevoerde prestaties worden tijdig gefactureerd en betaald; loopt parallel met Order to Delivery.",
    ownerRole: "Financieel verantwoordelijke",
    indicator:
      "Tijd tussen facturatievrijgave en factuur; achterstallige vorderingen",
    priority: "HIGH",
    nextAction:
      "Overdracht van facturatievrijgave naar administratie vastleggen.",
  },
  {
    id: "BP-04",
    name: "Procure to Pay",
    category: "Ondersteuning",
    start: "Goedgekeurde aankoopbehoefte",
    end: "Gecontroleerde leveranciersfactuur betaald",
    outcome:
      "De juiste aankoop, gecontroleerde ontvangst en correcte betaling.",
    ownerRole: "Aankoopverantwoordelijke",
    indicator: "Leverbetrouwbaarheid en factuurafwijkingen",
    priority: "NORMAL",
    nextAction: "Bestelling, ontvangst en factuurcontrole op elkaar afstemmen.",
  },
  {
    id: "BP-05",
    name: "Stock to Site",
    category: "Ondersteuning",
    start: "Materiaal beschikbaar en werfbehoefte bekend",
    end: "Materiaalverbruik of retour verwerkt",
    outcome:
      "De ploeg beschikt over volledig werfmateriaal; voorraad en verbruik kloppen.",
    ownerRole: "Magazijnverantwoordelijke",
    indicator: "Volledige werfpakketten en voorraadverschillen",
    priority: "NORMAL",
    nextAction: "Reservering, werfpakket, uitgifte en retour beschrijven.",
  },
  {
    id: "BP-06",
    name: "Request to Resolution",
    category: "Kernproces",
    start: "Servicevraag of klacht",
    end: "Opgelost, bevestigd en administratief afgesloten",
    outcome:
      "De klant krijgt een traceerbare oplossing met correcte opvolging en eventuele facturatie.",
    ownerRole: "Serviceverantwoordelijke",
    indicator: "Reactietijd en oplossing bij eerste interventie",
    priority: "NORMAL",
    nextAction: "Service-intake, prioritering en afsluiting vastleggen.",
  },
  {
    id: "BP-07",
    name: "Contract to Maintenance",
    category: "Kernproces",
    start: "Actief onderhoudscontract",
    end: "Onderhoudscyclus uitgevoerd en verwerkt",
    outcome:
      "Onderhoud wordt gepland, uitgevoerd, gerapporteerd en gefactureerd.",
    ownerRole: "Onderhoudsverantwoordelijke",
    indicator: "Tijdig uitgevoerd onderhoud",
    priority: "NORMAL",
    nextAction:
      "Contractgegevens, planning en onderhoudsverslag standaardiseren.",
  },
  {
    id: "BP-08",
    name: "Record to Report",
    category: "Ondersteuning",
    start: "Financiële transacties en operationele registraties",
    end: "Afgesloten en gevalideerde managementrapportering",
    outcome: "Betrouwbaar zicht op resultaten, projectmarges en groepscijfers.",
    ownerRole: "Financieel verantwoordelijke",
    indicator: "Afsluitdoorlooptijd en volledigheid rapportering",
    priority: "NORMAL",
    nextAction: "Afsluitkalender, intercompany en controles bepalen.",
  },
  {
    id: "BP-09",
    name: "Hire to Retire",
    category: "Ondersteuning",
    start: "Goedgekeurde personeelsbehoefte",
    end: "Samenwerking afgerond en overdracht voltooid",
    outcome:
      "Medewerkers starten voorbereid, ontwikkelen zich en dragen correct over bij vertrek.",
    ownerRole: "HR-verantwoordelijke",
    indicator: "Volledigheid onboarding en opleidingsplan",
    priority: "NORMAL",
    nextAction: "Onboarding, opleiding en offboarding structureren.",
  },
  {
    id: "BP-10",
    name: "Issue to Improvement",
    category: "Verbetering",
    start: "Vastgestelde afwijking of verbetermogelijkheid",
    end: "Effect gecontroleerd en standaard aangepast",
    outcome:
      "Een oorzaakgericht verbetertraject met een aantoonbaar resultaat.",
    ownerRole: "Verantwoordelijke continue verbetering",
    indicator: "Verbeteracties met geverifieerd effect",
    priority: "NORMAL",
    nextAction:
      "Een vaste cyclus voor probleem, oorzaak, actie en effectcontrole afspreken.",
  },
];
export type ProcessMetadata = {
  owner: string;
  status: ProcessStatus;
  health: ProcessHealth;
  priority: "HIGH" | "NORMAL";
  sharepointUrl: string;
  methodologyUrl: string;
  nextAction: string;
  nextReviewOn: string;
  target: string;
  measurement: string;
  problem: string;
  countermeasure: string;
  verification: string;
};
export type ProcessRecord = ProcessDefinition &
  ProcessMetadata & { version: number; updatedAt: string | null };
export function initialProcess(definition: ProcessDefinition): ProcessRecord {
  return {
    ...definition,
    owner: "",
    status: "PLANNED",
    health: "UNKNOWN",
    sharepointUrl: "",
    methodologyUrl: "",
    nextReviewOn: "",
    target: "",
    measurement: "",
    problem: "",
    countermeasure: "",
    verification: "",
    version: 0,
    updatedAt: null,
  };
}
export function isSharePointUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return (
      u.protocol === "https:" &&
      u.hostname.endsWith(".sharepoint.com") &&
      !u.username &&
      !u.password &&
      (!u.port || u.port === "443")
    );
  } catch {
    return false;
  }
}
export function validateProcessMetadata(
  value: unknown,
): ProcessMetadata & { version: number } {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Ongeldige procesgegevens.");
  const b = value as Record<string, unknown>;
  const fields = [
    "owner",
    "sharepointUrl",
    "methodologyUrl",
    "nextAction",
    "nextReviewOn",
    "target",
    "measurement",
    "problem",
    "countermeasure",
    "verification",
  ] as const;
  for (const key of fields) {
    const limit = key.endsWith("Url")
      ? 2000
      : key === "owner"
        ? 100
        : key === "nextReviewOn"
          ? 10
          : 1000;
    if (typeof b[key] !== "string" || (b[key] as string).length > limit)
      throw new Error(`Controleer het veld ${key}.`);
  }
  if (
    !Object.hasOwn(processStatuses, String(b.status)) ||
    !Object.hasOwn(processHealth, String(b.health)) ||
    !["HIGH", "NORMAL"].includes(String(b.priority)) ||
    !Number.isSafeInteger(b.version) ||
    (b.version as number) < 0
  )
    throw new Error("Ongeldige status, prioriteit of versie.");
  const strings = Object.fromEntries(
    fields.map((k) => [k, (b[k] as string).trim()]),
  ) as Pick<ProcessMetadata, (typeof fields)[number]>;
  for (const key of ["sharepointUrl", "methodologyUrl"] as const)
    if (strings[key] && !isSharePointUrl(strings[key]))
      throw new Error(
        "Gebruik een https-link naar jullie SharePoint-document of -pagina.",
      );
  if (
    strings.nextReviewOn &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(strings.nextReviewOn) ||
      Number.isNaN(Date.parse(strings.nextReviewOn)) ||
      new Date(strings.nextReviewOn).toISOString().slice(0, 10) !==
        strings.nextReviewOn)
  )
    throw new Error("Gebruik een geldige reviewdatum.");
  if (
    ["APPROVED", "ACTIVE"].includes(String(b.status)) &&
    (!strings.owner || !strings.sharepointUrl)
  )
    throw new Error(
      "Een goedgekeurd of actief proces heeft een eigenaar en SharePoint-link nodig.",
    );
  if (b.health !== "UNKNOWN" && !strings.measurement)
    throw new Error(
      "Onderbouw de proceswerking met een meting of beoordeling.",
    );
  if (
    ["AMBER", "RED"].includes(String(b.health)) &&
    (!strings.problem || !strings.nextAction)
  )
    throw new Error(
      "Leg bij aandacht of blokkade het knelpunt en de volgende actie vast.",
    );
  return {
    ...strings,
    status: b.status as ProcessStatus,
    health: b.health as ProcessHealth,
    priority: b.priority as "HIGH" | "NORMAL",
    version: b.version as number,
  };
}
