import "reflect-metadata";
import { Controller, Get, Headers, Module, Param, Post, Query } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { developmentIdentity } from "@cohvera/auth";
import { prisma } from "@cohvera/database";
import { pluginCatalog } from "@cohvera/plugin-sdk";
import { syncPluginRegistry, writeAudit } from "@cohvera/services";

const DEV_EMAIL = "remko@cohvera.be";

@Controller()
class AppController {
  @Get("health")
  health() {
    return { status: "ok", service: "cohvera-api", version: "0.3.0" };
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
