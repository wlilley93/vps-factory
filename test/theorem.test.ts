// Phase 6b: general theorems — claims about a formalization, quantified over ALL subjects,
// rather than verdicts about one instance.
//
// These tests check the generated statement and the refusals; the proofs themselves were
// verified against the real kernel (see record/0029.md). Running Lean inside the unit suite
// would make it slow and environment-dependent for no extra assurance about the codegen.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderTheorem } from "../src/codegen/theorem.js";
import type { IR } from "../src/ir/schema.js";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const load = (c: string): IR => JSON.parse(fs.readFileSync(path.join(repo, "cases", c, "draft.ir.json"), "utf8"));

describe("general theorems", () => {
  it("states strictness over every subject, not over registered instances", () => {
    const r1 = load("2026-08-22-sample-role");
    const r2: IR = JSON.parse(JSON.stringify(r1));
    (r2.requirement.itemsData.values as any[]).push({ label: "Kubernetes required", kind: "skill", minCount: 0, needle: "Kubernetes" });
    const { text } = renderTheorem(r2, "2026-08-22-sample-role-r2", {
      property: "stricter", againstSlug: "2026-08-22-sample-role", againstIR: r1
    });
    expect(text).toMatch(/∀ s : Candidate/);
    expect(text).toMatch(/all_of_subset/);
    expect(text).toMatch(/duties_subset .*:= by decide/);
    // Core Lean only — the point of the exercise (VPS-PLAN §20 predicted otherwise).
    expect(text).not.toMatch(/Mathlib/);
    expect(text).toMatch(/^import Spec\.Core/m);
    // exactly one import block, at the top
    expect(text.split("\n").findLastIndex(l => l.startsWith("import "))).toBeLessThan(2);
  });

  it("refuses to compare revisions that do not share a model", () => {
    // Lean gives each case its own Duty type, and all_of_subset needs ONE predicate, so a
    // subset argument across different models would be comparing two different things.
    // Refusing to state it is the honest outcome, not a proof failure to report later.
    const a = load("2026-08-22-sample-role");
    const b = load("2026-08-22-legal-engine-product-lead");
    expect(() => renderTheorem(b, "2026-08-22-legal-engine-product-lead", {
      property: "stricter", againstSlug: "2026-08-22-sample-role", againstIR: a
    })).toThrow(/do not share a model/);
  });

  it("requires --against for stricter and two duties for exclusive", () => {
    const ir = load("2026-08-22-sample-role");
    expect(() => renderTheorem(ir, "x", { property: "stricter" })).toThrow(/--against/);
    expect(() => renderTheorem(ir, "x", { property: "exclusive" })).toThrow(/--duty/);
  });

  it("rejects an unknown duty label rather than silently proving nothing", () => {
    const ir = load("2026-08-22-sample-role");
    expect(() => renderTheorem(ir, "x", {
      property: "exclusive", dutyA: "5+ years experience", dutyB: "no such duty"
    })).toThrow(/unknown duty label/);
  });

  it("closes exclusivity with core decision procedures", () => {
    const ir = load("2026-08-22-sample-role");
    const { text } = renderTheorem(ir, "2026-08-22-sample-role", {
      property: "exclusive", dutyA: "5+ years experience", dutyB: "Led 2+ launches"
    });
    expect(text).toMatch(/omega/);      // core Lean, not Mathlib
    expect(text).toMatch(/¬ \(/);
    expect(text).not.toMatch(/Mathlib/);
  });
});
