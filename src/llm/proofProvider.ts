// §8.6: ProofProvider — separate interface; the prover proposes, Lean disposes.
import fs from "node:fs";
import path from "node:path";
import { fixturesProver } from "../paths.js";

export interface ProofCandidate { tactic: string; raw: string; attempt: number }
export interface ProposeReq {
  caseId: string; context: string; goal: string;
  history: { tactic: string; error: string }[]; n: number;
}
export interface ProofProvider { readonly name: string; propose(req: ProposeReq): Promise<ProofCandidate[]> }

export interface ProverCfg {
  enabled: boolean; backend: string; model: string; endpoint: string;
  attempts: number; temperature: number; timeoutMsPerAttempt: number; maxTokens: number;
  allowNativeDecide?: boolean;
}

export function sanitise(raw: string, allowNativeDecide: boolean): { ok: true; tactic: string } | { ok: false; reason: string } {
  let t = raw.replace(/```(?:lean)?/g, "").trim();
  if (/^by\b/.test(t)) t = t.replace(/^by\s*/, "");
  const banned: [RegExp, string][] = [
    [/\bsorry\b/, "sorry"], [/\baxiom\b/, "axiom"], [/\bstructure\b/, "structure"],
    [/\bdef\s/, "def"], [/\btheorem\b/, "theorem"], [/\bimport\b/, "import"]
  ];
  if (!allowNativeDecide) banned.push([/\bnative_decide\b/, "native_decide (disallowed by default; §18.1.9)"]);
  for (const [re, name] of banned) if (re.test(t)) return { ok: false, reason: name };
  const hb = t.match(/set_option\s+maxHeartbeats\s+(\d+)/);
  if (hb && Number(hb[1]) > 400000) return { ok: false, reason: "maxHeartbeats > 400000" };
  if (!t) return { ok: false, reason: "empty" };
  return { ok: true, tactic: t };
}

export async function getProofProvider(cfg: ProverCfg): Promise<ProofProvider> {
  const backend = process.env.VPS_PROVER ?? cfg.backend;
  if (backend === "mock") {
    return {
      name: "mock",
      async propose(req) {
        const f = fixturesProver(`${req.caseId}.json`);
        if (!fs.existsSync(f)) throw new Error(`mock prover: missing fixture ${f}`);
        return JSON.parse(fs.readFileSync(f, "utf8"));
      }
    };
  }
  if (backend === "ollama") {
    return {
      name: "ollama",
      async propose(req) {
        const prompt = renderProverPrompt(req);
        const out: ProofCandidate[] = [];
        for (let i = 1; i <= req.n; i++) {
          try {
            const res = await fetch(`${cfg.endpoint}/api/generate`, {
              method: "POST", headers: { "content-type": "application/json" },
              body: JSON.stringify({ model: cfg.model, prompt, stream: false, options: { temperature: cfg.temperature, num_predict: cfg.maxTokens } }),
              signal: AbortSignal.timeout(cfg.timeoutMsPerAttempt)
            });
            const j: any = await res.json();
            out.push({ tactic: String(j.response ?? ""), raw: String(j.response ?? ""), attempt: i });
          } catch (e) {
            if (i === 1) { /* cold-start retry allowance: continue */ }
          }
        }
        return out;
      }
    };
  }
  if (backend === "openai-compatible" || backend === "deepseek-api") {
    const endpoint = backend === "deepseek-api" ? "https://api.deepseek.com" : cfg.endpoint;
    const key = backend === "deepseek-api" ? process.env.DEEPSEEK_API_KEY : undefined;
    return {
      name: backend,
      async propose(req) {
        const prompt = renderProverPrompt(req);
        const out: ProofCandidate[] = [];
        for (let i = 1; i <= req.n; i++) {
          const res = await fetch(`${endpoint}/v1/chat/completions`, {
            method: "POST",
            headers: { "content-type": "application/json", ...(key ? { authorization: `Bearer ${key}` } : {}) },
            body: JSON.stringify({ model: cfg.model, temperature: cfg.temperature, max_tokens: cfg.maxTokens, messages: [{ role: "user", content: prompt }] }),
            signal: AbortSignal.timeout(cfg.timeoutMsPerAttempt)
          });
          const j: any = await res.json();
          const text = j.choices?.[0]?.message?.content ?? "";
          out.push({ tactic: text, raw: text, attempt: i });
        }
        return out;
      }
    };
  }
  throw new Error(`unknown prover backend: ${backend}`);
}

function renderProverPrompt(req: ProposeReq): string {
  const hist = req.history.length
    ? "\n\nPrevious attempts failed:\n" + req.history.map(h => `- \`${h.tactic}\` -> ${h.error}`).join("\n")
    : "";
  return `Complete the following Lean 4 proof. Output ONLY the tactic block that replaces \`sorry\` —\nno fences, no commentary, no restatement of the theorem.\n\n${req.context}${hist}\n`;
}
