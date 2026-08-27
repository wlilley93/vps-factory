// renderCaseLean (§7.4): pure function; the case file is always fully regenerated.
import type { IR, Expr, InstanceT } from "../ir/schema.js";

export interface CodegenOpts {
  diagnostics: boolean;
  theoremTactic: string | null;
  instanceName: string | null;
}

export function moduleName(slug: string): string {
  const pas = slug.replace(/^[0-9-]+/, "").split(/[^A-Za-z0-9]+/).filter(Boolean)
    .map(w => w[0].toUpperCase() + w.slice(1)).join("");
  const year = slug.match(/^(\d{4})/)?.[1] ?? "";
  return pas + year;
}

const leanStr = (s: string) => JSON.stringify(s); // JSON escaping is valid Lean string syntax here

function leanType(t: string): string {
  return { Nat: "Nat", Int: "Int", Bool: "Bool", String: "String", ListString: "List String", ListNat: "List Nat" }[t]!;
}

export function exprToLean(e: Expr): string {
  switch (e.op) {
    case "const":
      if (e.type === "String") return leanStr(String(e.value));
      // Negative Int literals need parens and an ascription: bare `-3` parses as a prefix
      // operator in argument position, and Lean's default numeric literal is Nat, so a
      // negative constant must say it is an Int or elaboration fails.
      if (e.type === "Int") return Number(e.value) < 0 ? `((${e.value}) : Int)` : `(${e.value} : Int)`;
      return String(e.value);
    case "field": return e.path;
    case "ge": return `decide (${exprToLean(e.left)} ≥ ${exprToLean(e.right)})`;
    case "gt": return `decide (${exprToLean(e.left)} > ${exprToLean(e.right)})`;
    case "le": return `decide (${exprToLean(e.left)} ≤ ${exprToLean(e.right)})`;
    case "lt": return `decide (${exprToLean(e.left)} < ${exprToLean(e.right)})`;
    case "eq": return `decide (${exprToLean(e.left)} = ${exprToLean(e.right)})`;
    case "ne": return `decide (${exprToLean(e.left)} ≠ ${exprToLean(e.right)})`;
    case "and": return "(" + e.args.map(exprToLean).join(" && ") + ")";
    case "or": return "(" + e.args.map(exprToLean).join(" || ") + ")";
    case "not": return `!(${exprToLean(e.arg)})`;
    case "contains": return `(${exprToLean(e.list)}).contains ${exprToLean(e.item)}`;
    // Desugared, not given its own Lean form: `between` exists so a drafter can say a range
    // in one node, but the generated code and the TS mirror both see only ge/le, so there is
    // no third semantics to keep in step with the other two.
    case "between": return exprToLean(desugar(e));
  }
}

/** between(v, lo, hi) => and(ge(v, lo), le(v, hi)). Applied before codegen AND before the
 *  mirror evaluates, so the two cannot disagree about ranges. */
export function desugar(e: Expr): Expr {
  if (e.op === "between") {
    return { op: "and", args: [
      { op: "ge", left: desugar(e.value), right: desugar(e.lo) },
      { op: "le", left: desugar(e.value), right: desugar(e.hi) }
    ] };
  }
  if (e.op === "and" || e.op === "or") return { ...e, args: e.args.map(desugar) };
  if (e.op === "not") return { ...e, arg: desugar(e.arg) };
  if (e.op === "contains") return { ...e, list: desugar(e.list), item: desugar(e.item) };
  if ("left" in e && "right" in e) return { ...e, left: desugar(e.left), right: desugar(e.right) } as Expr;
  return e;
}

function valueToLean(t: string, v: unknown): string {
  switch (t) {
    case "Nat": return String(v);
    case "Int": return Number(v) < 0 ? `((${v}) : Int)` : `(${v} : Int)`;
    case "Bool": return String(v);
    case "String": return leanStr(String(v));
    case "ListString": return "[" + (v as string[]).map(leanStr).join(", ") + "]";
    case "ListNat": return "[" + (v as number[]).join(", ") + "]";
    default: return String(v);
  }
}

export function renderCaseLean(ir: IR, instances: InstanceT[], opts: CodegenOpts, slug: string): string {
  const mod = moduleName(slug);
  const L: string[] = [];
  L.push("import Spec.Core");
  L.push(`namespace Spec.Cases.${mod}`);
  L.push("");
  // nouns: requirementItem first is unnecessary — no cross refs; keep IR order
  for (const n of ir.nouns) {
    L.push(`structure ${n.name} where`);
    for (const f of n.fields) L.push(`  ${f.name} : ${leanType(f.type)}`);
    L.push("deriving Repr, DecidableEq");
    L.push("");
  }
  const pred = ir.predicates[0];
  const params = pred.params.map(p => `(${p.name} : ${p.noun})`).join(" ");
  L.push(`/-- ${pred.interpretationNotes.replace(/\n/g, " ")} -/`);
  L.push(`def ${pred.name}B ${params} : Bool :=`);
  L.push("  " + exprToLean(pred.body));
  L.push("");
  const req = ir.requirement;
  const itemNoun = ir.nouns.find(n => n.name === req.itemsNoun)!;
  L.push(`def ${req.itemsData.name} : List ${req.itemsNoun} := [`);
  const rows = req.itemsData.values.map(v =>
    "  { " + itemNoun.fields.map(f => `${f.name} := ${valueToLean(f.type, (v as any)[f.name])}`).join(", ") + " }");
  L.push(rows.join(",\n"));
  L.push("]");
  L.push("");
  const subj = pred.params[0].name;
  L.push(`def ${req.name}B (${subj} : ${req.subjectNoun}) : Bool := ${req.itemsData.name}.all (${pred.name}B ${subj})`);
  // `abbrev`, not `def`: the Prop wrapper must stay reducible, or typeclass resolution
  // cannot see through it to the underlying Bool equality and rung-1 `decide` fails with
  // "failed to synthesize Decidable (…)" on a goal that is in fact decidable. A plain
  // `def` here silently defeats §1.3's Bool-valued-predicate design. Found by running Lean
  // for the first time (Protocol 5b): every generated case file had been failing to compile.
  L.push(`abbrev ${req.name}  (${subj} : ${req.subjectNoun}) : Prop := ${req.name}B ${subj} = true`);
  L.push("");
  for (const inst of instances) {
    const noun = ir.nouns.find(n => n.name === inst.noun)!;
    L.push(`def ${instDefName(inst)} : ${inst.noun} := {`);
    L.push("  " + noun.fields.map(f => `${f.name} := ${valueToLean(f.type, (inst.values as any)[f.name])}`).join(",\n  "));
    L.push("}");
    L.push("");
  }
  if (opts.theoremTactic && opts.instanceName) {
    L.push(`theorem verdict_${opts.instanceName} : ${req.name} ${opts.instanceName} := by ${opts.theoremTactic}`);
    L.push("");
  }
  if (opts.diagnostics && opts.instanceName) {
    L.push(`#eval (${req.itemsData.name}.filter (fun d => !(${pred.name}B ${opts.instanceName} d))).map (·.label)`);
    L.push(`#eval ${req.itemsData.name}.map (fun d => (d.label, ${pred.name}B ${opts.instanceName} d))`);
    L.push("");
  }
  L.push(`end Spec.Cases.${mod}`);
  L.push("");
  return L.join("\n");
}

export function instDefName(inst: InstanceT): string {
  return inst.values["name"] ? String(inst.values["name"]).toLowerCase().replace(/[^a-z0-9]/g, "") : "subject";
}
