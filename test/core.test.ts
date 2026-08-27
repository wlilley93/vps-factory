import { describe, it, expect } from "vitest";
import { wordDiff, diffSummary, irDiff } from "../src/diff.js";
import { sanitise } from "../src/llm/proofProvider.js";
import { stripFences } from "../src/llm/json.js";

describe("word diff (M10 f)", () => {
  it("identical inputs -> empty diff", () => {
    const d = diffSummary(wordDiff("a b c", "a b c"));
    expect(d.added).toEqual([]); expect(d.removed).toEqual([]);
  });
  it("insert middle", () => {
    const d = diffSummary(wordDiff("a b d", "a b c d"));
    expect(d.added).toEqual(["c"]); expect(d.removed).toEqual([]);
  });
  it("replace at start and delete at end", () => {
    const d = diffSummary(wordDiff("x b c tail", "y b c"));
    expect(d.added).toEqual(["y"]); expect(d.removed).toEqual(["x", "tail"]);
  });
});

describe("prover sanitisation (M8 a; §8.6/§18.1.9)", () => {
  it("rejects sorry/axiom/def/import and native_decide by default", () => {
    for (const bad of ["sorry", "axiom x : True", "def f := 1", "import Mathlib", "native_decide"])
      expect(sanitise(bad, false).ok).toBe(false);
  });
  it("allows native_decide only when a human enabled it", () => {
    expect(sanitise("native_decide", true)).toEqual({ ok: true, tactic: "native_decide" });
  });
  it("strips fences and leading by", () => {
    const r = sanitise("```lean\nby decide\n```", false);
    expect(r).toEqual({ ok: true, tactic: "decide" });
  });
  it("rejects maxHeartbeats above 400000", () => {
    expect(sanitise("set_option maxHeartbeats 800000 in decide", false).ok).toBe(false);
  });
});

describe("json fence stripping (§8.4)", () => {
  it("extracts the object from fenced output", () => {
    expect(JSON.parse(stripFences('noise ```json\n{"a":1}\n``` noise')).a).toBe(1);
  });
});

describe("ir diff (M10 f drift input)", () => {
  const base = { nouns: [{ name: "C", fields: [{ name: "x", type: "Nat" }] }], predicates: [{ name: "p", body: { op: "const", type: "Bool", value: true } }], requirement: { itemsData: { values: [{ label: "a" }] } } };
  it("detects a renamed field as remove+add", () => {
    const next = JSON.parse(JSON.stringify(base)); next.nouns[0].fields[0].name = "y";
    const d = irDiff(base, next);
    expect(d.map(x => x.kind).sort()).toEqual(["added", "removed"]);
  });
});
