import { Prisma } from "@cohvera/database";
import { uuidPattern } from "./policy";
export const businessRoles = [
  "viewer",
  "employee",
  "manager",
  "company-admin",
] as const;
export type GroupMapping = {
  groupId?: string;
  groupName?: string;
  name: string;
  companyCode: string;
  roleKey: (typeof businessRoles)[number];
};
export const defaultGroupMappings = [
  { groupName: "SG-QHOME-All", companyCode: "QHOME", roleKey: "employee" },
  { groupName: "SG-TOMME-All", companyCode: "TOMME", roleKey: "employee" },
  { groupName: "SG-WARCO-All", companyCode: "WARCO", roleKey: "employee" },
  { groupName: "SG-COHVERA-Management", companyCode: "WARCO", roleKey: "manager" },
];
export function groupMappings(
  raw = process.env.ENTRA_GROUP_MAPPINGS ||
    JSON.stringify(defaultGroupMappings),
): GroupMapping[] {
  let rows: unknown;
  try {
    rows = JSON.parse(raw);
  } catch {
    throw new Error("group_configuration");
  }
  if (!Array.isArray(rows) || rows.length > 200)
    throw new Error("group_configuration");
  return rows.map((row) => {
    if (
      !row ||
      typeof row !== "object" ||
      !(
        (typeof row.groupId === "string" &&
          uuidPattern.test(row.groupId) &&
          row.groupName === undefined) ||
        (row.groupId === undefined &&
          typeof row.groupName === "string" &&
          row.groupName.length > 0 &&
          row.groupName.length <= 150 &&
          row.groupName.trim() === row.groupName &&
          !uuidPattern.test(row.groupName))
      ) ||
      typeof row.companyCode !== "string" ||
      !/^[A-Z0-9_-]{1,32}$/.test(row.companyCode) ||
      !businessRoles.includes(row.roleKey) ||
      (row.name !== undefined &&
        (typeof row.name !== "string" || row.name.length > 150))
    )
      throw new Error("group_configuration");
    return {
      ...(row.groupId
        ? { groupId: row.groupId.toLowerCase() }
        : { groupName: row.groupName }),
      name: row.name || row.groupName || row.groupId,
      companyCode: row.companyCode,
      roleKey: row.roleKey,
    };
  });
}
export function companyAccess(
  claims: Record<string, unknown>,
  mappings = groupMappings(),
) {
  const names = claims._claim_names;
  if (
    claims.hasgroups ||
    (names && typeof names === "object" && "groups" in names)
  )
    throw new Error("groups_overage");
  if (
    claims.groups !== undefined &&
    (!Array.isArray(claims.groups) ||
      claims.groups.some((g) => typeof g !== "string" || !g || g.length > 256))
  )
    throw new Error("invalid_groups");
  const values = (claims.groups as string[] | undefined) || [];
  if (
    mappings.length &&
    mappings.every((m) => m.groupName) &&
    values.length &&
    values.every((g) => uuidPattern.test(g))
  )
    throw new Error("group_names_required");
  const groups = new Set(values);
  const ids = new Set(
    values.filter((g) => uuidPattern.test(g)).map((g) => g.toLowerCase()),
  );
  // Exact names from the verified ID token only; never infer groups from email or roles.
  const matched = mappings.filter((m) =>
    m.groupName ? groups.has(m.groupName) : !!m.groupId && ids.has(m.groupId),
  );
  const assignments = new Map<string, GroupMapping>();
  for (const mapping of matched) {
    const old = assignments.get(mapping.companyCode);
    if (
      !old ||
      businessRoles.indexOf(mapping.roleKey) >
        businessRoles.indexOf(old.roleKey)
    )
      assignments.set(mapping.companyCode, mapping);
  }
  return {
    receivedGroups: [...groups],
    matched,
    assignments: [...assignments.values()],
    groupsClaimPresent: Array.isArray(claims.groups),
  };
}
export async function syncCompanyAccess(
  tx: Prisma.TransactionClient,
  userId: string,
  access: ReturnType<typeof companyAccess>,
) {
  const [companies, roles] = await Promise.all([
    tx.company.findMany({
      where: {
        code: { in: access.assignments.map((m) => m.companyCode) },
        isActive: true,
      },
    }),
    tx.role.findMany({
      where: { key: { in: access.assignments.map((m) => m.roleKey) } },
    }),
  ]);
  const data = access.assignments.map((m) => {
    const company = companies.find((c) => c.code === m.companyCode),
      role = roles.find((r) => r.key === m.roleKey);
    if (!company || !role) throw new Error("group_configuration");
    return { userId, companyId: company.id, roleId: role.id };
  });
  await tx.companyMembership.deleteMany({ where: { userId } });
  if (data.length) await tx.companyMembership.createMany({ data });
}
