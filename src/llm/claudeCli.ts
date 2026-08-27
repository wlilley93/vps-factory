// §8.2: claude CLI provider.
import { execa } from "execa";
import type { LLMProvider } from "./provider.js";

export async function hasCli(): Promise<boolean> {
  try { await execa("claude", ["--version"], { timeout: 15000 }); return true; } catch { return false; }
}

export function cliProvider(): LLMProvider {
  return {
    async complete(req) {
      const combined = req.system + "\n\n---\n\n" + req.user;
      try {
        const r = await execa("claude", ["-p", combined, "--output-format", "json"], { timeout: 300000 });
        try {
          const env = JSON.parse(r.stdout);
          return env.result ?? env.content ?? env.text ?? r.stdout;
        } catch { return r.stdout; }
      } catch {
        const r = await execa("claude", ["-p", combined], { timeout: 300000 });
        return r.stdout;
      }
    }
  };
}
