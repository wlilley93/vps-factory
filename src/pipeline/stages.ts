// S0–S7 (§10) in one module, one exported run function per stage.
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { advance, caseDir, initState, readState, writeState } from "../state.js";
import { IRSchema, Instance, type IR, type InstanceT } from "../ir/schema.js";
import { validateIR, validateInstance } from "../ir/validate.js";
import { renderCaseLean, moduleName, instDefName } from "../codegen/lean.js";
import { checkFile, leanAvailable } from "../lean/runner.js";
import { diagnose, evalDuties } from "../lean/diagnose.js";
import { getProvider, loadConfig, type Config } from "../llm/provider.js";
import { completeJson } from "../llm/json.js";
import { renderPrompt } from "../prompts.js";
import { extractQuestions } from "../precedent/questions.js";
import { ask, rule, courtRoot } from "../court/client.js";
import { traceability } from "../checks/traceability.js";
import { roundtrip } from "../checks/roundtrip.js";
import { knownAnswer } from "../checks/knownAnswer.js";
import { ensemble } from "../checks/ensemble.js";
import { adversarial } from "../checks/adversarial.js";
import { writeReports } from "../checks/report.js";
import { wordDiff, diffSummary, irDiff, driftWarnings } from "../diff.js";
import crypto from "node:crypto";
import { casesDir, leanFile } from "../paths.js";

export const sha256 = (s: string | Buffer) => crypto.createHash("sha256").update(s).digest("hex");

const IR_SCHEMA_TEXT = `IR JSON shape (v1):
{ caseId, sourceDoc, nouns: [{name: PascalCase, role: "subject"|"requirementItem",
  fields: [{name: camelCase, type: "Nat"|"Bool"|"String"|"ListString"|"ListNat",
            source: {quote: VERBATIM substring of intake, start, end}}], source: {...}}],
  predicates: [ exactly one: {name, params: [{name, noun}, {name, noun}], body: Expr,
                source: {...}, interpretationNotes}],
  requirement: {name, quantifier: "allOf", subjectNoun, itemsNoun,
                itemsData: {name, values: [...]}, predicate},
  ambiguities: [{sourceText, options[], chosen, rationale}],
  exclusions: [{sourceText, reason}] }
Expr := {op:"const",type,value} | {op:"field",path:"p.field"} | {op:"ge"|"gt"|"le"|"lt",left,right}
      | {op:"eq"|"ne",left,right} | {op:"and"|"or",args:[..]} | {op:"not",arg} | {op:"contains",list,item}`;

