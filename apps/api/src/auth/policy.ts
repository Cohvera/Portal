export const isPortalUser = (roles: readonly string[]) =>
  roles.includes("Portal.User") || roles.includes("Portal.Admin");
export const isPortalAdmin = (roles: readonly string[]) =>
  roles.includes("Portal.Admin");
export const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function identityClaims(
  claims: Record<string, unknown>,
  tenantId: string,
) {
  if (
    claims.tid !== tenantId ||
    typeof claims.oid !== "string" ||
    !uuidPattern.test(claims.oid)
  )
    throw new Error("invalid_identity");
  const roles = Array.isArray(claims.roles)
    ? claims.roles.filter(
        (r): r is string => r === "Portal.User" || r === "Portal.Admin",
      )
    : [];
  if (!isPortalUser(roles)) throw new Error("no_portal_role");
  if (typeof claims.exp !== "number" || claims.exp * 1000 <= Date.now())
    throw new Error("expired_identity");
  const address =
    typeof claims.email === "string"
      ? claims.email
      : typeof claims.preferred_username === "string"
        ? claims.preferred_username
        : "";
  return {
    tenantId,
    objectId: claims.oid.toLowerCase(),
    roles,
    expiresAt: claims.exp * 1000,
    displayName:
      typeof claims.name === "string"
        ? claims.name.slice(0, 100)
        : "Microsoft-gebruiker",
    email:
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) && address.length <= 254
        ? address.toLowerCase()
        : `${claims.oid}@identity.invalid`,
  };
}
