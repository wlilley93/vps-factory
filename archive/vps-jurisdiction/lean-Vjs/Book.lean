/-
GENERATED from .justice/book.json by src/kernel/book.ts — do not edit (CLAUDE.md 5e).
The build is the enactment (§21.5): if book_lawful fails to compile, the enactment
never happened.
-/
import Vps.Legitimacy
import Vps.Proofs

namespace Vjs
open Vps

/-- [2026] VPS 2 — Kernel Protection Act. Kernel changes must carry a record entry explaining themselves. -/
def actKernelProtection : Instrument :=
  { cite := ⟨2026, 2⟩
  , kind := .statute
  , rule := .recordRequired "lean/Vps/"
  , entrenched := true
  , supersedes := none
  , authority := .derived ⟨2026, 1⟩ }

/-- [2026] VPS 3 — Gate Integrity Act. Hook scripts change only by a lawful superseding enactment shipping with the change. -/
def actGateIntegrity : Instrument :=
  { cite := ⟨2026, 3⟩
  , kind := .statute
  , rule := .pathForbidden "gate/"
  , entrenched := false
  , supersedes := none
  , authority := .derived ⟨2026, 1⟩ }

/-- [2026] VPS 4 — Record Discipline Act. Changes to the law's prose mirror must add a record entry. -/
def actRecordDiscipline : Instrument :=
  { cite := ⟨2026, 4⟩
  , kind := .statute
  , rule := .recordRequired "law/"
  , entrenched := false
  , supersedes := none
  , authority := .derived ⟨2026, 1⟩ }

/-- [2026] VPS 5 — Judgment Integrity Act. Hand edits to judgments without a record entry are denied; Foundry's own filings write their record stubs and pass. -/
def actJudgmentIntegrity : Instrument :=
  { cite := ⟨2026, 5⟩
  , kind := .statute
  , rule := .recordRequired ".justice/judgments/"
  , entrenched := true
  , supersedes := none
  , authority := .derived ⟨2026, 1⟩ }

/-- [2026] VPS 6 — Ruling on model:candidate:shape. Filed from case 2026-08-22-sample-role (first-instance). Payload in .justice/judgments/. -/
def ruling2026N6 : Instrument :=
  { cite := ⟨2026, 6⟩
  , kind := .ruling
  , rule := .free
  , entrenched := false
  , supersedes := none
  , authority := .derived ⟨2026, 1⟩ }

/-- [2026] VPS 7 — Ruling on model:duty:shape. Filed from case 2026-08-22-sample-role (first-instance). Payload in .justice/judgments/. -/
def ruling2026N7 : Instrument :=
  { cite := ⟨2026, 7⟩
  , kind := .ruling
  , rule := .free
  , entrenched := false
  , supersedes := none
  , authority := .derived ⟨2026, 1⟩ }

/-- [2026] VPS 8 — Ruling on model:predicate:meets. Filed from case 2026-08-22-sample-role (first-instance). Payload in .justice/judgments/. -/
def ruling2026N8 : Instrument :=
  { cite := ⟨2026, 8⟩
  , kind := .ruling
  , rule := .free
  , entrenched := false
  , supersedes := none
  , authority := .derived ⟨2026, 1⟩ }

/-- [2026] VPS 9 — Ruling on interpret:737ba1c4. Filed from case 2026-08-22-sample-role (first-instance). Payload in .justice/judgments/. -/
def ruling2026N9 : Instrument :=
  { cite := ⟨2026, 9⟩
  , kind := .ruling
  , rule := .free
  , entrenched := false
  , supersedes := none
  , authority := .derived ⟨2026, 1⟩ }

/-- [2026] VPS 10 — Ruling on signoff:2026-08-22-sample-role. Filed from case 2026-08-22-sample-role (first-instance). Payload in .justice/judgments/. -/
def ruling2026N10 : Instrument :=
  { cite := ⟨2026, 10⟩
  , kind := .ruling
  , rule := .free
  , entrenched := false
  , supersedes := none
  , authority := .derived ⟨2026, 1⟩ }

