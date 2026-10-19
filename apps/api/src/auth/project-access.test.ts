import { test } from "node:test";
import assert from "node:assert/strict";
import { authContext, membership, type AuthContext } from "./context";

function actor(roles = ["Portal.Admin"], active = true): AuthContext {
  return {mode:"entra", roles, actor:{id:"user",isActive:true,memberships:[
    {company:{id:"qhome",code:"QHOME",isActive:active},role:{key:"employee",permissions:[]}},
  ]} as unknown as AuthContext["actor"]};
}
test("portal admins can read, create, edit and import projects in assigned companies", () => {
  authContext.run(actor(), () => {
    for (const permission of ["projects.read", "projects.create", "projects.manage"])
      assert.equal(membership("QHOME", permission).company.code, "QHOME");
  });
});
test("project exception does not grant other business permissions or company membership", () => {
  authContext.run(actor(), () => {
    assert.throws(()=>membership("WARCO","projects.manage"), /Geen toegang/);
    for (const permission of ["strategy.manage","tasks.manage","inspections.write"])
      assert.throws(()=>membership("QHOME",permission), /geen recht/);
  });
  authContext.run(actor(["Portal.Admin"], false), () =>
    assert.throws(()=>membership("QHOME","projects.manage"), /Geen toegang/));
  authContext.run(actor(["Portal.User"]), () =>
    assert.throws(()=>membership("QHOME","projects.manage"), /geen recht/));
});
