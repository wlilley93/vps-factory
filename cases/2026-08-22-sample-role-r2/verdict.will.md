# VERDICT — RED ❌
**Case:** 2026-08-22-sample-role-r2 (family 2026-08-22-sample-role, revision 2) · **Instance:** will · **Date:** 2026-08-23

## Failing requirements
- **7+ years experience** — duty {"label":"7+ years experience","kind":"minYears","minCount":7,"needle":""} — instance did not satisfy the signed-off predicate for this item.
- **Kubernetes required** — duty {"label":"Kubernetes required","kind":"skill","minCount":0,"needle":"Kubernetes"} — instance did not satisfy the signed-off predicate for this item.

## Possible causes
The data is wrong (fix the instance and reprove) · the formalization is wrong (reject via
`foundry signoff --reject` and redraft) · the requirement is genuinely unmet.

## What this is conditional on
Same conditionality as any verdict: the signed-off formalization (b19f5edc0e6f…, by Will Lilley),
the truth of the instance data, and the exclusions listed in the sign-off bundle.
