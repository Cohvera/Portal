import { allowedCompanies, context } from "./auth/context";
import { isPortalAdmin } from "./auth/policy";
import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  ForbiddenException,
  UnauthorizedException,
} from "@nestjs/common";
import { prisma, Prisma } from "@cohvera/database";
import { portalAdmin } from "./auth/context";

const builtinIds = new Set([
  "tv-screen",
  "heat-loss",
  "warehouse-manager",
  "q-portal",
  "project-tasks",
  "ventilation-cloud",
  "inspections",
  "solar-subcontracting",
  "charging-workorders",
]);
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new BadRequestException("Ongeldige toolgegevens.");
  return value as Record<string, unknown>;
}
async function companyCodes(value: unknown) {
  if (
    !Array.isArray(value) ||
    !value.length ||
    value.length > 100 ||
    !value.every((code) => typeof code === "string")
  )
    throw new BadRequestException("Selecteer minstens één geldig bedrijf.");
  const codes = [...new Set(value as string[])];
  if (
    (await prisma.company.count({
      where: { code: { in: codes }, isActive: true },
    })) !== codes.length
  )
    throw new BadRequestException("Onbekend of inactief bedrijf.");
  return codes;
}
async function customEntry(value: unknown) {
  const b = object(value);
  if (
    typeof b.name !== "string" ||
    !b.name.trim() ||
    b.name.length > 80 ||
    typeof b.description !== "string" ||
    b.description.length > 240 ||
    typeof b.href !== "string" ||
    b.href.length > 2000 ||
    !["tool", "integration"].includes(String(b.kind))
  )
    throw new BadRequestException("Controleer naam, beschrijving en webadres.");
  try {
    const url = new URL(b.href);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      throw new Error();
  } catch {
    throw new BadRequestException(
      "Gebruik een geldig http- of https-adres zonder inloggegevens.",
    );
  }
  return {
    name: b.name.trim(),
    description: b.description.trim(),
    href: b.href.trim(),
    kind: b.kind as string,
    companyCodes: await companyCodes(b.companyCodes),
  };
}
@Controller("admin/access")
export class AdminAccessController {
  @Get()
  async access() {
    try {
      const actor = portalAdmin();
      return {
        canManageCatalog: true,
        displayName: actor.displayName,
      };
    } catch (e) {
      if (e instanceof ForbiddenException || e instanceof UnauthorizedException)
        return { canManageCatalog: false };
      throw e;
    }
  }
}
@Controller("catalog")
export class CatalogController {
  @Get()
  async overview() {
    const codes = allowedCompanies().map((c) => c.code);
    const rows = await prisma.toolCatalog.findMany({
      where: isPortalAdmin(context().roles)
        ? {}
        : { OR: [{ kind: "builtin" }, { companyCodes: { hasSome: codes } }] },
      orderBy: { name: "asc" },
    });
    return {
      entries: rows
        .filter((r) => r.kind !== "builtin")
        .map((r) => ({ ...r, companyCode: r.companyCodes[0] })),
      selections: Object.fromEntries(
        rows
          .filter((r) => r.kind === "builtin")
          .map((r) => [r.id, r.companyCodes]),
      ),
    };
  }
  @Post()
  async create(@Body() body: unknown) {
    const actor = portalAdmin();
    const data = await customEntry(body);
    return prisma.$transaction(async (tx) => {
      const row = await tx.toolCatalog.create({
        data: { id: randomUUID(), ...data },
      });
      await this.audit(tx, actor.id, row.id, "tool.created", data.companyCodes);
      return row;
    });
  }
  @Patch(":id/companies")
  async assign(@Param("id") id: string, @Body() body: unknown) {
    const actor = portalAdmin();
    const codes = await companyCodes(object(body).companyCodes);
    return prisma.$transaction(async (tx) => {
      const existing = await tx.toolCatalog.findUnique({ where: { id } });
      if (!existing && !builtinIds.has(id))
        throw new BadRequestException("Onbekende tool.");
      const row = await tx.toolCatalog.upsert({
        where: { id },
        create: { id, kind: "builtin", companyCodes: codes },
        update: { companyCodes: codes },
      });
      await this.audit(tx, actor.id, id, "tool.companies.updated", codes);
      return row;
    });
  }
  // Explicit migration of the previous browser-only catalog, preserving existing server records.
  @Post("import")
  async importLocal(@Body() body: unknown) {
    const actor = portalAdmin();
    const b = object(body);
    if (!Array.isArray(b.entries) || b.entries.length > 100)
      throw new BadRequestException(
        "Maximaal 100 lokale toevoegingen tegelijk.",
      );
    const entries = await Promise.all(
      b.entries.map(async (value) => {
        const e = object(value);
        if (
          typeof e.id !== "string" ||
          !/^[a-zA-Z0-9-]{1,100}$/.test(e.id) ||
          builtinIds.has(e.id)
        )
          throw new BadRequestException("Ongeldige lokale tool.");
        return {
          id: e.id,
          ...(await customEntry({
            ...e,
            companyCodes: e.companyCodes || [e.companyCode],
          })),
        };
      }),
    );
    const selections = object(b.selections);
    const assigned = await Promise.all(
      Object.entries(selections).map(async ([id, codes]) => {
        if (!builtinIds.has(id))
          throw new BadRequestException("Onbekende standaardtool.");
        return { id, kind: "builtin", companyCodes: await companyCodes(codes) };
      }),
    );
    return prisma.$transaction(async (tx) => {
      const result = await tx.toolCatalog.createMany({
        data: [...entries, ...assigned],
        skipDuplicates: true,
      });
      await this.audit(tx, actor.id, "catalog", "tool.imported", []);
      return { imported: result.count };
    });
  }
  private async audit(
    tx: Prisma.TransactionClient,
    userId: string,
    entityId: string,
    action: string,
    codes: string[],
  ) {
    const company = await tx.company.findUniqueOrThrow({
      where: { code: "COH" },
    });
    await tx.auditLog.create({
      data: {
        companyId: company.id,
        userId,
        entityType: "tool",
        entityId,
        action,
        metadata: { companyCodes: codes },
      },
    });
  }
}
