// Semantic validation beyond zod (§6.5). Collect errors, never fail-fast.
import fs from "node:fs";
import type { IR, Expr, InstanceT } from "./schema.js";

export interface VError { path: string; message: string }

type Ty = "Nat" | "Int" | "Bool" | "String" | "ListString" | "ListNat";

/** A unit, flattened to a comparable key. Absent/plain both read as "plain" so existing
 *  IRs keep exactly the meaning they had. */
type UnitKey = string;
const unitKey = (u?: { kind: string; scale?: number }): UnitKey =>
  !u || u.kind === "plain" ? "plain" : u.kind === "scaled" ? `scaled(${u.scale})` : u.kind;

/** JS numbers lose integer precision past 2^53-1, and the TS mirror would then disagree
 *  with Lean SILENTLY -- the worst failure this system can have, because the mirror is what
 *  the deferred path and two of the five checks evaluate against. Refuse at the boundary. */
const SAFE_INT = Number.MAX_SAFE_INTEGER;

export function validateIR(ir: IR, intakePath: string): VError[] {
  const errs: VError[] = [];
  const intake = fs.readFileSync(intakePath, "utf8");

  // identifier uniqueness
  const names = new Set<string>();
  for (const n of ir.nouns) {
    if (names.has(n.name)) errs.push({ path: `nouns.${n.name}`, message: "duplicate noun name" });
    names.add(n.name);
    const fnames = new Set<string>();
    for (const f of n.fields) {
      if (fnames.has(f.name)) errs.push({ path: `nouns.${n.name}.${f.name}`, message: "duplicate field" });
      fnames.add(f.name);
    }
  }

  // spans verify verbatim (§6.5.2)
  const checkSpan = (path: string, s: { quote: string; start: number; end: number }) => {
    if (intake.slice(s.start, s.end) !== s.quote)
      errs.push({ path, message: `span [${s.start},${s.end}) does not equal quote verbatim` });
  };
  for (const n of ir.nouns) {
    checkSpan(`nouns.${n.name}.source`, n.source);
    for (const f of n.fields) checkSpan(`nouns.${n.name}.${f.name}.source`, f.source);
  }
  for (const p of ir.predicates) checkSpan(`predicates.${p.name}.source`, p.source);

  // expression typing (§6.2) against declared params
  const pred = ir.predicates[0];
  const nounOf = new Map(ir.nouns.map(n => [n.name, n]));
  const paramTypes = new Map<string, Map<string, Ty>>();
  const paramUnits = new Map<string, Map<string, UnitKey>>();
  for (const prm of pred.params) {
    const noun = nounOf.get(prm.noun);
    if (!noun) { errs.push({ path: `predicates.${pred.name}.params.${prm.name}`, message: `unknown noun ${prm.noun}` }); continue; }
    paramTypes.set(prm.name, new Map(noun.fields.map(f => [f.name, f.type as Ty])));
    paramUnits.set(prm.name, new Map(noun.fields.map(f => [f.name, unitKey(f.unit)])));
  }
  // A field's unit, for compatibility checking. Constants are unit-agnostic (null) so a
  // literal can be compared against a dated field without ceremony -- the literal simply
  // has to be in that field's unit, which is the drafter's job to state in the rationale.
  const unitOf = (e: Expr): UnitKey | null => {
    if (e.op !== "field") return null;
    const [p, f] = e.path.split(".");
    return paramUnits.get(p)?.get(f) ?? "plain";
  };
  const checkUnits = (e: Expr, path: string, op: string) => {
    const l = unitOf((e as any).left ?? (e as any).value), r = unitOf((e as any).right ?? (e as any).lo);
    if (l && r && l !== r) {
      errs.push({ path, message: `${op} compares incompatible units: ${l} vs ${r}. A quantity in one unit is not ordered against another (this is the check that catches "years of experience >= a date").` });
    }
  };
  const typeOf = (e: Expr, path: string): Ty | null => {
    switch (e.op) {
      case "const": return e.type;
      case "field": {
        const [p, f] = e.path.split(".");
        const t = paramTypes.get(p)?.get(f);
        if (!t) { errs.push({ path, message: `unresolvable field path ${e.path}` }); return null; }
        return t;
      }
      case "ge": case "gt": case "le": case "lt": {
        const l = typeOf(e.left, path + ".left"), r = typeOf(e.right, path + ".right");
        const ordered = (t: Ty | null) => t === "Nat" || t === "Int";
        if (l && !ordered(l)) errs.push({ path, message: `${e.op} needs Nat or Int, got ${l}` });
        if (r && !ordered(r)) errs.push({ path, message: `${e.op} needs Nat or Int, got ${r}` });
        checkUnits(e, path, e.op);
        return "Bool";
      }
      case "between": {
        const v = typeOf(e.value, path + ".value");
        const lo = typeOf(e.lo, path + ".lo"), hi = typeOf(e.hi, path + ".hi");
        for (const [t, w] of [[v, "value"], [lo, "lo"], [hi, "hi"]] as const) {
          if (t && t !== "Nat" && t !== "Int") errs.push({ path: `${path}.${w}`, message: `between needs Nat or Int, got ${t}` });
        }
        const uv = unitOf(e.value), ulo = unitOf(e.lo), uhi = unitOf(e.hi);
        for (const [u, w] of [[ulo, "lo"], [uhi, "hi"]] as const) {
          if (uv && u && uv !== u) errs.push({ path: `${path}.${w}`, message: `between: bound is in ${u} but the value is in ${uv}` });
        }
        return "Bool";
      }
      case "eq": case "ne": {
        const l = typeOf(e.left, path + ".left"), r = typeOf(e.right, path + ".right");
        if (l && r && l !== r) errs.push({ path, message: `${e.op} type mismatch ${l} vs ${r}` });
        checkUnits(e, path, e.op);
        if (l && (l === "ListString" || l === "ListNat")) errs.push({ path, message: `${e.op} not defined on lists in v1` });
        return "Bool";
      }
      case "and": case "or": {
        e.args.forEach((a, i) => { const t = typeOf(a, `${path}.args[${i}]`); if (t && t !== "Bool") errs.push({ path: `${path}.args[${i}]`, message: `expected Bool, got ${t}` }); });
        return "Bool";
      }
      case "not": {
        const t = typeOf(e.arg, path + ".arg");
        if (t && t !== "Bool") errs.push({ path, message: `not needs Bool, got ${t}` });
        return "Bool";
      }
      case "contains": {
        const l = typeOf(e.list, path + ".list"), i = typeOf(e.item, path + ".item");
        if (l === "ListString" && i && i !== "String") errs.push({ path, message: "contains: ListString needs String item" });
        else if (l === "ListNat" && i && i !== "Nat" && i !== "Int") errs.push({ path, message: "contains: ListNat needs Nat item" });
        else if (l && l !== "ListString" && l !== "ListNat") errs.push({ path, message: `contains needs a list, got ${l}` });
        return "Bool";
      }
    }
  };
  const bt = typeOf(pred.body, `predicates.${pred.name}.body`);
  if (bt && bt !== "Bool") errs.push({ path: `predicates.${pred.name}.body`, message: `predicate body must be Bool, got ${bt}` });

  // requirement wiring + itemsData typing (§6.5.3)
  const req = ir.requirement;
  if (!nounOf.has(req.subjectNoun)) errs.push({ path: "requirement.subjectNoun", message: "unknown noun" });
  if (!nounOf.has(req.itemsNoun)) errs.push({ path: "requirement.itemsNoun", message: "unknown noun" });
  if (req.predicate !== pred.name) errs.push({ path: "requirement.predicate", message: "unknown predicate" });
  const itemNoun = nounOf.get(req.itemsNoun);
  if (itemNoun) req.itemsData.values.forEach((v, i) =>
    errs.push(...checkValues(itemNoun.fields, v, `requirement.itemsData.values[${i}]`)));

  // Ambiguities: the resolution recorded must be one the drafter actually offered.
  // zod checks that `options` has >= 2 entries and that `chosen` is a string, but never
  // that `chosen` is among them. Without this, an IR can record a set of options and a
  // pick that was not in it, and S4 presents that to the human as a considered choice.
  // Sign-off is the load-bearing condition of every later GREEN; it must not be asked to
  // approve a judgment call that was never on the menu.
  ir.ambiguities.forEach((a, i) => {
    if (!a.options.includes(a.chosen)) {
      errs.push({
        path: `ambiguities[${i}].chosen`,
        message: `chosen resolution is not among the recorded options (chosen: ${JSON.stringify(a.chosen)}; options: ${JSON.stringify(a.options)})`
      });
    }
  });

  return errs;
}

