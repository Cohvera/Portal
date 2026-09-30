import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@cohvera/database";
import { companyAccess, groupMappings, syncCompanyAccess } from "./groups";
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
      assert.equal((await req("/admin/plugins", "business")).status, 403);
      // Removed account management must be inaccessible even to portal admins.
      for (const user of ["admin", "both", "business"]) {
        for (const [path, method] of [
          ["/admin/accounts", "GET"],
          ["/admin/accounts", "POST"],
          [`/admin/accounts/${ids[6]}`, "PATCH"],
          [`/admin/accounts/${ids[6]}`, "DELETE"],
        ]) {
          assert.equal(
            (await req(path, user, method, method === "GET" ? undefined : {}))
              .status,
            method === "GET" ? (user === "business" ? 403 : 200) : 404,
          );
        }
      }
      assert.ok(await prisma.user.findUnique({ where: { id: ids[6] } }));
      // Group sync replaces old assignments and removes companies after group removal.
      const groupId = "33333333-3333-4333-8333-333333333333";
      const mappings = groupMappings(
        JSON.stringify([{ groupId, companyCode: "TOMME", roleKey: "viewer" }]),
      );
      await prisma.$transaction((tx) =>
        syncCompanyAccess(
          tx,
          ids[6],
          companyAccess({ groups: [groupId] }, mappings),
        ),
      );
      assert.equal(
        (await (await req("/companies", "unassigned")).json()).length,
        1,
      );
      await prisma.$transaction((tx) =>
        syncCompanyAccess(tx, ids[6], companyAccess({ groups: [] }, mappings)),
      );
      assert.deepEqual(
        await (await req("/companies", "unassigned")).json(),
        [],
      );
      await assert.rejects(
        prisma.$transaction((tx) =>
          syncCompanyAccess(
            tx,
            ids[6],
            companyAccess(
              { groups: [groupId] },
              groupMappings(
                JSON.stringify([
                  { groupId, companyCode: "MISSING", roleKey: "viewer" },
                ]),
              ),
            ),
          ),
        ),
        /group_configuration/,
      );
      // Regression: even Portal.Admin with only Q-Home must lose old company access.
      await prisma.$transaction((tx) =>
        syncCompanyAccess(
          tx,
          ids[2],
          companyAccess(
            { groups: ["SG-QHOME-All"] },
            groupMappings(
              JSON.stringify([
                {
                  groupName: "SG-QHOME-All",
                  companyCode: "QHOME",
                  roleKey: "employee",
                },
                {
                  groupName: "SG-TOMME-All",
                  companyCode: "TOMME",
                  roleKey: "employee",
                },
                {
                  groupName: "SG-WARCO-All",
                  companyCode: "WARCO",
                  roleKey: "employee",
                },
              ]),
            ),
          ),
        ),
      );
      const qhomeIdentity = await (await req("/auth/me", "admin")).json();
      assert.deepEqual(
        qhomeIdentity.companies.map((c: { code: string }) => c.code),
        ["QHOME"],
      );
      assert.equal(qhomeIdentity.businessAccess[0].businessAdmin, false);
      assert.equal(
        (await req("/companies/QHOME/projects", "admin")).status,
        200,
      );
      for (const code of ["TOMME", "WARCO", "COH"])
        assert.equal(
          (await req(`/companies/${code}/projects`, "admin")).status,
          403,
        );
      // A Q-Home employee creates a project; the warehouse contract recalls the same ID.
      const input = {
        name: "Warehouse reference test",
        owner: "Nieuwe collega",
        status: "Actief",
        statusColor: "#2563eb",
      };
      const created = await req(
        "/companies/QHOME/projects",
        "admin",
        "POST",
        input,
      );
      assert.equal(created.status, 201);
      const project = await created.json();
      try {
        assert.equal(
          (
            await req(
              `/companies/QHOME/projects/${project.id}`,
              "admin",
              "PATCH",
              input,
            )
          ).status,
          403,
        );
        const reference = await req(
          `/v1/companies/QHOME/projects/${project.id}`,
          "admin",
        );
        assert.equal(reference.status, 200);
        assert.deepEqual(await reference.json(), {
          id: project.id,
          companyCode: "QHOME",
          ...input,
        });
        const page = await (
          await req(
            "/v1/companies/QHOME/projects?q=Warehouse%20reference%20test",
            "admin",
          )
        ).json();
        assert.equal(page.version, 1);
        assert.ok(
          page.projects.some((p: { id: string }) => p.id === project.id),
        );
        assert.equal(
          (await req(`/v1/companies/TOMME/projects/${project.id}`, "admin"))
            .status,
          403,
        );
        assert.equal(
          (await req(`/v1/companies/TOMME/projects/${project.id}`, "business"))
            .status,
          404,
        );
        assert.equal((await req("/v1/companies/QHOME/projects")).status, 401);
        assert.equal(
          (await req("/companies/TOMME/projects", "user", "POST", input))
            .status,
          401,
        );
        // Renaming does not break the reference; completed projects remain retrievable.
        await prisma.project.update({
          where: { id: project.id },
          data: { name: "Renamed warehouse reference", status: "Afgerond" },
        });
        const renamed = await (
          await req(`/v1/companies/QHOME/projects/${project.id}`, "admin")
        ).json();
        assert.equal(renamed.id, project.id);
        assert.equal(renamed.name, "Renamed warehouse reference");
        assert.equal(renamed.status, "Afgerond");
      } finally {
        await prisma.project.delete({ where: { id: project.id } });
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
