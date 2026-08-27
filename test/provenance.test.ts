// Per-duty provenance: which source sentence a failing requirement came from.
// Was README deviation 6 — a stub that returned the predicate's own quote for every duty,
// so a verdict naming two distinct unmet requirements cited the same sentence twice.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evalDuties } from "../src/lean/diagnose.js";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const load = (c: string, i: string) => ({
  ir: JSON.parse(fs.readFileSync(path.join(repo, "cases", c, "draft.ir.json"), "utf8")),
  inst: JSON.parse(fs.readFileSync(path.join(repo, "cases", c, "instances", `${i}.json`), "utf8"))
});

describe("per-duty provenance", () => {
  it("cites a different, correct sentence for each failing duty", () => {
    const { ir, inst } = load("2026-08-22-legal-engine-product-lead", "will-lilley");
    const { provenance } = evalDuties(ir, inst);
    const byLabel = Object.fromEntries(provenance.map(p => [p.label, p]));

    expect(byLabel["Business cases: NPV, second-order effects"].quote).toContain("NPV");
    expect(byLabel["Compliance artifact: RFP response"].quote).toContain("RFP response");

    // The regression this fixes: the two quotes used to be identical.
    const quotes = provenance.map(p => p.quote);
    expect(new Set(quotes).size).toBe(quotes.length);
  });

  it("marks field-resolved citations as specific", () => {
    const { ir, inst } = load("2026-08-22-legal-engine-product-lead", "will-lilley");
    for (const p of evalDuties(ir, inst).provenance) expect(p.specific).toBe(true);
  });

  it("KNOWN LIMIT: duties sharing a dispatch branch cannot be told apart", () => {
    // sample-role-r2's "TypeScript essential" and "Kubernetes required" are both `skill`
    // duties, so both select the same predicate branch, which reads the same `skills`
    // field, which carries one span. Field-level provenance is therefore as precise as the
    // IR allows — duty ROWS (requirement.itemsData.values) carry no SourceSpan of their
    // own, only nouns/fields/predicates do.
    //
    // Fixing this properly means adding per-duty spans to the IR, which is a schema change
    // and so needs a plan revision and a ruling (CLAUDE.md rule 5). Until then this test
    // documents the boundary rather than pretending it is closed.
    const { ir, inst } = load("2026-08-22-sample-role-r2", "casey");
    const { provenance } = evalDuties(ir, inst);
    const skillDuties = provenance.filter(p => /TypeScript|Kubernetes/.test(p.label));
    expect(skillDuties.length).toBe(2);
    expect(skillDuties[0].quote).toBe(skillDuties[1].quote);   // the limit, asserted
  });
});
