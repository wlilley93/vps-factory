/-! Spec core: the shared marker, and the one hand-proved lemma the general-theorem
    tier rests on (§20 / Phase 6b). -/
namespace Spec

def version : String := "0.2.0"

theorem sanity : 2 + 2 = 4 := by decide

/--
If every requirement of `l₁` also appears in `l₂`, then satisfying all of `l₂` implies
satisfying all of `l₁`.

This is the entire content of "revision r2 is at least as strict as r1": r2's duty list
contains r1's, so anything r2 admits, r1 admits too. Stated once here, it collapses every
per-revision strictness obligation to a `by decide` subset check over two finite duty
lists — while the theorem it proves quantifies over ALL subjects, which is not decidable
and is exactly the kind of claim `reprove`'s per-instance regression report can only sample.

Core Lean only. `List.all_eq_true` is in Init/Data/List/Lemmas; no Mathlib is involved,
which is worth stating because VPS-PLAN §20 predicted that general theorems would
require it. They do not — see [2026] VPS 29.
-/
theorem all_of_subset {α : Type} (p : α → Bool) {l₁ l₂ : List α}
    (hsub : ∀ a ∈ l₁, a ∈ l₂) (h : l₂.all p = true) : l₁.all p = true := by
  rw [List.all_eq_true] at *
  intro a ha
  exact h a (hsub a ha)

end Spec
