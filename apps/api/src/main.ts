import "reflect-metadata";
import { Body, Controller, Delete, Get, Headers, Module, Param, Post, Query, UnauthorizedException, BadRequestException } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { developmentIdentity } from "@cohvera/auth";
import { prisma } from "@cohvera/database";
import { pluginCatalog } from "@cohvera/plugin-sdk";
import { syncPluginRegistry, writeAudit } from "@cohvera/services";

const DEV_EMAIL = "remko@cohvera.be";

type ExternalPluginManifest = {
  id: string;
  name: string;
  version: string;
  description?: string;
  apiVersion: string;
  entrypointUrl: string;
  sourceUrl?: string;
};

const toolSnapshots: Record<string, { open: number; planned: number; completed: number; attention: number; activity: { title: string; detail: string }[] }> = {
  "ventilation-cloud": { open: 12, planned: 4, completed: 18, attention: 2, activity: [{ title: "Project Warco - Appartements", detail: "Debieten gecontroleerd · 08:42" }, { title: "Residentie Parkzicht", detail: "Rapport klaar voor review · gisteren" }, { title: "Tomme - woning Kortrijk", detail: "Dimensionering gestart · gisteren" }] },
  inspections: { open: 9, planned: 6, completed: 14, attention: 3, activity: [{ title: "Q-Home - keuring PV", detail: "Gepland voor vrijdag · 09:10" }, { title: "Warco - technische ruimte", detail: "Attest ontvangen · gisteren" }, { title: "Herkeuring Kuurne", detail: "2 opmerkingen open · gisteren" }] },
  "solar-subcontracting": { open: 7, planned: 5, completed: 11, attention: 1, activity: [{ title: "PV-opdracht Deerlijk", detail: "Onderaannemer toegewezen · 07:58" }, { title: "Installatie Menen", detail: "Materiaallijst bevestigd · gisteren" }, { title: "Oplevering Waregem", detail: "Foto's ontvangen · gisteren" }] },
  "charging-workorders": { open: 8, planned: 3, completed: 22, attention: 2, activity: [{ title: "Alfen - interventie Roeselare", detail: "Werkbon gestart · 08:17" }, { title: "BlitzPower Lux", detail: "Meetwaarden opgeslagen · gisteren" }, { title: "Q-Home laadpaal", detail: "Werkbon ondertekend · gisteren" }] }
};

function requirePluginAdmin(token?: string) {
  const expected = process.env.PLUGIN_ADMIN_TOKEN;
  if (!expected || token !== expected) throw new UnauthorizedException("Invalid plugin admin token");
}

function validateManifest(value: unknown): ExternalPluginManifest {
  if (!value || typeof value !== "object") throw new BadRequestException("Manifest must be a JSON object");
  const m = value as Partial<ExternalPluginManifest>;
  if (!m.id || !/^[a-z0-9-]+$/.test(m.id)) throw new BadRequestException("Manifest id must be kebab-case");
  if (!m.name || !m.version || !m.apiVersion || !m.entrypointUrl) throw new BadRequestException("Manifest requires id, name, version, apiVersion and entrypointUrl");
  const entrypoint = new URL(m.entrypointUrl);
  if (entrypoint.protocol !== "https:") throw new BadRequestException("entrypointUrl must use https");
  return m as ExternalPluginManifest;
}

@Controller()
class AppController {
  @Get("health") health() { return { status: "ok", service: "cohvera-api", version: "0.5.0" }; }

  @Get("session")
  async session(@Headers("x-company-code") headerCompanyCode?: string, @Query("companyCode") queryCompanyCode?: string) {
    const companyCode = queryCompanyCode || headerCompanyCode || "COH";
    const user = await prisma.user.findUnique({ where: { email: DEV_EMAIL }, include: { memberships: { include: { company: true, role: { include: { permissions: { include: { permission: true } } } } } } } });
    if (!user) return developmentIdentity(companyCode);
    const membership = user.memberships.find((item) => item.company.code === companyCode) ?? user.memberships[0];
    if (!membership) return developmentIdentity(companyCode);
    return { userId: user.id, email: user.email, displayName: user.displayName, companyId: membership.company.id, companyCode: membership.company.code, companyName: membership.company.name, role: membership.role.name, permissions: membership.role.permissions.map((item) => item.permission.key) };
  }

