import "reflect-metadata";
import { Controller, Get, Headers, Module, Param, Post, Query } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { developmentIdentity } from "@cohvera/auth";
import { prisma } from "@cohvera/database";
import { pluginCatalog } from "@cohvera/plugin-sdk";
import { syncPluginRegistry, writeAudit } from "@cohvera/services";

const DEV_EMAIL = "remko@cohvera.be";

const toolSnapshots: Record<string, { open: number; planned: number; completed: number; attention: number; activity: { title: string; detail: string }[] }> = {
  "ventilation-cloud": {
    open: 12, planned: 4, completed: 18, attention: 2,
    activity: [
      { title: "Project Warco - Appartements", detail: "Debieten gecontroleerd · 08:42" },
      { title: "Residentie Parkzicht", detail: "Rapport klaar voor review · gisteren" },
      { title: "Tomme - woning Kortrijk", detail: "Dimensionering gestart · gisteren" }
    ]
  },
  inspections: {
    open: 9, planned: 6, completed: 14, attention: 3,
    activity: [
      { title: "Q-Home - keuring PV", detail: "Gepland voor vrijdag · 09:10" },
      { title: "Warco - technische ruimte", detail: "Attest ontvangen · gisteren" },
      { title: "Herkeuring Kuurne", detail: "2 opmerkingen open · gisteren" }
    ]
  },
  "solar-subcontracting": {
    open: 7, planned: 5, completed: 11, attention: 1,
    activity: [
      { title: "PV-opdracht Deerlijk", detail: "Onderaannemer toegewezen · 07:58" },
      { title: "Installatie Menen", detail: "Materiaallijst bevestigd · gisteren" },
      { title: "Oplevering Waregem", detail: "Foto's ontvangen · gisteren" }
    ]
  },
  "charging-workorders": {
    open: 8, planned: 3, completed: 22, attention: 2,
    activity: [
      { title: "Alfen - interventie Roeselare", detail: "Werkbon gestart · 08:17" },
      { title: "BlitzPower Lux", detail: "Meetwaarden opgeslagen · gisteren" },
      { title: "Q-Home laadpaal", detail: "Werkbon ondertekend · gisteren" }
    ]
  }
};

@Controller()
class AppController {
  @Get("health")
  health() {
    return { status: "ok", service: "cohvera-api", version: "0.4.0" };
  }

  @Get("session")
  async session(@Headers("x-company-code") headerCompanyCode?: string, @Query("companyCode") queryCompanyCode?: string) {
    const companyCode = queryCompanyCode || headerCompanyCode || "COH";
    const user = await prisma.user.findUnique({
      where: { email: DEV_EMAIL },
      include: {
        memberships: {
          include: {
            company: true,
            role: { include: { permissions: { include: { permission: true } } } }
          }
        }
      }
    });

    if (!user) return developmentIdentity(companyCode);

    const membership = user.memberships.find((item) => item.company.code === companyCode) ?? user.memberships[0];
    if (!membership) return developmentIdentity(companyCode);

    return {
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      companyId: membership.company.id,
      companyCode: membership.company.code,
      companyName: membership.company.name,
      role: membership.role.name,
      permissions: membership.role.permissions.map((item) => item.permission.key)
    };
  }

  @Get("companies")
  async companies() {
    return prisma.company.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
  }

  @Get("companies/:companyCode/plugins")
  async companyPlugins(@Param("companyCode") companyCode: string) {
    const company = await prisma.company.findUnique({ where: { code: companyCode } });
    if (!company) return [];
    const enabled = await prisma.companyPlugin.findMany({ where: { companyId: company.id, enabled: true }, include: { plugin: true } });
    const enabledIds = new Set(enabled.map((item) => item.pluginId));
    return pluginCatalog.filter((plugin) => enabledIds.has(plugin.id));
  }

  @Get("plugins")
  async plugins(@Headers("x-company-id") companyId?: string) {
    if (!companyId) return pluginCatalog;
    const enabled = await prisma.companyPlugin.findMany({ where: { companyId, enabled: true }, include: { plugin: true } });
    const enabledIds = new Set(enabled.map((item) => item.pluginId));
    return pluginCatalog.filter((plugin) => enabledIds.has(plugin.id));
  }

  @Get("tools/:toolId/summary")
  toolSummary(@Param("toolId") toolId: string) {
    return toolSnapshots[toolId] ?? { open: 0, planned: 0, completed: 0, attention: 0, activity: [] };
  }

  @Get("companies/:companyCode/notifications")
  async companyNotifications(@Param("companyCode") companyCode: string) {
    const company = await prisma.company.findUnique({ where: { code: companyCode } });
    if (!company) return [];
    return prisma.notification.findMany({ where: { companyId: company.id }, orderBy: { createdAt: "desc" }, take: 20 });
  }

  @Get("companies/:companyCode/audit")
  async companyAudit(@Param("companyCode") companyCode: string) {
    const company = await prisma.company.findUnique({ where: { code: companyCode } });
    if (!company) return [];
    return prisma.auditLog.findMany({ where: { companyId: company.id }, orderBy: { createdAt: "desc" }, take: 50 });
  }

  @Post("companies/:companyCode/select")
  async selectCompany(@Param("companyCode") companyCode: string) {
    const company = await prisma.company.findUnique({ where: { code: companyCode } });
    if (!company) return { selectedCompanyCode: companyCode, found: false };
    const user = await prisma.user.findUnique({ where: { email: DEV_EMAIL } });
    await writeAudit({ companyId: company.id, userId: user?.id, action: "company.selected", metadata: { source: "portal", companyCode } });
    return { selectedCompanyId: company.id, selectedCompanyCode: company.code, found: true };
  }
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
