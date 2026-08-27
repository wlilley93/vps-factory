---
citation: "[2026] VPS 29"
court: first-instance
questionKey: "proof:general-theorems:tier"
caseId: 2026-08-23-general-theorems
date: 2026-08-23
status: standing
---
## Question
Which general theorems may Foundry prove, and does that require Mathlib?

## Facts
properties: stricter (∀ subject, later → earlier) | exclusive (∀ subject, ¬(dutyA ∧ dutyB)) | stricter proof: Foundry.all_of_subset + a decidable subset check over two finite duty lists | exclusive proof: simp on the predicate, then omega | core Lean 4.15 only: List.all_eq_true and omega are both core; Mathlib is NOT enabled | stricter is stateable only when both revisions share nouns, units and predicate, differing solely in duty data | a refused proof is reported as NOT ESTABLISHED, never as a disproof | known limit: the subset argument is syntactic, so a RAISED threshold is not established even though it is semantically stricter

## Ruling
Adopted. Both properties are provable in core Lean and §18.1.1's no-Mathlib rule stands unamended. FOUNDRY-PLAN §20's prediction that general theorems 'will also require enabling Mathlib' is wrong, and wrong in the cheaper direction.

## Reasoning
Verified rather than argued: a pure-addition revision pair PROVED, a threshold-raising pair had its subset check proved FALSE by decide, and a genuinely contradictory duty pair had its exclusivity PROVED by simp+omega — all against the pinned kernel with no Mathlib in the build graph. Mathlib would also have been actively harmful here, because enact() runs `lake build Vps` under a 120s timeout and treats a non-zero exit as 'the enactment never happened'; a cold Mathlib build in that graph would make filing a ruling flaky for reasons unrelated to law. §18.1.10's rule that reaching proof search is a bug signal is extended rather than retired: a general goal this fragment cannot close has left the fragment, which is the loud failure §18.1.1 demands. Two limits are recorded rather than hidden — the syntactic subset argument cannot see a raised threshold, and revisions that changed their model are refused as not comparable rather than compared unsoundly.

## Law applied
- SPEC-LAW: spec is law
- SPEC-LAW: rulings are precedent
- FOUNDRY-PLAN §18.1.1: no Mathlib
- FOUNDRY-PLAN §18.1.16: the interface must under-promise
