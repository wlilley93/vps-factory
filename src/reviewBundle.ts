// S4 terminal bundle (§10 S4): content-equivalent to the web page.
import fs from "node:fs";
import path from "node:path";
import { caseDir, readState } from "./state.js";

export function printBundle(caseId: string): void {
  const dir = caseDir(caseId);
  const ir = JSON.parse(fs.readFileSync(path.join(dir, "draft.ir.json"), "utf8"));
  const intake = fs.readFileSync(path.join(dir, "intake.md"), "utf8");
  const rt = JSON.parse(fs.readFileSync(path.join(dir, "checks", "roundtrip.json"), "utf8"));
  const sum = JSON.parse(fs.readFileSync(path.join(dir, "checks", "summary.json"), "utf8"));
  const prec = fs.existsSync(path.join(dir, "precedent.report.json"))
    ? JSON.parse(fs.readFileSync(path.join(dir, "precedent.report.json"), "utf8")) : { applied: [], filed: [] };
  console.log("=".repeat(70));
  console.log(`SIGN-OFF BUNDLE — ${caseId} (status ${readState(caseId).status})`);
  console.log("=".repeat(70));
  console.log("\n--- INTAKE (verbatim) ---\n" + intake);
  console.log("\n--- BACK-TRANSLATION (what the formalization actually says) ---\n" + rt.details.backtranslation);
  console.log("\n--- EXCLUSIONS (NOT covered by any verdict) ---");
  for (const x of ir.exclusions) console.log(`  ✗ "${x.sourceText}"\n     reason: ${x.reason}`);
  console.log("\n--- AMBIGUITIES (the drafter's judgment calls) ---");
  for (const a of ir.ambiguities) {
    console.log(`  ? "${a.sourceText}"`);
    for (const o of a.options) console.log(`      ${o === a.chosen ? "▶" : " "} ${o}`);
    console.log(`     rationale: ${a.rationale}`);
  }
  console.log("\n--- PREDICATE interpretationNotes ---\n  " + ir.predicates[0].interpretationNotes);
  console.log("\n--- CHECKS ---\n  " + (sum.passed ? "all passed" : "FAILURES: " + sum.failures.join(", ")));
  console.log("\n--- PRECEDENT ---\n  applied: " + (prec.applied.join(", ") || "none") + "\n  filed: " + (prec.filed.join(", ") || "none"));
  const revCtx = path.join(dir, "ir.diff.json");
  if (fs.existsSync(revCtx)) {
    const d = JSON.parse(fs.readFileSync(revCtx, "utf8"));
    console.log("\n--- REVISION DELTA (read this first) ---");
    for (const x of d.deltas) console.log(`  ${x.kind}: ${x.path} — ${x.detail}`);
    if (d.drift.length) { console.log("  ⚠ DRIFT (IR changes outside the prose diff):"); for (const x of d.drift) console.log(`    ! ${x.path} — ${x.detail}`); }
  }
  console.log("\nApproval records a human judgment that this formalization faithfully represents");
  console.log("the prose. It is the load-bearing condition of every future GREEN verdict for this");
  console.log("case. Nothing in this bundle is proved.");
  console.log(`\n  vps signoff ${caseId} --approve --by "<name>" [--notes ...]`);
  console.log(`  vps signoff ${caseId} --reject  --by "<name>" --notes "..."`);
}
