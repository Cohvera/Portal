import { Controller, Get } from "@nestjs/common";
import { prisma } from "@cohvera/database";
import { portalAdmin } from "./auth/context";
import { groupMappings } from "./auth/groups";
@Controller("admin/accounts")
export class AccountsController {
  @Get() async overview() {
    portalAdmin();
    const users = await prisma.user.findMany({
      select: {
        id: true,
        displayName: true,
        email: true,
        isActive: true,
        entraObjectId: true,
        createdAt: true,
        memberships: {
          select: {
            company: { select: { name: true, code: true } },
            role: { select: { name: true, key: true } },
          },
        },
      },
      orderBy: { displayName: "asc" },
    });
    const logins = await prisma.auditLog.findMany({
      where: { action: "auth.login", userId: { in: users.map((u) => u.id) } },
      orderBy: { createdAt: "desc" },
      distinct: ["userId"],
      select: { userId: true, createdAt: true, metadata: true },
    });
    let mappings: ReturnType<typeof groupMappings> = [],
      configurationError = false;
    try {
      mappings = groupMappings();
    } catch {
      configurationError = true;
    }
    return {
      mappings,
      configurationError,
      users: users.map((user) => {
        const login = logins.find((l) => l.userId === user.id);
        const metadata = login?.metadata as
          | {
              roles?: string[];
              groups?: unknown[];
              groupsClaimPresent?: boolean;
            }
          | undefined;
        return {
          ...user,
          lastLoginAt: login?.createdAt ?? null,
          portalRoles: metadata?.roles || [],
          groups: metadata?.groups || [],
          groupsSynced: Array.isArray(metadata?.groups),
          groupsClaimPresent: metadata?.groupsClaimPresent ?? false,
        };
      }),
    };
  }
}
