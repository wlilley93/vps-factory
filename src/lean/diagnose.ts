// Per-duty failure analysis (§7.6): regenerate with diagnostics, parse #eval info lines.
import fs from "node:fs";
import path from "node:path";
import { renderCaseLean, moduleName, instDefName, desugar } from "../codegen/lean.js";
import { checkFile } from "./runner.js";
import type { IR, InstanceT } from "../ir/schema.js";
import { leanFile } from "../paths.js";

export interface Diagnosis {
  failingDuties: string[];
  perDuty: { label: string; pass: boolean }[];
  /** `specific: false` means no field-level span resolved and this is the predicate's
   *  own quote — a fallback, not a precise citation. Say so rather than implying precision. */
  provenance: { label: string; quote: string; specific: boolean }[];
  deferred?: boolean;
}

export async function diagnose(ir: IR, inst: InstanceT, slug: string): Promise<Diagnosis> {
  const file = renderCaseLean(ir, [inst], { diagnostics: true, theoremTactic: null, instanceName: instDefName(inst) }, slug);
  const rel = path.join("Spec", "Cases", moduleName(slug) + ".lean");
  fs.writeFileSync(leanFile(rel), file);
  const r = await checkFile(rel);
  if (r.deferred) {
    // Lean unavailable: evaluate the same Bool semantics in TS (recorded as interim, not proof)
    const per = evalDuties(ir, inst);
    return { ...per, deferred: true };
  }
  const infos = r.diagnostics.filter(d => d.severity === "information").map(d => d.data);
  const failing = parseLabelList(infos[0] ?? "");
  const pairs = parsePairs(infos[1] ?? "");
  return { failingDuties: failing, perDuty: pairs, provenance: provenanceFor(ir, failing) };
}

// deterministic TS mirror of the Bool semantics — used only when Lean is deferred,
// and by the known-answer check's pre-computation
export function evalDuties(ir: IR, inst: InstanceT): Omit<Diagnosis, "deferred"> {
  const pred = ir.predicates[0];
  const per = ir.requirement.itemsData.values.map(d => {
    const env: Record<string, Record<string, unknown>> = {
      [pred.params[0].name]: inst.values,
      [pred.params[1].name]: d as Record<string, unknown>
    };
    // desugar first, exactly as codegen does — the mirror must see the same tree Lean does
    return { label: String((d as any).label ?? ""), pass: evalExpr(desugar(pred.body), env) as boolean };
  });
  const failing = per.filter(p => !p.pass).map(p => p.label);
  return { failingDuties: failing, perDuty: per, provenance: provenanceFor(ir, failing) };
}

function evalExpr(e: any, env: Record<string, Record<string, unknown>>): unknown {
  switch (e.op) {
    case "const": return e.value;
    case "field": { const [p, f] = e.path.split("."); return env[p]?.[f]; }
    case "ge": return (evalExpr(e.left, env) as number) >= (evalExpr(e.right, env) as number);
    case "gt": return (evalExpr(e.left, env) as number) > (evalExpr(e.right, env) as number);
    case "le": return (evalExpr(e.left, env) as number) <= (evalExpr(e.right, env) as number);
    case "lt": return (evalExpr(e.left, env) as number) < (evalExpr(e.right, env) as number);
    case "eq": return evalExpr(e.left, env) === evalExpr(e.right, env);
    case "ne": return evalExpr(e.left, env) !== evalExpr(e.right, env);
    case "and": return e.args.every((a: any) => evalExpr(a, env));
    case "or": return e.args.some((a: any) => evalExpr(a, env));
    case "not": return !evalExpr(e.arg, env);
    case "contains": return (evalExpr(e.list, env) as unknown[]).includes(evalExpr(e.item, env));
  }
}

