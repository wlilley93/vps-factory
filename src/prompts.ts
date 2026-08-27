// Prompt loader: front-matter (name/version) + {{placeholder}} substitution.
// {{#if x}}...{{/if}} and {{#each xs}}...{{/each}} are NOT implemented — templates
// in prompts/ use plain placeholders only (kept simpler than §9's illustrative syntax).
import fs from "node:fs";
import path from "node:path";
import { promptsFile } from "./paths.js";

export function renderPrompt(name: string, vars: Record<string, string>): { system: string; user: string } {
  const raw = fs.readFileSync(promptsFile(name), "utf8");
  const body = raw.replace(/^---[\s\S]*?---\n/, "");
  const [sys, usr] = body.split(/\n== USER ==\n/);
  const sub = (s: string) => s.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
  return { system: sub(sys ?? "").trim(), user: sub(usr ?? "").trim() };
}