/-- [2026] VPS 11 — Ruling on signoff:2026-08-22-sample-role-r2. Filed from case 2026-08-22-sample-role-r2 (first-instance). Payload in .justice/judgments/. -/
def ruling2026N11 : Instrument :=
  { cite := ⟨2026, 11⟩
  , kind := .ruling
  , rule := .free
  , entrenched := false
  , supersedes := none
  , authority := .derived ⟨2026, 1⟩ }

/-- [2026] VPS 12 — Ruling on interpret:1ce71c01. Filed from case 2026-08-22-legal-engine-product-lead (first-instance). Payload in .justice/judgments/. -/
def ruling2026N12 : Instrument :=
  { cite := ⟨2026, 12⟩
  , kind := .ruling
  , rule := .free
  , entrenched := false
  , supersedes := none
  , authority := .derived ⟨2026, 1⟩ }

/-- [2026] VPS 13 — Ruling on interpret:c91d2da0. Filed from case 2026-08-22-legal-engine-product-lead (first-instance). Payload in .justice/judgments/. -/
def ruling2026N13 : Instrument :=
  { cite := ⟨2026, 13⟩
  , kind := .ruling
  , rule := .free
  , entrenched := false
  , supersedes := none
  , authority := .derived ⟨2026, 1⟩ }

/-- [2026] VPS 14 — Ruling on interpret:97aa40ef. Filed from case 2026-08-22-legal-engine-product-lead (first-instance). Payload in .justice/judgments/. -/
def ruling2026N14 : Instrument :=
  { cite := ⟨2026, 14⟩
  , kind := .ruling
  , rule := .free
  , entrenched := false
  , supersedes := none
  , authority := .derived ⟨2026, 1⟩ }

/-- [2026] VPS 15 — Ruling on interpret:05811fc3. Filed from case 2026-08-22-legal-engine-product-lead (first-instance). Payload in .justice/judgments/. -/
def ruling2026N15 : Instrument :=
  { cite := ⟨2026, 15⟩
  , kind := .ruling
  , rule := .free
  , entrenched := false
  , supersedes := none
  , authority := .derived ⟨2026, 1⟩ }

/-- [2026] VPS 16 — Appeal ruling on model:candidate:shape. Supersedes [2026] VPS 6. -/
def ruling2026N16 : Instrument :=
  { cite := ⟨2026, 16⟩
  , kind := .ruling
  , rule := .free
  , entrenched := false
  , supersedes := some ⟨2026, 6⟩
  , authority := .derived ⟨2026, 1⟩ }

/-- [2026] VPS 17 — Appeal ruling on model:predicate:meets. Supersedes [2026] VPS 8. -/
def ruling2026N17 : Instrument :=
  { cite := ⟨2026, 17⟩
  , kind := .ruling
  , rule := .free
  , entrenched := false
  , supersedes := some ⟨2026, 8⟩
  , authority := .derived ⟨2026, 1⟩ }

/-- [2026] VPS 18 — Ruling on model:2026-08-22-legal-engine-product-lead:candidate:shape. Filed from case 2026-08-22-legal-engine-product-lead (first-instance). Payload in .justice/judgments/. -/
def ruling2026N18 : Instrument :=
  { cite := ⟨2026, 18⟩
  , kind := .ruling
  , rule := .free
  , entrenched := false
  , supersedes := none
  , authority := .derived ⟨2026, 1⟩ }

/-- [2026] VPS 19 — Ruling on model:2026-08-22-legal-engine-product-lead:duty:shape. Filed from case 2026-08-22-legal-engine-product-lead (first-instance). Payload in .justice/judgments/. -/
def ruling2026N19 : Instrument :=
  { cite := ⟨2026, 19⟩
  , kind := .ruling
  , rule := .free
  , entrenched := false
  , supersedes := none
  , authority := .derived ⟨2026, 1⟩ }

