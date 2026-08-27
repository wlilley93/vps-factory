// §12.5: red-team counterexamples, confirmed against real evaluation.
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

const Adversary = z.object({
  counterexamples: z.array(z.object({
    instance: z.record(z.unknown()), predicateSays: z.boolean(), humanWouldSay: z.boolean(), why: z.string()
  }))
});

export interface AdversarialResult {
  name: "adversarial"; passed: boolean;
  details: { confirmed: { instance: string; why: string }[]; proposed: number };
}

export async function adversarial(provider: LLMProvider, cfg: Config, ir: IR, caseId: string): Promise<AdversarialResult> {
  const intake = fs.readFileSync(path.join(caseDir(caseId), "intake.md"), "utf8");
  const p = renderPrompt("adversary", { ir: JSON.stringify(ir, null, 2), intake });
  const out = await completeJson(provider, Adversary, { promptName: "adversary", caseId, system: p.system, user: p.user }, cfg.maxJsonRepairs);
  const subject = ir.nouns.find(n => n.role === "subject")!;
  const confirmed: { instance: string; why: string }[] = [];
  for (const cx of out.counterexamples) {
    if (checkValues(subject.fields as any, cx.instance, "cx").length) continue;
    const real = evalDuties(ir, { noun: subject.name, values: cx.instance }).failingDuties.length === 0;
    if (real === cx.predicateSays && real !== cx.humanWouldSay)
      confirmed.push({ instance: JSON.stringify(cx.instance).slice(0, 160), why: cx.why });
  }
  return { name: "adversarial", passed: confirmed.length === 0, details: { confirmed, proposed: out.counterexamples.length } };
}
