import "reflect-metadata";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { AuthController } from "./auth/controller";
import { PortalGuard, publicAuthPath } from "./auth/guard";
import {
  authContext,
  allowedCompanies,
  context,
  membership,
  portalAdmin,
} from "./auth/context";
import { requestContext } from "./auth/session";
import { authMode } from "./auth/config";
import type { Request, Response, NextFunction } from "express";
import { InspectionsController } from "./inspections/controller";
import { CatalogController, AdminAccessController } from "./catalog";
import { AccountsController } from "./accounts";
import { ProjectsController } from "./projects";
import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Module,
  Param,
  Post,
  Query,
  UnauthorizedException,
  BadRequestException,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { prisma } from "@cohvera/database";
import { pluginCatalog } from "@cohvera/plugin-sdk";
import { syncPluginRegistry, writeAudit } from "@cohvera/services";

type ExternalPluginManifest = {
  id: string;
  name: string;
  version: string;
  description?: string;
  apiVersion: string;
  entrypointUrl: string;
  sourceUrl?: string;
};

const toolSnapshots: Record<
  string,
  {
    open: number;
    planned: number;
    completed: number;
    attention: number;
    activity: { title: string; detail: string }[];
  }
> = {
  "ventilation-cloud": {
    open: 12,
    planned: 4,
    completed: 18,
    attention: 2,
    activity: [
      {
        title: "Project Warco - Appartements",
        detail: "Debieten gecontroleerd · 08:42",
      },
      {
        title: "Residentie Parkzicht",
        detail: "Rapport klaar voor review · gisteren",
      },
      {
        title: "Tomme - woning Kortrijk",
        detail: "Dimensionering gestart · gisteren",
      },
    ],
  },
  "solar-subcontracting": {
    open: 7,
    planned: 5,
    completed: 11,
    attention: 1,
    activity: [
      {
        title: "PV-opdracht Deerlijk",
        detail: "Onderaannemer toegewezen · 07:58",
      },
      {
        title: "Installatie Menen",
        detail: "Materiaallijst bevestigd · gisteren",
      },
      { title: "Oplevering Waregem", detail: "Foto's ontvangen · gisteren" },
    ],
  },
  "charging-workorders": {
    open: 8,
    planned: 3,
    completed: 22,
    attention: 2,
    activity: [
      {
        title: "Alfen - interventie Roeselare",
        detail: "Werkbon gestart · 08:17",
      },
      { title: "BlitzPower Lux", detail: "Meetwaarden opgeslagen · gisteren" },
      { title: "Q-Home laadpaal", detail: "Werkbon ondertekend · gisteren" },
    ],
  },
};

function requirePluginAdmin(_token?: string) {
  portalAdmin();
}

function validateManifest(value: unknown): ExternalPluginManifest {
  if (!value || typeof value !== "object")
    throw new BadRequestException("Manifest must be a JSON object");
  const m = value as Partial<ExternalPluginManifest>;
  if (!m.id || !/^[a-z0-9-]+$/.test(m.id))
    throw new BadRequestException("Manifest id must be kebab-case");
  if (!m.name || !m.version || !m.apiVersion || !m.entrypointUrl)
    throw new BadRequestException(
      "Manifest requires id, name, version, apiVersion and entrypointUrl",
    );
  const entrypoint = new URL(m.entrypointUrl);
  if (entrypoint.protocol !== "https:")
    throw new BadRequestException("entrypointUrl must use https");
  return m as ExternalPluginManifest;
}

@Controller()
class AppController {
  @Get("health") health() {
    return { status: "ok", service: "cohvera-api", version: "0.5.0" };
  }

  @Get("session")
  async session(
    @Headers("x-company-code") headerCompanyCode?: string,
    @Query("companyCode") queryCompanyCode?: string,
  ) {
    const ctx = context(),
      companies = allowedCompanies();
    const code = queryCompanyCode || headerCompanyCode || companies[0]?.code;
    if (!code)
      return {
        userId: ctx.actor.id,
        email: ctx.actor.email,
        displayName: ctx.actor.displayName,
        companyId: null,
        companyCode: null,
        permissions: [],
        role: "Geen bedrijfstoegang",
      };
    const m = membership(code);
    return {
      userId: ctx.actor.id,
      email: ctx.actor.email,
      displayName: ctx.actor.displayName,
      companyId: m.companyId,
      companyCode: m.company.code,
      companyName: m.company.name,
      role: m.role.name,
      permissions: m.role.permissions
        .map((p) => p.permission.key)
        .filter((k) => k !== "portal.admin"),
      portalRoles: ctx.roles,
    };
  }

