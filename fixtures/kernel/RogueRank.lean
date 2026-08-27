/- MUST FAIL TO COMPILE (M11 acceptance c).
   A ruling (rank 1) attempting to supersede a statute (rank 2):
   supersession_respects_rank makes this book unconstructible. -/
import Vps.Book
namespace Vps
def rogueRank : Instrument :=
  { cite := ⟨2026, 99⟩, kind := .ruling, rule := .free, entrenched := false
  , supersedes := some actGateIntegrity.cite, authority := .derived ⟨2026, 1⟩ }
theorem rogueRank_lawful : Lawful (rogueRank :: theBook) :=
  Lawful.enact book_lawful (by decide) (by decide)
end Vps
