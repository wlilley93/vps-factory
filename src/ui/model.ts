// The read model shared by both UI surfaces.
//
// This module exists so that "the Docket cannot write" is a fact about the import graph
// rather than a promise in a comment. server.ts owns the read model AND the one write
// endpoint; putting the read model somewhere that never imports `s4_signoff`, `advance`,
// `writeState`, `fileRuling` or `enact` means a read-only server can be built on it and
// the property is checkable by a test (test/docket-readonly.test.ts).
//
// Nothing here writes. If that ever stops being true, the read-only test fails.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { caseDir, casesDir } from "../paths.js";
import { readState, type CaseState, type Status } from "../state.js";

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

/** The sign-off bundle for one case. Unchanged in shape from the original in server.ts —
 *  `review --web`'s semantics must not drift because the Docket wanted a field. */
export function buildBundle(caseId: string) {
  const dir = caseDir(caseId);
  const read = (f: string) => fs.readFileSync(path.join(dir, f), "utf8");
  const maybe = (f: string) => fs.existsSync(path.join(dir, f)) ? JSON.parse(read(f)) : null;
  const irRaw = read("draft.ir.json");
  return {
    caseId, state: readState(caseId),
    intake: read("intake.md"),
    ir: JSON.parse(irRaw), irSha: sha256(irRaw),
    checks: {
      summary: maybe("checks/summary.json"),
      traceability: maybe("checks/traceability.json"),
      roundtrip: maybe("checks/roundtrip.json"),
      knownAnswer: maybe("checks/known-answer.json"),
      ensemble: maybe("checks/ensemble.json"),
      adversarial: maybe("checks/adversarial.json")
    },
    precedent: maybe("precedent.report.json"),
    revision: maybe("ir.diff.json"),
    amendContext: maybe("amend.context.json"),
    signoff: maybe("signoff.json")
  };
}

/** buildBundle throws when a case has not been drafted yet (no draft.ir.json). The Docket
 *  must still be able to show that case — it is precisely what you look at when something
 *  went wrong — so this degrades instead of throwing. */
export function buildBundleSafe(caseId: string):
  ReturnType<typeof buildBundle> | { caseId: string; partial: true; state: CaseState; intake: string | null } {
  try { return buildBundle(caseId); }
  catch {
    const dir = caseDir(caseId);
    const ip = path.join(dir, "intake.md");
    return {
      caseId, partial: true, state: readState(caseId),
      intake: fs.existsSync(ip) ? fs.readFileSync(ip, "utf8") : null
    };
  }
}

/** A case id arrives from a URL. Without this, `caseDir("../../etc")` is an arbitrary-file
 *  read primitive. Localhost-only, so low severity — and free to eliminate. */
export function assertCaseId(id: string): string {
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(id) || id.includes("..")) {
    throw Object.assign(new Error(`bad case id: ${id}`), { code: 400 });
  }
  if (!fs.existsSync(path.join(caseDir(id), "state.json"))) {
    throw Object.assign(new Error(`no such case: ${id}`), { code: 404 });
  }
  return id;
}

export interface MatterSummary {
  name: string;
  verdict: "green" | "red" | null;
  failing: string[];
  deferred: boolean;
}

export interface CaseSummary {
  caseId: string;
  familyId: string;
  revision: number;
  status: Status;
  supersedes: string | null;
  supersededBy: string | null;
  updatedAt: string | null;
  lastBy: string | null;
  awaitingSignoff: boolean;
  signedBy: string | null;
  checksPassed: boolean | null;
  checkFailures: string[];
  ambiguities: number;
  exclusions: number;
  duties: number;
  matters: MatterSummary[];
  deferredLean: boolean;
  llmCalls: number;
  broken?: string;
}

/** Verdict is derived from the recorded proof result, not by grepping verdict.md for the
 *  word GREEN — the prose is a rendering, the JSON is the record. */
function matterOf(dir: string, name: string): MatterSummary {
  const per = path.join(dir, `proof.result.${name}.json`);
  const single = path.join(dir, "proof.result.json");
  let file: string | null = fs.existsSync(per) ? per : null;
  if (!file && fs.existsSync(single)) {
    try { if (JSON.parse(fs.readFileSync(single, "utf8")).instance === name) file = single; } catch { /* */ }
  }
  if (!file) return { name, verdict: null, failing: [], deferred: false };
  try {
    const p = JSON.parse(fs.readFileSync(file, "utf8"));
    const failing: string[] = p.diagnosis?.failingDuties ?? [];
    return {
      name,
      verdict: p.rung != null ? "green" : failing.length ? "red" : null,
      failing,
      deferred: p.deferred === true
    };
  } catch { return { name, verdict: null, failing: [], deferred: false }; }
}