/-- [2026] VPS 20 — Ruling on model:2026-08-22-legal-engine-product-lead:predicate:meets. Filed from case 2026-08-22-legal-engine-product-lead (first-instance). Payload in .justice/judgments/. -/
def ruling2026N20 : Instrument :=
  { cite := ⟨2026, 20⟩
  , kind := .ruling
  , rule := .free
  , entrenched := false
  , supersedes := none
  , authority := .derived ⟨2026, 1⟩ }

/-- [2026] VPS 21 — Ruling on signoff:2026-08-22-legal-engine-product-lead. Filed from case 2026-08-22-legal-engine-product-lead (first-instance). Payload in .justice/judgments/. -/
def ruling2026N21 : Instrument :=
  { cite := ⟨2026, 21⟩
  , kind := .ruling
  , rule := .free
  , entrenched := false
  , supersedes := none
  , authority := .derived ⟨2026, 1⟩ }

/-- [2026] VPS 22 — Ruling on model:2026-08-23-shopping-list:shoppingtrip:shape. Filed from case 2026-08-23-shopping-list (first-instance). Payload in .justice/judgments/. -/
def ruling2026N22 : Instrument :=
  { cite := ⟨2026, 22⟩
  , kind := .ruling
  , rule := .free
  , entrenched := false
  , supersedes := none
  , authority := .derived ⟨2026, 1⟩ }

/-- [2026] VPS 23 — Ruling on model:2026-08-23-shopping-list:listitem:shape. Filed from case 2026-08-23-shopping-list (first-instance). Payload in .justice/judgments/. -/
def ruling2026N23 : Instrument :=
  { cite := ⟨2026, 23⟩
  , kind := .ruling
  , rule := .free
  , entrenched := false
  , supersedes := none
  , authority := .derived ⟨2026, 1⟩ }

/-- [2026] VPS 24 — Ruling on model:2026-08-23-shopping-list:predicate:itemSatisfied. Filed from case 2026-08-23-shopping-list (first-instance). Payload in .justice/judgments/. -/
def ruling2026N24 : Instrument :=
  { cite := ⟨2026, 24⟩
  , kind := .ruling
  , rule := .free
  , entrenched := false
  , supersedes := none
  , authority := .derived ⟨2026, 1⟩ }

/-- [2026] VPS 25 — Ruling on interpret:7543eaae. Filed from case 2026-08-23-shopping-list (first-instance). Payload in .justice/judgments/. -/
def ruling2026N25 : Instrument :=
  { cite := ⟨2026, 25⟩
  , kind := .ruling
  , rule := .free
  , entrenched := false
  , supersedes := none
  , authority := .derived ⟨2026, 1⟩ }

/-- [2026] VPS 26 — Ruling on interpret:49e9db1e. Filed from case 2026-08-23-shopping-list (first-instance). Payload in .justice/judgments/. -/
def ruling2026N26 : Instrument :=
  { cite := ⟨2026, 26⟩
  , kind := .ruling
  , rule := .free
  , entrenched := false
  , supersedes := none
  , authority := .derived ⟨2026, 1⟩ }

/-- [2026] VPS 27 — Ruling on interpret:4cb0b250. Filed from case 2026-08-23-shopping-list (first-instance). Payload in .justice/judgments/. -/
def ruling2026N27 : Instrument :=
  { cite := ⟨2026, 27⟩
  , kind := .ruling
  , rule := .free
  , entrenched := false
  , supersedes := none
  , authority := .derived ⟨2026, 1⟩ }

/-- [2026] VPS 28 — Ruling on schema:ir:types:v2. Filed from case 2026-08-23-schema-types-v2 (first-instance). Payload in .justice/judgments/. -/
def ruling2026N28 : Instrument :=
  { cite := ⟨2026, 28⟩
  , kind := .ruling
  , rule := .free
  , entrenched := false
  , supersedes := none
  , authority := .derived ⟨2026, 1⟩ }

