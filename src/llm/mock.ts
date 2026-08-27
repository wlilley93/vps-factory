// §8.5: mock provider resolves fixtures/llm/<promptName>.<caseId>.json -> { text }.
import fs from "node:fs";
import path from "node:path";
import type { LLMProvider } from "./provider.js";
import { fixturesLlm } from "../paths.js";

export function mockProvider(): LLMProvider {
  return {
    async complete(req) {
      const f = fixturesLlm(`${req.promptName}.${req.caseId}.json`);
      if (!fs.existsSync(f))
        throw Object.assign(new Error(`mock provider: missing fixture ${f} (record the model output there)`), { code: 5 });
      return JSON.parse(fs.readFileSync(f, "utf8")).text;
    }
  };
}
