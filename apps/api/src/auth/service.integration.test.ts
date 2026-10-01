import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPair, exportJWK, SignJWT } from "jose";
import { configuredApp } from "../main";
import { prisma } from "@cohvera/database";
test(
  "Warehouse HTTP access: only read-only v1 projects in assigned active company",
  { skip: process.env.AUTH_INTEGRATION_TEST !== "1" },
  async () => {
    const tenant = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      audience = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      client = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    process.env.AUTH_MODE = "entra";
    process.env.ENTRA_TENANT_ID = tenant;
    process.env.ENTRA_API_AUDIENCE = audience;
    process.env.ENTRA_SERVICE_CLIENTS = JSON.stringify({ [client]: ["TOMME"] });
    const keys = await generateKeyPair("RS256"),
      jwk = {
        ...(await exportJWK(keys.publicKey)),
        kid: "http-test",
        alg: "RS256",
      };
    const realFetch = globalThis.fetch;
    globalThis.fetch = async (input, init) =>
      String(input) ===
      `https://login.microsoftonline.com/${tenant}/discovery/v2.0/keys`
        ? Response.json({ keys: [jwk] })
        : realFetch(input, init);
    let app: Awaited<ReturnType<typeof configuredApp>> | undefined;
    try {
      const token = await new SignJWT({
        tid: tenant,
        azp: client,
        idtyp: "app",
        ver: "2.0",
        roles: ["Projects.Read.All"],
      })
        .setProtectedHeader({ alg: "RS256", kid: "http-test" })
        .setIssuer(`https://login.microsoftonline.com/${tenant}/v2.0`)
        .setAudience(audience)
        .setIssuedAt()
        .setExpirationTime("5m")
        .sign(keys.privateKey);
      app = await configuredApp();
      app.useLogger(false);
      await app.listen(0, "127.0.0.1");
      const base = await app.getUrl();
      const req = (path: string, method = "GET", auth = `Bearer ${token}`) =>
        realFetch(base + path, {
          method,
          headers: { Authorization: auth, "Content-Type": "application/json" },
          body: method === "POST" ? "{}" : undefined,
        });
      const list = await req("/v1/companies/TOMME/projects");
      assert.equal(list.status, 200);
      const page = await list.json();
      assert.equal(page.version, 1);
      if (page.projects.length)
        assert.equal(
          (await req(`/v1/companies/TOMME/projects/${page.projects[0].id}`))
            .status,
          200,
        );
      assert.equal(
        (await req("/v1/companies/TOMME/projects/not-existing")).status,
        404,
      );
      for (const path of [
        "/v1/companies/QHOME/projects",
        "/v1/companies/WARCO/projects",
        "/companies/TOMME/projects",
        "/admin/accounts",
        "/auth/me",
        "/catalog",
      ])
        assert.equal((await req(path)).status, 403, path);
      assert.equal(
        (await req("/companies/TOMME/projects", "POST")).status,
        403,
      );
      assert.equal(
        (await req("/v1/companies/TOMME/projects", "GET", "Bearer broken"))
          .status,
        401,
      );
      process.env.ENTRA_SERVICE_CLIENTS = "{}";
      assert.equal((await req("/v1/companies/TOMME/projects")).status, 403);
    } finally {
      globalThis.fetch = realFetch;
      if (app) await app.close();
      await prisma.$disconnect();
    }
  },
);