export function slugOf(file: string, slug?: string): string {
  const base = slug ?? path.basename(file).replace(/\.[^.]+$/, "");
  const kebab = base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${new Date().toISOString().slice(0, 10)}-${kebab}`;
}

// S0 intake
export function s0_intake(file: string, slug?: string): string {
  const caseId = slugOf(file, slug);
  if (fs.existsSync(caseDir(caseId))) throw new Error(`case exists: ${caseId}`);
  initState(caseId);
  fs.copyFileSync(file, path.join(caseDir(caseId), "intake.md"));
  fs.mkdirSync(path.join(caseDir(caseId), "instances"), { recursive: true });
  return caseId;
}

// S0b amend (§5.3)
export function s0b_amend(prevCase: string, file: string): string {
  const prev = readState(prevCase);
  if (prev.supersededBy) throw new Error(`${prevCase} already superseded by ${prev.supersededBy}`);
  const famBase = prev.familyId;
  const revs = fs.readdirSync(casesDir()).filter(c => c === famBase || c.startsWith(famBase + "-r"));
  const n = revs.length + 1;
  const caseId = `${famBase}-r${n}`;
  initState(caseId, { familyId: famBase, revision: n, supersedes: prevCase });
  fs.copyFileSync(file, path.join(caseDir(caseId), "intake.md"));
  fs.mkdirSync(path.join(caseDir(caseId), "instances"), { recursive: true });
  const prevIntake = fs.readFileSync(path.join(caseDir(prevCase), "intake.md"), "utf8");
  const nextIntake = fs.readFileSync(path.join(caseDir(caseId), "intake.md"), "utf8");
  const prevIr = fs.existsSync(path.join(caseDir(prevCase), "draft.ir.json"))
    ? fs.readFileSync(path.join(caseDir(prevCase), "draft.ir.json"), "utf8") : null;
  fs.writeFileSync(path.join(caseDir(caseId), "amend.context.json"), JSON.stringify({
    previousCase: prevCase,
    previousIrSha: prevIr ? sha256(prevIr) : null,
    proseDiff: diffSummary(wordDiff(prevIntake, nextIntake))
  }, null, 2));
  const prevInst = path.join(caseDir(prevCase), "instances");
  for (const f of fs.readdirSync(prevInst)) fs.copyFileSync(path.join(prevInst, f), path.join(caseDir(caseId), "instances", f));
  return caseId;
}

// S1 draft
export async function s1_draft(caseId: string, opts: { fromChecks?: boolean } = {}): Promise<void> {
  const cfg = loadConfig();
  const provider = await getProvider(cfg);
  const st = readState(caseId);
  const intake = fs.readFileSync(path.join(caseDir(caseId), "intake.md"), "utf8");

  let priorErrors = "";
  if (opts.fromChecks) {
    const sum = path.join(caseDir(caseId), "checks", "summary.json");
    if (fs.existsSync(sum)) priorErrors = fs.readFileSync(sum, "utf8");
    const notes = readState(caseId).history.filter(h => h.status === "rejected" && h.note).map(h => h.note).join("; ");
    if (notes) priorErrors += "\nReviewer notes: " + notes;
  }
  // precedents applicable (S2's store lookup; empty on first run)
  let precedents = "";
  // revision context (§10 S1)
  let previousIR = "", proseDiff = "";
  const amendCtx = path.join(caseDir(caseId), "amend.context.json");
  if (fs.existsSync(amendCtx)) {
    const ctx = JSON.parse(fs.readFileSync(amendCtx, "utf8"));
    const prevIrPath = path.join(caseDir(ctx.previousCase), "draft.ir.json");
    if (fs.existsSync(prevIrPath)) previousIR = fs.readFileSync(prevIrPath, "utf8");
    proseDiff = JSON.stringify(ctx.proseDiff);
  }
  const p = renderPrompt("drafter", { intake, irSchema: IR_SCHEMA_TEXT, precedents, priorErrors, previousIR, proseDiff });
  let ir: IR | null = null;
  let errs: { path: string; message: string }[] = [];
  for (let i = 0; i <= cfg.maxJsonRepairs; i++) {
    const attempt = await completeJson(provider, IRSchema, {
      promptName: "drafter", caseId, system: p.system,
      user: p.user + (errs.length ? `\n\nPrevious draft failed semantic validation: ${JSON.stringify(errs.slice(0, 8))}. Fix precisely these.` : "")
    }, cfg.maxJsonRepairs);
    errs = validateIR(attempt, path.join(caseDir(caseId), "intake.md"));
    if (!errs.length) { ir = attempt; break; }
  }
  if (!ir) throw Object.assign(new Error("draft failed semantic validation: " + JSON.stringify(errs.slice(0, 8))), { code: 5 });

  const irPath = path.join(caseDir(caseId), "draft.ir.json");
  if (fs.existsSync(irPath)) {
    fs.mkdirSync(path.join(caseDir(caseId), "draft.history"), { recursive: true });
    fs.copyFileSync(irPath, path.join(caseDir(caseId), "draft.history", Date.now() + ".ir.json"));
  }
  fs.writeFileSync(irPath, JSON.stringify(ir, null, 2));

  if (previousIR) {
    const deltas = irDiff(JSON.parse(previousIR), ir);
    const ctx = JSON.parse(fs.readFileSync(amendCtx, "utf8"));
    const drift = driftWarnings(deltas, ctx.proseDiff);
    fs.writeFileSync(path.join(caseDir(caseId), "ir.diff.json"), JSON.stringify({ deltas, drift }, null, 2));
  }
  advance(caseId, "drafted", { by: "s1" });
}

// S2 precedent
export async function s2_precedent(caseId: string): Promise<{ conflicts: string[] }> {
  // S2 no longer runs a court. It asks one.
  //
  // Question extraction stays here — it is knowledge about the IR, which is this factory's
  // domain. Everything after it (does a standing ruling exist, does it agree, and if not who
  // decides) belongs to the court, and the court's docket is where the answer lives. This
  // repository holds no book, no citations and no genesis of its own.
  const ir: IR = JSON.parse(fs.readFileSync(path.join(caseDir(caseId), "draft.ir.json"), "utf8"));
  const qs = extractQuestions(ir, readState(caseId).familyId);
  const applied: string[] = [], filed: string[] = [], conflicts: string[] = [];
  const conflictDetail: { citation: string; questionKey: string; question: string;
                          recorded: string; drafted: string }[] = [];

  for (const q of qs) {
    const standing = await ask(q.key);
    if (standing) {
      // Exact agreement on the recorded facts, or it is a conflict. The court reports the
      // divergence; it does not acquire an opinion about what this factory should do next.
      const consistent = (standing.facts ?? "").trim() === q.facts.trim();
      if (consistent) applied.push(standing.citation);
      else {
        conflicts.push(`${standing.citation} (${q.key}): recorded facts differ from draft`);
        conflictDetail.push({
          citation: standing.citation, questionKey: q.key, question: q.text,
          recorded: (standing.facts ?? "").trim(), drafted: q.facts.trim()
        });
      }
      continue;
    }
    const { ruling } = await rule({ key: q.key, question: q.text, facts: q.facts, matter: caseId });
    filed.push(ruling.citation);
  }

  fs.writeFileSync(path.join(caseDir(caseId), "precedent.report.json"),
    JSON.stringify({ applied, filed, conflicts, conflictDetail, court: courtRoot() }, null, 2));
  if (!conflicts.length) advance(caseId, "precedent-checked", { by: "s2" });
  return { conflicts };
}

// S3 checks
export async function s3_checks(caseId: string): Promise<boolean> {
  const cfg = loadConfig();
  const provider = await getProvider(cfg);
  const ir: IR = JSON.parse(fs.readFileSync(path.join(caseDir(caseId), "draft.ir.json"), "utf8"));
  const results = [];
  results.push(traceability(ir, caseId));                      // 12.1
  results.push(await ensemble(provider, cfg, caseId, IR_SCHEMA_TEXT)); // 12.4
  results.push(await roundtrip(provider, cfg, ir, caseId));    // 12.2
  results.push(await knownAnswer(provider, cfg, ir, caseId));  // 12.3
  results.push(await adversarial(provider, cfg, ir, caseId));  // 12.5
  const { passed } = writeReports(caseId, results);
  advance(caseId, passed ? "checks-passed" : "checks-failed", { by: "s3" });
  return passed;
}

// S4 sign-off — the shared implementation (CLI and web both call THIS; §13.3)
export async function s4_signoff(caseId: string, decision: "approve" | "reject", by: string, notes: string): Promise<{ rulingCitation?: string }> {
  const st = readState(caseId);
  if (st.status !== "checks-passed") throw new Error(`sign-off requires checks-passed (is: ${st.status})`);
  if (decision === "reject") {
    advance(caseId, "rejected", { by, note: notes || "(rejected)" });
    advance(caseId, "drafted", { by, note: "returned for redraft" });
    return {};
  }
  const irRaw = fs.readFileSync(path.join(caseDir(caseId), "draft.ir.json"), "utf8");
  // Sign-off no longer files a ruling.
  //
  // A `signoff:` entry was never a decision on a question — it was an event, and one already
  // recorded here with the signer, the time and the exact IR hash it binds to. It existed
  // only because filing a ruling used to be the only way to obtain a citation, and it put
  // three non-decisions into a docket that is supposed to hold decisions.
  //
  // Nothing is weakened: `requireSignoffCurrent` still gates S5-S7 on this file and on the
  // hash matching, and every verdict's conditionality clause still names the signer and the
  // sha. What is gone is a citation nobody ever cited.
  const tmp = path.join(caseDir(caseId), "signoff.json.tmp");
  fs.writeFileSync(tmp, JSON.stringify({
    approved: true, by, at: new Date().toISOString(), notes, irSha: sha256(irRaw)
  }, null, 2));
  fs.renameSync(tmp, path.join(caseDir(caseId), "signoff.json"));
  advance(caseId, "signed-off", { by, note: `IR ${sha256(irRaw).slice(0, 12)}…` });
  // supersession becomes real at the successor's sign-off (§5.3)
  if (st.supersedes) {
    const prev = readState(st.supersedes);
    prev.supersededBy = caseId;
    writeState(prev);
  }
  return {};
}

export function requireSignoffCurrent(caseId: string): void {
  const so = path.join(caseDir(caseId), "signoff.json");
  if (!fs.existsSync(so)) throw Object.assign(new Error("sign-off required (exit 2)"), { code: 2 });
  const rec = JSON.parse(fs.readFileSync(so, "utf8"));
  const cur = sha256(fs.readFileSync(path.join(caseDir(caseId), "draft.ir.json"), "utf8"));
  if (!rec.approved || rec.irSha !== cur)
    throw Object.assign(new Error("sign-off is stale for the current draft.ir.json (exit 2)"), { code: 2 });
}

// S5 compile
export async function s5_compile(caseId: string): Promise<void> {
  requireSignoffCurrent(caseId);
  const ir: IR = JSON.parse(fs.readFileSync(path.join(caseDir(caseId), "draft.ir.json"), "utf8"));
  const file = renderCaseLean(ir, [], { diagnostics: false, theoremTactic: null, instanceName: null }, caseId);
  const rel = path.join("Spec", "Cases", moduleName(caseId) + ".lean");
  fs.writeFileSync(leanFile(rel), file);
  const instDir = path.join(caseDir(caseId), "instances");
  for (const f of fs.readdirSync(instDir)) {
    const inst = Instance.parse(JSON.parse(fs.readFileSync(path.join(instDir, f), "utf8")));
    const errs = validateInstance(ir, inst);
    if (errs.length) throw Object.assign(new Error(`instance ${f} invalid: ${JSON.stringify(errs)}`), { code: 4 });
  }
  const r = await checkFile(rel);
  if (r.ok === false) throw Object.assign(new Error("S5 Lean failure:\n" + r.diagnostics.map(d => d.data).join("\n")), { code: 4 });
  advance(caseId, "compiled", { by: "s5", note: r.deferred ? "lean deferred (ledger)" : "lean ok" });
}


/** Proof results are per-instance, exactly as §10 S6b specifies. Writing only the
 *  unsuffixed `proof.result.json` meant that in `reprove` each instance overwrote the
 *  previous one's record, so a family of N matters kept one proof result -- the last.
 *  The unsuffixed file is still written for backward compatibility: it is "the most recent
 *  single-instance run's", and is what an older caller expects. Same defect class as the
 *  regression report's borrowed verdict.md (fixed 2026-08-23); the lesson is that any
 *  per-instance artefact needs the instance in its name. */
function writeProofResult(caseId: string, instanceName: string, payload: unknown): void {
  const body = JSON.stringify(payload, null, 2);
  fs.writeFileSync(path.join(caseDir(caseId), `proof.result.${instanceName}.json`), body);
  fs.writeFileSync(path.join(caseDir(caseId), "proof.result.json"), body);
}

// S6 prove — the ladder (§10)
export async function s6_prove(caseId: string, instanceName: string, forceProver = false): Promise<boolean> {
  const cfg = loadConfig();
  requireSignoffCurrent(caseId);
  const ir: IR = JSON.parse(fs.readFileSync(path.join(caseDir(caseId), "draft.ir.json"), "utf8"));
  const instPath = path.join(caseDir(caseId), "instances", instanceName + ".json");
  const inst: InstanceT = Instance.parse(JSON.parse(fs.readFileSync(instPath, "utf8")));
  const defName = instDefName(inst);
  const rel = path.join("Spec", "Cases", moduleName(caseId) + ".lean");
  const history: { rung: number; tactic: string; ok: boolean | null; error?: string }[] = [];
  const ladder: { rung: number; tactic: string }[] = [
    { rung: 1, tactic: "decide" }, { rung: 2, tactic: "native_decide" }, { rung: 3, tactic: "simp; decide" }
  ];
  const finish = async (rung: number, tactic: string, deferred: boolean) => {
    fs.copyFileSync(leanFile(rel), path.join(caseDir(caseId), "lean.snapshot.lean"));
    writeProofResult(caseId, instanceName, {
      instance: instanceName, rung, tactic, searchRequired: rung >= 4, deferred,
      attempts: history.length, history
    });
    advance(caseId, "proved", { by: "s6", note: `${tactic}${deferred ? " (deferred)" : ""}` });
  };

  const leanUp = await leanAvailable();
  if (!leanUp) {
    // Deferred: TS mirror decides expected outcome; Lean run queued. Never described as proof.
    const r = evalDuties(ir, inst);
    const file = renderCaseLean(ir, [inst], { diagnostics: false, theoremTactic: "decide", instanceName: defName }, caseId);
    fs.writeFileSync(leanFile(rel), file);
    await checkFile(rel); // queues ledger line
    if (r.failingDuties.length === 0) { await finish(1, "decide", true); return true; }
    const diag = { ...r, deferred: true };
    fs.writeFileSync(path.join(caseDir(caseId), "proof.result.json"), JSON.stringify({
      instance: instanceName, rung: null, tactic: null, deferred: true, diagnosis: diag, history
    }, null, 2));
    advance(caseId, "proof-failed", { by: "s6", note: `fails: ${r.failingDuties.join("; ").slice(0, 120)}` });
    return false;
  }

  for (const { rung, tactic } of ladder) {
    const file = renderCaseLean(ir, [inst], { diagnostics: false, theoremTactic: tactic, instanceName: defName }, caseId);
    fs.writeFileSync(leanFile(rel), file);
    const r = await checkFile(rel);
    history.push({ rung, tactic, ok: r.ok, error: r.ok ? undefined : r.diagnostics.map(d => d.data).join("; ").slice(0, 300) });
    if (r.ok) { await finish(rung, tactic, false); return true; }
  }
  // rung 4: prover (only if enabled/forced), rung 5: repair loop
  const { proverRungs } = await import("./prove45.js");
  const done = await proverRungs(cfg, ir, inst, caseId, rel, defName, history, forceProver);
  if (done) { await finish(done.rung, done.tactic, false); return true; }
  const diag = await diagnose(ir, inst, caseId);
  writeProofResult(caseId, instanceName, {
    instance: instanceName, rung: null, tactic: null, diagnosis: diag, history
  });
  advance(caseId, "proof-failed", { by: "s6", note: `fails: ${diag.failingDuties.join("; ").slice(0, 120)}` });
  return false;
}

// S7 verdict
export async function s7_verdict(caseId: string, instanceName?: string): Promise<string> {
  const st = readState(caseId);
  const cfgLean = fs.existsSync(leanFile("lean-toolchain")) ? fs.readFileSync(leanFile("lean-toolchain"), "utf8").trim() : "?";
  const ir: IR = JSON.parse(fs.readFileSync(path.join(caseDir(caseId), "draft.ir.json"), "utf8"));
  // Prefer this instance's own proof record; fall back to the unsuffixed file only when
  // no instance was named (the single-instance path).
  const perInstance = instanceName ? path.join(caseDir(caseId), `proof.result.${instanceName}.json`) : null;
  const proofPath = perInstance && fs.existsSync(perInstance)
    ? perInstance : path.join(caseDir(caseId), "proof.result.json");
  const proof = JSON.parse(fs.readFileSync(proofPath, "utf8"));
  const so = JSON.parse(fs.readFileSync(path.join(caseDir(caseId), "signoff.json"), "utf8"));
  const intake = fs.readFileSync(path.join(caseDir(caseId), "intake.md"), "utf8");
  const irRaw = fs.readFileSync(path.join(caseDir(caseId), "draft.ir.json"), "utf8");
  const green = st.status === "proved" || st.status === "verdict-green";
  const inst = instanceName ?? proof.instance;
  const supersededNote = st.supersededBy
    ? `> ⚠ SUPERSEDED by ${st.supersededBy}. This verdict remains a true statement about revision ${st.revision}'s formalization only. See the successor's verdicts for current status.\n`
    : "";
  const deferredNote = proof.deferred
    ? "\n> ⚠ LEAN DEFERRED: this environment could not run Lean; the verdict below reports the deterministic evaluation mirror, and the Lean run is queued in UNVERIFIED-LEAN.md. Until that ledger is executed, per Protocol 5b this is an EXPECTED verdict, not a machine-checked one.\n"
    : "";
  let md: string;
  if (green) {
    md = `# VERDICT — GREEN ✅
**Case:** ${caseId} (family ${st.familyId}, revision ${st.revision}) · **Instance:** ${inst} · **Date:** ${new Date().toISOString().slice(0, 10)}
${supersededNote}${deferredNote}**Theorem:** \`verdict_${inst} : ${ir.requirement.name} ${inst}\` — ${proof.deferred ? "queued for" : "accepted by"} Lean (${cfgLean}) via \`${proof.tactic}\`.

## What this guarantees
Lean ${proof.deferred ? "will verify (pending ledger)" : "has verified"}, for every requirement item in the signed-off formalization, that the
provided instance data satisfies the signed-off predicate. This is a machine-checked proof,
not a test: within the model, no case was sampled — all were covered.

## What this is conditional on (read this)
1. **The formalization** (${so.irSha.slice(0, 12)}…) faithfully representing the source prose — a human
   judgment, signed off by ${so.by} on ${so.at.slice(0, 10)}, binding IR ${String(so.irSha).slice(0, 12)}…, supported by
   the checks in \`checks/report.md\`, and proved by nothing.
2. **The instance data** being true. Lean verified \`IF this data THEN satisfied\`; it cannot
   verify the data itself.
3. **Exclusions:** the following prose was deliberately not modelled and is NOT covered by
   this verdict:
${ir.exclusions.map(x => `   - "${x.sourceText}" — ${x.reason}`).join("\n") || "   - (none)"}

## Chain of custody
intake ${sha256(intake).slice(0, 12)} → IR ${sha256(irRaw).slice(0, 12)} → lean ${sha256(fs.readFileSync(path.join(caseDir(caseId), "lean.snapshot.lean"))).slice(0, 12)} → proof \`${proof.tactic}\`, ${proof.attempts ?? 1} attempt(s).
`;
  } else {
    const d = proof.diagnosis ?? { failingDuties: [], perDuty: [], provenance: [] };
    const duties = ir.requirement.itemsData.values as any[];
    const failLines = d.failingDuties.map((label: string) => {
      const duty = duties.find(x => x.label === label);
      return `- **${label}** — duty ${JSON.stringify(duty)} — instance did not satisfy the signed-off predicate for this item.`;
    }).join("\n");
    md = `# VERDICT — RED ❌
**Case:** ${caseId} (family ${st.familyId}, revision ${st.revision}) · **Instance:** ${inst} · **Date:** ${new Date().toISOString().slice(0, 10)}
${supersededNote}${deferredNote}
## Failing requirements
${failLines || "- (diagnosis unavailable)"}

## Possible causes
The data is wrong (fix the instance and reprove) · the formalization is wrong (reject via
\`vps signoff --reject\` and redraft) · the requirement is genuinely unmet.

## What this is conditional on
Same conditionality as any verdict: the signed-off formalization (${so.irSha.slice(0, 12)}…, by ${so.by}),
the truth of the instance data, and the exclusions listed in the sign-off bundle.
`;
  }
  const out = path.join(caseDir(caseId), instanceName ? `verdict.${instanceName}.md` : "verdict.md");
  fs.writeFileSync(out, md);
  // per-instance history always survives (predecessor lookups in reprove depend on it)
  if (!instanceName && inst) fs.writeFileSync(path.join(caseDir(caseId), `verdict.${inst}.md`), md);
  if (st.status === "proved") advance(caseId, "verdict-green", { by: "s7" });
  else if (st.status === "proof-failed") advance(caseId, "verdict-red", { by: "s7" });
  return out;
}