/-- [2026] VPS 29 — Ruling on proof:general-theorems:tier. Filed from case 2026-08-23-general-theorems (first-instance). Payload in .justice/judgments/. -/
def ruling2026N29 : Instrument :=
  { cite := ⟨2026, 29⟩
  , kind := .ruling
  , rule := .free
  , entrenched := false
  , supersedes := none
  , authority := .derived ⟨2026, 1⟩ }

/-- [2026] VPS 30 — Book Protection Act. The generated statute book is law: changing it by hand requires a record entry saying why. Enacted when the kernel became a pinned dependency and [2026] VPS 2's scope, lean/Vps/, ceased to exist. VPS 2 is entrenched and therefore cannot be repointed, so this supplements it rather than superseding it. -/
def actBookProtection : Instrument :=
  { cite := ⟨2026, 30⟩
  , kind := .statute
  , rule := .recordRequired "lean/Vjs/"
  , entrenched := true
  , supersedes := none
  , authority := .derived ⟨2026, 1⟩ }

/-- **This jurisdiction's sovereign digest** -- the sha256 of law/genesis.md. The
    engine is a pinned dependency and contributes no digest of its own. -/
def digest : String := "sha256:304148d85a3dae274525953dc7e41986b701da7aaee8443f9a98227dfd5961e3"

/-- The book, newest first. -/
def theBook : List Instrument :=
  [actBookProtection, ruling2026N29, ruling2026N28, ruling2026N27, ruling2026N26, ruling2026N25, ruling2026N24, ruling2026N23, ruling2026N22, ruling2026N21, ruling2026N20, ruling2026N19, ruling2026N18, ruling2026N17, ruling2026N16, ruling2026N15, ruling2026N14, ruling2026N13, ruling2026N12, ruling2026N11, ruling2026N10, ruling2026N9, ruling2026N8, ruling2026N7, ruling2026N6, actJudgmentIntegrity, actRecordDiscipline, actGateIntegrity, actKernelProtection, genesisInstrument digest]

/-- The book's legitimacy is a compile-time theorem (§21.5). -/
theorem book_lawful : Lawful digest theBook :=
  Lawful.enact (Lawful.enact (Lawful.enact (Lawful.enact (Lawful.enact (Lawful.enact (Lawful.enact (Lawful.enact (Lawful.enact (Lawful.enact (Lawful.enact (Lawful.enact (Lawful.enact (Lawful.enact (Lawful.enact (Lawful.enact (Lawful.enact (Lawful.enact (Lawful.enact (Lawful.enact (Lawful.enact (Lawful.enact (Lawful.enact (Lawful.enact (Lawful.enact (Lawful.enact (Lawful.enact (Lawful.enact (Lawful.enact Lawful.genesis (by decide) (by decide)) (by decide) (by decide)) (by decide) (by decide)) (by decide) (by decide)) (by decide) (by decide)) (by decide) (by decide)) (by decide) (by decide)) (by decide) (by decide)) (by decide) (by decide)) (by decide) (by decide)) (by decide) (by decide)) (by decide) (by decide)) (by decide) (by decide)) (by decide) (by decide)) (by decide) (by decide)) (by decide) (by decide)) (by decide) (by decide)) (by decide) (by decide)) (by decide) (by decide)) (by decide) (by decide)) (by decide) (by decide)) (by decide) (by decide)) (by decide) (by decide)) (by decide) (by decide)) (by decide) (by decide)) (by decide) (by decide)) (by decide) (by decide)) (by decide) (by decide)) (by decide) (by decide)

/-- The gate as deployed: the compiled book applied to facts. -/
def gate (f : Facts) : Verdict :=
  decideVerdict theBook f

end Vjs
