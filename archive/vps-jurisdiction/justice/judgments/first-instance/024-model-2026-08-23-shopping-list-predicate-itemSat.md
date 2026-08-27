---
citation: "[2026] VPS 24"
court: first-instance
questionKey: "model:2026-08-23-shopping-list:predicate:itemSatisfied"
caseId: 2026-08-23-shopping-list
date: 2026-08-23
status: standing
---
## Question
What does itemSatisfied mean?

## Facts
{"args":[{"left":{"op":"field","path":"item.optional"},"op":"eq","right":{"op":"const","type":"Bool","value":true}},{"args":[{"item":{"op":"field","path":"item.itemName"},"list":{"op":"field","path":"trip.purchasedItems"},"op":"contains"},{"args":[{"left":{"op":"field","path":"item.itemName"},"op":"ne","right":{"op":"const","type":"String","value":"bananas"}},{"left":{"op":"field","path":"trip.bananaCount"},"op":"ge","right":{"op":"field","path":"item.minQuantity"}}],"op":"or"}],"op":"and"}],"op":"or"}|One dispatching predicate over the four list items. An optional item is satisfied vacuously. A required item must appear by name in the trip's purchased items; the bananas branch additionally requires the purchased banana count to reach the item's minimum quantity of 3. Non-banana items carry minQuantity 1, which the presence check already discharges, so the quantity branch is a no-op for them.

## Ruling
itemSatisfied is a per-item dispatching predicate over the pair (item, trip): a shopping-list item is satisfied if and only if either (a) the item is marked optional, in which case it is satisfied vacuously and no purchase is required of it, or (b) the item's itemName appears in trip.purchasedItems AND the quantity guard holds, where the quantity guard is the disjunction (item.itemName != "bananas") OR (trip.bananaCount >= item.minQuantity). The quantity guard therefore binds only the bananas item, for which the purchased banana count must reach that item's minQuantity; for every non-banana item the guard's left disjunct discharges it and presence by name is the whole test. itemSatisfied is a statement about one item against one trip only; it carries no aggregation over the list and no ordering, and it says nothing about items purchased but not listed.

## Reasoning
The formalization is the governing text, so the meaning of itemSatisfied is read off the IR structure, not off the prose gloss. The top-level 'or' makes optionality a genuine short-circuit: an optional item is satisfied whatever the trip contains, which is the correct reading of 'optional' as a waiver of the requirement rather than a relaxation of it. The second disjunct is an 'and' of a presence check and a quantity check, so a required item must clear both; the presence check is by name against trip.purchasedItems, i.e. membership, not count. The quantity check is itself a disjunction guarded on name inequality, which is the IR's idiom for a conditional obligation: it is a no-op precisely when the item is not bananas. This is a name-keyed guard, not a general quantity rule — the predicate as written enforces a minimum only through trip.bananaCount, and there is no per-item purchased-count field it could consult for anything else. I record, without departing from the model, that the prose gloss's claim that the quantity branch is 'a no-op for them' is true of the current input data (non-banana items carry minQuantity 1, which presence discharges) but is a property of the data, not of the formalization: were a later revision to raise a non-banana item's minQuantity above 1, this predicate would silently ignore it. That is a contingency of the requirement data, and any GREEN verdict on this case is conditional on it. It is not a defect in itemSatisfied's semantics as ruled here, and correcting it would be a requirements amendment, not a reinterpretation. No prior rulings were tendered on this question, so nothing is departed from.

## Law applied
- SPEC-LAW: Spec is law — the signed-off formalization is the case's governing text.
- SPEC-LAW: Rulings are precedent — a modelling question answered once binds every later draft.
- SPEC-LAW: The kernel is clerk, not court — it applies law mechanically; benches decide semantics.
