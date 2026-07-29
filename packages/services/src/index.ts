import { prisma } from "@cohvera/database";
import { pluginCatalog } from "@cohvera/plugin-sdk";

export async function syncPluginRegistry(): Promise<void> {
  for (const manifest of pluginCatalog) {
    await prisma.plugin.upsert({
      where: { id: manifest.id },
      update: { name: manifest.name, version: manifest.version, apiVersion: manifest.apiVersion },
      create: { id: manifest.id, name: manifest.name, version: manifest.version, apiVersion: manifest.apiVersion }
    });
  }
}

export async function writeAudit(input: {
  companyId: string; userId?: string; pluginId?: string; action: string;
  entityType?: string; entityId?: string; metadata?: Record<string, unknown>;
}): Promise<void> {
  await prisma.auditLog.create({ data: input });
}

export async function notify(input: { companyId: string; userId?: string; title: string; body: string }): Promise<void> {
  await prisma.notification.create({ data: input });
}