export function checkValues(fields: { name: string; type: Ty | string }[], values: Record<string, unknown>, path: string): VError[] {
  const errs: VError[] = [];
  for (const f of fields) {
    const v = values[f.name];
    if (v === undefined) { errs.push({ path: `${path}.${f.name}`, message: "missing value" }); continue; }
    const bad = (want: string) => errs.push({ path: `${path}.${f.name}`, message: `expected ${want}` });
    switch (f.type as Ty) {
      case "Nat":
        if (typeof v !== "number" || v < 0 || !Number.isInteger(v)) bad("Nat");
        else if (v > SAFE_INT) errs.push({ path: `${path}.${f.name}`, message: `${v} exceeds 2^53-1; beyond that JS integers lose precision and the TS mirror would silently disagree with Lean` });
        break;
      case "Int":
        if (typeof v !== "number" || !Number.isInteger(v)) bad("Int");
        else if (Math.abs(v) > SAFE_INT) errs.push({ path: `${path}.${f.name}`, message: `|${v}| exceeds 2^53-1; beyond that JS integers lose precision and the TS mirror would silently disagree with Lean` });
        break;
      case "Bool": if (typeof v !== "boolean") bad("Bool"); break;
      case "String": if (typeof v !== "string") bad("String"); break;
      case "ListString": if (!Array.isArray(v) || v.some(x => typeof x !== "string")) bad("ListString"); break;
      case "ListNat": if (!Array.isArray(v) || v.some(x => typeof x !== "number" || x < 0 || !Number.isInteger(x))) bad("ListNat"); break;
    }
  }
  for (const k of Object.keys(values)) if (!fields.some(f => f.name === k))
    errs.push({ path: `${path}.${k}`, message: "unknown field" });
  return errs;
}

export function validateInstance(ir: IR, inst: InstanceT): VError[] {
  const noun = ir.nouns.find(n => n.name === inst.noun);
  if (!noun) return [{ path: "instance.noun", message: `unknown noun ${inst.noun}` }];
  return checkValues(noun.fields, inst.values, "instance.values");
}
