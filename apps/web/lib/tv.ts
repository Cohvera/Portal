import type { Project } from "./projects";
export const DAY = 86400000;
export const tvToday = (now: number) =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Brussels" }).format(
    new Date(now),
  );
export function fresh(
  value: string | null | undefined,
  now: number,
  max = DAY,
) {
  const t = Date.parse(value || "");
  return Number.isFinite(t) && t <= now + 60000 && now - t < max;
}
export function tvProjects(
  projects: Project[],
  selection: string,
  source: string | null | undefined,
  now: number,
) {
  return projects.filter((p) => {
    if (p.externalSource === "PLENION")
      return (
        fresh(source, now) &&
        fresh(p.sourceSeenAt, now) &&
        p.sourceSeenAt === source &&
        p.sourceIsClosed === false &&
        (selection !== "execution" ||
          (p.sourceIsActive === true &&
            p.sourceStatusLabel === "07 - In Uitvoering"))
      );
    return selection === "execution"
      ? p.status === "Actief"
      : p.status !== "Afgerond";
  });
}
export function planned(p: Project) {
  return p.sourcePlannedAt?.slice(0, 10) || "";
}
export function splitProjects(projects: Project[], day: string) {
  return {
    late: projects
      .filter((p) => planned(p) && planned(p) < day)
      .sort((a, b) => planned(b).localeCompare(planned(a))),
    current: projects.filter((p) => !planned(p) || planned(p) === day),
    upcoming: projects
      .filter((p) => planned(p) > day)
      .sort((a, b) => planned(a).localeCompare(planned(b))),
  };
}
export function inspection(next: string, day: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(next) || !Number.isFinite(Date.parse(next)))
    return { color: "red", label: "Keuringsdatum ontbreekt" };
  const months = (n: number) => {
    const d = new Date(day + "T00:00:00Z"),
      dom = d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + n);
    const end = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
    ).getUTCDate();
    d.setUTCDate(Math.min(dom, end));
    return d.toISOString().slice(0, 10);
  };
  const days = Math.round((Date.parse(next) - Date.parse(day)) / DAY);
  return {
    color: next <= months(1) ? "red" : next <= months(3) ? "orange" : "green",
    label:
      days < 0
        ? `${-days} dagen overtijd`
        : days === 0
          ? "Vandaag keuren"
          : `Nog ${days} dagen`,
  };
}
export type TvSettings = {
  selection: "execution" | "open";
  rotationSeconds: number;
  waste: { label: string; date: string; time: string }[];
};
export const defaultTvSettings: TvSettings = {
  selection: "execution",
  rotationSeconds: 12,
  waste: [],
};
export type TvData = {
  projects: Project[];
  settings: Partial<TvSettings>;
  source: null | {
    sourceObservedAt: string;
    snapshotId: string;
    receivedAt: string;
  };
  receivedAt: string | null;
  fleet: null | {
    snapshot_id: string;
    source_observed_at: string;
    vehicles: {
      plate: string;
      name: string;
      next_inspection: string;
      source_id: string;
    }[];
  };
  nas: null | {
    status: string;
    loggingOk: boolean;
    latest: {
      checkedAt: string;
      cpu: number | null;
      ram: number | null;
      disk: number | null;
      io: number | null;
    };
    history: { checkedAt: string; cpu: number | null; ram: number | null }[];
  };
};
