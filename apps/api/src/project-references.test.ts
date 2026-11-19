import { test } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@cohvera/database";
import { ProjectReferencesController } from "./project-references";

const project = {
  id: "portal-stable-id", name: "260123 · Werf", owner: "Milan",
  status: "Actief", statusColor: "#2563eb", externalSource: "PLENION",
  externalId: "260123", sourceExtraFields: {A_Adres: "Kerkstraat 12", unrelated: "internal"},
};

test("warehouse list and detail expose the source number and street with the stable ID", async t => {
  const originalImport = prisma.qboxImport.findUnique;
  const originalList = prisma.project.findMany;
  const originalDetail = prisma.project.findFirst;
  t.after(() => {
    prisma.qboxImport.findUnique = originalImport;
    prisma.project.findMany = originalList;
    prisma.project.findFirst = originalDetail;
  });
  prisma.qboxImport.findUnique = (async () => null) as typeof originalImport;
  prisma.project.findMany = (async () => [project]) as unknown as typeof originalList;
  prisma.project.findFirst = (async () => project) as unknown as typeof originalDetail;
  const controller = new ProjectReferencesController();
  const page = await controller.list("WARCO");
  const detail = await controller.get("WARCO", project.id);
  assert.deepEqual(page.projects, [detail]);
  assert.equal(detail.id, project.id);
  assert.equal(detail.reference, "260123");
  assert.equal(detail.street, "Kerkstraat 12");
  assert.equal("sourceExtraFields" in detail, false);
  assert.equal("externalId" in detail, false);
});

test("Teamleader project references take precedence over the external UUID", async t => {
  const originalDetail = prisma.project.findFirst;
  t.after(() => { prisma.project.findFirst = originalDetail; });
  prisma.project.findFirst = (async () => ({
    ...project, externalSource: "TEAMLEADER", externalId: "external-uuid",
    sourceExtraFields: {reference: "2026/42"},
  })) as unknown as typeof originalDetail;
  const detail = await new ProjectReferencesController().get("QHOME", project.id);
  assert.equal(detail.reference, "2026/42");
  assert.equal(detail.street, null);
});

test("projects without source metadata remain readable", async t => {
  const originalDetail = prisma.project.findFirst;
  t.after(() => { prisma.project.findFirst = originalDetail; });
  prisma.project.findFirst = (async () => ({
    ...project, externalSource: null, externalId: null, sourceExtraFields: null,
  })) as unknown as typeof originalDetail;
  const detail = await new ProjectReferencesController().get("WARCO", project.id);
  assert.equal(detail.reference, null);
  assert.equal(detail.street, null);
});
