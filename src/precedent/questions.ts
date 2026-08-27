// §11.3: question extraction & normalised keys from an IR.
import crypto from "node:crypto";
import type { IR } from "../ir/schema.js";

export interface Question { key: string; text: string; facts: string }

const canon = (v: unknown): string => JSON.stringify(sort(v));
function sort(v: any): any {
  if (Array.isArray(v)) return v.map(sort);
  if (v && typeof v === "object") return Object.fromEntries(Object.keys(v).sort().map(k => [k, sort(v[k])]));
  return v;
}
export const sha8 = (s: string) => crypto.createHash("sha256").update(s).digest("hex").slice(0, 8);

// Shape keys are FAMILY-scoped (deviation from §11.3, recorded in README): estate-global
// noun names collide across unrelated domains — found the hard way when the sample
// fixture's Candidate bound the Legal Engine case ([2026] VPS 16/17 resolved the
// collision; this scoping prevents the class). Interpret keys stay estate-global:
// identical prose should mean the same thing everywhere.
export function extractQuestions(ir: IR, familyId: string): Question[] {
  const qs: Question[] = [];
  for (const n of ir.nouns) {
    qs.push({
      key: `model:${familyId}:${n.name.toLowerCase()}:shape`,
      text: `How is ${n.name} modelled?`,
      // Unit is rendered ONLY when it is not plain. Appending it unconditionally would
      // change the facts string of every noun shape already on record, so all 22 standing
      // instruments would conflict on the next redraft and stop the line at exit 2. A plain
      // Nat must keep producing exactly the string it produced before units existed.
      facts: n.fields.map(f => {
        const u = f.unit && f.unit.kind !== "plain"
          ? `@${f.unit.kind}${f.unit.kind === "scaled" ? `(${f.unit.scale})` : ""}` : "";
        return `${f.name}:${f.type}${u}`;
      }).sort().join(",")
    });
  }
  for (const p of ir.predicates) {
    qs.push({
      key: `model:${familyId}:predicate:${p.name}`,
      text: `What does ${p.name} mean?`,
      facts: canon(p.body) + "|" + p.interpretationNotes.trim()
    });
  }
  for (const a of ir.ambiguities) {
    qs.push({
      key: `interpret:${sha8(a.sourceText)}`,
      text: `How is '${a.sourceText}' interpreted?`,
      facts: canon({ options: a.options, chosen: a.chosen })
    });
  }
  return qs;
}
