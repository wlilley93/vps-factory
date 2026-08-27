// Orchestrator (§10): S1→S3, gate at S4, then S5→S7. Idempotent.
import fs from "node:fs";
import path from "node:path";
import { readState, caseDir } from "../state.js";
import { s1_draft, s2_precedent, s3_checks, s5_compile, s6_prove, s7_verdict, requireSignoffCurrent } from "./stages.js";
import { say, warn } from "../out.js";

/** Accepted values for --force-from. Only S1 is forceable today; a typo previously
 *  triggered a silent redraft rather than an error. */
export const FORCE_STAGES = ["draft"];

/** Where a run stopped, and why. A machine caller needs this: "exit 2" alone cannot
 *  distinguish a precedent conflict from an unsigned gate, and `no-signoff` (nobody has
 *  approved yet) demands a different human action from `stale-signoff` (the draft changed
 *  under a prior approval). The old bare `catch {}` swallowed exactly that distinction. */
export interface RunOutcome {
  exitCode: number;
  stopped: "completed" | "precedent-conflict" | "checks-failed" | "signoff-required"
         | "awaiting-instance" | "proof-failed";
  stage: "s1" | "s2" | "s3" | "s4" | "s5" | "s6" | "s7" | null;
  status: string;
  ran: string[];
  detail: {
    conflicts?: string[];
    failures?: string[];
    reportPath?: string;
    reason?: "no-signoff" | "stale-signoff";
    verdictPath?: string;
  };
  next: { reason: string; command: string[]; human: string };
}

export async function runCase(caseId: string, opts: { instance?: string; forceFrom?: string }): Promise<RunOutcome> {
  const from = opts.forceFrom;
  const st = () => readState(caseId).status;
  const ran: string[] = [];
  const done = (o: Omit<RunOutcome, "status" | "ran">): RunOutcome => ({ ...o, status: st(), ran });

  // `&&` binds tighter than `||`, so the previous form (`… || st() === "drafted" && from`)
  // re-drafted on ANY --force-from value, not just --force-from draft. The old line 11
  // (`if (st() === "intake") await s1_draft(...)`) was dead — already covered here.
  if (from && !FORCE_STAGES.includes(from)) {
    throw Object.assign(new Error(`unknown --force-from '${from}' (expected one of: ${FORCE_STAGES.join(", ")})`), { code: 1 });
  }
  if (from === "draft" || st() === "intake") { await s1_draft(caseId); ran.push("s1"); }
  if (st() === "drafted") {
    const { conflicts } = await s2_precedent(caseId);
    ran.push("s2");
    if (conflicts.length) {
      warn("PRECEDENT CONFLICTS:\n" + conflicts.map(c => "  - " + c).join("\n"));
      warn(`Either conform the draft (vps draft ${caseId} --from-checks) or appeal the citation.`);
      return done({
        exitCode: 2, stopped: "precedent-conflict", stage: "s2", detail: { conflicts },
        next: { reason: "precedent-conflict", command: ["draft", caseId, "--from-checks"],
                human: "Conform the draft to standing precedent, or appeal the citation." }
      });
    }
  }
  if (st() === "precedent-checked") {
    const ok = await s3_checks(caseId);
    ran.push("s3");
    if (!ok) {
      const reportPath = path.join(caseDir(caseId), "checks", "report.md");
      let failures: string[] = [];
      try { failures = JSON.parse(fs.readFileSync(path.join(caseDir(caseId), "checks", "summary.json"), "utf8")).failures ?? []; } catch { /* */ }
      warn(`Checks failed. Read ${reportPath} then: vps draft ${caseId} --from-checks`);
      return done({
        exitCode: 3, stopped: "checks-failed", stage: "s3", detail: { failures, reportPath },
        next: { reason: "checks-failed", command: ["draft", caseId, "--from-checks"],
                human: "Read the checks report, then redraft against the named failures." }
      });
    }
  }
  try { requireSignoffCurrent(caseId); }
  catch (e: any) {
    // Distinguish "nobody has signed" from "the draft moved under a signature", because
    // they call for different human action. This is the whole point of the gate being
    // asynchronous rather than absent: the pipeline parks here and a person decides.
    const hasSignoff = fs.existsSync(path.join(caseDir(caseId), "signoff.json"));
    const reason = hasSignoff ? "stale-signoff" as const : "no-signoff" as const;
    say(`Human gate: review and sign off.\n  next: vps review ${caseId}   (or --web)\n  then: vps signoff ${caseId} --approve --by "<name>"`);
    return done({
      exitCode: 2, stopped: "signoff-required", stage: "s4", detail: { reason },
      next: { reason,
              command: ["review", caseId, "--web"],
              human: reason === "stale-signoff"
                ? "The draft changed after it was approved. Re-review and sign off again."
                : "Review the formalization and sign off. No flag can skip this." }
    });
  }
  if (st() === "signed-off") { await s5_compile(caseId); ran.push("s5"); }
  if (st() === "compiled" && opts.instance) {
    const proved = await s6_prove(caseId, opts.instance);
    ran.push("s6");
    const verdictPath = await s7_verdict(caseId, opts.instance);
    ran.push("s7");
    say("Verdict: " + verdictPath);
    return done({
      exitCode: 0, stopped: proved ? "completed" : "proof-failed", stage: "s7",
      detail: { verdictPath },
      next: { reason: proved ? "completed" : "proof-failed", command: [],
              human: proved
                ? "Read the conditionality section: the verdict is conditional on the sign-off and the instance data."
                : "The verdict names each failing requirement. Fix the data, reject the formalization, or accept that it is unmet." }
    });
  }
  if (st() === "compiled") {
    say(`Compiled. Register an instance then prove:\n  vps instance ${caseId} <file.json>\n  vps prove ${caseId} --instance <name>`);
    return done({
      exitCode: 0, stopped: "awaiting-instance", stage: "s5", detail: {},
      next: { reason: "awaiting-instance", command: ["instance", caseId, "<file.json>"],
              human: "Register the data to check against this formalization." }
    });
  }
  return done({
    exitCode: 0, stopped: "completed", stage: null, detail: {},
    next: { reason: "completed", command: [], human: "Nothing further to run." }
  });
}

