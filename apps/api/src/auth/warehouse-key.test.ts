import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { verifyWarehouseKey } from "./warehouse-key";
import { PortalGuard } from "./guard";
import { ProjectReferencesController } from "../project-references";
import { prisma } from "@cohvera/database";
import type { ExecutionContext } from "@nestjs/common";

test("Warehouse key: fail closed, company scope, read-only controller, active company", async () => {
  const key = randomBytes(32).toString("base64url");
  const oldKey = process.env.WAREHOUSE_PROJECTS_API_KEY;
  const oldCompanies = process.env.WAREHOUSE_PROJECTS_COMPANIES;
  const original = prisma.company.findUnique;
  try {
    delete process.env.WAREHOUSE_PROJECTS_API_KEY;
    assert.throws(() => verifyWarehouseKey(key));
    process.env.WAREHOUSE_PROJECTS_API_KEY = key;
    process.env.WAREHOUSE_PROJECTS_COMPANIES = "TOMME";
    for (const wrong of ["", "bad", [key], key + "x"]) assert.throws(() => verifyWarehouseKey(wrong));
    assert.deepEqual(verifyWarehouseKey(key).companyCodes, ["TOMME"]);
    prisma.company.findUnique = (async () => ({ isActive: true })) as unknown as typeof original;
    const request = (method = "GET", companyCode = "TOMME", controller: unknown = ProjectReferencesController, headers: Record<string,string> = {"x-warehouse-key": key}) => new PortalGuard().canActivate({
      switchToHttp: () => ({ getRequest: () => ({ path: `/v1/companies/${companyCode}/projects`, method, params: {companyCode}, headers }) }),
      getClass: () => controller,
    } as unknown as ExecutionContext);
    assert.equal(await request(), true);
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) await assert.rejects(request(method));
    await assert.rejects(request("GET", "QHOME"));
    await assert.rejects(request("GET", "TOMME", class Accounts {}));
    await assert.rejects(request("GET", "TOMME", ProjectReferencesController, {"x-warehouse-key": key, authorization: "Bearer broken"}));
    prisma.company.findUnique = (async () => ({ isActive: false })) as unknown as typeof original;
    await assert.rejects(request());
    process.env.WAREHOUSE_PROJECTS_API_KEY = randomBytes(32).toString("base64url");
    assert.throws(() => verifyWarehouseKey(key));
  } finally {
    prisma.company.findUnique = original;
    if (oldKey === undefined) delete process.env.WAREHOUSE_PROJECTS_API_KEY; else process.env.WAREHOUSE_PROJECTS_API_KEY = oldKey;
    if (oldCompanies === undefined) delete process.env.WAREHOUSE_PROJECTS_COMPANIES; else process.env.WAREHOUSE_PROJECTS_COMPANIES = oldCompanies;
  }
});