  @Get("companies") async companies() { return prisma.company.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }); }

  @Get("companies/:companyCode/plugins")
  async companyPlugins(@Param("companyCode") companyCode: string) {
    const company = await prisma.company.findUnique({ where: { code: companyCode } });
    if (!company) return [];
    const enabled = await prisma.companyPlugin.findMany({ where: { companyId: company.id, enabled: true }, include: { plugin: true } });
    return enabled.map(({ plugin }) => {
      const builtin = pluginCatalog.find((item) => item.id === plugin.id);
      if (builtin) return builtin;
      return { id: plugin.id, name: plugin.name, version: plugin.version, description: plugin.description ?? "External Cohvera plugin", route: plugin.entrypointUrl ?? "#", apiVersion: plugin.apiVersion, requiredPermissions: [], status: plugin.state.toLowerCase(), menu: { section: "tools", label: plugin.name, order: 900 } };
    });
  }

  @Get("plugins") async plugins(@Headers("x-company-id") companyId?: string) {
    if (!companyId) return pluginCatalog;
    const enabled = await prisma.companyPlugin.findMany({ where: { companyId, enabled: true }, include: { plugin: true } });
    const enabledIds = new Set(enabled.map((item) => item.pluginId));
    return pluginCatalog.filter((plugin) => enabledIds.has(plugin.id));
  }

  @Get("admin/plugins")
  async adminPlugins() {
    return prisma.plugin.findMany({ include: { companies: { include: { company: true } } }, orderBy: [{ runtime: "asc" }, { name: "asc" }] });
  }

  @Post("admin/plugins/install")
  async installPlugin(@Headers("x-plugin-admin-token") token: string | undefined, @Body() body: { manifestUrl?: string }) {
    requirePluginAdmin(token);
    if (!body.manifestUrl) throw new BadRequestException("manifestUrl is required");
    const manifestUrl = new URL(body.manifestUrl);
    if (manifestUrl.protocol !== "https:") throw new BadRequestException("manifestUrl must use https");
    const response = await fetch(manifestUrl, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new BadRequestException(`Could not download manifest (${response.status})`);
    const manifest = validateManifest(await response.json());
    const builtin = pluginCatalog.some((item) => item.id === manifest.id);
    if (builtin) throw new BadRequestException("A built-in plugin with this id already exists");
    const plugin = await prisma.plugin.upsert({
      where: { id: manifest.id },
      update: { name: manifest.name, description: manifest.description, version: manifest.version, apiVersion: manifest.apiVersion, runtime: "EXTERNAL", state: "ACTIVE", entrypointUrl: manifest.entrypointUrl, manifestUrl: body.manifestUrl, sourceUrl: manifest.sourceUrl },
      create: { id: manifest.id, name: manifest.name, description: manifest.description, version: manifest.version, apiVersion: manifest.apiVersion, runtime: "EXTERNAL", state: "ACTIVE", entrypointUrl: manifest.entrypointUrl, manifestUrl: body.manifestUrl, sourceUrl: manifest.sourceUrl }
    });
    return { installed: true, plugin };
  }

  @Post("admin/plugins/:pluginId/companies/:companyCode/enable")
  async enablePlugin(@Headers("x-plugin-admin-token") token: string | undefined, @Param("pluginId") pluginId: string, @Param("companyCode") companyCode: string) {
    requirePluginAdmin(token);
    const company = await prisma.company.findUnique({ where: { code: companyCode } });
    const plugin = await prisma.plugin.findUnique({ where: { id: pluginId } });
    if (!company || !plugin) throw new BadRequestException("Unknown company or plugin");
    await prisma.companyPlugin.upsert({ where: { companyId_pluginId: { companyId: company.id, pluginId } }, update: { enabled: true }, create: { companyId: company.id, pluginId, enabled: true } });
    return { enabled: true, companyCode, pluginId };
  }

  @Post("admin/plugins/:pluginId/companies/:companyCode/disable")
  async disablePlugin(@Headers("x-plugin-admin-token") token: string | undefined, @Param("pluginId") pluginId: string, @Param("companyCode") companyCode: string) {
    requirePluginAdmin(token);
    const company = await prisma.company.findUnique({ where: { code: companyCode } });
    if (!company) throw new BadRequestException("Unknown company");
    await prisma.companyPlugin.upsert({ where: { companyId_pluginId: { companyId: company.id, pluginId } }, update: { enabled: false }, create: { companyId: company.id, pluginId, enabled: false } });
    return { enabled: false, companyCode, pluginId };
  }

  @Delete("admin/plugins/:pluginId")
  async uninstallPlugin(@Headers("x-plugin-admin-token") token: string | undefined, @Param("pluginId") pluginId: string) {
    requirePluginAdmin(token);
    const plugin = await prisma.plugin.findUnique({ where: { id: pluginId } });
    if (!plugin) return { removed: false };
    if (plugin.runtime === "BUILTIN") throw new BadRequestException("Built-in plugins cannot be uninstalled from the admin UI");
    await prisma.plugin.delete({ where: { id: pluginId } });
    return { removed: true, pluginId };
  }

  @Get("tools/:toolId/summary") toolSummary(@Param("toolId") toolId: string) { return toolSnapshots[toolId] ?? { open: 0, planned: 0, completed: 0, attention: 0, activity: [] }; }

  @Get("companies/:companyCode/notifications")
  async companyNotifications(@Param("companyCode") companyCode: string) { const company = await prisma.company.findUnique({ where: { code: companyCode } }); if (!company) return []; return prisma.notification.findMany({ where: { companyId: company.id }, orderBy: { createdAt: "desc" }, take: 20 }); }

  @Get("companies/:companyCode/audit")
  async companyAudit(@Param("companyCode") companyCode: string) { const company = await prisma.company.findUnique({ where: { code: companyCode } }); if (!company) return []; return prisma.auditLog.findMany({ where: { companyId: company.id }, orderBy: { createdAt: "desc" }, take: 50 }); }

  @Post("companies/:companyCode/select")
  async selectCompany(@Param("companyCode") companyCode: string) { const company = await prisma.company.findUnique({ where: { code: companyCode } }); if (!company) return { selectedCompanyCode: companyCode, found: false }; const user = await prisma.user.findUnique({ where: { email: DEV_EMAIL } }); await writeAudit({ companyId: company.id, userId: user?.id, action: "company.selected", metadata: { source: "portal", companyCode } }); return { selectedCompanyId: company.id, selectedCompanyCode: company.code, found: true }; }
}

@Module({ controllers: [AppController] })
class AppModule {}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: process.env.WEB_URL ?? "http://localhost:3000" });
  await syncPluginRegistry();
  await app.listen(process.env.PORT ?? 4000);
}

void bootstrap();
