// General theorems (§20 / Phase 6b): claims about a formalization itself, quantified over
// ALL subjects, rather than about one concrete instance.
//
// Every verdict the pipeline produces until now is about one instance: "this candidate
// satisfies this spec". The interesting claims are universal — "no subject can satisfy both
// of these duties", "revision r2 is at least as strict as r1" — and `reprove`'s regression
// report can only ever sample them, one registered instance at a time.
//
// VPS-PLAN §20 predicted this tier "will also require enabling Mathlib". It does not.
// `List.all_eq_true` and `omega` are both core Lean 4.15, so the two properties below close
// with one hand-proved lemma (Spec.all_of_subset) plus decision procedures. §18.1.1
// stands unamended, and §18.1.10's rule extends rather than retires: a general goal that
// this fragment cannot close has left the fragment, and that is a loud failure, not a
// reason to reach for proof search.
import type { IR } from "../ir/schema.js";
import { moduleName, renderCaseLean } from "./lean.js";

export type Property = "stricter" | "exclusive";

export interface TheoremSpec {
  property: Property;
  /** For `stricter`: the case whose duty list should be the weaker (subset) one. */
  againstSlug?: string;
  againstIR?: IR;
  /** For `exclusive`: the two duty labels claimed to be jointly unsatisfiable. */
  dutyA?: string;
  dutyB?: string;
}

/** One case's structures, predicate and duty list, namespaced — no theorem, no #eval, and
 *  with the leading `import` stripped: Lean requires every import at the top of the file,
 *  and a theorem file concatenates two of these bodies under one shared import block. */
function defsFor(ir: IR, slug: string): string {
  return renderCaseLean(ir, [], { diagnostics: false, theoremTactic: null, instanceName: null }, slug)
    .split("\n").filter(l => !l.startsWith("import ")).join("\n").replace(/^\n+/, "");
}

const HEADER = "import Spec.Core\n";

const dutyLiteral = (ir: IR, row: Record<string, unknown>): string => {
  const itemNoun = ir.nouns.find(n => n.name === ir.requirement.itemsNoun)!;
  const val = (t: string, v: unknown) =>
    t === "String" ? JSON.stringify(String(v))
    : t === "Int" ? (Number(v) < 0 ? `((${v}) : Int)` : `(${v} : Int)`)
    : t === "ListString" ? "[" + (v as string[]).map(x => JSON.stringify(x)).join(", ") + "]"
    : t === "ListNat" ? "[" + (v as number[]).join(", ") + "]"
    : String(v);
  return "{ " + itemNoun.fields.map(f => `${f.name} := ${val(f.type, row[f.name])}`).join(", ") + " }";
};

const labelField = (ir: IR): string => {
  const first = (ir.requirement.itemsData.values[0] ?? {}) as Record<string, unknown>;
  return Object.keys(first).find(k => typeof first[k] === "string" && k.toLowerCase().includes("label"))
    ?? Object.keys(first)[0];
};

/**
 * `stricter`: ∀ subject, thisRevision(subject) → thatRevision(subject).
 *
 * Proved by `Spec.all_of_subset` with a decidable subset check over the two finite duty
 * lists. If r2 dropped or altered a duty of r1 the subset check fails and Lean refuses the
 * theorem — which is the honest answer, because r2 would then admit something r1 did not.
 */