// S6b reprove (§10): every family instance, regression report.
export async function reprove(caseId: string): Promise<void> {
  const st = readState(caseId);
  requireSignoffCurrent(caseId);
  await s5_compile(caseId).catch(() => { /* already compiled ok */ });
  const instDir = path.join(caseDir(caseId), "instances");
  const rows: { name: string; prev: string; now: string; failing: string[] }[] = [];
  for (const f of fs.readdirSync(instDir).filter(f => f.endsWith(".json"))) {
    const name = f.replace(/\.json$/, "");
    const ok = await s6_prove(caseId, name);
    await s7_verdict(caseId, name);
    // Predecessor verdict for THIS instance, or "—" if the predecessor never proved it.
    //
    // There is deliberately no fallback to the unsuffixed `verdict.md`. That file is "the
    // most recent single-instance run's" (§10 S7) and says nothing about which instance it
    // describes, so reading it here attributes one instance's verdict to every instance in
    // the family. That is not a cosmetic error: it silently defeats flip detection, which
    // is this report's entire purpose. Observed on 2026-08-23 — sample-role r1 held only an
    // unsuffixed verdict.md, so `will` (in fact GREEN, confirmed by `decide` at rung 1) was
    // reported RED, and the real GREEN→RED regression at r2 was printed as "RED | RED", no
    // flip. An unknown predecessor must read as unknown; a borrowed one is worse than none.
    let prev = "—";
    if (st.supersedes) {
      const pv = path.join(caseDir(st.supersedes), `verdict.${name}.md`);
      if (fs.existsSync(pv)) prev = fs.readFileSync(pv, "utf8").includes("GREEN") ? "GREEN" : "RED";
    }
    const proof = JSON.parse(fs.readFileSync(path.join(caseDir(caseId), "proof.result.json"), "utf8"));
    rows.push({ name, prev, now: ok ? "GREEN" : "RED", failing: proof.diagnosis?.failingDuties ?? [] });
  }
  const md = ["# Regression report — " + caseId, "", "| instance | predecessor | this revision | flips/failures |", "|---|---|---|---|"];
  for (const r of rows) {
    const flip = r.prev !== "—" && r.prev !== r.now ? ` **FLIP** — fails: ${r.failing.join("; ") || "(see verdict)"}` : (r.failing.length ? " fails: " + r.failing.join("; ") : "");
    md.push(`| ${r.name} | ${r.prev} | ${r.now} |${flip} |`);
  }
  fs.writeFileSync(path.join(caseDir(caseId), "regression.report.md"), md.join("\n") + "\n");
}
