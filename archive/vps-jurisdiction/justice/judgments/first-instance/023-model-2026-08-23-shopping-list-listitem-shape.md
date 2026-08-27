---
citation: "[2026] VPS 23"
court: first-instance
questionKey: "model:2026-08-23-shopping-list:listitem:shape"
caseId: 2026-08-23-shopping-list
date: 2026-08-23
status: standing
---
## Question
How is ListItem modelled?

## Facts
itemName:String,minQuantity:Nat,optional:Bool

## Ruling
ListItem is modelled as a single flat record (Lean structure) named ListItem with exactly three independent fields, in the order the intake gave them: itemName : String, minQuantity : Nat, optional : Bool. Every field is total and unconditional. itemName is a plain String with no non-emptiness, uniqueness, casing, trimming, or normalisation constraint; two ListItems are distinct data even if their names differ only by case or surrounding whitespace, and item identity is decidable String equality and nothing more. minQuantity is a plain Nat: zero is a permitted, meaningful value, there is no upper bound, and no implicit non-zero or positivity constraint is read in. optional is a plain Bool flag carried as data — it is NOT encoded by wrapping minQuantity in Option, by a subtype, by an inductive with required/optional constructors, or by a sentinel value of minQuantity. No cross-field invariant is attached to the structure: optional = true is not held to imply minQuantity = 0, optional = false is not held to imply minQuantity > 0, and no well-formedness proof field is added. Any such coupling, and any requirement that a satisfying purchase meet or exceed minQuantity for non-optional items, is a substantive requirement that must arrive as a predicate over ListItem via `foundry amend` as a new revision, never by reading it into this ruling. No new IR ops or types are introduced: String, Nat, Bool and record formation are existing primitives.

## Reasoning
The PRIOR RULINGS set supplied to this bench is empty, so this is first impression on questionKey model:...:listitem:shape and nothing is departed from. It nonetheless follows the shape reasoning already settled for the sibling entity in this case ([2026] VPS 22, ShoppingTrip): flat record, declared types honoured at face value, no unstated invariants. Three questions had to be answered.

Shape. The facts present three named, heterogeneous, simultaneously-held attributes of one entity. A record is the only faithful encoding — a sum type would assert the attributes are alternatives, and a bare tuple would discard the names the intake supplied. Field order is preserved as given so that positional construction in generated Cases files matches the IR.

Encoding of `optional`. The strong temptation is to make optionality structural: minQuantity : Option Nat, or an inductive distinguishing required from optional items, so that the illegal state is unrepresentable. I decline. The intake declares a Bool, and a Bool is the weakest faithful reading — it commits only to a two-valued flag held alongside the quantity, whereas Option or a required/optional inductive silently rules that an optional item has no minimum quantity at all. That is a semantic claim the facts do not make: an intake may perfectly well say 'if you buy milk at all, buy two, but milk is optional'. Under 'the kernel is clerk, not court', encoding a semantics the drafter did not state would be this bench legislating. Bool also keeps minQuantity's arithmetic uniform across all items, which matters for the mechanism stages: no case split is forced on every later requirement that reads a quantity.

Invariants. No coupling between optional and minQuantity is imposed, and no non-emptiness constraint is placed on itemName. 'Spec is law: the signed-off formalization is the case's governing text' cuts both ways — the formalization may not carry more than the text does. An unstated invariant would make every later verdict conditional on a constraint the human never signed off, contrary to rule 4. It is also the wrong default under falsifiability: baking 'optional → minQuantity = 0' into the structure makes ill-typed any list item that contradicts it, which removes the deny vector rather than supplying one, since no counterexample could be constructed. Every operative statute must carry both a deny and an allow vector; a constraint that lives in the type carries neither. If the coupling is wanted it belongs in a requirement predicate over ListItem, where it can fail and be measured.

minQuantity = 0 is deliberately left meaningful and distinct from optional = true. Collapsing them — treating 0 as 'not really required' — would be a semantic identification the facts do not license, and it would destroy the drafter's ability to express 'required, any amount'.

Binding effect: later drafts presenting a named line item with a quantity floor and a requiredness flag take this shape — flat record, declared types honoured, optionality carried as data not as structure, no cross-field invariant absent an explicit requirement.

## Law applied
- SPEC-LAW: Spec is law — the signed-off formalization is the case's governing text
- SPEC-LAW: Rulings are precedent — a modelling question answered once binds every later draft
- SPEC-LAW: The kernel is clerk, not court — it applies law mechanically; benches decide semantics
- SPEC-LAW: An unfalsifiable rule is unenactable; every operative statute carries a deny and an allow vector
- CLAUDE.md rule 4: a GREEN verdict is conditional on the signed-off formalization and the input data
- CLAUDE.md rule 5: no Mathlib; no new IR ops or types without a plan revision and a ruling
- CLAUDE.md rule 5d: requirements changes go through `foundry amend` as a new revision
- [2026] VPS 22 (first-instance, same case): flat record, declared types at face value, no cross-field invariant in the structure