  @Get("companies") async companies() {
    return allowedCompanies();
  }

  @Get("companies/:companyCode/plugins")
  async companyPlugins(@Param("companyCode") companyCode: string) {
    const company = await prisma.company.findUnique({
      where: { code: companyCode },
    });
    if (!company) return [];
    const enabled = await prisma.companyPlugin.findMany({
      where: { companyId: company.id, enabled: true },
      include: { plugin: true },
    });
    return enabled.map(({ plugin }) => {
      const builtin = pluginCatalog.find((item) => item.id === plugin.id);
      if (builtin) return builtin;
      return {
        id: plugin.id,
        name: plugin.name,
        version: plugin.version,
        description: plugin.description ?? "External Cohvera plugin",
        route: plugin.entrypointUrl ?? "#",
        apiVersion: plugin.apiVersion,
        requiredPermissions: [],
        status: plugin.state.toLowerCase(),
        menu: { section: "tools", label: plugin.name, order: 900 },
      };
    });
  }

  @Get("plugins") async plugins(@Headers("x-company-id") companyId?: string) {
    if (!companyId) return pluginCatalog;
    if (!allowedCompanies().some((c) => c.id === companyId))
      throw new UnauthorizedException("Geen bedrijfstoegang.");
    const enabled = await prisma.companyPlugin.findMany({
      where: { companyId, enabled: true },
      include: { plugin: true },
    });
    const enabledIds = new Set(enabled.map((item) => item.pluginId));
    return pluginCatalog.filter((plugin) => enabledIds.has(plugin.id));
  }

