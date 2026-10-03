import { test } from "node:test";
import assert from "node:assert/strict";
import {
  initialProcess,
  isSharePointUrl,
  processDefinitions,
  validateProcessMetadata,
} from "@cohvera/contracts";
import { ProcessesController } from "./processes";
import { authContext, type AuthContext } from "./auth/context";
import { prisma } from "@cohvera/database";

const base = () => initialProcess(processDefinitions[0]);
test("SharePoint links reject scripts, credentials, lookalike domains and plain HTTP", () => {
  assert.equal(
    isSharePointUrl(
      "https://cohvera.sharepoint.com/sites/Processen/BP01.aspx?web=1",
    ),
    true,
  );
  for (const url of [
    "javascript:alert(1)",
    "http://cohvera.sharepoint.com/x",
    "https://cohvera.sharepoint.com.evil.test/x",
    "https://sharepoint.com/x",
    "https://user:pass@cohvera.sharepoint.com/x",
    "https://cohvera.sharepoint.com:8000/x",
  ])
    assert.equal(isSharePointUrl(url), false);
});
test("active standards need an owner and document; operational health needs evidence", () => {
  assert.throws(
    () => validateProcessMetadata({ ...base(), status: "ACTIVE" }),
    /eigenaar/,
  );
  assert.throws(
    () => validateProcessMetadata({ ...base(), health: "GREEN" }),
    /Onderbouw/,
  );
  assert.throws(
    () =>
      validateProcessMetadata({
        ...base(),
        health: "RED",
        measurement: "2026-10-03: drie dossiers geblokkeerd",
      }),
    /knelpunt/,
  );
  const value = validateProcessMetadata({
    ...base(),
    status: "ACTIVE",
    owner: "Sales",
    sharepointUrl: "https://cohvera.sharepoint.com/sites/process/BP01",
    health: "AMBER",
    measurement: "2026-10-03: 5 dagen doorlooptijd",
    problem: "Goedkeuring duurt te lang",
  });
  assert.equal(value.status, "ACTIVE");
});
test("reject invalid dates, statuses, malformed bodies and oversized values", () => {
  for (const value of [
    null,
    [],
    { ...base(), status: "toString" },
    { ...base(), health: "invalid" },
    { ...base(), version: -1 },
    { ...base(), nextReviewOn: "2026-02-30" },
    { ...base(), owner: "x".repeat(101) },
  ])
    assert.throws(() => validateProcessMetadata(value));
  assert.equal(
    validateProcessMetadata({ ...base(), nextReviewOn: "2026-10-20" })
      .nextReviewOn,
    "2026-10-20",
  );
});
// Controller access is tested without a database: unauthorized calls must stop before persistence.
const ctx = (roles: string[], memberships: unknown[] = []): AuthContext => ({
  mode: "entra",
  roles,
  actor: { id: "test", isActive: true, memberships } as AuthContext["actor"],
});
test("register denies anonymous and unassigned readers; only portal admins may write", async () => {
  const controller = new ProcessesController();
  await assert.rejects(controller.overview(), /Meld je aan/);
  await authContext.run(ctx(["Portal.User"]), async () => {
    await assert.rejects(controller.overview(), /bedrijfstoegang/);
    await assert.rejects(
      controller.update("BP-01", base()),
      /portaalbeheerder/,
    );
  });
  await authContext.run(ctx(["Portal.Admin"]), async () => {
    await assert.rejects(controller.update("BP-99", base()), /Onbekend/);
    await assert.rejects(
      controller.update("BP-01", {
        ...base(),
        methodologyUrl: "https://cohvera.sharepoint.com/sites/cpm",
      }),
      /CPM/,
    );
  });
});
test("stale updates fail before changing rows or writing audit logs", async (t) => {
  const original = prisma.$transaction;
  prisma.$transaction = (async (callback: (tx: unknown) => unknown) =>
    callback({
      processRegister: { updateMany: async () => ({ count: 0 }) },
    })) as typeof prisma.$transaction;
  t.after(() => {
    prisma.$transaction = original;
  });
  await authContext.run(ctx(["Portal.Admin"]), async () => {
    await assert.rejects(
      new ProcessesController().update("BP-01", { ...base(), version: 2 }),
      /ondertussen gewijzigd/,
    );
  });
});

test("company members receive all shared standards with unassessed defaults", async (t) => {
  const original = prisma.processRegister.findMany;
  prisma.processRegister.findMany = (async () => []) as typeof original;
  t.after(() => {
    prisma.processRegister.findMany = original;
  });
  await authContext.run(
    ctx(["Portal.User"], [{ company: { code: "QHOME", isActive: true } }]),
    async () => {
      const result = await new ProcessesController().overview();
      assert.equal(result.length, 10);
      assert.ok(
        result.every(
          (p) =>
            p.health === "UNKNOWN" && p.status === "PLANNED" && p.version === 0,
        ),
      );
      assert.equal(result.find((p) => p.id === "BP-02")?.methodology, "CPM");
    },
  );
});

test("saving a new record and its audit event happens in one transaction", async (t) => {
  const original = prisma.$transaction;
  const events: string[] = [];
  const payload = validateProcessMetadata(base());
  prisma.$transaction = (async (callback: (tx: unknown) => unknown) =>
    callback({
      processRegister: {
        create: async () => {
          events.push("create");
        },
        findUniqueOrThrow: async () => ({
          id: "BP-01",
          ...payload,
          version: 1,
          updatedAt: new Date("2026-10-03T12:00:00Z"),
        }),
      },
      company: { findUniqueOrThrow: async () => ({ id: "coh" }) },
      auditLog: {
        create: async ({
          data,
        }: {
          data: { action: string; entityId: string };
        }) => {
          assert.equal(data.entityId, "BP-01");
          events.push(data.action);
        },
      },
    })) as typeof original;
  t.after(() => {
    prisma.$transaction = original;
  });
  await authContext.run(ctx(["Portal.Admin"]), async () => {
    const row = await new ProcessesController().update("BP-01", base());
    assert.equal(row.version, 1);
    assert.equal(row.updatedAt, "2026-10-03T12:00:00.000Z");
    assert.deepEqual(events, ["create", "process.updated"]);
  });
});
