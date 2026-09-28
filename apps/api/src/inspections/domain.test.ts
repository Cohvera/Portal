import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addMonths,
  attentionReasons,
  completionIssues,
  newInspection,
  nextCycleAvailable,
  validateInspection,
} from "@cohvera/contracts";
const draft = () => ({
  ...newInspection(),
  title: "Keuring test",
  customer: "Testklant",
  address: "Teststraat 1",
});
test("datumvalidatie en kalendermaanden behouden schrikkeldagen correct", () => {
  assert.equal(addMonths("2024-02-29", 12), "2025-02-28");
  assert.equal(addMonths("2026-05-31", -3), "2026-02-28");
  assert.throws(() =>
    validateInspection({ ...draft(), plannedDate: "2026-02-30" }),
  );
});
test("conform vereist rapport, uitgevoerde datum, volgende cyclus en afgeronde acties", () => {
  const data = { ...draft(), status: "CONFORM" as const, intervalMonths: 12 };
  assert.equal(completionIssues(data, [], "2026-09-25").length, 3);
  const completed = {
    ...data,
    inspectedDate: "2026-09-01",
    nextDate: "2027-09-01",
    reportNumber: "R-1",
  };
  assert.deepEqual(
    completionIssues(
      completed,
      [{ category: "Keuringsrapport" }],
      "2026-09-25",
    ),
    [],
  );
  assert.equal(
    completionIssues(
      {
        ...completed,
        followUps: [
          { id: "a", title: "Herstellen", owner: "", dueDate: "", done: false },
        ],
      },
      [{ category: "Keuringsrapport" }],
      "2026-09-25",
    ).length,
    1,
  );
});
test("plannen en niet-conforme keuringen vereisen hun eigen controles", () => {
  assert.equal(
    completionIssues({ ...draft(), status: "PLANNED" }, [], "2026-09-25")
      .length,
    2,
  );
  assert.ok(
    completionIssues(
      {
        ...draft(),
        status: "REINSPECTION",
        inspectedDate: "2026-09-01",
        reportNumber: "X",
      },
      [{ category: "Keuringsrapport" }],
      "2026-09-25",
    ).some((x) => x.includes("herstelactie")),
  );
});
test("volgende cyclus pas vanaf drie maanden, herkeuring direct, uit dienst nooit", () => {
  const data = {
    ...draft(),
    status: "CONFORM" as const,
    intervalMonths: 12,
    nextDate: "2027-06-30",
  };
  assert.equal(nextCycleAvailable(data, "2027-03-29"), false);
  assert.equal(nextCycleAvailable(data, "2027-03-30"), true);
  assert.equal(
    nextCycleAvailable({ ...data, status: "REINSPECTION" }, "2026-01-01"),
    true,
  );
  assert.equal(
    nextCycleAvailable({ ...data, status: "OUT_OF_SERVICE" }, "2028-01-01"),
    false,
  );
});
test("opvolgacties krijgen unieke IDs en archief geeft geen actieve alarmen", () => {
  const f = {
    id: "a",
    title: "Controle",
    owner: "",
    dueDate: "2026-01-01",
    done: false,
  };
  assert.throws(() => validateInspection({ ...draft(), followUps: [f, f] }));
  assert.deepEqual(
    attentionReasons(
      { ...draft(), status: "ARCHIVED", followUps: [f] },
      "2026-09-25",
    ),
    [],
  );
  assert.deepEqual(
    attentionReasons({ ...draft(), followUps: [f] }, "2026-09-25"),
    ["Opvolgactie vervallen"],
  );
});
