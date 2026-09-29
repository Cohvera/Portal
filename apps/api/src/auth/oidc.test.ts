import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import * as oidc from "openid-client";
import { identityClaims, isPortalAdmin, isPortalUser } from "./policy";
import { companyAccess, defaultGroupMappings, groupMappings } from "./groups";
const tenant = "11111111-1111-4111-8111-111111111111",
  clientId = "22222222-2222-4222-8222-222222222222",
  objectId = "33333333-3333-4333-8333-333333333333";
const issuer = `https://login.microsoftonline.com/${tenant}/v2.0`;
const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
function token(overrides: Record<string, unknown> = {}, badSignature = false) {
  const now = Math.floor(Date.now() / 1000);
  const body = {
    iss: issuer,
    aud: clientId,
    sub: "subject",
    oid: objectId,
    tid: tenant,
    iat: now,
    exp: now + 3600,
    nonce: "expected-nonce",
    roles: ["Portal.User"],
    ...overrides,
  };
  const encoded = [{ alg: "RS256", kid: "test-key" }, body]
    .map((v) => Buffer.from(JSON.stringify(v)).toString("base64url"))
    .join(".");
  const signature = sign("RSA-SHA256", Buffer.from(encoded), keys.privateKey);
  if (badSignature) signature[0] ^= 255;
  return `${encoded}.${signature.toString("base64url")}`;
}
async function grant(
  overrides: Record<string, unknown> = {},
  badSignature = false,
  receivedState = "expected-state",
) {
  const config = new oidc.Configuration(
    {
      issuer,
      authorization_endpoint: "https://provider.invalid/authorize",
      token_endpoint: "https://provider.invalid/token",
      jwks_uri: "https://provider.invalid/jwks",
    },
    clientId,
    { client_secret: "synthetic-only", id_token_signed_response_alg: "RS256" },
  );
  config[oidc.customFetch] = async (input, options) => {
    const u = String(input);
    if (u.endsWith("/jwks"))
      return Response.json({
        keys: [
          {
            ...keys.publicKey.export({ format: "jwk" }),
            kid: "test-key",
            alg: "RS256",
            use: "sig",
          },
        ],
      });
    assert.ok(String(options?.body).includes("code_verifier="));
    return Response.json({
      access_token: "unused",
      token_type: "Bearer",
      id_token: token(overrides, badSignature),
    });
  };
  oidc.enableNonRepudiationChecks(config);
  return oidc.authorizationCodeGrant(
    config,
    new URL(
      `https://portal.example/auth/callback?code=synthetic&state=${receivedState}`,
    ),
    {
      expectedState: "expected-state",
      expectedNonce: "expected-nonce",
      pkceCodeVerifier:
        "test-verifier-0123456789012345678901234567890123456789",
      idTokenExpected: true,
    },
  );
}
test("PDF A-D: geen rol geweigerd, user gewoon, admin en beide ook gewoon", () => {
  for (const [roles, user, admin] of [
    [[], false, false],
    [["Portal.User"], true, false],
    [["Portal.Admin"], true, true],
    [["Portal.User", "Portal.Admin"], true, true],
  ] as const) {
    assert.equal(isPortalUser(roles), user);
    assert.equal(isPortalAdmin(roles), admin);
  }
  assert.equal(isPortalAdmin(["portal.admin", "SG-PORTAL-Admins"]), false);
});
test("OIDC library valideert gesigneerde code-flow en claims", async () => {
  const result = await grant();
  const user = identityClaims(result.claims()!, tenant);
  assert.equal(user.objectId, objectId);
  assert.deepEqual(user.roles, ["Portal.User"]);
});
for (const [label, claims, badSignature, state] of [
  ["verkeerde handtekening", {}, true, "expected-state"],
  [
    "verkeerde issuer",
    { iss: "https://attacker.invalid" },
    false,
    "expected-state",
  ],
  ["verkeerde audience", { aud: "other-client" }, false, "expected-state"],
  ["verlopen token", { exp: 1 }, false, "expected-state"],
  [
    "toekomstige not-before",
    { nbf: Math.floor(Date.now() / 1000) + 3600 },
    false,
    "expected-state",
  ],
  ["verkeerde nonce", { nonce: "other" }, false, "expected-state"],
  ["verkeerde state", {}, false, "other-state"],
] as const)
  test(`OIDC weigert ${label}`, async () => {
    await assert.rejects(grant(claims, badSignature, state));
  });
test("geen rol en vreemde tenant/object worden geweigerd na protocolvalidatie", () => {
  const base = {
    tid: tenant,
    oid: objectId,
    exp: Math.floor(Date.now() / 1000) + 3600,
    roles: ["Portal.User"],
  };
  assert.throws(
    () => identityClaims({ ...base, roles: [] }, tenant),
    /no_portal_role/,
  );
  assert.throws(
    () => identityClaims({ ...base, tid: "other" }, tenant),
    /invalid_identity/,
  );
  assert.throws(
    () => identityClaims({ ...base, oid: "" }, tenant),
    /invalid_identity/,
  );
});

test("Entra-configuratie weigert onveilige callbacks en onbegrensde sessies",async()=>{
 const {entraSettings}=await import("./config");const keys=["ENTRA_TENANT_ID","ENTRA_CLIENT_ID","ENTRA_CLIENT_SECRET","ENTRA_REDIRECT_URI","ENTRA_SESSION_MINUTES","NODE_ENV"];
 const old=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 try{Object.assign(process.env,{ENTRA_TENANT_ID:tenant,ENTRA_CLIENT_ID:clientId,ENTRA_CLIENT_SECRET:"synthetic",ENTRA_REDIRECT_URI:"https://portal.example/auth/callback",ENTRA_SESSION_MINUTES:"15",NODE_ENV:"production"});assert.equal(entraSettings().secure,true);
  process.env.ENTRA_REDIRECT_URI="http://portal.example/auth/callback";assert.throws(()=>entraSettings());
  process.env.ENTRA_REDIRECT_URI="http://localhost:3000/auth/callback";assert.throws(()=>entraSettings());
  process.env.NODE_ENV="development";assert.equal(entraSettings().secure,false);
  process.env.ENTRA_SESSION_MINUTES="999";assert.throws(()=>entraSettings());
 }finally{for(const k of keys){if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}}
});

test("signed Q-Home token retains groups and maps only QHOME employee", async () => {
 const result = await grant({groups:["SG-QHOME-All"]});
 const claims = result.claims()!;
 identityClaims(claims, tenant);
 const access = companyAccess(claims, groupMappings(JSON.stringify(defaultGroupMappings)));
 assert.deepEqual(access.receivedGroups,["SG-QHOME-All"]);
 assert.deepEqual(access.assignments.map(m=>[m.companyCode,m.roleKey]),[["QHOME","employee"]]);
});