  @Get("admin/companies") async adminCompanies() {
    portalAdmin();
    return prisma.company.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });
  }

  @Get("admin/plugins")
  async adminPlugins() {
    return prisma.plugin.findMany({
      include: { companies: { include: { company: true } } },
      orderBy: [{ runtime: "asc" }, { name: "asc" }],
    });
  }

  @Post("admin/plugins/install")
  async installPlugin(
    @Headers("x-plugin-admin-token") token: string | undefined,
    @Body() body: { manifestUrl?: string },
  ) {
    requirePluginAdmin(token);
    if (!body.manifestUrl)
      throw new BadRequestException("manifestUrl is required");
    const manifestUrl = new URL(body.manifestUrl);
    if (manifestUrl.protocol !== "https:")
      throw new BadRequestException("manifestUrl must use https");
    const response = await fetch(manifestUrl, {
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok)
      throw new BadRequestException(
        `Could not download manifest (${response.status})`,
      );
    const manifest = validateManifest(await response.json());
    const builtin = pluginCatalog.some((item) => item.id === manifest.id);
    if (builtin)
      throw new BadRequestException(
        "A built-in plugin with this id already exists",
      );
    const plugin = await prisma.plugin.upsert({
      where: { id: manifest.id },
      update: {
        name: manifest.name,
        description: manifest.description,
        version: manifest.version,
        apiVersion: manifest.apiVersion,
        runtime: "EXTERNAL",
        state: "ACTIVE",
        entrypointUrl: manifest.entrypointUrl,
        manifestUrl: body.manifestUrl,
        sourceUrl: manifest.sourceUrl,
      },
      create: {
        id: manifest.id,
        name: manifest.name,
        description: manifest.description,
        version: manifest.version,
        apiVersion: manifest.apiVersion,
        runtime: "EXTERNAL",
        state: "ACTIVE",
        entrypointUrl: manifest.entrypointUrl,
        manifestUrl: body.manifestUrl,
        sourceUrl: manifest.sourceUrl,
      },
    });
    return { installed: true, plugin };
  }

  @Post("admin/plugins/:pluginId/companies/:companyCode/enable")
  async enablePlugin(
    @Headers("x-plugin-admin-token") token: string | undefined,
    @Param("pluginId") pluginId: string,
    @Param("companyCode") companyCode: string,
  ) {
    requirePluginAdmin(token);
    const company = await prisma.company.findUnique({
      where: { code: companyCode },
    });
    const plugin = await prisma.plugin.findUnique({ where: { id: pluginId } });
    if (!company || !plugin)
      throw new BadRequestException("Unknown company or plugin");
    await prisma.companyPlugin.upsert({
      where: { companyId_pluginId: { companyId: company.id, pluginId } },
      update: { enabled: true },
      create: { companyId: company.id, pluginId, enabled: true },
    });
    return { enabled: true, companyCode, pluginId };
  }

  @Post("admin/plugins/:pluginId/companies/:companyCode/disable")
  async disablePlugin(
    @Headers("x-plugin-admin-token") token: string | undefined,
    @Param("pluginId") pluginId: string,
    @Param("companyCode") companyCode: string,
  ) {
    requirePluginAdmin(token);
    const company = await prisma.company.findUnique({
      where: { code: companyCode },
    });
    if (!company) throw new BadRequestException("Unknown company");
    await prisma.companyPlugin.upsert({
      where: { companyId_pluginId: { companyId: company.id, pluginId } },
      update: { enabled: false },
      create: { companyId: company.id, pluginId, enabled: false },
    });
    return { enabled: false, companyCode, pluginId };
  }

  @Delete("admin/plugins/:pluginId")
  async uninstallPlugin(
    @Headers("x-plugin-admin-token") token: string | undefined,
    @Param("pluginId") pluginId: string,
  ) {
    requirePluginAdmin(token);
    const plugin = await prisma.plugin.findUnique({ where: { id: pluginId } });
    if (!plugin) return { removed: false };
    if (plugin.runtime === "BUILTIN")
      throw new BadRequestException(
        "Built-in plugins cannot be uninstalled from the admin UI",
      );
    await prisma.plugin.delete({ where: { id: pluginId } });
    return { removed: true, pluginId };
  }

  @Get("tools/:toolId/summary") toolSummary(@Param("toolId") toolId: string) {
    return (
      toolSnapshots[toolId] ?? {
        open: 0,
        planned: 0,
        completed: 0,
        attention: 0,
        activity: [],
      }
    );
  }

  @Get("companies/:companyCode/notifications")
  async companyNotifications(@Param("companyCode") companyCode: string) {
    const company = await prisma.company.findUnique({
      where: { code: companyCode },
    });
    if (!company) return [];
    return prisma.notification.findMany({
      where: { companyId: company.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
  }

  @Get("companies/:companyCode/audit")
  async companyAudit(@Param("companyCode") companyCode: string) {
    const company = await prisma.company.findUnique({
      where: { code: companyCode },
    });
    if (!company) return [];
    return prisma.auditLog.findMany({
      where: { companyId: company.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  @Post("companies/:companyCode/select")
  async selectCompany(@Param("companyCode") companyCode: string) {
    const company = await prisma.company.findUnique({
      where: { code: companyCode },
    });
    if (!company) return { selectedCompanyCode: companyCode, found: false };
    const user = context().actor;
    await writeAudit({
      companyId: company.id,
      userId: user?.id,
      action: "company.selected",
      metadata: { source: "portal", companyCode },
    });
    return {
      selectedCompanyId: company.id,
      selectedCompanyCode: company.code,
      found: true,
    };
  }
}

@Module({
  controllers: [
    AuthController,
    InspectionsController,
    AppController,
    ProjectsController,
    AccountsController,
    CatalogController,
    AdminAccessController,
  ],
})
export class AppModule {}

export async function configuredApp() {
  const envPath = resolve(__dirname, "../../../.env");
  if (existsSync(envPath)) process.loadEnvFile(envPath);
  const app =
    await NestFactory.create<
      import("@nestjs/platform-express").NestExpressApplication
    >(AppModule);
  app.useBodyParser("json", { limit: "6mb" });
  authMode();
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Cache-Control", "no-store");
    if (publicAuthPath(req.path.replace(/\/$/, ""))) return next();
    void requestContext(req)
      .then((ctx) => authContext.run(ctx, () => next()))
      .catch(() =>
        res
          .status(503)
          .json({ message: "Aanmelden is tijdelijk niet beschikbaar." }),
      );
  });
  app.useGlobalGuards(new PortalGuard());
  app.enableCors({
    origin: process.env.WEB_URL ?? "http://localhost:3000",
    credentials: true,
  });
  return app;
}

async function bootstrap() {
  const app = await configuredApp();
  await syncPluginRegistry();
  await app.listen(process.env.PORT ?? 4000);
}

if (require.main === module) void bootstrap();
