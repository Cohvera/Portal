import "reflect-metadata";
import { Controller, Get, Headers, Module, Param, Post } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { developmentIdentity } from "@cohvera/auth";
import { prisma } from "@cohvera/database";
import { pluginCatalog } from "@cohvera/plugin-sdk";
import { syncPluginRegistry, writeAudit } from "@cohvera/services";

@Controller()
class AppController {
  @Get("health") health() { return { status: "ok", service: "cohvera-api", version: "0.2.0" }; }

  @Get("session") session(@Headers("x-company-code") companyCode?: string) {
    return developmentIdentity(companyCode || "COH");
  }

  @Get("companies") async companies() {
    return prisma.company.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
  }

  @Get("plugins") async plugins(@Headers("x-company-id") companyId?: string) {
    if (!companyId) return pluginCatalog;
    const enabled = await prisma.companyPlugin.findMany({ where: { companyId, enabled: true }, include: { plugin: true } });
    const enabledIds = new Set(enabled.map((item) => item.pluginId));
    return pluginCatalog.filter((plugin) => enabledIds.has(plugin.id));
  }

  @Get("notifications/:companyId") async notifications(@Param("companyId") companyId: string) {
    return prisma.notification.findMany({ where: { companyId }, orderBy: { createdAt: "desc" }, take: 20 });
  }

  @Get("audit/:companyId") async audit(@Param("companyId") companyId: string) {
    return prisma.auditLog.findMany({ where: { companyId }, orderBy: { createdAt: "desc" }, take: 50 });
  }

  @Post("companies/:companyId/select") async selectCompany(@Param("companyId") companyId: string) {
    await writeAudit({ companyId, action: "company.selected", metadata: { source: "portal" } });
    return { selectedCompanyId: companyId };
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
