/- MUST COMPILE (M11 acceptance c).
   A statute lawfully superseding the non-entrenched Gate Integrity Act,
   after which the old act no longer bites the gate. -/
import Vps.Book
namespace Vps
def actGateIntegrity2 : Instrument :=
  { cite := ⟨2026, 98⟩, kind := .statute, rule := .pathForbidden "gate/hooks/", entrenched := false
  , supersedes := some actGateIntegrity.cite, authority := .derived ⟨2026, 1⟩ }
theorem grown_lawful : Lawful (actGateIntegrity2 :: theBook) :=
  Lawful.enact book_lawful (by decide) (by decide)
example : decideVerdict (actGateIntegrity2 :: theBook)
    { pathsChanged := ["gate/pre-commit"], recordsAdded := 0 } = .allow := by native_decide
end Vps
