import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@cohvera/database";
import { configuredApp } from "../main";
import { hashToken, opaqueToken } from "./session";

test(
  "Entra API: deny-by-default, rol/businessscheiding, CSRF, verlopen sessies en directe endpoints",
  { skip: process.env.AUTH_INTEGRATION_TEST !== "1" },
  async () => {
    process.env.AUTH_MODE = "entra";
    process.env.ENTRA_TENANT_ID = "11111111-1111-4111-8111-111111111111";
    process.env.ENTRA_CLIENT_ID = "22222222-2222-4222-8222-222222222222";
    process.env.ENTRA_CLIENT_SECRET = "synthetic-test-only";
    process.env.ENTRA_REDIRECT_URI = "https://portal.example/auth/callback";
    const ids: string[] = [],
      sessionTokens: Record<string, string> = {};
    let app: Awaited<ReturnType<typeof configuredApp>> | undefined;
    try {
      const company = await prisma.company.findUniqueOrThrow({
          where: { code: "TOMME" },
        }),
        role = await prisma.role.findUniqueOrThrow({
          where: { key: "viewer" },
        }),
        business = await prisma.role.findUniqueOrThrow({
          where: { key: "company-admin" },
        });
      for (const [name, roles, roleId, expired] of [
        ["none", [], role.id, false],
        ["user", ["Portal.User"], role.id, false],
        ["admin", ["Portal.Admin"], role.id, false],
        ["both", ["Portal.Admin", "Portal.User"], role.id, false],
        ["business", ["Portal.User"], business.id, false],
        ["expired", ["Portal.Admin"], role.id, true],
        ["unassigned", ["Portal.User"], null, false],
      ] as const) {
        const user = await prisma.user.create({
          data: {
            email: `test-${randomUUID()}@example.invalid`,
            displayName: `Synthetic ${name}`,
            entraTenantId: process.env.ENTRA_TENANT_ID,
            entraObjectId: randomUUID(),
            ...(roleId
              ? { memberships: { create: { companyId: company.id, roleId } } }
              : {}),
          },
        });
        ids.push(user.id);
        const token = opaqueToken();
        sessionTokens[name] = token;
        await prisma.portalSession.create({
          data: {
            tokenHash: hashToken(token),
            userId: user.id,
            roles: [...roles],
            tenantId: process.env.ENTRA_TENANT_ID!,
            expiresAt: new Date(Date.now() + (expired ? -1000 : 60000)),
          },
        });
      }
      app = await configuredApp();
      app.useLogger(false);
      await app.listen(0, "127.0.0.1");
      const root = await app.getUrl();
      async function req(
        path: string,
        user?: string,
        method = "GET",
        body?: unknown,
        origin = "https://portal.example",
      ) {
        return fetch(root + path, {
          method,
          headers: {
            ...(user
              ? { cookie: `cohvera_session=${sessionTokens[user]}` }
              : {
                  "x-user-email": "remko@cohvera.be",
                  "x-plugin-admin-token": "pretend-admin",
                }),
            ...(body !== undefined
              ? { "Content-Type": "application/json" }
              : {}),
            ...(origin ? { Origin: origin } : {}),
          },
          body: body !== undefined ? JSON.stringify(body) : undefined,
          redirect: "manual",
        });
      }
      assert.equal((await req("/health")).status, 200);
      for (const user of [undefined, "none", "expired"])
        assert.equal((await req("/companies", user)).status, 401);
      for (const user of ["user", "admin", "both"]) {
        const r = await req("/companies", user);
        assert.equal(r.status, 200);
        const rows = await r.json();
        assert.equal(rows.length, 1);
        assert.equal(rows[0].code, "TOMME");
      }
      for (const user of ["user", "business"]) {
        assert.equal((await req("/admin/accounts", user)).status, 403);
        assert.equal((await req("/admin/plugins", user)).status, 403);
        assert.equal((await req("/catalog", user, "POST", {})).status, 403);
        assert.equal(
          (
            await req("/catalog/inspections/companies", user, "PATCH", {
              companyCodes: ["TOMME"],
            })
          ).status,
          403,
        );
      }
      for (const user of ["admin", "both"])
        assert.equal((await req("/admin/accounts", user)).status, 200);
      assert.equal(
        (await req("/companies/TOMME/projects", "user")).status,
        200,
      );
      assert.equal(
        (await req("/companies/TOMME/projects", "user", "POST", {})).status,
        403,
      );
      assert.equal(
        (await req("/companies/QHOME/projects", "admin")).status,
        403,
      );
      assert.equal(
        (await req("/session?companyCode=QHOME", "user")).status,
        403,
      );
      assert.equal(
        (await req("/companies/TOMME/inspections", "user")).status,
        200,
      );
      assert.equal(
        (await req("/companies/TOMME/inspections", "user", "POST", {})).status,
        403,
      );
      assert.equal(
        (
          await req(
            "/companies/TOMME/projects",
            "business",
            "POST",
            {},
            "https://evil.invalid",
          )
        ).status,
        403,
      );
      assert.equal(
        (await req("/companies/TOMME/projects", "business", "POST", {}, ""))
          .status,
        403,
      );
      assert.equal(
        (await req("/companies/TOMME/projects", "business", "POST", {})).status,
        400,
      ); // Authorized, input validation runs.
      assert.deepEqual(
        await (await req("/companies", "unassigned")).json(),
        [],
      );
      assert.equal(
        (await req("/companies/TOMME/projects", "unassigned")).status,
        403,
      );
      assert.equal((await req("/admin/accounts", "unassigned")).status, 403);
      await prisma.user.update({
        where: { id: ids[1] },
        data: { isActive: false },
      });
      assert.equal((await req("/companies", "user")).status, 401);
      // Direct business-role changes cannot grant Portal.Admin.
      await prisma.companyMembership.update({
        where: { userId_companyId: { userId: ids[4], companyId: company.id } },
        data: {
          roleId: (
            await prisma.role.findUniqueOrThrow({
              where: { key: "portal-admin" },
            })
          ).id,
        },
      });
      assert.equal((await req("/admin/accounts", "business")).status, 403);
      // Deletion is administrator-only, cannot target self, and revokes sessions.
      assert.equal((await req(`/admin/accounts/${ids[6]}`, "business", "DELETE", {})).status, 403);
      assert.equal((await req(`/admin/accounts/${ids[2]}`, "admin", "DELETE", {})).status, 403);
      assert.equal((await req(`/admin/accounts/${ids[6]}`, "admin", "DELETE", {}, "https://evil.invalid")).status, 403);
      const history = await prisma.auditLog.create({ data: { companyId: company.id, userId: ids[6], action: "test.history" } });
      const notification = await prisma.notification.create({ data: { companyId: company.id, userId: ids[6], title: "Test", body: "Test" } });
      try {
        assert.equal((await req(`/admin/accounts/${ids[6]}`, "admin", "DELETE", {})).status, 200);
        assert.equal(await prisma.user.findUnique({ where: { id: ids[6] } }), null);
        assert.equal(await prisma.portalSession.count({ where: { userId: ids[6] } }), 0);
        assert.equal(await prisma.notification.findUnique({ where: { id: notification.id } }), null);
        assert.equal((await prisma.auditLog.findUniqueOrThrow({ where: { id: history.id } })).userId, null);
        assert.equal((await req("/auth/me", "unassigned")).status, 401);
        assert.equal((await req(`/admin/accounts/${ids[6]}`, "admin", "DELETE", {})).status, 404);
        assert.ok(await prisma.auditLog.findFirst({ where: { action: "account.deleted", entityId: ids[6], userId: ids[2] } }));
        // A member account also loses every company assignment.
        assert.equal((await req(`/admin/accounts/${ids[0]}`, "admin", "DELETE", {})).status, 200);
        assert.equal(await prisma.companyMembership.count({ where: { userId: ids[0] } }), 0);
      } finally {
        await prisma.auditLog.deleteMany({ where: { OR: [{ id: history.id }, { action: "account.deleted", entityId: { in: ids } }] } });
      }
      // Real logout revokes the opaque session, independent of the Microsoft logout redirect.
      const logout = await req("/auth/logout", "admin", "POST", {});
      assert.equal(logout.status, 303);
      assert.equal((await req("/auth/me", "admin")).status, 401);
    } finally {
      if (app) await app.close();
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
      await prisma.$disconnect();
    }
  },
);
