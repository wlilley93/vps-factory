// Case state machine (§5). Transitions only via advance(); illegal ⇒ throw.
import fs from "node:fs";
import path from "node:path";

export type Status =
  | "intake" | "drafted" | "precedent-checked" | "checks-passed" | "checks-failed"
  | "signed-off" | "rejected" | "compiled" | "proved" | "proof-failed"
  | "verdict-green" | "verdict-red";

/** Exported so the transition table itself is testable — it is the closest thing the
 *  pipeline has to a safety invariant (nothing may reach `signed-off` except from
 *  `checks-passed`), and it had no coverage. */
export const LEGAL_TRANSITIONS: Record<Status, Status[]> = {
  "intake": ["drafted"],
  "drafted": ["precedent-checked", "drafted"],
  // self-loops permit idempotent stage re-runs
  "precedent-checked": ["checks-passed", "checks-failed", "drafted", "precedent-checked"],
  "checks-failed": ["drafted", "checks-passed", "checks-failed"],
  // `checks-passed` needs the same self-loop every other stage has, or re-running S3 on a
  // passing case throws `illegal transition`. `checks-failed` must be reachable too: without
  // it a re-run that now FAILS throws and leaves the case still reading `checks-passed` —
  // the dangerous direction, since that is the state the S4 gate opens from.
  "checks-passed": ["signed-off", "rejected", "checks-passed", "checks-failed", "drafted"],
  "rejected": ["drafted"],
  "signed-off": ["compiled"],
  "compiled": ["proved", "proof-failed", "compiled"],
  "proved": ["verdict-green", "compiled", "proved", "proof-failed"],
  "proof-failed": ["verdict-red", "compiled", "proved", "proof-failed"],
  "verdict-green": ["compiled", "proved", "proof-failed"],
  "verdict-red": ["compiled", "proved", "proof-failed", "drafted"]
};

export interface CaseState {
  caseId: string;
  familyId: string;
  revision: number;
  supersedes: string | null;
  supersededBy: string | null;
  status: Status;
  history: { status: Status; at: string; by: string; note?: string }[];
}

// caseDir now lives in paths.ts (root-relative). Re-exported here so the ten modules
// that import it from state.js keep working unchanged.
import { caseDir } from "./paths.js";
export { caseDir };
const stateFile = (caseId: string) => path.join(caseDir(caseId), "state.json");

export function readState(caseId: string): CaseState {
  return JSON.parse(fs.readFileSync(stateFile(caseId), "utf8"));
}

export function writeState(s: CaseState): void {
  const tmp = stateFile(s.caseId) + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(s, null, 2));
  fs.renameSync(tmp, stateFile(s.caseId));
}

export function initState(caseId: string, family?: { familyId: string; revision: number; supersedes: string }): CaseState {
  const s: CaseState = {
    caseId,
    familyId: family?.familyId ?? caseId,
    revision: family?.revision ?? 1,
    supersedes: family?.supersedes ?? null,
    supersededBy: null,
    status: "intake",
    history: [{ status: "intake", at: new Date().toISOString(), by: "vps" }]
  };
  fs.mkdirSync(caseDir(caseId), { recursive: true });
  writeState(s);
  return s;
}

export function advance(caseId: string, to: Status, meta: { by: string; note?: string }): CaseState {
  const s = readState(caseId);
  if (!LEGAL_TRANSITIONS[s.status]?.includes(to))
    throw new Error(`illegal transition ${s.status} -> ${to} for ${caseId}`);
  s.status = to;
  s.history.push({ status: to, at: new Date().toISOString(), by: meta.by, note: meta.note });
  writeState(s);
  return s;
}
