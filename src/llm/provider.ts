// LLM provider interface + factory (§8.1). Every call logged to cases/<id>/llm.log.jsonl.
import fs from "node:fs";
import path from "node:path";
import { caseDir } from "../state.js";
import { configFile } from "../paths.js";

export interface CompleteReq {
  promptName: string; caseId: string; system: string; user: string; maxTokens?: number;
}
export interface LLMProvider { complete(req: CompleteReq): Promise<string> }

export interface Config {
  provider: "auto" | "cli" | "api" | "mock";
  model: string; ensembleK: number; maxJsonRepairs: number; maxProofRepairs: number;
  roundtripThreshold: string; ensembleThreshold: number; leanTimeoutMs: number;
  citationCourtCode: string;
  prover: { enabled: boolean; backend: string; model: string; endpoint: string; attempts: number; temperature: number; timeoutMsPerAttempt: number; maxTokens: number; allowNativeDecide?: boolean };
}

export function loadConfig(): Config {
  const p = configFile();
  const cfg = JSON.parse(fs.readFileSync(p, "utf8"));
  if (process.env.VPS_PROVIDER) cfg.provider = process.env.VPS_PROVIDER;
  if (process.env.VPS_MOCK_LLM === "1") cfg.provider = "mock";
  return cfg;
}

function logCall(caseId: string, promptName: string, provider: string, ms: number, chars: number) {
  try {
    const f = path.join(caseDir(caseId), "llm.log.jsonl");
    fs.appendFileSync(f, JSON.stringify({ promptName, provider, ms, chars, at: new Date().toISOString() }) + "\n");
  } catch { /* case dir may not exist in unit tests */ }
}

/**
 * Record the completion itself, not just that one happened.
 *
 * `llm.log.jsonl` holds only {promptName, provider, ms, chars} — metadata. So a MOCK run
 * can show what the model said (the fixtures hold it) while a LIVE run cannot, which is
 * backwards: the live run is the one whose reasoning nobody has seen. Writing each
 * completion in the same shape as `fixtures/llm/*` fixes that and buys something else for
 * free — a live run becomes its own fixture set, so it can be replayed deterministically
 * with VPS_FIXTURES pointed at it.
 *
 * Privacy, stated rather than assumed: instances carry real personal data (a CV), and the
 * prompts that reason about them carry it too. This directory inherits that sensitivity.
 * It is written inside the case dir, which is already where that data lives.
 */
function recordCompletion(caseId: string, promptName: string, provider: string, text: string) {
  try {
    const dir = path.join(caseDir(caseId), "llm");
    fs.mkdirSync(dir, { recursive: true });
    // Same envelope as fixtures/llm/*.json so the mock provider can replay it unchanged.
    fs.writeFileSync(path.join(dir, `${promptName}.json`),
      JSON.stringify({ text, provider, at: new Date().toISOString() }, null, 2));
  } catch { /* never let instrumentation fail a case */ }
}

export function withLogging(p: LLMProvider, name: string): LLMProvider {
  return {
    async complete(req) {
      const t0 = Date.now();
      const out = await p.complete(req);
      logCall(req.caseId, req.promptName, name, Date.now() - t0, out.length);
      // Mock runs already have their content on disk under fixtures/; re-recording it would
      // duplicate the corpus without adding a fact.
      if (name !== "mock") recordCompletion(req.caseId, req.promptName, name, out);
      return out;
    }
  };
}

export async function getProvider(cfg: Config): Promise<LLMProvider> {
  const kind = cfg.provider;
  if (kind === "mock") return withLogging((await import("./mock.js")).mockProvider(), "mock");
  if (kind === "cli") return withLogging((await import("./claudeCli.js")).cliProvider(), "cli");
  if (kind === "api") return withLogging((await import("./anthropicApi.js")).apiProvider(cfg), "api");
  // auto
  const { hasCli, cliProvider } = await import("./claudeCli.js");
  if (await hasCli()) return withLogging(cliProvider(), "cli");
  if (process.env.ANTHROPIC_API_KEY) return withLogging((await import("./anthropicApi.js")).apiProvider(cfg), "api");
  throw Object.assign(new Error("no LLM provider available (no claude CLI, no ANTHROPIC_API_KEY); use VPS_MOCK_LLM=1"), { code: 5 });
}
