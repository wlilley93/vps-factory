/- MUST FAIL TO COMPILE (M11 acceptance c).
   A statute attempting to supersede entrenched law:
   entrenched_immune makes this book unconstructible. -/
import Vps.Book
namespace Vps
def rogueEntrenched : Instrument :=
  { cite := ⟨2026, 99⟩, kind := .statute, rule := .free, entrenched := false
  , supersedes := some actKernelProtection.cite, authority := .derived ⟨2026, 1⟩ }
theorem rogueEntrenched_lawful : Lawful (rogueEntrenched :: theBook) :=
  Lawful.enact book_lawful (by decide) (by decide)
end Vps
