// §8.4: JSON discipline — strip fences, parse, zod-validate, re-ask on failure.
import type { z } from "zod";
import type { CompleteReq, LLMProvider } from "./provider.js";

export function stripFences(s: string): string {
  const m = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = m ? m[1] : s;
  const first = body.indexOf("{");
  const last = body.lastIndexOf("}");
  return first >= 0 && last > first ? body.slice(first, last + 1) : body.trim();
}

export async function completeJson<T>(
  provider: LLMProvider, schema: z.ZodType<T>, req: CompleteReq, maxRepairs: number
): Promise<T> {
  let lastErr = "";
  for (let attempt = 0; attempt <= maxRepairs; attempt++) {
    const user = attempt === 0 ? req.user
      : req.user + `\n\nYour previous output failed validation: ${lastErr}. Output ONLY corrected JSON.`;
    const raw = await provider.complete({ ...req, user, promptName: req.promptName + (attempt ? `.repair${attempt}` : "") });
    try {
      const parsed = JSON.parse(stripFences(raw));
      const res = schema.safeParse(parsed);
      if (res.success) return res.data;
      // Include the offending value alongside the path and message. The model is being asked
      // to repair its own output; "requirement.name: <rule>" alone makes it guess which of
      // the names it wrote is at fault, and it can burn every attempt guessing wrong.
      lastErr = res.error.issues.slice(0, 5).map(i => {
        let got: unknown = parsed;
        for (const k of i.path) got = (got as any)?.[k as any];
        const shown = got === undefined ? "" : ` (you wrote ${JSON.stringify(got)})`;
        return `${i.path.join(".")}: ${i.message}${shown}`;
      }).join("; ");
    } catch (e: any) { lastErr = "not valid JSON: " + String(e.message).slice(0, 200); }
  }
  throw Object.assign(new Error(`completeJson exhausted repairs for ${req.promptName}: ${lastErr}`), { code: 5 });
}
