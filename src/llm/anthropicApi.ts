// §8.3: Anthropic API provider (lazy import so the dependency is only needed live).
import type { Config, LLMProvider } from "./provider.js";

export function apiProvider(cfg: Config): LLMProvider {
  return {
    async complete(req) {
      const mod: any = await import("@anthropic-ai/sdk" as string).catch(() => {
        throw Object.assign(new Error("@anthropic-ai/sdk not installed; npm i @anthropic-ai/sdk"), { code: 5 });
      });
      const client = new mod.default({});
      const msg = await client.messages.create({
        model: cfg.model, max_tokens: req.maxTokens ?? 4096,
        system: req.system, messages: [{ role: "user", content: req.user }]
      });
      return msg.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
    }
  };
}