function renderStricter(ir: IR, slug: string, againstIR: IR, againstSlug: string): string {
  const thisMod = moduleName(slug), thatMod = moduleName(againstSlug);
  const req = ir.requirement, areq = againstIR.requirement;

  // The two revisions must share a MODEL for this claim to be stateable at all.
  //
  // Lean gives each generated case its own `Duty` structure, so r1's Duty and r2's Duty are
  // distinct types even when their fields are identical, and `d ∈ r1duties` for `d : r2.Duty`
  // is a type error rather than a false statement. And `all_of_subset` needs ONE predicate,
  // since a subset argument says nothing if the two revisions test their duties differently.
  //
  // So the strictness theorem is available exactly when a revision changed its duty DATA and
  // nothing else — which is what §10 S1's minimal-delta drafting is for. When the model
  // itself moved, the honest answer is that the revisions are not comparable this way, not a
  // proof that quietly compares two different things.
  const shape = (x: IR) => JSON.stringify({
    nouns: x.nouns.map(n => ({ n: n.name, f: n.fields.map(f => [f.name, f.type, f.unit?.kind ?? "plain"]).sort() }))
                  .sort((a, b) => a.n.localeCompare(b.n)),
    pred: x.predicates[0].body,
    subject: x.requirement.subjectNoun, items: x.requirement.itemsNoun
  });
  if (shape(ir) !== shape(againstIR)) {
    throw Object.assign(new Error(
      `${slug} and ${againstSlug} do not share a model, so "is at least as strict as" cannot be stated between them.\n` +
      `  A subset argument over duty lists is only meaningful when both revisions declare the same nouns and the same predicate\n` +
      `  and differ solely in their duty data. Here the model itself changed, so the two specs test different things.`
    ), { code: 1 });
  }

  // One shared model, two duty lists. Emitted from the LATER revision's IR; the earlier
  // revision contributes only its rows, which by the check above are of the same shape.
  const itemNoun = ir.nouns.find(n => n.name === req.itemsNoun)!;
  const rowsOf = (x: IR) => (x.requirement.itemsData.values as Record<string, unknown>[])
    .map(r => "    " + dutyLiteral(x, r)).join(",\n");

  return `${HEADER}
${defsFor(ir, slug)}
namespace Spec.Theorems.${thisMod}Stricter

open Spec
open Spec.Cases.${thisMod}

/-- The earlier revision's duty list (${againstSlug}), over the SAME model. -/
def earlierDuties : List ${req.itemsNoun} := [
${rowsOf(againstIR)}
]

def earlierSatisfiedB (s : ${req.subjectNoun}) : Bool := earlierDuties.all (${ir.predicates[0].name}B s)

/-- Every duty of ${againstSlug} also appears in ${slug}. Finite and decidable. -/
theorem duties_subset : ∀ d ∈ earlierDuties, d ∈ ${req.itemsData.name} := by decide

/-- Therefore anything satisfying ${slug} satisfies ${againstSlug}: ${slug} is at least as
    strict. Quantified over EVERY subject, not over the registered instances. -/
theorem stricter_than_earlier :
    ∀ s : ${req.subjectNoun}, ${req.name}B s = true → earlierSatisfiedB s = true := by
  intro s h
  exact all_of_subset _ duties_subset h

end Spec.Theorems.${thisMod}Stricter
`;
}

/**
 * `exclusive`: ∀ subject, ¬(meets(subject, A) ∧ meets(subject, B)).
 *
 * A spec that contains two duties nothing can satisfy together is unsatisfiable, and no
 * amount of per-instance RED verdicts says so — each one looks like a candidate problem.
 * Closed by `simp` on the predicate then `omega` for the linear-arithmetic contradiction;
 * both are core Lean.
 */
function renderExclusive(ir: IR, slug: string, dutyA: string, dutyB: string): string {
  const mod = moduleName(slug);
  const Q = `Spec.Cases.${mod}`;
  const pred = ir.predicates[0];
  const rows = ir.requirement.itemsData.values as Record<string, unknown>[];
  const lf = labelField(ir);
  const a = rows.find(r => String(r[lf]) === dutyA);
  const b = rows.find(r => String(r[lf]) === dutyB);
  if (!a || !b) throw Object.assign(new Error(`unknown duty label(s): ${!a ? dutyA : ""} ${!b ? dutyB : ""}`.trim()), { code: 1 });
  return `${HEADER}
${defsFor(ir, slug)}
namespace Spec.Theorems.${mod}Exclusive

/-- No subject satisfies both duties at once, so any spec demanding both is unsatisfiable.
    A per-instance RED verdict can never say this: each one looks like a data problem. -/
theorem duties_mutually_exclusive :
    ∀ s : ${Q}.${ir.requirement.subjectNoun},
      ¬ (${Q}.${pred.name}B s ${dutyLiteral(ir, a)} = true ∧
         ${Q}.${pred.name}B s ${dutyLiteral(ir, b)} = true) := by
  intro s ⟨h₁, h₂⟩
  simp [${Q}.${pred.name}B] at h₁ h₂
  omega

end Spec.Theorems.${mod}Exclusive
`;
}

export function renderTheorem(ir: IR, slug: string, spec: TheoremSpec): { text: string; module: string } {
  if (spec.property === "stricter") {
    if (!spec.againstIR || !spec.againstSlug) {
      throw Object.assign(new Error("--against <case> is required for the `stricter` property"), { code: 1 });
    }
    return {
      text: renderStricter(ir, slug, spec.againstIR, spec.againstSlug),
      module: `${moduleName(slug)}Stricter`
    };
  }
  if (!spec.dutyA || !spec.dutyB) {
    throw Object.assign(new Error("--duty <label> must be given twice for the `exclusive` property"), { code: 1 });
  }
  return {
    text: renderExclusive(ir, slug, spec.dutyA, spec.dutyB),
    module: `${moduleName(slug)}Exclusive`
  };
}
