---
citation: "[2026] VPS 22"
court: first-instance
questionKey: "model:2026-08-23-shopping-list:shoppingtrip:shape"
caseId: 2026-08-23-shopping-list
date: 2026-08-23
status: standing
---
## Question
How is ShoppingTrip modelled?

## Facts
bananaCount:Nat,purchasedItems:ListString

## Ruling
ShoppingTrip is modelled as a single flat record (Lean structure) named ShoppingTrip with exactly two independent fields in the order given: bananaCount : Nat and purchasedItems : List String. Both fields are total and unconditional — bananaCount is a plain Nat with no upper bound and no implicit non-zero constraint, and purchasedItems is an ordered, duplicate-permitting List String, not a Set, Multiset, or Array. No invariant is imposed relating bananaCount to purchasedItems: the count is NOT held to equal, bound, or be derivable from the number of "banana"-valued elements of purchasedItems, and no well-formedness proof field is attached to the structure. The two facts are modelled as separately-supplied data. Any requirement coupling them (e.g. bananaCount = purchasedItems.count "banana") is a substantive requirement that must arrive by `foundry amend` as a new revision, not by reading it into this ruling.

## Reasoning
This is a case of first impression: the PRIOR RULINGS set is empty, so nothing binds and nothing is departed from. Two questions had to be answered — the shape of the type, and the invariants it carries.

Shape. The facts present two named, heterogeneous, simultaneously-held attributes of one entity. A record is the only faithful encoding; a sum type would assert the attributes are alternatives, and a bare tuple would discard the names the intake supplied. The declared field types are taken at face value — Nat, not Int (a count of bananas has no meaning below zero and Nat's induction is the cheaper mechanism), and List String, not a set or multiset, because the intake wrote List and the ordered, duplicate-permitting reading is the weaker commitment. Choosing Set or Multiset here would silently rule that order and repetition are immaterial, which is a semantic claim the facts do not make. Array is rejected for the same reason plus proof ergonomics: List carries structural recursion, and this repo has no Mathlib to lean on.

Invariants. The tempting move is to tie bananaCount to purchasedItems — the shared word "banana" invites it. I decline. "Spec is law: the signed-off formalization is the case's governing text" cuts both ways: the formalization may not carry more than the text does. An unstated coupling would make every later verdict conditional on a constraint the human never signed off, and rule 4 forbids describing a GREEN as more than the signed-off formalization plus the input data. It would also be the wrong default under falsifiability: adding the invariant to the structure makes ill-typed any trip that reports a count inconsistent with its list, which removes the deny vector rather than supplying one — the rule could never be violated because no counterexample could be constructed. If the coupling is wanted, it belongs in a requirement predicate over ShoppingTrip where it can fail, not in the type where it cannot.

No new IR ops or types are needed: Nat, List, String, and record formation are existing primitives, so rule 5 is satisfied without a plan revision. The unnamed-agent reading of the intake order (bananaCount first) is preserved so that positional construction in generated Cases files matches the IR.

Binding effect: later drafts presenting a count-plus-manifest pair take this shape — flat record, declared types honoured, no cross-field invariant absent an explicit requirement.

## Law applied
- SPEC-LAW: Spec is law — the signed-off formalization is the case's governing text
- SPEC-LAW: Rulings are precedent — a modelling question answered once binds every later draft
- SPEC-LAW: The kernel is clerk, not court — benches decide semantics
- SPEC-LAW: An unfalsifiable rule is unenactable; every operative statute carries a deny and an allow vector
- CLAUDE.md rule 4: a GREEN verdict is conditional on the signed-off formalization and the input data
- CLAUDE.md rule 5: no Mathlib; no new IR ops or types without a plan revision and a ruling
- CLAUDE.md rule 5d: requirements changes go through `foundry amend` as a new revision