/**
 * Which source sentence a failing duty came from.
 *
 * This was a stub returning `ir.predicates[0].source.quote` for EVERY failing duty, so a
 * verdict naming two distinct unmet requirements quoted the same sentence twice (README
 * deviation 6 — visible in the live legal-engine case, where the NPV business case and the
 * RFP response both cited the same line). A verdict that cannot say which sentence a
 * requirement came from is barely better than one that says "something failed".
 *
 * The real provenance, as the old comment itself proposed: resolve the duty row back to the
 * subject fields the predicate actually consults for that row, and quote THOSE fields'
 * spans. A row selects a branch of the predicate's dispatch (usually via a `kind`-style
 * tag); that branch reads particular subject fields; each field carries a verbatim
 * SourceSpan into the byte-immutable intake.
 */
function provenanceFor(ir: IR, labels: string[]) {
  const pred = ir.predicates[0];
  const subjectParam = pred.params[0].name;
  const itemParam = pred.params[1].name;
  const subjectNoun = ir.nouns.find(n => n.name === ir.requirement.subjectNoun);
  const rows = ir.requirement.itemsData.values as Record<string, unknown>[];
  const first = rows[0] ?? {};
  const labelField = Object.keys(first).find(k => typeof first[k] === "string" && k.toLowerCase().includes("label"))
    ?? Object.keys(first)[0];

  /** Every `param.field` path mentioned anywhere in an expression. */
  const pathsIn = (e: any, out: Set<string> = new Set<string>()): Set<string> => {
    if (!e || typeof e !== "object") return out;
    if (e.op === "field" && typeof e.path === "string") out.add(e.path);
    for (const k of ["left", "right", "arg", "list", "item"]) if (e[k]) pathsIn(e[k], out);
    for (const a of e.args ?? []) pathsIn(a, out);
    return out;
  };

  /** The branches of a top-level `or` are the dispatch table. A branch belongs to this row
   *  if every item-field literal it guards on matches the row — that is what "this row
   *  selects this branch" means. A branch with no item guard applies to every row. */
  const branchesFor = (row: Record<string, unknown>): any[] => {
    const top = pred.body as any;
    const branches: any[] = top?.op === "or" ? top.args : [top];
    const selected = branches.filter(b => {
      const lits: { field: string; value: unknown }[] = [];
      const collect = (e: any) => {
        if (!e || typeof e !== "object") return;
        if (e.op === "eq" && e.left?.op === "field" && e.right?.op === "const"
            && String(e.left.path).startsWith(itemParam + ".")) {
          lits.push({ field: String(e.left.path).slice(itemParam.length + 1), value: e.right.value });
        }
        for (const k of ["left", "right", "arg", "list", "item"]) if (e[k]) collect(e[k]);
        for (const a of e.args ?? []) collect(a);
      };
      collect(b);
      if (!lits.length) return true;
      return lits.every(l => row[l.field] === l.value);
    });
    return selected.length ? selected : branches;
  };

  return labels.map(label => {
    const row = rows.find(r => String(r[labelField] ?? "") === label);
    const quotes: string[] = [];
    if (row && subjectNoun) {
      const paths = new Set<string>();
      for (const b of branchesFor(row)) for (const p of pathsIn(b)) paths.add(p);
      for (const p of paths) {
        if (!p.startsWith(subjectParam + ".")) continue;   // item fields are data, not source
        const f = subjectNoun.fields.find(x => x.name === p.slice(subjectParam.length + 1));
        if (f?.source?.quote && !quotes.includes(f.source.quote)) quotes.push(f.source.quote);
      }
    }
    // Fall back to the predicate's own span only when nothing more specific resolves — and
    // say which it is, rather than presenting a generic quote as though it were precise.
    return quotes.length
      ? { label, quote: quotes.join(" · "), specific: true }
      : { label, quote: pred.source.quote, specific: false };
  });
}

function parseLabelList(s: string): string[] {
  return [...s.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map(m => m[1]);
}
function parsePairs(s: string): { label: string; pass: boolean }[] {
  return [...s.matchAll(/\("((?:[^"\\]|\\.)*)",\s*(true|false)\)/g)].map(m => ({ label: m[1], pass: m[2] === "true" }));
}
