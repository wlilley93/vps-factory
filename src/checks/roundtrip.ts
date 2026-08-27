// §12.2: back-translate (IR only) then faithfulness judge.
import { z } from "zod";
import type { Config, LLMProvider } from "../llm/provider.js";
import { completeJson } from "../llm/json.js";
import { renderPrompt } from "../prompts.js";
import type { IR } from "../ir/schema.js";
import fs from "node:fs";
import path from "node:path";
import { caseDir } from "../state.js";

const JudgeOut = z.object({
  verdict: z.enum(["faithful", "divergent"]),
  divergences: z.array(z.object({ kind: z.enum(["missing", "added", "altered"]), detail: z.string() }))
});

export interface RoundtripResult {
  name: "roundtrip"; passed: boolean;
  details: { backtranslation: string; verdict: string; required: string; divergences: { kind: string; detail: string }[] };
}

export async function roundtrip(provider: LLMProvider, cfg: Config, ir: IR, caseId: string): Promise<RoundtripResult> {
  const bt = renderPrompt("backtranslate", { ir: JSON.stringify(ir, null, 2) });
  const backtranslation = await provider.complete({ promptName: "backtranslate", caseId, system: bt.system, user: bt.user });
  const original = fs.readFileSync(path.join(caseDir(caseId), "intake.md"), "utf8");
  const fj = renderPrompt("faithfulness-judge", {
    original, backtranslation, exclusions: JSON.stringify(ir.exclusions)
  });
  const out = await completeJson(provider, JudgeOut, { promptName: "faithfulness-judge", caseId, system: fj.system, user: fj.user }, cfg.maxJsonRepairs);
  // `roundtripThreshold` is the configured verdict this check demands (default "faithful").
  // It was previously declared in Config and in vps.config.json but never read, so the
  // bar was hardcoded and the config key was a lie about what the system does.
  const required = cfg.roundtripThreshold ?? "faithful";
  return {
    name: "roundtrip", passed: out.verdict === required,
    details: { backtranslation, verdict: out.verdict, required, divergences: out.divergences }
  };
}
