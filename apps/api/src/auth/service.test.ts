import { test } from "node:test";
import assert from "node:assert/strict";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { serviceSettings, verifyServiceToken } from "./service";
const tenant = "11111111-1111-4111-8111-111111111111",
  audience = "22222222-2222-4222-8222-222222222222",
  client = "33333333-3333-4333-8333-333333333333";
export const serviceTestSettings = {
  tenant,
  audience,
  clients: { [client]: ["TOMME"] },
};
export async function serviceFixture() {
  const keys = await generateKeyPair("RS256"),
    jwk = {
      ...(await exportJWK(keys.publicKey)),
      kid: "service-test",
      alg: "RS256",
    };
  async function token(changes: Record<string, unknown> = {}) {
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({
      iss: `https://login.microsoftonline.com/${tenant}/v2.0`,
      aud: audience,
      exp: now + 300,
      iat: now,
      nbf: now - 1,
      tid: tenant,
      azp: client,
      idtyp: "app",
      ver: "2.0",
      roles: ["Projects.Read.All"],
      ...changes,
    })
      .setProtectedHeader({ alg: "RS256", kid: "service-test" })
      .sign(keys.privateKey);
  }
  return { token, jwk, resolve: createLocalJWKSet({ keys: [jwk] }) };
}
test("service tokens: signature, tenant, audience, expiry, app identity, role and allowlist", async () => {
  const f = await serviceFixture();
  assert.deepEqual(
    await verifyServiceToken(await f.token(), serviceTestSettings, f.resolve),
    { clientId: client, companyCodes: ["TOMME"] },
  );
  for (const changes of [
    { aud: "https://graph.microsoft.com" },
    { iss: "https://attacker.invalid" },
    { tid: audience },
    { exp: 1 },
    { nbf: Math.floor(Date.now() / 1000) + 300 },
    { idtyp: "user" },
    { scp: "projects.read" },
    { ver: "1.0" },
    { azp: audience },
    { roles: ["Portal.Admin"] },
    { roles: [] },
    { idtyp: undefined },
    { exp: undefined },
  ])
    await assert.rejects(
      verifyServiceToken(
        await f.token(changes),
        serviceTestSettings,
        f.resolve,
      ),
    );
  const other = await serviceFixture();
  await assert.rejects(
    verifyServiceToken(await other.token(), serviceTestSettings, f.resolve),
  );
  await assert.rejects(
    verifyServiceToken(
      await f.token(),
      { ...serviceTestSettings, clients: {} },
      f.resolve,
    ),
  );
});
test("service configuration rejects malformed allowlists and unknown audience", () => {
  const old = { ...process.env };
  try {
    process.env.ENTRA_TENANT_ID = tenant;
    process.env.ENTRA_API_AUDIENCE = audience;
    process.env.ENTRA_SERVICE_CLIENTS = JSON.stringify({ [client]: ["TOMME"] });
    assert.deepEqual(serviceSettings(), serviceTestSettings);
    for (const invalid of [
      "[]",
      '{"oops":["TOMME"]}',
      JSON.stringify({ [client]: ["*"] }),
      "{",
    ]) {
      process.env.ENTRA_SERVICE_CLIENTS = invalid;
      assert.throws(() => serviceSettings());
    }
  } finally {
    for (const key of [
      "ENTRA_TENANT_ID",
      "ENTRA_API_AUDIENCE",
      "ENTRA_SERVICE_CLIENTS",
    ]) {
      if (old[key] === undefined) delete process.env[key];
      else process.env[key] = old[key];
    }
  }
});
