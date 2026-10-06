import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Put,
} from "@nestjs/common";
import { prisma } from "@cohvera/database";

const bad = (): never => {
  throw new BadRequestException("Ongeldige tv-instellingen of brongegevens.");
};
const obj = (v: unknown): Record<string, any> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, any>)
    : bad();
const str = (v: unknown, max: number) =>
  typeof v === "string" && v.length <= max ? v : bad();
const date = (v: unknown) =>
  typeof v === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  Number.isFinite(Date.parse(v)) &&
  new Date(v).toISOString().slice(0, 10) === v
    ? v
    : bad();
const stamp = (v: unknown) => {
  const s = str(v, 40);
  const t = Date.parse(s);
  return Number.isFinite(t) && t <= Date.now() + 60000 ? s : bad();
};
export function tvSettings(value: unknown) {
  const b = obj(value);
  if (
    !["execution", "open"].includes(b.selection) ||
    ![8, 12, 20, 30].includes(b.rotationSeconds) ||
    !Array.isArray(b.waste) ||
    b.waste.length > 50
  )
    return bad();
  return {
    selection: b.selection as string,
    rotationSeconds: b.rotationSeconds as number,
    waste: b.waste.map((v: unknown) => {
      const e = obj(v);
      return {
        label: str(e.label, 100),
        date: date(e.date),
        time: /^([01]\d|2[0-3]):[0-5]\d$/.test(e.time) ? str(e.time, 5) : bad(),
      };
    }),
  };
}
export function tvTelemetry(value: unknown) {
  const b = obj(value);
  let fleet = null,
    nas = null;
  if (b.fleet != null) {
    const f = obj(b.fleet);
    if (
      f.schema_version !== 2 ||
      f.source_kind !== "central_datahub" ||
      !Array.isArray(f.vehicles) ||
      f.vehicles.length > 200
    )
      return bad();
    fleet = {
      schema_version: 2,
      source_kind: "central_datahub",
      snapshot_id: str(f.snapshot_id, 150),
      source_observed_at: stamp(f.source_observed_at),
      vehicles: f.vehicles.map((v: unknown) => {
        const r = obj(v);
        return {
          plate: str(r.plate, 30),
          name: str(r.name, 150),
          next_inspection: r.next_inspection ? date(r.next_inspection) : "",
          source_id: str(r.source_id, 100),
        };
      }),
    };
    if (
      new Set(fleet.vehicles.map((v) => v.source_id)).size !==
      fleet.vehicles.length
    )
      return bad();
  }
  if (b.nas != null) {
    const n = obj(b.nas),
      l = obj(n.latest);
    const pct = (v: unknown) =>
      v === null || v === undefined
        ? null
        : typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100
          ? v
          : bad();
    if (
      !["ok", "warning", "critical", "unknown"].includes(n.status) ||
      typeof n.loggingOk !== "boolean" ||
      !Array.isArray(n.history) ||
      n.history.length > 400
    )
      return bad();
    nas = {
      status: n.status as string,
      loggingOk: n.loggingOk,
      latest: {
        checkedAt: stamp(l.checkedAt),
        cpu: pct(l.cpu?.usedPercent),
        ram: pct(l.memory?.usedPercent),
        disk: pct(l.disk?.usedPercent),
        io: pct(l.cpu?.iowaitPercent),
      },
      history: n.history.map((v: unknown) => {
        const r = obj(v);
        return {
          checkedAt: stamp(r.checkedAt),
          cpu: pct(r.cpu),
          ram: pct(r.ram),
        };
      }),
    };
  }
  return { fleet, nas };
}
@Controller("companies/:companyCode/projects/tv")
export class TvController {
  @Get()
  async get(@Param("companyCode") code: string) {
    const [board, source, projects] = await Promise.all([
      prisma.tvBoard.findUnique({ where: { companyCode: code } }),
      prisma.qboxImport.findUnique({
        where: { companyCode: code },
        select: { snapshotId: true, sourceObservedAt: true, receivedAt: true },
      }),
      prisma.project.findMany({
        where: { company: { code } },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          customer: true,
          owner: true,
          status: true,
          externalSource: true,
          externalId: true,
          sourceDescription: true,
          sourceStatusLabel: true,
          sourceIsClosed: true,
          sourceIsActive: true,
          sourcePlannedAt: true,
          sourceSeenAt: true,
        },
      }),
    ]);
    return {
      settings: board?.settings ?? {},
      fleet: board?.fleet ?? null,
      nas: board?.nas ?? null,
      receivedAt: board?.receivedAt ?? null,
      source,
      projects,
    };
  }
  @Put("settings")
  async save(@Param("companyCode") companyCode: string, @Body() body: unknown) {
    const settings = tvSettings(body);
    await prisma.tvBoard.upsert({
      where: { companyCode },
      create: { companyCode, settings },
      update: { settings },
    });
    return settings;
  }
}
