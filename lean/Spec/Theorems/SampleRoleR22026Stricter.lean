import Spec.Core

namespace Spec.Cases.SampleRoleR22026

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

end Spec.Cases.SampleRoleR22026

namespace Spec.Theorems.SampleRoleR22026Stricter

open Spec
open Spec.Cases.SampleRoleR22026

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

end Spec.Theorems.SampleRoleR22026Stricter