export function caseSummary(caseId: string): CaseSummary {
  const dir = caseDir(caseId);
  const base = {
    caseId, familyId: caseId, revision: 1, status: "intake" as Status,
    supersedes: null, supersededBy: null, updatedAt: null, lastBy: null,
    awaitingSignoff: false, signedBy: null, checksPassed: null, checkFailures: [],
    ambiguities: 0, exclusions: 0, duties: 0, matters: [], deferredLean: false, llmCalls: 0
  };
  try {
    const st = readState(caseId);
    const last = st.history[st.history.length - 1];
    const maybe = (f: string) => fs.existsSync(path.join(dir, f)) ? JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) : null;
    const ir = maybe("draft.ir.json");
    const summary = maybe("checks/summary.json");
    const signoff = maybe("signoff.json");
    const instDir = path.join(dir, "instances");
    const matters = fs.existsSync(instDir)
      ? fs.readdirSync(instDir).filter(f => f.endsWith(".json")).map(f => matterOf(dir, f.replace(/\.json$/, "")))
      : [];
    let llmCalls = 0;
    const logPath = path.join(dir, "llm.log.jsonl");
    if (fs.existsSync(logPath)) llmCalls = fs.readFileSync(logPath, "utf8").split("\n").filter(Boolean).length;
    return {
      ...base,
      caseId, familyId: st.familyId, revision: st.revision, status: st.status,
      supersedes: st.supersedes ?? null, supersededBy: st.supersededBy ?? null,
      updatedAt: last?.at ?? null, lastBy: last?.by ?? null,
      awaitingSignoff: st.status === "checks-passed" && !signoff,
      signedBy: signoff?.by ?? null,
      checksPassed: summary ? !!summary.passed : null,
      checkFailures: summary?.failures ?? [],
      ambiguities: ir?.ambiguities?.length ?? 0,
      exclusions: ir?.exclusions?.length ?? 0,
      duties: ir?.requirement?.itemsData?.values?.length ?? 0,
      matters,
      deferredLean: matters.some(m => m.deferred),
      llmCalls
    };
  } catch (e: any) {
    // A half-written case dir must not take down the whole listing. The Docket is what you
    // open when something has gone wrong; it has to survive the wrong thing.
    return { ...base, broken: String(e?.message ?? e) };
  }
}

export function listCases(): CaseSummary[] {
  const dir = casesDir();
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(e => e.isDirectory() && fs.existsSync(path.join(dir, e.name, "state.json")))
    .map(e => caseSummary(e.name))
    .sort((a, b) => a.caseId.localeCompare(b.caseId));
}

export interface RequirementSet {
  familyId: string;
  revisions: CaseSummary[];
  matterNames: string[];
  current: string;
}

/** A *source requirement set* is a family: a base case plus its revisions. A *matter* is an
 *  instance checked against it. The grid of matters x revisions is what `reprove` already
 *  reports flips over; this just names the structure that was always there. */
export function listRequirementSets(): RequirementSet[] {
  const byFamily = new Map<string, CaseSummary[]>();
  for (const c of listCases()) {
    const arr = byFamily.get(c.familyId) ?? [];
    arr.push(c);
    byFamily.set(c.familyId, arr);
  }
  return [...byFamily.entries()].map(([familyId, revisions]) => {
    revisions.sort((a, b) => a.revision - b.revision);
    const names = new Set<string>();
    for (const r of revisions) for (const m of r.matters) names.add(m.name);
    const live = revisions.filter(r => !r.supersededBy);
    return {
      familyId,
      revisions,
      matterNames: [...names].sort(),
      current: (live[live.length - 1] ?? revisions[revisions.length - 1]).caseId
    };
  }).sort((a, b) => a.familyId.localeCompare(b.familyId));
}

export function readVerdicts(caseId: string): { name: string; text: string }[] {
  const dir = caseDir(caseId);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.startsWith("verdict") && f.endsWith(".md"))
    .sort()
    .map(f => ({ name: f, text: fs.readFileSync(path.join(dir, f), "utf8") }));
}

export function readRegression(caseId: string): string | null {
  const p = path.join(caseDir(caseId), "regression.report.md");
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
}
