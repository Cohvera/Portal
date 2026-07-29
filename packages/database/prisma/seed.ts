import { PrismaClient, PluginState } from "@prisma/client";

const prisma = new PrismaClient();

const permissions = [
  "portal.admin", "companies.read", "companies.switch", "users.read", "users.manage",
  "plugins.read", "plugins.manage", "notifications.read", "audit.read",
  "inspections.read", "inspections.write", "solar.read", "solar.write",
  "charging-workorders.read", "charging-workorders.write", "ventilation.read"
];

async function main() {
  const companies = await Promise.all([
    prisma.company.upsert({ where: { code: "COH" }, update: {}, create: { code: "COH", name: "Cohvera" } }),
    prisma.company.upsert({ where: { code: "QHOME" }, update: {}, create: { code: "QHOME", name: "Q-Home" } }),
    prisma.company.upsert({ where: { code: "TOMME" }, update: {}, create: { code: "TOMME", name: "Tomme Energie" } }),
    prisma.company.upsert({ where: { code: "WARCO" }, update: {}, create: { code: "WARCO", name: "Warco" } })
  ]);

  const permissionRows = await Promise.all(permissions.map((key) => prisma.permission.upsert({ where: { key }, update: {}, create: { key } })));
  const adminRole = await prisma.role.upsert({ where: { key: "portal-admin" }, update: {}, create: { key: "portal-admin", name: "Portal Admin" } });
  await Promise.all(permissionRows.map((permission) => prisma.rolePermission.upsert({
    where: { roleId_permissionId: { roleId: adminRole.id, permissionId: permission.id } },
    update: {}, create: { roleId: adminRole.id, permissionId: permission.id }
  })));

  const user = await prisma.user.upsert({ where: { email: "remko@cohvera.be" }, update: { displayName: "Remko" }, create: { email: "remko@cohvera.be", displayName: "Remko" } });
  await Promise.all(companies.map((company) => prisma.companyMembership.upsert({
    where: { userId_companyId: { userId: user.id, companyId: company.id } },
    update: { roleId: adminRole.id }, create: { userId: user.id, companyId: company.id, roleId: adminRole.id }
  })));

  const plugins = [
    ["ventilation-cloud", "Ventilatie Cloud"], ["inspections", "Keuringen"],
    ["solar-subcontracting", "Solar Onderaanneming"], ["charging-workorders", "Laadpaal Werkbon"]
  ] as const;
  for (const [id, name] of plugins) {
    await prisma.plugin.upsert({ where: { id }, update: { name, version: "0.1.0" }, create: { id, name, version: "0.1.0", apiVersion: "1", state: PluginState.ACTIVE } });
    await Promise.all(companies.map((company) => prisma.companyPlugin.upsert({
      where: { companyId_pluginId: { companyId: company.id, pluginId: id } }, update: {}, create: { companyId: company.id, pluginId: id }
    })));
  }
}

main().finally(() => prisma.$disconnect());
