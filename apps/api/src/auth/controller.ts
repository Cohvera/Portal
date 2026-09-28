import { Controller, Get, Post, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import * as oidc from "openid-client";
import { prisma, Prisma } from "@cohvera/database";
import { authMode, entraSettings } from "./config";
import { allowedCompanies, context } from "./context";
import { isPortalAdmin, identityClaims } from "./policy";
import { cookie, hashToken, opaqueToken } from "./session";
let configuration: Promise<oidc.Configuration> | undefined;
export function oidcConfiguration() {
  if (!configuration) {
    const s = entraSettings();
    configuration = oidc
      .discovery(
        new URL(`https://login.microsoftonline.com/${s.tenant}/v2.0`),
        s.clientId,
        s.secret,
        undefined,
        { execute: [oidc.enableNonRepudiationChecks], timeout: 10 },
      )
      .catch((e) => {
        configuration = undefined;
        throw e;
      });
  }
  return configuration;
}
const cookieOptions = () => ({
  httpOnly: true,
  secure: entraSettings().secure,
  sameSite: "lax" as const,
  path: "/",
});
@Controller("auth")
export class AuthController {
  @Get("config") config() {
    let configured = false;
    try {
      entraSettings();
      configured = true;
    } catch {}
    return { mode: authMode(), configured };
  }
  @Get("me") me() {
    const ctx = context();
    return {
      userId: ctx.actor.id,
      displayName: ctx.actor.displayName,
      email: ctx.actor.email,
      roles: ctx.roles,
      mode: ctx.mode,
      companies: allowedCompanies(),
      businessAccess: ctx.actor.memberships
        .filter((m) => m.company.isActive)
        .map((m) => ({
          companyCode: m.company.code,
          permissions: m.role.permissions
            .map((p) => p.permission.key)
            .filter((k) => k !== "portal.admin"),
          businessAdmin:
            m.role.key === "company-admin" ||
            m.role.permissions.some((p) => p.permission.key === "portal.admin"),
        })),
      canManageCatalog: isPortalAdmin(ctx.roles),
      canManageAccounts: isPortalAdmin(ctx.roles),
    };
  }
  @Get("login") async login(@Res() res: Response) {
    res.setHeader("Cache-Control", "no-store");
    if (authMode() === "development") return res.redirect("/");
    try {
      const s = entraSettings(),
        config = await oidcConfiguration(),
        token = opaqueToken(),
        state = oidc.randomState(),
        nonce = oidc.randomNonce(),
        verifier = oidc.randomPKCECodeVerifier();
      await prisma.entraLoginAttempt.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
      await prisma.portalSession.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
      await prisma.entraLoginAttempt.create({
        data: {
          tokenHash: hashToken(token),
          state,
          nonce,
          verifier,
          expiresAt: new Date(Date.now() + 600000),
        },
      });
      const destination = oidc.buildAuthorizationUrl(config, {
        redirect_uri: s.redirect,
        scope: "openid profile email",
        response_type: "code",
        response_mode: "query",
        state,
        nonce,
        code_challenge: await oidc.calculatePKCECodeChallenge(verifier),
        code_challenge_method: "S256",
      });
      res.cookie("cohvera_login", token, {
        ...cookieOptions(),
        maxAge: 600000,
      });
      return res.redirect(destination.href);
    } catch {
      return res.redirect("/login?error=configuration");
    }
  }
  @Get("callback") async callback(@Req() req: Request, @Res() res: Response) {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Referrer-Policy", "no-referrer");
    if (authMode() !== "entra")
      return res.redirect("/login?error=configuration");
    try {
      const s = entraSettings(),
        token = cookie(req, "cohvera_login");
      res.clearCookie("cohvera_login", cookieOptions());
      if (!token) throw new Error("invalid_flow");
      const tokenHash = hashToken(token),
        attempt = await prisma.entraLoginAttempt.findUnique({
          where: { tokenHash },
        });
      if (!attempt || attempt.expiresAt <= new Date())
        throw new Error("invalid_flow");
      if (
        !(
          await prisma.entraLoginAttempt.deleteMany({
            where: { tokenHash, expiresAt: { gt: new Date() } },
          })
        ).count
      )
        throw new Error("invalid_flow");
      const callback = new URL(s.redirect);
      callback.search = new URL(req.originalUrl, "http://internal").search;
      const tokens = await oidc.authorizationCodeGrant(
        await oidcConfiguration(),
        callback,
        {
          pkceCodeVerifier: attempt.verifier,
          expectedState: attempt.state,
          expectedNonce: attempt.nonce,
          idTokenExpected: true,
        },
      );
      const claims = tokens.claims();
      if (!claims) throw new Error("invalid_identity");
      const identity = identityClaims(claims, s.tenant);
      const sessionToken = opaqueToken();
      await prisma.$transaction(async (tx) => {
        const existing = await tx.user.findUnique({
          where: {
            entraTenantId_entraObjectId: {
              entraTenantId: identity.tenantId,
              entraObjectId: identity.objectId,
            },
          },
        });
        if (existing && !existing.isActive) throw new Error("account_disabled");
        // Never grant an existing account's memberships by matching an email claim.
        const collision = await tx.user.findUnique({
          where: { email: identity.email },
        });
        if (collision && collision.id !== existing?.id)
          throw new Error("identity_link_required");
        const profile = {
          email: identity.email,
          displayName: identity.displayName,
        };
        const user = existing
          ? await tx.user.update({ where: { id: existing.id }, data: profile })
          : await tx.user.create({
              data: {
                ...profile,
                entraTenantId: identity.tenantId,
                entraObjectId: identity.objectId,
              },
            });
        await tx.portalSession.create({
          data: {
            tokenHash: hashToken(sessionToken),
            userId: user.id,
            roles: identity.roles,
            tenantId: identity.tenantId,
            expiresAt: new Date(
              Math.min(identity.expiresAt, Date.now() + s.sessionMs),
            ),
          },
        });
        const coh = await tx.company.findUnique({ where: { code: "COH" } });
        if (coh)
          await tx.auditLog.create({
            data: {
              companyId: coh.id,
              userId: user.id,
              action: "auth.login",
              entityType: "user",
              entityId: user.id,
              metadata: { provider: "entra", roles: identity.roles },
            },
          });
      });
      const previous = cookie(req, "cohvera_session");
      if (previous)
        await prisma.portalSession.deleteMany({
          where: { tokenHash: hashToken(previous) },
        });
      res.cookie("cohvera_session", sessionToken, {
        ...cookieOptions(),
        maxAge: Math.min(identity.expiresAt - Date.now(), s.sessionMs),
      });
      return res.redirect("/");
    } catch (e) {
      const message = e instanceof Error ? e.message : "";
      const safe = [
        "no_portal_role",
        "identity_link_required",
        "account_disabled",
      ].includes(message)
        ? message
        : e instanceof Prisma.PrismaClientKnownRequestError &&
            e.code === "P2002"
          ? "identity_link_required"
          : "invalid_flow";
      // Deliberately no exception logging: OIDC errors can contain sensitive response data.
      return res.redirect(`/login?error=${safe}`);
    }
  }
  @Post("logout") async logout(@Res() res: Response) {
    const ctx = context();
    res.setHeader("Cache-Control", "no-store");
    if (ctx.sessionHash)
      await prisma.portalSession.deleteMany({
        where: { tokenHash: ctx.sessionHash },
      });
    if (ctx.mode === "entra") {
      res.clearCookie("cohvera_session", cookieOptions());
      res.clearCookie("cohvera_login", cookieOptions());
      try {
        return res.redirect(
          303,
          oidc.buildEndSessionUrl(await oidcConfiguration(), {
            post_logout_redirect_uri: `${entraSettings().origin}/login`,
          }).href,
        );
      } catch {}
    }
    return res.redirect(303, "/login");
  }
}
