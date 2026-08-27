# VERDICT — GREEN ✅
**Case:** 2026-08-22-sample-role (family 2026-08-22-sample-role, revision 1) · **Instance:** will · **Date:** 2026-08-23
> ⚠ SUPERSEDED by 2026-08-22-sample-role-r2. This verdict remains a true statement about revision 1's formalization only. See the successor's verdicts for current status.
**Theorem:** `verdict_will : satisfiesRole will` — accepted by Lean (leanprover/lean4:v4.15.0) via `decide`.

## What this guarantees
Lean has verified, for every requirement item in the signed-off formalization, that the
provided instance data satisfies the signed-off predicate. This is a machine-checked proof,
not a test: within the model, no case was sampled — all were covered.

## What this is conditional on (read this)
1. **The formalization** (bfc04c171717…) faithfully representing the source prose — a human
   judgment, signed off by Will Lilley on 2026-08-22 (ruling [2026] VPS 10), supported by
   the checks in `checks/report.md`, and proved by nothing.
2. **The instance data** being true. Lean verified `IF this data THEN satisfied`; it cannot
   verify the data itself.
3. **Exclusions:** the following prose was deliberately not modelled and is NOT covered by
   this verdict:
   - "communicates clearly with stakeholders" — unmeasurable in v1 type system; surfaced for human decision at sign-off

## Chain of custody
intake 89277a7dfe56 → IR bfc04c171717 → lean 33e584cdc873 → proof `decide`, 1 attempt(s).
