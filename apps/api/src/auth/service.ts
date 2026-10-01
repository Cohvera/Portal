import {
  ForbiddenException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { uuidPattern } from "./policy";
export const projectReadRole = "Projects.Read.All";
type ServiceSettings = {
  tenant: string;
  audience: string;
  clients: Record<string, string[]>;
};
export function serviceSettings(): ServiceSettings {
  const tenant =
    process.env.ENTRA_TENANT_ID || process.env.AZURE_AD_TENANT_ID || "";
  const audience = process.env.ENTRA_API_AUDIENCE || "";
  let clients: unknown;
  try {
    clients = JSON.parse(process.env.ENTRA_SERVICE_CLIENTS || "{}");
  } catch {
    throw new ServiceUnavailableException("Ongeldige serviceconfiguratie.");
  }
  if (
    !uuidPattern.test(tenant) ||
    !uuidPattern.test(audience) ||
    !clients ||
    typeof clients !== "object" ||
    Array.isArray(clients)
  )
    throw new ServiceUnavailableException(
      "Applicatie-authenticatie is niet geconfigureerd.",
    );
  const normalized: Record<string, string[]> = {};
  for (const [id, codes] of Object.entries(clients)) {
    if (
      !uuidPattern.test(id) ||
      !Array.isArray(codes) ||
      !codes.length ||
      codes.some(
        (c) => typeof c !== "string" || !/^[A-Z0-9_-]{1,32}$/.test(c),
      ) ||
      normalized[id.toLowerCase()]
    )
      throw new ServiceUnavailableException("Ongeldige serviceconfiguratie.");
    normalized[id.toLowerCase()] = [...new Set(codes)];
  }
  return {
    tenant: tenant.toLowerCase(),
    audience: audience.toLowerCase(),
    clients: normalized,
  };
}
let jwks: { tenant: string; resolver: JWTVerifyGetKey } | undefined;
function microsoftKeys(tenant: string) {
  if (jwks?.tenant !== tenant)
    jwks = {
      tenant,
      resolver: createRemoteJWKSet(
        new URL(
          `https://login.microsoftonline.com/${tenant}/discovery/v2.0/keys`,
        ),
        { timeoutDuration: 5000 },
      ),
    };
  return jwks.resolver;
}
export async function verifyServiceToken(
  token: string,
  settings = serviceSettings(),
  keys?: JWTVerifyGetKey,
) {
  let payload;
  try {
    ({ payload } = await jwtVerify(
      token,
      keys || microsoftKeys(settings.tenant),
      {
        algorithms: ["RS256"],
        issuer: `https://login.microsoftonline.com/${settings.tenant}/v2.0`,
        audience: settings.audience,
        requiredClaims: ["exp", "iat", "tid", "azp", "idtyp", "roles", "ver"],
      },
    ));
  } catch {
    throw new UnauthorizedException("Ongeldig of verlopen applicatietoken.");
  }
  if (
    payload.ver !== "2.0" ||
    payload.tid !== settings.tenant ||
    payload.idtyp !== "app" ||
    payload.scp !== undefined ||
    typeof payload.azp !== "string" ||
    !uuidPattern.test(payload.azp)
  )
    throw new UnauthorizedException("Een Entra v2 applicatietoken is vereist.");
  const clientId = payload.azp.toLowerCase();
  if (
    !Array.isArray(payload.roles) ||
    !payload.roles.includes(projectReadRole) ||
    !Object.hasOwn(settings.clients, clientId)
  )
    throw new ForbiddenException(
      "Deze applicatie heeft geen projectleestoegang.",
    );
  return { clientId, companyCodes: settings.clients[clientId] };
}
