// Regression tests for the defects found on 2026-08-23, the day Lean first ran.
// Each test names the defect it locks down; none of these paths had any coverage before.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { LEGAL_TRANSITIONS } from "../src/state.js";
import { FORCE_STAGES } from "../src/pipeline/run.js";
import { validateIR } from "../src/ir/validate.js";
import type { IR } from "../src/ir/schema.js";

describe("state machine (defect a)", () => {
  it("allows re-running S3 on an already-passing case", () => {
    // Every other stage has a self-loop for idempotent re-runs; checks-passed did not,
    // so `vps check` on a passing case threw `illegal transition`.
    expect(LEGAL_TRANSITIONS["checks-passed"]).toContain("checks-passed");
  });

  it("allows a passing case to fall back to checks-failed", () => {
    // The dangerous direction: without this, a re-run that now FAILS throws and the case
    // is left still reading checks-passed — the state the S4 gate opens from.
    expect(LEGAL_TRANSITIONS["checks-passed"]).toContain("checks-failed");
  });

  it("still refuses to jump from intake straight to signed-off", () => {
    // The self-loops must not have loosened the gate's approach path.
    expect(LEGAL_TRANSITIONS["intake"]).not.toContain("signed-off");
    for (const [from, tos] of Object.entries(LEGAL_TRANSITIONS)) {
      if (from !== "checks-passed") expect(tos).not.toContain("signed-off");
    }
  });
});

describe("--force-from (defect b)", () => {
  it("accepts only known stages", () => {
    // A typo previously triggered a silent redraft instead of an error, because
    // `&&` bound tighter than `||` in the guard.
    expect(FORCE_STAGES).toEqual(["draft"]);
  });
});

describe("ambiguity.chosen validation (defect e)", () => {
  const intake = path.join(os.tmpdir(), `vps-validate-${process.pid}.md`);
  const prose = "Candidates need at least one shipped product.";

  const baseIR = (chosen: string): IR => ({
    caseId: "t", sourceDoc: "intake.md",
    nouns: [
      { name: "Subject", role: "subject",
        fields: [{ name: "shipped", type: "Nat", source: { quote: prose, start: 0, end: prose.length } }],
        source: { quote: prose, start: 0, end: prose.length } },
      { name: "Duty", role: "requirementItem",
        fields: [{ name: "label", type: "String", source: { quote: prose, start: 0, end: prose.length } },
                 { name: "minCount", type: "Nat", source: { quote: prose, start: 0, end: prose.length } }],
        source: { quote: prose, start: 0, end: prose.length } }
    ],
    predicates: [{
      name: "meets",
      params: [{ name: "s", noun: "Subject" }, { name: "d", noun: "Duty" }],
      body: { op: "ge", left: { op: "field", path: "s.shipped" }, right: { op: "field", path: "d.minCount" } },
      source: { quote: prose, start: 0, end: prose.length },
      interpretationNotes: "n/a"
    }],
    requirement: {
      name: "ok", quantifier: "allOf", subjectNoun: "Subject", itemsNoun: "Duty", predicate: "meets",
      itemsData: { name: "duties", values: [{ label: "shipped", minCount: 1 }] }
    },
    ambiguities: [{ sourceText: "at least one", options: ["minimum 1", "some higher bar"], chosen, rationale: "weakest faithful reading" }],
    exclusions: []
  } as unknown as IR);

  it("rejects a chosen resolution that was never offered", () => {
    fs.writeFileSync(intake, prose);
    const errs = validateIR(baseIR("minimum 5"), intake);
    expect(errs.some(e => e.path === "ambiguities[0].chosen")).toBe(true);
  });

  it("accepts a chosen resolution that is among the options", () => {
    fs.writeFileSync(intake, prose);
    const errs = validateIR(baseIR("minimum 1"), intake);
    expect(errs.filter(e => e.path.startsWith("ambiguities"))).toHaveLength(0);
  });
});
