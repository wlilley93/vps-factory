---
citation: "[2026] VPS 28"
court: first-instance
questionKey: "schema:ir:types:v2"
caseId: 2026-08-23-schema-types-v2
date: 2026-08-23
status: standing
---
## Question
What types, units and comparison rules may an IR use?

## Facts
admitted field types: Nat, Int, Bool, String, ListString, ListNat | unit kinds: plain (default) | date | scaled(n) | date encoding: Nat days since 1970-01-01, proleptic Gregorian, UTC | scaled encoding: integer in 10^-n units; money scale 2, basis points scale 4 | comparison rule: ge/gt/le/lt/eq/ne and between require matching unit keys on both sides | integer bound: |v| <= 2^53-1, refused above | between(v,lo,hi) desugars to and(ge(v,lo), le(v,hi)) before codegen and before the TS mirror | rejected: Rat (Std.Internal.Rat is internal API), Float (non-decidable), Std.Time.PlainDate (per-literal proof obligation), arithmetic operators (+,-,*,/) | question-key rendering: unit appended only when non-plain, so pre-existing facts strings are unchanged

## Ruling
Adopted. The v2 type language is the list above. Expressive power comes from the type checker, not from new runtime primitives: dates and fixed-point quantities are Nat/Int in a declared unit, so generated code stays inside core Lean with no new proof burden and the TypeScript mirror needs no new evaluation arms, while the validator gains the ability to refuse a comparison across incompatible units — the class of error no amount of proving would catch.

## Reasoning
First impression on the language itself rather than on any one case, so it binds every future drafter. Rat is rejected because Std.Internal.Rat is internal API and depending on it would make the description of the trusted base dishonest. Float is rejected because its comparisons are not decidable and the mirror could not reproduce them. Std.Time.PlainDate is rejected because its validity field imposes a proof obligation on every date literal. Arithmetic operators are rejected because keeping Expr arithmetic-free is what keeps evalExpr trivially identical to exprToLean; Nat truncated subtraction against JS subtraction is precisely the divergence one must not discover inside a verdict. The 2^53-1 bound exists for the same reason: beyond it JS integers lose precision and the mirror would disagree with the kernel silently. Falsifiability, per Charter Art. 8: an IR comparing a plain count against a date must fail validation, and an IR comparing two same-unit quantities must pass; both are asserted in test/types.test.ts.

## Law applied
- SPEC-LAW: spec is law
- SPEC-LAW: rulings are precedent
- CLAUDE.md 5: no new IR ops or types without a plan revision and a ruling
