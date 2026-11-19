import { createHash, randomBytes } from "node:crypto";
import type { Request, Response } from "express";
import { prisma } from "@cohvera/database";
import { actorInclude, AuthContext, developmentContext } from "./context";
import { authMode, entraSettings } from "./config";
import { isPortalUser } from "./policy";
export const opaqueToken = () => randomBytes(32).toString("base64url");
export const hashToken = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export function cookie(req: Request, name: string) {
  const values = (req.headers.cookie || "")
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.startsWith(`${name}=`));
  if (values.length !== 1) return "";
  const value = values[0].slice(name.length + 1);
  return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : "";
}
// Renew browser persistence on use; the server session itself has no timeout.
export const sessionCookieOptions = () => ({
  httpOnly: true,
  secure: entraSettings().secure,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 400 * 86400000,
});
export async function requestContext(req: Request, res?: Response): Promise<AuthContext> {
  if (authMode() === "development") return developmentContext();
  const empty: AuthContext = { actor: null, roles: [], mode: "entra" };
  const token = cookie(req, "cohvera_session");
  if (!token) return empty;
  const tokenHash = hashToken(token),
    s = await prisma.portalSession.findUnique({
      where: { tokenHash },
      include: { user: { include: actorInclude } },
    });
  if (
    !s ||
    (s.expiresAt !== null && s.expiresAt <= new Date()) ||
    !s.user.isActive ||
    !isPortalUser(s.roles) ||
    s.tenantId !== entraSettings().tenant ||
    s.user.entraTenantId !== s.tenantId
  )
    return empty;
  if (req.path?.replace(/\/$/, "") !== "/auth/logout")
    res?.cookie("cohvera_session", token, sessionCookieOptions());
  return {
    actor: s.user,
    roles: s.roles,
    mode: "entra",
    sessionHash: tokenHash,
  };
}
