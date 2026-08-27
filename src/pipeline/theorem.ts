// S8 (new): prove a general theorem about a formalization, rather than a verdict about one
// instance. See src/codegen/theorem.ts for why this stays inside core Lean.
//
// The output deliberately does NOT go in verdict.<instance>.md: a general theorem is not
// about an instance, and it makes a strictly STRONGER claim than any GREEN — it is
// conditional on the signed-off formalization alone, not on anyone's data. That makes it
// the easiest artefact in the repository to overstate, so its conditionality clause is
// written to say what it does *not* depend on as well as what it does.
import fs from "node:fs";
import path from "node:path";
import { caseDir, leanFile } from "../paths.js";
import { readState } from "../state.js";
import { requireSignoffCurrent } from "./stages.js";
import { checkFile } from "../lean/runner.js";
import { renderTheorem, type Property } from "../codegen/theorem.js";
import type { IR } from "../ir/schema.js";

const readIR = (caseId: string): IR =>
  JSON.parse(fs.readFileSync(path.join(caseDir(caseId), "draft.ir.json"), "utf8"));

export interface TheoremResult {
  property: Property;
  caseId: string;
  against?: string;
  duties?: [string, string];
  proved: boolean;
  deferred: boolean;
  module: string;
  diagnostics: string[];
  path: string;
}

export async function proveTheorem(
  caseId: string,
  opts: { property: Property; against?: string; duties?: [string, string] }
): Promise<TheoremResult> {
  // A general theorem is a claim about the FORMALIZATION, so it inherits the same gate:
  // an unsigned formalization has not been accepted by anyone and nothing may be asserted
  // about it. This is the same condition every verdict carries.
  requireSignoffCurrent(caseId);

  const ir = readIR(caseId);
  const againstIR = opts.against ? readIR(opts.against) : undefined;
  if (opts.against) requireSignoffCurrent(opts.against);

  const { text, module } = renderTheorem(ir, caseId, {
    property: opts.property,
    againstSlug: opts.against, againstIR,
    dutyA: opts.duties?.[0], dutyB: opts.duties?.[1]
  });

  const rel = path.join("Spec", "Theorems", module + ".lean");
  fs.mkdirSync(path.dirname(leanFile(rel)), { recursive: true });
  fs.writeFileSync(leanFile(rel), text);

  const r = await checkFile(rel);
  const diagnostics = r.diagnostics.filter(d => d.severity === "error").map(d => d.data);
  const proved = r.ok === true;
  const deferred = r.ok === null;

  const out = path.join(caseDir(caseId), `theorem.${opts.property}.md`);
  fs.writeFileSync(out, render(caseId, opts, { proved, deferred, module, diagnostics }, text));

  return { property: opts.property, caseId, against: opts.against, duties: opts.duties,
           proved, deferred, module, diagnostics, path: out };
}

function render(
  caseId: string,
  opts: { property: Property; against?: string; duties?: [string, string] },
  r: { proved: boolean; deferred: boolean; module: string; diagnostics: string[] },
  lean: string
): string {
  const st = readState(caseId);
  const so = JSON.parse(fs.readFileSync(path.join(caseDir(caseId), "signoff.json"), "utf8"));
  // "NOT ESTABLISHED", never "does not hold". Lean refusing a proof is not a proof of the
  // negation, and the difference is exactly the kind of overstatement §18.1.16 exists to
  // prevent. The commonest cause here is a claim that is TRUE but outside this fragment —
  // a raised threshold, for instance, is semantically stricter while not being a syntactic
  // superset — and reporting that as "does not hold" would be a false statement about the
  // requirements rather than an honest one about the proof.
  const head = r.deferred ? "DEFERRED — Lean was unavailable"
             : r.proved ? "HOLDS" : "NOT ESTABLISHED";
  const claim = opts.property === "stricter"
    ? `Every subject satisfying **${caseId}** also satisfies **${opts.against}**, so ${caseId} is at least as strict.`
    : `No subject satisfies both **${opts.duties?.[0]}** and **${opts.duties?.[1]}**.`;

  return `# GENERAL THEOREM — ${head}
**Case:** ${caseId} (revision ${st.revision}) · **Property:** ${opts.property} · **Date:** ${new Date().toISOString().slice(0, 10)}

## The claim
${claim}

${r.deferred ? "> ⚠ Lean could not be run; this is the generated statement, not a checked one.\n" : ""}${
  !r.proved && !r.deferred
    ? `## Not established — which is not the same as false\nLean did not accept the statement. That is a fact about this proof, not about the requirements: a claim can be true and still sit outside the fragment this tier can close.\n\nFor \`stricter\`, the proof is a **syntactic** one — it asks whether the earlier revision's duty rows all appear in the later one. So it succeeds when a revision ADDS duties, and fails when a revision RAISES a threshold, even though raising a threshold is semantically stricter. \`5+ years\` becoming \`7+ years\` is the ordinary case and this proof cannot see it; closing that gap needs a per-duty implication argument, which is a larger piece of work and is named rather than pretended.\n\nLean's diagnostics, verbatim:\n\n\`\`\`\n${r.diagnostics.join("\n").slice(0, 2000)}\n\`\`\`\n`
    : ""}
## What this is conditional on — and what it is NOT
This is a statement about the **formalization**, quantified over every possible subject. It
is therefore conditional on the signed-off formalization (${String(so.irSha).slice(0, 12)}…, by
${so.by}) and on nothing else.

In particular it does **not** depend on any instance data, which makes it a strictly
stronger claim than any GREEN verdict this system issues — and correspondingly the easiest
thing here to overstate. It says the requirements relate to each other in the stated way. It
says nothing about whether anyone satisfies them, and nothing about whether the formalization
faithfully represents the prose: that remains a human judgment, recorded at sign-off.

## The statement Lean was given
\`\`\`lean
${lean}\`\`\`
`;
}
