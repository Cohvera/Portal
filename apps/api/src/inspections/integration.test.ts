import { test } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@cohvera/database";
import { newInspection, type InspectionRecord } from "@cohvera/contracts";

test(
  "Keuringen API: opslag, isolatie, conflicten, documenten, bewijs en dubbele cycli",
  { skip: process.env.INSPECTIONS_INTEGRATION_TEST !== "1" },
  async () => {
    const root = "http://127.0.0.1:4000/companies/TOMME/inspections",
      ids: string[] = [];
    async function call(
      url: string,
      method = "GET",
      body?: unknown,
      status = 200,
    ) {
      const r = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await r.json();
      assert.equal(r.status, status, JSON.stringify(data));
      return data;
    }
    try {
      let row: InspectionRecord = await call(
        root,
        "POST",
        {
          data: {
            ...newInspection(),
            title: "Geautomatiseerde synthetische keuringscontrole",
            customer: "Testklant",
            address: "Teststraat 1",
          },
        },
        201,
      );
      ids.push(row.id);
      const original = row;
      row = await call(`${root}/${row.id}`, "PATCH", {
        version: row.version,
        data: { ...row.data, owner: "Testbeheerder" },
      });
      await call(
        `${root}/${row.id}`,
        "PATCH",
        { version: original.version, data: original.data },
        409,
      );
      await call(
        `${root}/${row.id}`,
        "PATCH",
        { version: row.version, data: { ...row.data, status: "CONFORM" } },
        400,
      );
      await call(root.replace("TOMME", "QHOME"), "GET", undefined, 403);
      const content = Buffer.from("%PDF-1.4\n%synthetic-test\n%%EOF");
      row = await call(
        `${root}/${row.id}/documents`,
        "POST",
        {
          version: row.version,
          name: "controle.pdf",
          category: "Keuringsrapport",
          content: content.toString("base64"),
        },
        201,
      );
      const download = await fetch(
        `${root}/${row.id}/documents/${row.documents[0].id}`,
      );
      assert.equal(download.status, 200);
      assert.deepEqual(Buffer.from(await download.arrayBuffer()), content);
      const foreign = await fetch(
        `${root.replace("TOMME", "QHOME")}/${row.id}/documents/${row.documents[0].id}`,
      );
      assert.equal(foreign.status, 403);
      const parallel = await Promise.all(
        ["A", "B"].map((notes) =>
          fetch(`${root}/${row.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              version: row.version,
              data: { ...row.data, notes },
            }),
          }),
        ),
      );
      assert.deepEqual(parallel.map((r) => r.status).sort(), [200, 409]);
      row = await parallel.find((r) => r.status === 200)!.json();
      row = await call(`${root}/${row.id}`, "PATCH", {
        version: row.version,
        data: {
          ...row.data,
          status: "CONFORM",
          inspectedDate: "2025-09-01",
          nextDate: "2026-09-01",
          intervalMonths: 12,
          reportNumber: "TEST-1",
        },
      });
      await call(
        `${root}/${row.id}/documents/${row.documents[0].id}/remove`,
        "POST",
        { version: row.version, reason: "Test" },
        400,
      );
      const child: InspectionRecord = await call(
        `${root}/${row.id}/next-cycle`,
        "POST",
        { version: row.version },
        201,
      );
      ids.push(child.id);
      assert.equal(child.previousId, row.id);
      assert.equal(child.data.status, "DRAFT");
      assert.equal(child.documents.length, 0);
      const all: InspectionRecord[] = await call(root);
      row = all.find((r) => r.id === row.id)!;
      await call(
        `${root}/${row.id}/next-cycle`,
        "POST",
        { version: row.version },
        409,
      );
      assert.ok(row.events.length >= 5);
    } finally {
      await prisma.auditLog.deleteMany({
        where: { entityType: "inspection", entityId: { in: ids } },
      });
      await prisma.inspection.deleteMany({ where: { id: { in: ids } } });
      await prisma.$disconnect();
    }
  },
);
