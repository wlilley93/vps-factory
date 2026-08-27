// S6 rungs 4 (prover) and 5 (general-LLM repair) — §8.6, §10.
import fs from "node:fs";
import path from "node:path";
import type { Config } from "../llm/provider.js";
import { getProvider } from "../llm/provider.js";
import { renderPrompt } from "../prompts.js";
import { renderCaseLean } from "../codegen/lean.js";
import { checkFile } from "../lean/runner.js";
import { getProofProvider, sanitise } from "../llm/proofProvider.js";
import type { IR, InstanceT } from "../ir/schema.js";
import { leanFile as leanFileAbs } from "../paths.js";

export async function proverRungs(
  cfg: Config, ir: IR, inst: InstanceT, caseId: string, rel: string, defName: string,
  history: { rung: number; tactic: string; ok: boolean | null; error?: string }[],
  forceProver: boolean
): Promise<{ rung: number; tactic: string } | null> {
  const tryTactic = async (rung: number, tactic: string): Promise<boolean> => {
    const file = renderCaseLean(ir, [inst], { diagnostics: false, theoremTactic: tactic, instanceName: defName }, caseId);
    fs.writeFileSync(leanFileAbs(rel), file);
    const r = await checkFile(rel);
    history.push({ rung, tactic, ok: r.ok, error: r.ok ? undefined : r.diagnostics.map(d => d.data).join("; ").slice(0, 300) });
    return r.ok === true;
  };

  // rung 4
  if (cfg.prover.enabled || forceProver) {
    const pp = await getProofProvider(cfg.prover);
    const context = renderCaseLean(ir, [inst], { diagnostics: false, theoremTactic: "sorry", instanceName: defName }, caseId);
    const goal = `${ir.requirement.name} ${defName}`;
    const candidates = await pp.propose({
      caseId, context, goal,
      history: history.filter(h => !h.ok).map(h => ({ tactic: h.tactic, error: h.error ?? "" })),
      n: cfg.prover.attempts
    });
    for (const c of candidates) {
      const clean = sanitise(c.tactic, cfg.prover.allowNativeDecide ?? false);
      if (!clean.ok) { history.push({ rung: 4, tactic: c.tactic.slice(0, 60), ok: false, error: "sanitisation: " + clean.reason }); continue; }
      if (await tryTactic(4, clean.tactic)) return { rung: 4, tactic: clean.tactic };
    }
  }
  // rung 5: general-LLM repair loop
  const provider = await getProvider(cfg);
  for (let i = 0; i < cfg.maxProofRepairs; i++) {
    const leanFile = fs.readFileSync(leanFileAbs(rel), "utf8");
    const p = renderPrompt("proof-repair", {
      leanFile,
      diagnostics: history.filter(h => !h.ok).slice(-3).map(h => h.error ?? "").join("\n"),
      attemptHistory: history.map(h => h.tactic).join(", ")
    });
    let tactic: string;
    try {
      tactic = (await provider.complete({ promptName: `proof-repair.${i + 1}`, caseId, system: p.system, user: p.user })).trim();
    } catch { break; } // no fixture / no provider: rung 5 unavailable
    const clean = sanitise(tactic, true); // human-equivalent path; native_decide allowed at rung 5
    if (!clean.ok) { history.push({ rung: 5, tactic: tactic.slice(0, 60), ok: false, error: "sanitisation: " + clean.reason }); continue; }
    if (await tryTactic(5, clean.tactic)) return { rung: 5, tactic: clean.tactic };
  }
  return null;
}
