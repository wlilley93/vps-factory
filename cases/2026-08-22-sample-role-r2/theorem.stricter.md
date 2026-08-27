# GENERAL THEOREM — NOT ESTABLISHED
**Case:** 2026-08-22-sample-role-r2 (revision 2) · **Property:** stricter · **Date:** 2026-08-23

## The claim
Every subject satisfying **2026-08-22-sample-role-r2** also satisfies **2026-08-22-sample-role**, so 2026-08-22-sample-role-r2 is at least as strict.

## Not established — which is not the same as false
Lean did not accept the statement. That is a fact about this proof, not about the requirements: a claim can be true and still sit outside the fragment this tier can close.

For `stricter`, the proof is a **syntactic** one — it asks whether the earlier revision's duty rows all appear in the later one. So it succeeds when a revision ADDS duties, and fails when a revision RAISES a threshold, even though raising a threshold is semantically stricter. `5+ years` becoming `7+ years` is the ordinary case and this proof cannot see it; closing that gap needs a per-duty implication argument, which is a larger piece of work and is named rather than pretended.

Lean's diagnostics, verbatim:

```
tactic 'decide' proved that the proposition
  ∀ (d : Duty), d ∈ earlierDuties → d ∈ jdDuties
is false
```

## What this is conditional on — and what it is NOT
This is a statement about the **formalization**, quantified over every possible subject. It
is therefore conditional on the signed-off formalization (b19f5edc0e6f…, by
Will Lilley) and on nothing else.

In particular it does **not** depend on any instance data, which makes it a strictly
stronger claim than any GREEN verdict this system issues — and correspondingly the easiest
thing here to overstate. It says the requirements relate to each other in the stated way. It
says nothing about whether anyone satisfies them, and nothing about whether the formalization
faithfully represents the prose: that remains a human judgment, recorded at sign-off.

## The statement Lean was given
```lean
import Foundry.Core

namespace Foundry.Cases.SampleRoleR22026

structure Candidate where
  name : String
  yearsExp : Nat
  skills : List String
  launchesLed : Nat
  certifications : List String
deriving Repr, DecidableEq

structure Duty where
  label : String
  kind : String
  minCount : Nat
  needle : String
deriving Repr, DecidableEq

/-- Each duty is tagged with a kind; meets dispatches on kind. minCount is 0 where unused; needle is "" where unused. -/
def meetsB (c : Candidate) (d : Duty) : Bool :=
  ((decide (d.kind = "minYears") && decide (c.yearsExp ≥ d.minCount)) || (decide (d.kind = "skill") && (c.skills).contains d.needle) || (decide (d.kind = "launches") && decide (c.launchesLed ≥ d.minCount)) || (decide (d.kind = "cert") && (c.certifications).contains d.needle))

def jdDuties : List Duty := [
  { label := "7+ years experience", kind := "minYears", minCount := 7, needle := "" },
  { label := "TypeScript essential", kind := "skill", minCount := 0, needle := "TypeScript" },
  { label := "Led 2+ launches", kind := "launches", minCount := 2, needle := "" },
  { label := "AWS certification", kind := "cert", minCount := 0, needle := "AWS" },
  { label := "Kubernetes required", kind := "skill", minCount := 0, needle := "Kubernetes" }
]

def satisfiesRoleB (c : Candidate) : Bool := jdDuties.all (meetsB c)
abbrev satisfiesRole  (c : Candidate) : Prop := satisfiesRoleB c = true

end Foundry.Cases.SampleRoleR22026

namespace Foundry.Theorems.SampleRoleR22026Stricter

open Foundry
open Foundry.Cases.SampleRoleR22026

/-- The earlier revision's duty list (2026-08-22-sample-role), over the SAME model. -/
def earlierDuties : List Duty := [
    { label := "5+ years experience", kind := "minYears", minCount := 5, needle := "" },
    { label := "TypeScript essential", kind := "skill", minCount := 0, needle := "TypeScript" },
    { label := "Led 2+ launches", kind := "launches", minCount := 2, needle := "" },
    { label := "AWS certification", kind := "cert", minCount := 0, needle := "AWS" }
]

def earlierSatisfiedB (s : Candidate) : Bool := earlierDuties.all (meetsB s)

/-- Every duty of 2026-08-22-sample-role also appears in 2026-08-22-sample-role-r2. Finite and decidable. -/
theorem duties_subset : ∀ d ∈ earlierDuties, d ∈ jdDuties := by decide

/-- Therefore anything satisfying 2026-08-22-sample-role-r2 satisfies 2026-08-22-sample-role: 2026-08-22-sample-role-r2 is at least as
    strict. Quantified over EVERY subject, not over the registered instances. -/
theorem stricter_than_earlier :
    ∀ s : Candidate, satisfiesRoleB s = true → earlierSatisfiedB s = true := by
  intro s h
  exact all_of_subset _ duties_subset h

end Foundry.Theorems.SampleRoleR22026Stricter
```
