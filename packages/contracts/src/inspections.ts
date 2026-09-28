export const inspectionStatuses = {
  DRAFT: "Voorbereiden",
  READY: "Klaar voor planning",
  PLANNED: "Ingepland",
  REVIEW: "Rapport verwerken",
  CONFORM: "Conform",
  REINSPECTION: "Herkeuring",
  OUT_OF_SERVICE: "Uit dienst",
  ARCHIVED: "Gearchiveerd",
} as const;
export const inspectionTypes = [
  "Elektriciteit",
  "Zonnepanelen",
  "Batterij",
  "Laadpaal",
  "Brand",
  "Water",
  "Gas",
  "Werf",
  "Andere",
] as const;
export const documentCategories = [
  "Keuringsrapport",
  "Eendraadsschema",
  "Plaatsingsplan",
  "Foto",
  "Overig",
] as const;
export type InspectionStatus = keyof typeof inspectionStatuses;
export type FollowUp = {
  id: string;
  title: string;
  owner: string;
  dueDate: string;
  done: boolean;
};
export type InspectionData = {
  title: string;
  customer: string;
  address: string;
  contactEmail: string;
  phone: string;
  type: string;
  owner: string;
  inspector: string;
  status: InspectionStatus;
  plannedDate: string;
  plannedTime: string;
  round: string;
  inspectedDate: string;
  nextDate: string;
  intervalMonths: number;
  reportNumber: string;
  projectFolder: string;
  ean: string;
  grounding: string;
  notes: string;
  checklist: { access: boolean; installation: boolean; diagrams: boolean };
  followUps: FollowUp[];
};
export type InspectionDocument = {
  id: string;
  name: string;
  category: string;
  mime: string;
  size: number;
  createdAt: string;
};
export type InspectionRecord = {
  id: string;
  version: number;
  data: InspectionData;
  previousId: string | null;
  createdAt: string;
  updatedAt: string;
  documents: InspectionDocument[];
  events: {
    id: string;
    actor: string;
    action: string;
    detail: string;
    createdAt: string;
  }[];
};
export function newInspection(): InspectionData {
  return {
    title: "",
    customer: "",
    address: "",
    contactEmail: "",
    phone: "",
    type: "Elektriciteit",
    owner: "",
    inspector: "",
    status: "DRAFT",
    plannedDate: "",
    plannedTime: "",
    round: "",
    inspectedDate: "",
    nextDate: "",
    intervalMonths: 0,
    reportNumber: "",
    projectFolder: "",
    ean: "",
    grounding: "",
    notes: "",
    checklist: { access: false, installation: false, diagrams: false },
    followUps: [],
  };
}
export function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
export function addMonths(value: string, months: number): string {
  if (!validDate(value)) throw new Error("Ongeldige datum.");
  const date = new Date(`${value}T12:00:00Z`),
    day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const last = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate();
  date.setUTCDate(Math.min(day, last));
  return date.toISOString().slice(0, 10);
}
export function validateInspection(value: unknown): InspectionData {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Ongeldig dossier.");
  const b = value as Record<string, unknown>,
    result = newInspection();
  const textFields = [
    "title",
    "customer",
    "address",
    "contactEmail",
    "phone",
    "type",
    "owner",
    "inspector",
    "status",
    "plannedDate",
    "plannedTime",
    "round",
    "inspectedDate",
    "nextDate",
    "reportNumber",
    "projectFolder",
    "ean",
    "grounding",
    "notes",
  ] as const;
  for (const key of textFields) {
    if (
      typeof b[key] !== "string" ||
      (b[key] as string).length >
        (key === "notes" ? 10000 : key === "projectFolder" ? 1000 : 300)
    )
      throw new Error(`Ongeldig veld: ${key}.`);
    (result as unknown as Record<string, unknown>)[key] = (
      b[key] as string
    ).trim();
  }
  if (!result.title || !result.customer || !result.address)
    throw new Error("Vul titel, klant en adres in.");
  if (
    !Object.hasOwn(inspectionStatuses, result.status) ||
    !(inspectionTypes as readonly string[]).includes(result.type)
  )
    throw new Error("Kies een geldig type en status.");
  if (
    result.contactEmail &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.contactEmail)
  )
    throw new Error("Ongeldig e-mailadres.");
  for (const key of ["plannedDate", "inspectedDate", "nextDate"] as const)
    if (result[key] && !validDate(result[key]))
      throw new Error("Ongeldige datum.");
  if (
    result.plannedTime &&
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(result.plannedTime)
  )
    throw new Error("Ongeldig tijdstip.");
  if (
    !Number.isInteger(b.intervalMonths) ||
    Number(b.intervalMonths) < 0 ||
    Number(b.intervalMonths) > 120
  )
    throw new Error("Interval moet tussen 0 en 120 maanden liggen.");
  result.intervalMonths = Number(b.intervalMonths);
  const check = b.checklist as Record<string, unknown> | undefined;
  if (
    !check ||
    ["access", "installation", "diagrams"].some(
      (k) => typeof check[k] !== "boolean",
    )
  )
    throw new Error("Ongeldige voorbereidingslijst.");
  result.checklist = {
    access: check.access as boolean,
    installation: check.installation as boolean,
    diagrams: check.diagrams as boolean,
  };
  if (!Array.isArray(b.followUps) || b.followUps.length > 100)
    throw new Error("Maximaal 100 opvolgacties per dossier.");
  const ids = new Set<string>();
  result.followUps = b.followUps.map((item: unknown) => {
    const f = item as FollowUp;
    if (
      !f ||
      typeof f.id !== "string" ||
      !f.id ||
      f.id.length > 100 ||
      ids.has(f.id) ||
      typeof f.title !== "string" ||
      !f.title.trim() ||
      f.title.length > 300 ||
      typeof f.owner !== "string" ||
      f.owner.length > 100 ||
      typeof f.done !== "boolean" ||
      typeof f.dueDate !== "string" ||
      (f.dueDate && !validDate(f.dueDate))
    )
      throw new Error("Controleer de opvolgacties.");
    ids.add(f.id);
    return {
      id: f.id,
      title: f.title.trim(),
      owner: f.owner.trim(),
      dueDate: f.dueDate,
      done: f.done,
    };
  });
  return result;
}
export function completionIssues(
  data: InspectionData,
  documents: Pick<InspectionDocument, "category">[],
  today: string,
): string[] {
  const issues: string[] = [];
  if (
    ["READY", "PLANNED"].includes(data.status) &&
    Object.values(data.checklist).some((v) => !v)
  )
    issues.push("Vink de drie voorbereidingscontroles af.");
  if (data.status === "PLANNED" && (!data.plannedDate || !data.inspector))
    issues.push("Vul de plandatum en keurder in.");
  if (["CONFORM", "REINSPECTION"].includes(data.status)) {
    if (!data.inspectedDate || data.inspectedDate > today)
      issues.push(
        "Vul een uitgevoerde keuringsdatum in (niet in de toekomst).",
      );
    if (
      !data.reportNumber ||
      !documents.some((d) => d.category === "Keuringsrapport")
    )
      issues.push("Voeg een keuringsrapport en rapportnummer toe.");
  }
  if (data.status === "CONFORM") {
    if (data.followUps.some((f) => !f.done))
      issues.push("Rond eerst de open opvolgacties af.");
    if (
      data.intervalMonths > 0 &&
      (!data.nextDate || data.nextDate <= data.inspectedDate)
    )
      issues.push(
        "Bevestig de volgende keuringsdatum na de uitgevoerde keuring.",
      );
  }
  if (data.status === "REINSPECTION" && !data.followUps.some((f) => !f.done))
    issues.push("Voeg minstens één open herstelactie toe.");
  return issues;
}
export function nextCycleAvailable(data: InspectionData, today: string) {
  return (
    data.status === "REINSPECTION" ||
    (data.status === "CONFORM" &&
      data.intervalMonths > 0 &&
      validDate(data.nextDate) &&
      today >= addMonths(data.nextDate, -3))
  );
}
export function attentionReasons(
  data: InspectionData,
  today: string,
): string[] {
  if (["ARCHIVED", "OUT_OF_SERVICE"].includes(data.status)) return [];
  const reasons = [];
  if (data.status === "REINSPECTION") reasons.push("Herkeuring nodig");
  if (data.followUps.some((f) => !f.done && f.dueDate && f.dueDate < today))
    reasons.push("Opvolgactie vervallen");
  if (data.nextDate && data.nextDate < today)
    reasons.push("Periodieke keuring vervallen");
  if (data.status === "PLANNED" && data.plannedDate < today)
    reasons.push("Resultaat ontbreekt");
  return reasons;
}
