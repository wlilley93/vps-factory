// Machine-readable output (§15.2's `--json`, specified but never implemented).
//
// Four rules make this usable by a caller that is not a human:
//
//  1. In json mode stdout carries the envelope and NOTHING else. Every line a human would
//     read goes to stderr. This is why `say()` has to replace `console.log` in command
//     bodies — one stray log corrupts the caller's JSON.parse.
//  2. `--json` never changes exit codes. A gate stop is still exit 2; the envelope just
//     also says why. `envelope.exitCode === process exit status` is an invariant.
//  3. Failures emit too. A caller must never see empty stdout on error, because empty
//     stdout is indistinguishable from "the process was killed".
//  4. Emission happens in one place, so no command can forget.
import { readState } from "./state.js";

import fs from "node:fs";

export type OutMode = "text" | "json";
let mode: OutMode = "text";

export const setOutMode = (m: OutMode) => { mode = m; };
export const isJson = () => mode === "json";

/** Human-facing line. Suppressed entirely in json mode. */
export const say = (...a: unknown[]) => { if (mode === "text") console.log(...a); };
/** Diagnostics. Always stderr, both modes — never pollutes the envelope. */
export const warn = (...a: unknown[]) => console.error(...a);

export interface Next { reason: string; command: string[]; human: string }

export interface GateInfo {
  awaiting: boolean;
  kind: "human-signoff" | null;
  since: string | null;
  irSha: string | null;
  signoff: { by: string; at: string; irSha: string; rulingCitation?: string; stale: boolean } | null;
  actions: string[];
}

export interface Envelope {
  vps: 1;
  ok: boolean;
  command: string;
  caseId: string | null;
  exitCode: number;
  status: string | null;
  stage: string | null;
  result: unknown;
  gate: GateInfo | null;
  next: Next | null;
  error: { code: number; message: string } | null;
  at: string;
}

export interface Result {
  caseId: string | null;
  exitCode: number;
  status: string | null;
  stage: string | null;
  result: unknown;
  gate: GateInfo | null;
  next: Next | null;
}

function statusOf(caseId: string | null): string | null {
  if (!caseId) return null;
  try { return readState(caseId).status; } catch { return null; }
}

function emit(env: Envelope): never {
  if (mode === "json") {
    // `fs.writeSync(1, …)` — synchronous even to a pipe or a file, which the async
    // `process.stdout.write` is not. Two bugs die here, and the second was caused by the
    // fix for the first:
    //
    //  1. `process.exit()` truncates an async write, so a headless caller redirecting to a
    //     file got a 0-byte envelope while the same command printed fine to a terminal.
    //  2. Deferring the exit to a write callback made `emit` RETURN in json mode, silently
    //     breaking its `never` contract. Every command with an early `finish()` then ran on
    //     past it and emitted a SECOND envelope — `vjs ask` on a miss emitted one envelope
    //     saying "open" and another saying "cannot read property of null".
    //
    // A synchronous write followed by a synchronous exit is both flushed and terminal.
    fs.writeSync(1, JSON.stringify(env, null, 2) + "\n");
  }
  process.exit(env.exitCode);
}

/** Terminal success/known-stop path. Exits with r.exitCode (default 0). */
export function finish(command: string, r: Partial<Result> = {}): never {
  const caseId = r.caseId ?? null;
  emit({
    vps: 1,
    ok: (r.exitCode ?? 0) === 0,
    command,
    caseId,
    exitCode: r.exitCode ?? 0,
    status: r.status ?? statusOf(caseId),
    stage: r.stage ?? null,
    result: r.result ?? null,
    gate: r.gate ?? null,
    next: r.next ?? null,
    error: null,
    at: new Date().toISOString()
  });
}

/** Terminal failure path. Prints the message for humans and still emits an envelope. */
export function fail(command: string, e: any, caseId: string | null = null): never {
  const code = typeof e?.code === "number" ? e.code : 1;
  const message = String(e?.message ?? e);
  if (mode === "text") console.error(message);
  emit({
    vps: 1,
    ok: false,
    command,
    caseId,
    exitCode: code,
    status: statusOf(caseId),
    stage: null,
    result: null,
    gate: null,
    next: null,
    error: { code, message },
    at: new Date().toISOString()
  });
}
