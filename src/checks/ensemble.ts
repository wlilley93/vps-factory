// §12.4: K independent drafts, canonical normalisation, pairwise convergence.
import type { Config, LLMProvider } from "../llm/provider.js";
import { completeJson } from "../llm/json.js";
import { renderPrompt } from "../prompts.js";
import { IRSchema, type IR } from "../ir/schema.js";
import fs from "node:fs";
import path from "node:path";
import { caseDir } from "../state.js";

const canon = (v: unknown): string => JSON.stringify(sort(v));
function sort(v: any): any {
  if (Array.isArray(v)) return v.map(sort);
  if (v && typeof v === "object") return Object.fromEntries(Object.keys(v).sort().map(k => [k, sort(v[k])]));
  return v;
}

function normalise(ir: IR): { fields: string; body: string; itemsLen: number } {
  const subj = ir.nouns.find(n => n.role === "subject");
  const item = ir.nouns.find(n => n.role === "requirementItem");
  const fields = [subj, item].filter(Boolean)
    // Unit is part of a field's identity here: two drafts that agree on `hireDate:Nat` but
    // disagree on whether it is a date or a bare count have NOT converged, and scoring them
    // as agreeing would hide exactly the disagreement this check exists to surface.
    .map(n => n!.fields.map(f => {
      const u = f.unit && f.unit.kind !== "plain"
        ? `@${f.unit.kind}${f.unit.kind === "scaled" ? `(${f.unit.scale})` : ""}` : "";
      return `${f.name}:${f.type}${u}`;
    }).sort().join(",")).join(";");
  // body canonicalisation is field-NAME-insensitive: paths become P<param>.F<sorted-pos>,
  // so a pure rename flips only the field-set component of the score (§12.4).
  const pred = ir.predicates[0];
  const paramIdx = new Map(pred?.params.map((p, i) => [p.name, i]) ?? []);
  const fieldIdx = new Map<string, Map<string, number>>();
  for (const p of pred?.params ?? []) {
    const noun = ir.nouns.find(n => n.name === p.noun);
    const sorted = [...(noun?.fields ?? [])].map(f => f.name).sort();
    fieldIdx.set(p.name, new Map(sorted.map((f, i) => [f, i])));
  }
  const canonBody = (e: any): any => {
    if (e && typeof e === "object") {
      if (e.op === "field") {
        const [p, f] = String(e.path).split(".");
        return { op: "field", path: `P${paramIdx.get(p) ?? "?"}.F${fieldIdx.get(p)?.get(f) ?? "?"}` };
      }
      return Object.fromEntries(Object.entries(e).map(([k, v]) => [k, Array.isArray(v) ? v.map(canonBody) : canonBody(v)]));
    }
    return e;
  };
  return { fields, body: canon(canonBody(pred?.body)), itemsLen: ir.requirement.itemsData.values.length };
}

export interface EnsembleResult {
  name: "ensemble"; passed: boolean;
  details: { convergence: number; threshold: number; divergent: string[] };
}

export async function ensemble(provider: LLMProvider, cfg: Config, caseId: string, irSchemaText: string): Promise<EnsembleResult> {
  const intake = fs.readFileSync(path.join(caseDir(caseId), "intake.md"), "utf8");
  const drafts: IR[] = [];
  for (let i = 1; i <= cfg.ensembleK; i++) {
    const p = renderPrompt("drafter", { intake, irSchema: irSchemaText, precedents: "", priorErrors: "", previousIR: "", proseDiff: "" });
    drafts.push(await completeJson(provider, IRSchema, { promptName: `drafter.e${i}`, caseId, system: p.system, user: p.user }, cfg.maxJsonRepairs));
  }
  const norms = drafts.map(normalise);
  let sum = 0, pairs = 0; const divergent: string[] = [];
  for (let i = 0; i < norms.length; i++) for (let j = i + 1; j < norms.length; j++) {
    pairs++;
    let score = 0;
    if (norms[i].fields === norms[j].fields) score += 1 / 3; else divergent.push(`e${i + 1}/e${j + 1}: field sets differ`);
    if (norms[i].body === norms[j].body) score += 1 / 3; else divergent.push(`e${i + 1}/e${j + 1}: predicate bodies differ`);
    if (norms[i].itemsLen === norms[j].itemsLen) score += 1 / 3; else divergent.push(`e${i + 1}/e${j + 1}: itemsData length differs`);
    sum += score;
  }
  const convergence = pairs ? sum / pairs : 1;
  return { name: "ensemble", passed: convergence >= cfg.ensembleThreshold, details: { convergence: Number(convergence.toFixed(3)), threshold: cfg.ensembleThreshold, divergent } };
}
