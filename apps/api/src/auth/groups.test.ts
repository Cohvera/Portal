import { test } from "node:test";
import assert from "node:assert/strict";
import { companyAccess, groupMappings } from "./groups";
const a = "11111111-1111-4111-8111-111111111111",
  b = "22222222-2222-4222-8222-222222222222";
const mappings = groupMappings(
  JSON.stringify([
    { groupId: a, companyCode: "TOMME", roleKey: "viewer" },
    { groupId: b, companyCode: "TOMME", roleKey: "manager" },
    { groupId: b, companyCode: "QHOME", roleKey: "employee" },
  ]),
);
test("groups: multiple companies and highest explicit business role, never implicit portal-admin", () => {
  assert.deepEqual(
    companyAccess({ groups: [a, b] }, mappings).assignments.map((m) => [
      m.companyCode,
      m.roleKey,
    ]),
    [
      ["TOMME", "manager"],
      ["QHOME", "employee"],
    ],
  );
  assert.equal(
    companyAccess({ roles: ["Portal.Admin"] }, mappings).assignments.length,
    0,
  );
  assert.equal(companyAccess({ groups: [] }, mappings).assignments.length, 0);
});
test("groups: incomplete claims and invalid mappings fail closed", () => {
  assert.throws(
    () => companyAccess({ _claim_names: { groups: "src1" } }, mappings),
    /groups_overage/,
  );
  assert.throws(
    () => companyAccess({ hasgroups: true }, mappings),
    /groups_overage/,
  );
  assert.throws(
    () => companyAccess({ groups: [123] }, mappings),
    /invalid_groups/,
  );
  assert.throws(() => groupMappings("not-json"), /group_configuration/);
  assert.throws(
    () =>
      groupMappings(
        JSON.stringify([
          { groupId: a, companyCode: "TOMME", roleKey: "portal-admin" },
        ]),
      ),
    /group_configuration/,
  );
});

test("names: requested company groups grant employee only with exact verified names", () => {
  const names = groupMappings(
    JSON.stringify([
      { groupName: "SG-QHOME-All", companyCode: "QHOME", roleKey: "employee" },
      { groupName: "SG-TOMME-All", companyCode: "TOMME", roleKey: "employee" },
      { groupName: "SG-WARCO-All", companyCode: "WARCO", roleKey: "employee" },
    ]),
  );
  assert.deepEqual(
    companyAccess(
      { groups: ["SG-QHOME-All", "SG-TOMME-All", "SG-WARCO-All"] },
      names,
    ).assignments.map((m) => [m.companyCode, m.roleKey]),
    [
      ["QHOME", "employee"],
      ["TOMME", "employee"],
      ["WARCO", "employee"],
    ],
  );
  for (const group of [
    "sg-tomme-all",
    "SG-TOMME-All-other",
    " SG-TOMME-All",
    "SG-PORTAL-Admins",
  ])
    assert.equal(
      companyAccess({ groups: [group] }, names).assignments.length,
      0,
    );
  assert.equal(
    companyAccess({ roles: ["SG-TOMME-All", "Portal.Admin"] }, names)
      .assignments.length,
    0,
  );
  assert.throws(
    () => companyAccess({ groups: [a] }, names),
    /group_names_required/,
  );
  assert.throws(
    () =>
      groupMappings(
        JSON.stringify([
          {
            groupName: "SG-TOMME-All",
            groupId: a,
            companyCode: "TOMME",
            roleKey: "employee",
          },
        ]),
      ),
    /group_configuration/,
  );
});
