// Phase 6a: richer IR types. Int, unit annotations (date, scaled), and `between`.
//
// The design choice being locked down here: expressive power comes from the TYPE CHECKER,
// not from new runtime primitives. Dates are Nat days-since-epoch and money is Int minor
// units, so codegen stays inside core Lean with no new proof burden and the TS mirror needs
// no new arms — while the validator gains the ability to refuse "years >= a date", which is
// the class of error no amount of proving would catch.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { validateIR } from "../src/ir/validate.js";
import { exprToLean, desugar, renderCaseLean } from "../src/codegen/lean.js";
import { evalDuties } from "../src/lean/diagnose.js";
import type { IR, Expr } from "../src/ir/schema.js";

const prose = "Contractors start on or after 2024-01-01 and hold a balance between -500 and 5000 pence.";
const intake = path.join(os.tmpdir(), `vps-types-${process.pid}.md`);
fs.writeFileSync(intake, prose);
const span = { quote: prose, start: 0, end: prose.length };

const ir = (body: Expr): IR => ({
  caseId: "t", sourceDoc: "intake.md",
  nouns: [
    { name: "Contractor", role: "subject", source: span, fields: [
      { name: "name", type: "String", source: span },
      { name: "startDay", type: "Nat", unit: { kind: "date" }, source: span },
      { name: "balanceMinor", type: "Int", unit: { kind: "scaled", scale: 2 }, source: span },
      { name: "years", type: "Nat", source: span }
    ]},
    { name: "Rule", role: "requirementItem", source: span, fields: [
      { name: "label", type: "String", source: span },
      { name: "loMinor", type: "Int", unit: { kind: "scaled", scale: 2 }, source: span },
      { name: "hiMinor", type: "Int", unit: { kind: "scaled", scale: 2 }, source: span }
    ]}
  ],
  predicates: [{ name: "obeys", source: span, interpretationNotes: "n",
    params: [{ name: "c", noun: "Contractor" }, { name: "r", noun: "Rule" }], body }],
  requirement: { name: "compliant", quantifier: "allOf", subjectNoun: "Contractor",
    itemsNoun: "Rule", predicate: "obeys",
    itemsData: { name: "rules", values: [{ label: "range", loMinor: -50000, hiMinor: 500000 }] } },
  ambiguities: [], exclusions: []
} as unknown as IR);

const inRange: Expr = { op: "between", value: { op: "field", path: "c.balanceMinor" },
  lo: { op: "field", path: "r.loMinor" }, hi: { op: "field", path: "r.hiMinor" } };

describe("richer IR types", () => {
  it("accepts Int fields and negative values", () => {
    expect(validateIR(ir(inRange), intake)).toEqual([]);
  });

  it("refuses a comparison across incompatible units", () => {
    // The whole point of the unit annotation: `years` is a plain count, `startDay` is a
    // date. Ordering one against the other is meaningless and no proof would catch it.
    const bad: Expr = { op: "ge", left: { op: "field", path: "c.years" }, right: { op: "field", path: "c.startDay" } };
    const errs = validateIR(ir(bad), intake);
    expect(errs.some(e => /incompatible units: plain vs date/.test(e.message))).toBe(true);
  });

  it("refuses integers beyond JS's safe range", () => {
    // Past 2^53-1 the TS mirror and Lean would silently disagree — the worst bug available
    // here, since the mirror is what the deferred path and two checks evaluate against.
    const big = ir(inRange);
    (big.requirement.itemsData.values as any)[0].hiMinor = Number.MAX_SAFE_INTEGER + 2;
    expect(validateIR(big, intake).some(e => /2\^53/.test(e.message))).toBe(true);
  });

  it("emits Int literals Lean can elaborate, parenthesising negatives", () => {
    expect(exprToLean({ op: "const", type: "Int", value: -3 } as Expr)).toBe("((-3) : Int)");
    expect(exprToLean({ op: "const", type: "Int", value: 7 } as Expr)).toBe("(7 : Int)");
  });

  it("desugars `between` to ge/le, so codegen and the mirror see one tree", () => {
    const d = desugar(inRange) as any;
    expect(d.op).toBe("and");
    expect(d.args.map((a: any) => a.op)).toEqual(["ge", "le"]);
    // and the generated Lean contains no `between` of its own
    const lean = renderCaseLean(ir(inRange), [], { diagnostics: false, theoremTactic: null, instanceName: null }, "2026-08-23-t");
    expect(lean).not.toMatch(/between/);
    expect(lean).toMatch(/≥/); expect(lean).toMatch(/≤/);
  });

  it("evaluates `between` identically in the TS mirror", () => {
    const inside = { noun: "Contractor", values: { name: "Ada", startDay: 20000, balanceMinor: -12345, years: 5 } };
    const outside = { noun: "Contractor", values: { name: "Bo", startDay: 20000, balanceMinor: -99999, years: 5 } };
    expect(evalDuties(ir(inRange), inside as any).failingDuties).toEqual([]);
    expect(evalDuties(ir(inRange), outside as any).failingDuties).toEqual(["range"]);
  });
});
