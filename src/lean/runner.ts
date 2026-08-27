// lake/lean invocation (§7.5). In environments without Lean, every invocation is
// recorded in UNVERIFIED-LEAN.md and returns {ok:null} — deferred, never faked.
import fs from "node:fs";
import path from "node:path";
import { execa } from "execa";
import { leanDir, unverifiedLedger } from "../paths.js";

export interface Diagnostic { severity: string; pos?: unknown; endPos?: unknown; data: string }
export interface RunResult { ok: boolean | null; diagnostics: Diagnostic[]; deferred?: boolean }

let leanChecked: boolean | null = null;
export async function leanAvailable(): Promise<boolean> {
  if (leanChecked !== null) return leanChecked;
  try { await execa("lake", ["--version"], { cwd: leanDir(), timeout: 20000 }); leanChecked = true; }
  catch { leanChecked = false; }
  return leanChecked;
}

function deferLedger(cmd: string, rel: string): void {
  const line = "- [ ] `" + cmd + "` -- " + rel + " (" + new Date().toISOString() + ")\n";
  const f = unverifiedLedger();
  if (!fs.existsSync(f)) {
    const header = [
      "# Deferred Lean verification ledger",
      "",
      "Lean is unavailable in the build environment (all release CDNs proxy-blocked;",
      "see README deviations). Every Lean invocation the pipeline wanted is recorded",
      "here verbatim; run them on a machine with elan -- `cd lean && lake build`",
      "covers the lot. Protocol 5b stands: these artifacts are prose until this",
      "ledger is executed and emptied.",
      "", ""
    ].join("\n");
    fs.writeFileSync(f, header);
  }
  fs.appendFileSync(f, line);
}

export async function checkFile(relPath: string, timeoutMs = 120000): Promise<RunResult> {
  if (!(await leanAvailable())) { deferLedger(`lake env lean --json ${relPath}`, relPath); return { ok: null, diagnostics: [], deferred: true }; }
  try {
    const r = await execa("lake", ["env", "lean", "--json", relPath], { cwd: leanDir(), timeout: timeoutMs, reject: false });
    const diags: Diagnostic[] = r.stdout.split("\n").filter(Boolean).flatMap((l: string) => {
      try { return [JSON.parse(l)]; } catch { return []; }
    });
    const ok = r.exitCode === 0 && !diags.some(d => d.severity === "error");
    return { ok, diagnostics: diags };
  } catch (e: any) {
    return { ok: false, diagnostics: [{ severity: "error", data: String(e?.message ?? e) }] };
  }
}

export async function buildAll(timeoutMs = 600000): Promise<RunResult> {
  if (!(await leanAvailable())) { deferLedger("lake build", "whole lean/ tree"); return { ok: null, diagnostics: [], deferred: true }; }
  const r = await execa("lake", ["build"], { cwd: leanDir(), timeout: timeoutMs, reject: false });
  return { ok: r.exitCode === 0, diagnostics: [{ severity: r.exitCode === 0 ? "information" : "error", data: r.stdout + r.stderr }] };
}
