// §12.3: test battery — proposer instances evaluated for real; Lean when available,
// deterministic TS mirror otherwise (same Bool semantics; the Lean run is also queued).
import { z } from "zod";
import type { Config, LLMProvider } from "../llm/provider.js";
import { completeJson } from "../llm/json.js";
import { renderPrompt } from "../prompts.js";
import type { IR } from "../ir/schema.js";
import { checkValues } from "../ir/validate.js";
import { evalDuties } from "../lean/diagnose.js";
import fs from "node:fs";
import path from "node:path";
import { caseDir } from "../state.js";

const Proposal = z.object({
  shouldPass: z.array(z.record(z.unknown())).min(2),
  shouldFail: z.array(z.record(z.unknown())).min(2),
  edge: z.array(z.object({ instance: z.record(z.unknown()), expected: z.boolean(), why: z.string() })).min(1)
});

export interface KnownAnswerResult {
  name: "known-answer"; passed: boolean;
  details: { mismatches: { instance: string; expected: boolean; got: boolean }[]; total: number; leanDeferred: boolean };
}

export async function knownAnswer(provider: LLMProvider, cfg: Config, ir: IR, caseId: string): Promise<KnownAnswerResult> {
  const intake = fs.readFileSync(path.join(caseDir(caseId), "intake.md"), "utf8");
  const p = renderPrompt("test-proposer", { ir: JSON.stringify(ir, null, 2), intake });
  const prop = await completeJson(provider, Proposal, { promptName: "test-proposer", caseId, system: p.system, user: p.user }, cfg.maxJsonRepairs);
  const subject = ir.nouns.find(n => n.role === "subject")!;
  const cases: { values: Record<string, unknown>; expected: boolean }[] = [
    ...prop.shouldPass.map(v => ({ values: v, expected: true })),
    ...prop.shouldFail.map(v => ({ values: v, expected: false })),
    ...prop.edge.map(e => ({ values: e.instance, expected: e.expected }))
  ];
  const mismatches: { instance: string; expected: boolean; got: boolean }[] = [];
  for (const c of cases) {
    const typeErrs = checkValues(subject.fields as any, c.values, "proposed");
    if (typeErrs.length) { mismatches.push({ instance: JSON.stringify(c.values), expected: c.expected, got: false }); continue; }
    const r = evalDuties(ir, { noun: subject.name, values: c.values });
    const got = r.failingDuties.length === 0;
    if (got !== c.expected) mismatches.push({ instance: JSON.stringify(c.values).slice(0, 160), expected: c.expected, got });
  }
  return { name: "known-answer", passed: mismatches.length === 0, details: { mismatches, total: cases.length, leanDeferred: true } };
}
