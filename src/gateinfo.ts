// The S4 gate, described for a machine.
//
// A headless caller parks at the gate and later resumes; to do that it has to be able to
// ask "is this case still waiting on a human, and is the signature that exists still
// current?" — without a person reading prose. This is the read model for that question.
//
// `stale` is computed by reusing `requireSignoffCurrent`, never by reimplementing the sha
// comparison. Two implementations of "is this signature still valid" would drift, and the
// drift would be silent and in the dangerous direction.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { readState, caseDir } from "./state.js";
import { requireSignoffCurrent } from "./pipeline/stages.js";
import type { GateInfo } from "./out.js";

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

export function gateInfo(caseId: string): GateInfo | null {
  let state;
  try { state = readState(caseId); } catch { return null; }

  const dir = caseDir(caseId);
  const irPath = path.join(dir, "draft.ir.json");
  const irSha = fs.existsSync(irPath) ? sha256(fs.readFileSync(irPath, "utf8")) : null;

  const signoffPath = path.join(dir, "signoff.json");
  let signoff: GateInfo["signoff"] = null;
  if (fs.existsSync(signoffPath)) {
    try {
      const s = JSON.parse(fs.readFileSync(signoffPath, "utf8"));
      let stale = false;
      try { requireSignoffCurrent(caseId); } catch { stale = true; }
      signoff = { by: s.by, at: s.at, irSha: s.irSha, rulingCitation: s.rulingCitation, stale };
    } catch { /* unreadable sign-off reads as absent, which is the safe direction */ }
  }

  // Awaiting a human whenever there is no current approval — whether none was ever given
  // or the draft moved underneath one.
  const awaiting = !signoff || signoff.stale;

  // `since`: when the case entered the state the gate opens from.
  const entered = [...state.history].reverse().find(h => h.status === "checks-passed");

  return {
    awaiting,
    kind: awaiting ? "human-signoff" : null,
    since: entered?.at ?? null,
    irSha,
    signoff,
    // Deliberately never contains a bypass. There is no flag, env var, or endpoint that
    // approves a formalization; a person runs `signoff`, or nothing happens.
    actions: awaiting ? ["review", "signoff"] : []
  };
}
