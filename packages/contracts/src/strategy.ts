export const strategyStatuses = {
  REVIEW: "Te beoordelen", PLANNED: "Gepland", ACTIVE: "Bezig",
  BLOCKED: "Geblokkeerd", DONE: "Afgerond",
} as const;
export type StrategyStatus = keyof typeof strategyStatuses;
export type StrategyPhase = "1" | "23" | "5";
export interface StrategyDefinition {
  id: string; phase: StrategyPhase; title: string; description: string;
  result: string; amount: string | null;
}
export interface StrategyInput {
  status: StrategyStatus; ownerId: string | null; dueOn: string;
  nextStep: string; notes: string; version: number;
}
export interface StrategyRecord extends StrategyDefinition, StrategyInput {
  ownerName: string; updatedAt: string | null;
}
export interface StrategyOverview {
  actions: StrategyRecord[];
  owners: { id: string; displayName: string }[];
  history: { id: string; actionId: string; actor: string; createdAt: string }[];
}
export function validateStrategyInput(body: unknown): StrategyInput {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Ongeldige actie.");
  const b = body as Record<string, unknown>;
  const text = (key: string, max: number) => {
    if (typeof b[key] !== "string" || b[key].length > max) throw new Error(`Ongeldig veld: ${key}`);
    return (b[key] as string).trim();
  };
  const status = text("status", 20);
  if (!Object.hasOwn(strategyStatuses, status)) throw new Error("Ongeldige status.");
  if (!Number.isSafeInteger(b.version) || (b.version as number) < 0) throw new Error("Ongeldige versie.");
  if (b.ownerId !== null && (typeof b.ownerId !== "string" || !b.ownerId || b.ownerId.length > 128)) throw new Error("Ongeldige eigenaar.");
  const dueOn = text("dueOn", 10);
  if (dueOn) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueOn)) throw new Error("Ongeldige deadline.");
    const date = new Date(`${dueOn}T00:00:00.000Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== dueOn) throw new Error("Ongeldige deadline.");
  }
  return {status: status as StrategyStatus, ownerId: b.ownerId as string | null, dueOn,
    nextStep: text("nextStep", 2000), notes: text("notes", 10000), version: b.version as number};
}
export function strategySummary(actions: StrategyRecord[], today: string) {
  const done = actions.filter(a => a.status === "DONE").length;
  return { total: actions.length, done, percent: actions.length ? Math.round(done / actions.length * 100) : 0,
    active: actions.filter(a => a.status === "ACTIVE").length,
    attention: actions.filter(a => a.status !== "DONE" && (a.status === "BLOCKED" || (!!a.dueOn && a.dueOn < today))).length,
    unassigned: actions.filter(a => a.status !== "DONE" && !a.ownerId).length };
}
export function strategyCsv(actions: StrategyRecord[]) {
  const cell = (input: unknown) => {
    const text = String(input ?? "");
    const safe = /^[\s]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text) ? "'" + text : text;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const rows = [["ID", "Fase", "Actie", "Status", "Eigenaar", "Deadline", "Volgende stap", "Notities", "Meetpunt", "Bronbedrag"],
    ...actions.map(a => [a.id, a.phase === "23" ? "Jaar 2–3" : `Jaar ${a.phase}`, a.title,
      strategyStatuses[a.status], a.ownerName, a.dueOn, a.nextStep, a.notes, a.result, a.amount])];
  return "\ufeff" + rows.map(row => row.map(cell).join(";")).join("\r\n");
}
