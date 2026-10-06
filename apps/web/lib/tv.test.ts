import { test } from "node:test";
import assert from "node:assert/strict";
import { tvProjects, splitProjects, inspection, tvToday } from "./tv";
import type { Project } from "./projects";
const now = Date.parse("2026-10-06T10:00:00Z"),
  stamp = "2026-10-06T03:00:00.000Z";
const project = {
  id: "1",
  name: "Test",
  customer: "",
  owner: "",
  status: "Actief",
  sourceSeenAt: stamp,
  externalSource: "PLENION",
  sourceIsClosed: false,
  sourceIsActive: true,
  sourceStatusLabel: "07 - In Uitvoering",
} as Project;
test("TV excludes closed, inactive, unknown, stale and absent-from-latest-import projects", () => {
  const rows = [
    project,
    { ...project, id: "closed", sourceIsClosed: true },
    { ...project, id: "inactive", sourceIsActive: false },
    { ...project, id: "unknown", sourceIsClosed: null },
    { ...project, id: "old", sourceSeenAt: "2026-10-05T03:00:00.000Z" },
    { ...project, id: "quotation", sourceStatusLabel: "02 - Offerte" },
  ];
  assert.deepEqual(
    tvProjects(rows, "execution", stamp, now).map((p) => p.id),
    ["1"],
  );
  assert.deepEqual(
    tvProjects(rows, "open", stamp, now).map((p) => p.id),
    ["1", "inactive", "quotation"],
  );
  assert.equal(tvProjects(rows, "open", stamp, now + 86400000).length, 0);
  assert.equal(
    tvProjects([{ ...project, externalSource: null }], "execution", null, now)
      .length,
    1,
  );
});
test("Planning boundaries and inspection warnings use Brussels calendar dates", () => {
  assert.equal(tvToday(Date.parse("2026-10-06T22:30:00Z")), "2026-10-07");
  const g = splitProjects(
    [
      { ...project, sourcePlannedAt: "2026-10-05" },
      { ...project, sourcePlannedAt: "2026-10-06" },
      { ...project, sourcePlannedAt: null },
      { ...project, sourcePlannedAt: "2026-10-07" },
    ],
    "2026-10-06",
  );
  assert.equal(g.late.length, 1);
  assert.equal(g.current.length, 2);
  assert.equal(g.upcoming.length, 1);
  assert.equal(inspection("2026-02-28", "2026-01-31").color, "red");
  assert.equal(inspection("2026-03-01", "2026-01-31").color, "orange");
  assert.equal(inspection("", "2026-01-31").label, "Keuringsdatum ontbreekt");
});
