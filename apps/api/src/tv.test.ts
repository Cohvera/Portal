import "reflect-metadata";
import { test } from "node:test";
import assert from "node:assert/strict";
import { tvSettings, tvTelemetry, TvController } from "./tv";
import { authContext, type AuthContext } from "./auth/context";
import { PortalGuard } from "./auth/guard";
import type { ExecutionContext } from "@nestjs/common";
test("TV settings validate calendar values, bounds and whitelist fields", () => {
  const base = {
    selection: "execution",
    rotationSeconds: 12,
    waste: [{ label: "Papier", date: "2026-10-14", time: "07:00" }],
  };
  assert.deepEqual(tvSettings({ ...base, companyCode: "OTHER" }), base);
  for (const p of [
    { selection: "all" },
    { rotationSeconds: 0 },
    { waste: [{ ...base.waste[0], date: "2026-02-30" }] },
    { waste: Array(51).fill(base.waste[0]) },
  ])
    assert.throws(() => tvSettings({ ...base, ...p }));
});
test("TV telemetry rejects invalid flags/metrics and strips unneeded source fields", () => {
  const fleet = {
    schema_version: 2,
    source_kind: "central_datahub",
    snapshot_id: "test",
    source_observed_at: new Date().toISOString(),
    vehicles: [
      {
        plate: "TEST",
        name: "Test",
        source_id: "1",
        next_inspection: "2026-11-01",
        private: "excluded",
      },
    ],
  };
  assert.equal("private" in tvTelemetry({ fleet }).fleet!.vehicles[0], false);
  assert.throws(() =>
    tvTelemetry({
      fleet: { ...fleet, vehicles: [...fleet.vehicles, ...fleet.vehicles] },
    }),
  );
  assert.throws(() =>
    tvTelemetry({ fleet: { ...fleet, source_kind: "screenshots" } }),
  );
  assert.throws(() =>
    tvTelemetry({
      nas: {
        status: "ok",
        loggingOk: true,
        latest: {
          checkedAt: new Date().toISOString(),
          cpu: { usedPercent: 101 },
        },
        history: [],
      },
    }),
  );
  assert.deepEqual(tvTelemetry({ fleet: null, nas: null }), {
    fleet: null,
    nas: null,
  });
});
test("TV uses company membership and projects.read/manage, including direct API calls", async () => {
  const ctx = {
    mode: "development",
    roles: ["Portal.User"],
    actor: {
      isActive: true,
      memberships: [
        {
          company: { code: "QHOME", isActive: true },
          role: {
            key: "viewer",
            permissions: [{ permission: { key: "projects.read" } }],
          },
        },
      ],
    },
  } as unknown as AuthContext;
  const run = (code: string, method: string) =>
    authContext.run(ctx, () =>
      new PortalGuard().canActivate({
        getClass: () => TvController,
        switchToHttp: () => ({
          getRequest: () => ({
            path: `/companies/${code}/projects/tv${method === "PUT" ? "/settings" : ""}`,
            params: { companyCode: code },
            method,
            headers: {},
            is: () => true,
          }),
        }),
      } as unknown as ExecutionContext),
    );
  assert.equal(await run("QHOME", "GET"), true);
  await assert.rejects(run("TOMME", "GET"));
  await assert.rejects(run("QHOME", "PUT"));
  ctx.actor!.memberships[0].role.permissions.push({
    permission: { key: "projects.manage" },
  } as any);
  assert.equal(await run("QHOME", "PUT"), true);
});
