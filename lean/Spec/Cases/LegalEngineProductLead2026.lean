import Spec.Core
namespace Spec.Cases.LegalEngineProductLead2026

structure Candidate where
  name : String
  productsShipped : Nat
  machineBuildableSpecsWritten : Nat
  businessCasesBuilt : Nat
  complianceArtifacts : List String
  seniorStakeholderRooms : Bool
  claudeCodeSpecOpinions : Bool
  discoveryConversationsRun : Bool
  crossCustomerSynthesis : Bool
  clientMaterialsProduced : Bool
  motivatedByEarlyStage : Bool
deriving Repr, DecidableEq

structure Duty where
  label : String
  kind : String
  minCount : Nat
  needle : String
deriving Repr, DecidableEq

/-- Duties dispatch on kind. The JD states no numeric thresholds anywhere in scope, so every Nat minimum is 1 — the weakest faithful reading (recorded as an ambiguity). Bool duties marked self-declared rest on the candidate's say-so; the JD offers no external test. The whole success section is excluded as a type error: its items are predicates over a future employment trajectory (Candidate x Company x Time), not over the applicant. -/
def meetsB (c : Candidate) (d : Duty) : Bool :=
  ((decide (d.kind = "shipped") && decide (c.productsShipped ≥ d.minCount)) || (decide (d.kind = "specs") && decide (c.machineBuildableSpecsWritten ≥ d.minCount)) || (decide (d.kind = "cases") && decide (c.businessCasesBuilt ≥ d.minCount)) || (decide (d.kind = "artifact") && (c.complianceArtifacts).contains d.needle) || (decide (d.kind = "stakeholders") && decide (c.seniorStakeholderRooms = true)) || (decide (d.kind = "claudecode") && decide (c.claudeCodeSpecOpinions = true)) || (decide (d.kind = "discovery") && decide (c.discoveryConversationsRun = true)) || (decide (d.kind = "synthesis") && decide (c.crossCustomerSynthesis = true)) || (decide (d.kind = "materials") && decide (c.clientMaterialsProduced = true)) || (decide (d.kind = "motivation") && decide (c.motivatedByEarlyStage = true)))

def roleDuties : List Duty := [
  { label := "Built products before", kind := "shipped", minCount := 1, needle := "" },
  { label := "Writes machine-buildable specs and iterates them", kind := "specs", minCount := 1, needle := "" },
  { label := "Held own in senior stakeholder rooms", kind := "stakeholders", minCount := 0, needle := "" },
  { label := "Claude Code spec opinions", kind := "claudecode", minCount := 0, needle := "" },
  { label := "Runs customer discovery conversations", kind := "discovery", minCount := 0, needle := "" },
  { label := "Cross-customer synthesis", kind := "synthesis", minCount := 0, needle := "" },
  { label := "Business cases: NPV, second-order effects", kind := "cases", minCount := 1, needle := "" },
  { label := "Compliance artifact: DPIA", kind := "artifact", minCount := 0, needle := "DPIA" },
  { label := "Compliance artifact: RFP response", kind := "artifact", minCount := 0, needle := "RFP response" },
  { label := "Client-facing build materials", kind := "materials", minCount := 0, needle := "" },
  { label := "Keen on early-stage AI company (self-declared)", kind := "motivation", minCount := 0, needle := "" }
]

def suitedToRoleB (c : Candidate) : Bool := roleDuties.all (meetsB c)
abbrev suitedToRole  (c : Candidate) : Prop := suitedToRoleB c = true

def willlilley : Candidate := {
  name := "Will Lilley",
  productsShipped := 3,
  machineBuildableSpecsWritten := 4,
  businessCasesBuilt := 0,
  complianceArtifacts := ["DPIA"],
  seniorStakeholderRooms := true,
  claudeCodeSpecOpinions := true,
  discoveryConversationsRun := true,
  crossCustomerSynthesis := true,
  clientMaterialsProduced := true,
  motivatedByEarlyStage := true
}

#eval (roleDuties.filter (fun d => !(meetsB willlilley d))).map (·.label)
#eval roleDuties.map (fun d => (d.label, meetsB willlilley d))

end Spec.Cases.LegalEngineProductLead2026
