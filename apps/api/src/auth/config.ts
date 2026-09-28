import { ServiceUnavailableException } from "@nestjs/common";
import { uuidPattern } from "./policy";
export function authMode() {
  const mode = process.env.AUTH_MODE;
  if (mode !== "development" && mode !== "entra")
    throw new Error("AUTH_MODE moet expliciet development of entra zijn.");
  return mode;
}
export function entraSettings() {
  const tenant =
      process.env.ENTRA_TENANT_ID || process.env.AZURE_AD_TENANT_ID || "",
    clientId =
      process.env.ENTRA_CLIENT_ID || process.env.AZURE_AD_CLIENT_ID || "",
    secret =
      process.env.ENTRA_CLIENT_SECRET ||
      process.env.AZURE_AD_CLIENT_SECRET ||
      "",
    redirect = process.env.ENTRA_REDIRECT_URI || "";
  if (
    !uuidPattern.test(tenant) ||
    !uuidPattern.test(clientId) ||
    !secret ||
    !redirect
  )
    throw new ServiceUnavailableException(
      "De Microsoft-aanmelding is nog niet volledig geconfigureerd.",
    );
  let url: URL;
  try {
    url = new URL(redirect);
  } catch {
    throw new ServiceUnavailableException(
      "Ongeldige Entra callbackconfiguratie.",
    );
  }
  if (
    url.pathname !== "/auth/callback" ||
    url.search ||
    url.hash ||
    url.username ||
    url.password ||
    (url.protocol !== "https:" &&
      !(
        process.env.NODE_ENV !== "production" &&
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname)
      ))
  )
    throw new ServiceUnavailableException(
      "Gebruik een veilige callback-URL met pad /auth/callback.",
    );
  const minutes = Number(process.env.ENTRA_SESSION_MINUTES || 15);
  if (!Number.isInteger(minutes) || minutes < 5 || minutes > 60)
    throw new ServiceUnavailableException(
      "ENTRA_SESSION_MINUTES moet tussen 5 en 60 liggen.",
    );
  return {
    tenant: tenant.toLowerCase(),
    clientId,
    secret,
    redirect: url.href,
    origin: url.origin,
    secure: url.protocol === "https:",
    sessionMs: minutes * 60000,
  };
}
export function publicOrigin() {
  return authMode() === "entra"
    ? entraSettings().origin
    : new URL(process.env.WEB_URL || "http://localhost:3000").origin;
}
