import Foundry.Core
namespace Foundry.Cases.SampleRole2026

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
  { label := "5+ years experience", kind := "minYears", minCount := 5, needle := "" },
  { label := "TypeScript essential", kind := "skill", minCount := 0, needle := "TypeScript" },
  { label := "Led 2+ launches", kind := "launches", minCount := 2, needle := "" },
  { label := "AWS certification", kind := "cert", minCount := 0, needle := "AWS" }
]

def satisfiesRoleB (c : Candidate) : Bool := jdDuties.all (meetsB c)
abbrev satisfiesRole  (c : Candidate) : Prop := satisfiesRoleB c = true

def will : Candidate := {
  name := "Will",
  yearsExp := 6,
  skills := ["TypeScript", "Lean"],
  launchesLed := 3,
  certifications := ["AWS"]
}

theorem verdict_will : satisfiesRole will := by decide

end Foundry.Cases.SampleRole2026
