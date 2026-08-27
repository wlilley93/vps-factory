// How this factory reaches the court.
//
// VPS keeps no jurisdiction of its own. When something needs deciding it asks the Vibe
// Justice System, and the decision lands in the court's docket with the court's citation.
// This file is the whole of that relationship: locate the court, spawn it, read the answer.
//
// It deliberately holds no lookup logic, no book handling, and no ranking. The court is the
// only process that writes the docket — three clients importing enactment as a library would
// mean three processes racing one lockfile and, in time, three versions of the enactment
// code. That is not hypothetical: when the court existed twice here, eight of twelve shared
// modules drifted, and the one that drifted in a safety-relevant direction reported a Lean
// compile failure as a constitutional denial for hours.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";
import { R } from "../paths.js";

const exec = promisify(execFile);
const ENVELOPE_VERSION = 1;

export interface CourtRuling {
  citation: string; court: string; questionKey: string; caseId: string;
  date: string; status: string; file: string;
  question?: string; facts?: string; ruling?: string; reasoning?: string; lawApplied?: string[];
}

/** Where the court lives. Config first, then env, then a sibling checkout — a factory should
 *  not have to be told where the court is on a machine where it is obviously next door. */
export function courtRoot(): string {
  try {
    const cfg = JSON.parse(fs.readFileSync(R("vps.config.json"), "utf8"));
    if (cfg.courtRoot) return path.resolve(R("."), cfg.courtRoot);
  } catch { /* fall through */ }
  if (process.env.VJS_ROOT) return path.resolve(process.env.VJS_ROOT);
  return path.resolve(R(".."), "vibe-justice-system");
}

function parse(stdout: string, command: string): any {
  let env: any;
  try { env = JSON.parse(stdout); }
  catch { throw Object.assign(new Error(`the court returned unparseable output for \`${command}\``), { code: 5 }); }
  if (env.vjs !== ENVELOPE_VERSION) {
    throw Object.assign(new Error(
      `court envelope version ${env.vjs} is not ${ENVELOPE_VERSION}; this factory and that court ` +
      `disagree about the shape of an answer, so nothing is assumed about it`
    ), { code: 5 });
  }
  if (!env.ok && env.error) throw Object.assign(new Error(`court: ${env.error.message}`), { code: env.error.code ?? 5 });
  return env;
}

async function run(args: string[]): Promise<any> {
  const root = courtRoot();
  if (!fs.existsSync(path.join(root, "vjs.config.json"))) {
    throw Object.assign(new Error(
      `no court at ${root}.\n` +
      `  Set courtRoot in vps.config.json, or $VJS_ROOT, or check out vibe-justice-system beside this repo.`
    ), { code: 5 });
  }
  const argv = [path.join(root, "src", "cli.ts"), ...args, "--json", "--root", root];
  try {
    const { stdout } = await exec("npx", ["tsx", ...argv], {
      cwd: root, env: { ...process.env, VJS_ROOT: root },
      timeout: 600_000, maxBuffer: 32 * 1024 * 1024
    });
    return parse(stdout, args[0]);
  } catch (e: any) {
    // A non-zero exit still carries an envelope: the court emits one on failure precisely so
    // a caller never has to distinguish "refused" from "killed".
    if (typeof e?.stdout === "string" && e.stdout.trim().startsWith("{")) return parse(e.stdout, args[0]);
    throw Object.assign(new Error(String(e?.message ?? e)), { code: typeof e?.code === "number" ? e.code : 5 });
  }
}

/**
 * Has this question been decided? EXACT match on the key — this is res judicata, and its
 * exactness is the property. Never fall back to search on a miss: a ranking function here
 * would let the same question be answered two ways while `res_judicata` still compiled.
 */
export async function ask(key: string): Promise<CourtRuling | null> {
  return (await run(["ask", key])).result.standing ?? null;
}

/** Put a question to the bench. May sit a live bench and takes the court's lock; returns a
 *  standing ruling without sitting if the key is already answered. */
export async function rule(input: {
  key: string; question: string; facts: string; matter: string;
}): Promise<{ reused: boolean; ruling: CourtRuling }> {
  const r = await run(["rule", input.key, "--question", input.question, "--facts", input.facts, "--matter", input.matter]);
  return { reused: !!r.result.reused, ruling: r.result.ruling };
}
