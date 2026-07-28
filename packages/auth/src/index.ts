export interface PortalIdentity {
  userId: string;
  email: string;
  displayName: string;
  companyId: string;
  companyCode: string;
  permissions: string[];
}

export function hasPermission(identity: PortalIdentity, permission: string): boolean {
  return identity.permissions.includes("portal.admin") || identity.permissions.includes(permission);
}

export function requirePermission(identity: PortalIdentity, permission: string): void {
  if (!hasPermission(identity, permission)) throw new Error(`Forbidden: ${permission}`);
}

export function developmentIdentity(companyCode = "COH"): PortalIdentity {
  return {
    userId: "development-user",
    email: "remko@cohvera.be",
    displayName: "Remko",
    companyId: `development-${companyCode.toLowerCase()}`,
    companyCode,
    permissions: ["portal.admin"]
  };
}
