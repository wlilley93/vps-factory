// The only module that knows where the repository is.
//
// Before this existed, every path in src/ was bare-relative ("cases/", "lean/", ".justice/",
// "vps.config.json", …), so `process.cwd()` WAS the repo root by assumption and any host
// had to chdir before calling anything. That is fine for a CLI run from the repo and wrong
// for everything else.
//
// Deliberately NOT solved with `process.chdir()` at entry. chdir would silently break
// user-supplied relative arguments — `vps intake ../drafts/role.md` currently resolves
// against the shell's cwd, and after a chdir it would resolve against the repo root and read
// the wrong file or fail. Commands therefore resolve user file arguments against
// `invocationCwd` and repo data against `root()`.
//
// HARD RULE: no module-level path constants anywhere in src/ from here on. A `const X =
// path.join(...)` at module scope is evaluated at import time, before any root is resolved,
// and captures the wrong directory in a way that only shows up under --root.
import fs from "node:fs";
import path from "node:path";

/** The directory the process was launched from. Safe as a const — it never changes, and
 *  it is what user-supplied relative file arguments must resolve against. */
export const invocationCwd = process.cwd();

let rootAbs: string | null = null;

/** Walk up looking for the marker file that identifies a VPS repository. */
function discover(from: string): string | null {
  let dir = path.resolve(from);
  for (;;) {
    if (fs.existsSync(path.join(dir, "vps.config.json"))) return dir;
    const up = path.dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}

/** explicit (--root) > VPS_ROOT > walk up from cwd > cwd itself. */
export function resolveRoot(explicit?: string): string {
  if (explicit) return path.resolve(invocationCwd, explicit);
  if (process.env.VPS_ROOT) return path.resolve(process.env.VPS_ROOT);
  return discover(invocationCwd) ?? invocationCwd;
}

export function setRoot(abs: string): void { rootAbs = path.resolve(abs); }

export function root(): string {
  if (rootAbs === null) rootAbs = resolveRoot();
  return rootAbs;
}

/** Join against the repo root. The building block for everything below. */
export const R = (...p: string[]) => path.join(root(), ...p);

export const casesDir  = () => R("cases");
export const caseDir   = (caseId: string) => R("cases", caseId);
export const leanDir   = () => R("lean");
/** Absolute path to a file inside lean/. NOTE: the *argument* passed to `lake env lean`
 *  must stay relative — it is written verbatim into UNVERIFIED-LEAN.md, a committed and
 *  human-executed ledger, and absolutising it would leak $HOME into the repo. Only the
 *  write side uses this. */
export const leanFile  = (rel: string) => path.join(leanDir(), rel);
export const promptsFile = (name: string) => R("prompts", `${name}.md`);
export const recordDir = () => R("record");
export const unverifiedLedger = () => R("UNVERIFIED-LEAN.md");

/** Fixtures may live outside the repo so a headless harness can replay a recorded run.
 *  They feed S1–S3 only and never S4, so this is not a route around the gate. */
export const fixturesDir = () =>
  process.env.VPS_FIXTURES ? path.resolve(process.env.VPS_FIXTURES) : R("fixtures");
export const fixturesLlm    = (f: string) => path.join(fixturesDir(), "llm", f);
export const fixturesProver = (f: string) => path.join(fixturesDir(), "prover", f);

export const configFile = () =>
  process.env.VPS_CONFIG ? path.resolve(process.env.VPS_CONFIG) : R("vps.config.json");
