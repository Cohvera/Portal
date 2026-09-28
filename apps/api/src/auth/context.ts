import { AsyncLocalStorage } from "node:async_hooks";
import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { prisma, Prisma } from "@cohvera/database";
import { isPortalAdmin, isPortalUser } from "./policy";
export const actorInclude = {
  memberships: {
    include: {
      company: true,
      role: { include: { permissions: { include: { permission: true } } } },
    },
  },
} as const;
export type Actor = Prisma.UserGetPayload<{ include: typeof actorInclude }>;
export type AuthContext = {
  actor: Actor | null;
  roles: string[];
  mode: "development" | "entra";
  sessionHash?: string;
};
export const authContext = new AsyncLocalStorage<AuthContext>();
export function context() {
  const ctx = authContext.getStore();
  if (!ctx?.actor || !ctx.actor.isActive || !isPortalUser(ctx.roles))
    throw new UnauthorizedException("Meld je aan met je Cohvera-account.");
  return ctx as AuthContext & { actor: Actor };
}
export function currentActor() {
  return context().actor;
}
export function portalAdmin() {
  const ctx = context();
  if (!isPortalAdmin(ctx.roles))
    throw new ForbiddenException(
      "Alleen een Cohvera-portaalbeheerder mag dit beheren.",
    );
  return ctx.actor;
}
export function membership(code: string, permission?: string) {
  const ctx = context(),
    m = ctx.actor.memberships.find(
      (m) => m.company.code === code && m.company.isActive,
    );
  if (!m) throw new ForbiddenException("Geen toegang tot dit bedrijf.");
  // A legacy portal-admin database role is a business administrator only in Entra mode.
  const businessAdmin =
    m.role.permissions.some((p) => p.permission.key === "portal.admin") ||
    m.role.key === "company-admin";
  if (
    permission &&
    !businessAdmin &&
    !m.role.permissions.some((p) => p.permission.key === permission)
  )
    throw new ForbiddenException(
      "Je bedrijfsrol geeft geen recht op deze handeling.",
    );
  return m;
}
export function allowedCompanies() {
  return currentActor()
    .memberships.filter((m) => m.company.isActive)
    .map((m) => m.company);
}
export async function developmentContext(): Promise<AuthContext> {
  const actor = await prisma.user.findUnique({
    where: { email: "remko@cohvera.be" },
    include: actorInclude,
  });
  const admin = actor?.memberships.some(
    (m) =>
      m.company.code === "COH" &&
      m.company.isActive &&
      m.role.permissions.some((p) => p.permission.key === "portal.admin"),
  );
  return {
    actor,
    roles: admin ? ["Portal.Admin"] : ["Portal.User"],
    mode: "development",
  };
}
