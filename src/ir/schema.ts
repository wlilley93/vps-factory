// The IR (§6): zod schemas. v1 types: Nat | Bool | String | ListString | ListNat.
import { z } from "zod";

export const IDENT = /^[a-z][A-Za-z0-9]*$/;
export const PASCAL = /^[A-Z][A-Za-z0-9]*$/;
export const RESERVED = new Set([
  "Type", "Prop", "Sort", "theorem", "def", "structure", "instance", "class",
  "abbrev", "inductive", "match", "with", "fun", "let", "in", "do", "end",
  "namespace", "import", "open", "deriving", "where", "example", "axiom"
]);

// These messages matter as much as the constraints. On a validation failure the drafter is
// re-prompted with them and asked to repair, and zod's default ("Invalid") names no
// constraint at all — so a live model burns every repair attempt guessing. Observed
// 2026-08-23: a run died with `requirement.name: Invalid` after exhausting all three
// repairs on an identifier whose only fault was a character the schema never mentioned.
// Say what is required, and give an example; a repair prompt can only fix what it is told.
const IDENT_MSG = "must be lowerCamelCase: a lowercase letter followed by letters or digits only — no underscores, hyphens, spaces or dots (e.g. shoppingListSatisfied)";
const PASCAL_MSG = "must be UpperCamelCase: an uppercase letter followed by letters or digits only — no underscores, hyphens, spaces or dots (e.g. ShoppingTrip)";
const ident = z.string().regex(IDENT, IDENT_MSG)
  .refine(s => !RESERVED.has(s), s => ({ message: `'${s}' is a Lean reserved word — choose another name` }));
const pascal = z.string().regex(PASCAL, PASCAL_MSG)
  .refine(s => !RESERVED.has(s), s => ({ message: `'${s}' is a Lean reserved word — choose another name` }));

export const SourceSpan = z.object({
  quote: z.string().min(1),
  start: z.number().int().nonnegative(),
  end: z.number().int().nonnegative()
});

export const FieldType = z.enum(["Nat", "Int", "Bool", "String", "ListString", "ListNat"]);

/**
 * How to read a numeric field.
 *
 * The expressive win here comes from the type checker, not the runtime: encode ordered
 * quantities as Nat/Int in a declared unit and the codegen stays inside core Lean with no
 * new primitives, no new proof burden, and an `evalExpr` mirror that needs no new arms —
 * while the validator gains the ability to refuse "years of experience >= a date", which is
 * the class of error no amount of proving would catch.
 *
 *  - plain      : a bare count, as before.
 *  - date       : days since 1970-01-01, proleptic Gregorian, UTC. Not Std.Time.PlainDate:
 *                 that carries a validity proof obligation per literal and imports
 *                 Std.Internal.Rat, so every date in generated code would need a proof term.
 *  - scaled(n)  : fixed point. Money in minor units is scale 2; basis points scale 4.
 *                 Not Rat: Std.Internal.Rat is internal API and depending on it would make
 *                 the trusted-base description dishonest. Not Float: non-decidable
 *                 comparisons and a mirror that cannot reproduce them.
 */
export const Unit = z.object({
  kind: z.enum(["plain", "date", "scaled"]),
  scale: z.number().int().min(0).max(9).optional(),
  display: z.string().optional()
}).refine(u => u.kind !== "scaled" || typeof u.scale === "number",
  { message: "unit kind 'scaled' requires a scale (e.g. scale 2 for money in minor units)" });

export const Field = z.object({
  name: ident,
  type: FieldType,
  /** Absent means plain. Only meaningful on Nat and Int. */
  unit: Unit.optional(),
  source: SourceSpan
});

export const Noun = z.object({
  name: pascal,
  role: z.enum(["subject", "requirementItem"]),
  fields: z.array(Field).min(1),
  source: SourceSpan
});

export type Expr =
  | { op: "const"; type: "Nat" | "Int" | "Bool" | "String"; value: number | boolean | string }
  | { op: "field"; path: string }
  | { op: "ge" | "gt" | "le" | "lt"; left: Expr; right: Expr }
  | { op: "eq" | "ne"; left: Expr; right: Expr }
  | { op: "and" | "or"; args: Expr[] }
  | { op: "not"; arg: Expr }
  | { op: "contains"; list: Expr; item: Expr }
  /** Inclusive range. Desugared to and(ge(x,lo), le(x,hi)) before codegen and before the
   *  TS mirror sees it, so neither gains an arm and the two cannot drift. */
  | { op: "between"; value: Expr; lo: Expr; hi: Expr };

export const ExprSchema: z.ZodType<Expr> = z.lazy(() =>
  z.union([
    z.object({ op: z.literal("const"), type: z.enum(["Nat", "Int", "Bool", "String"]), value: z.union([z.number(), z.boolean(), z.string()]) }),
    z.object({ op: z.literal("field"), path: z.string().regex(/^[a-z][A-Za-z0-9]*\.[a-z][A-Za-z0-9]*$/) }),
    z.object({ op: z.enum(["ge", "gt", "le", "lt"]), left: z.lazy(() => ExprSchema), right: z.lazy(() => ExprSchema) }),
    z.object({ op: z.enum(["eq", "ne"]), left: z.lazy(() => ExprSchema), right: z.lazy(() => ExprSchema) }),
    z.object({ op: z.enum(["and", "or"]), args: z.array(z.lazy(() => ExprSchema)).min(2) }),
    z.object({ op: z.literal("not"), arg: z.lazy(() => ExprSchema) }),
    z.object({ op: z.literal("contains"), list: z.lazy(() => ExprSchema), item: z.lazy(() => ExprSchema) }),
    z.object({ op: z.literal("between"), value: z.lazy(() => ExprSchema), lo: z.lazy(() => ExprSchema), hi: z.lazy(() => ExprSchema) })
  ])
);

export const Predicate = z.object({
  name: ident,
  params: z.array(z.object({ name: ident, noun: pascal })).length(2),
  body: ExprSchema,
  source: SourceSpan,
  interpretationNotes: z.string()
});

export const Requirement = z.object({
  name: ident,
  quantifier: z.literal("allOf"),
  subjectNoun: pascal,
  itemsNoun: pascal,
  itemsData: z.object({ name: ident, values: z.array(z.record(z.unknown())).min(1) }),
  predicate: ident
});

export const Ambiguity = z.object({
  sourceText: z.string(), options: z.array(z.string()).min(2),
  chosen: z.string(), rationale: z.string()
});
export const Exclusion = z.object({ sourceText: z.string(), reason: z.string() });

export const IRSchema = z.object({
  caseId: z.string(),
  sourceDoc: z.string(),
  nouns: z.array(Noun).min(2),
  predicates: z.array(Predicate).length(1),
  requirement: Requirement,
  ambiguities: z.array(Ambiguity),
  exclusions: z.array(Exclusion)
});
export type IR = z.infer<typeof IRSchema>;

export const Instance = z.object({ noun: pascal, values: z.record(z.unknown()) });
export type InstanceT = z.infer<typeof Instance>;
