---
citation: "[2026] VPS 27"
court: first-instance
questionKey: "interpret:4cb0b250"
caseId: 2026-08-23-shopping-list
date: 2026-08-23
status: standing
---
## Question
How is 'ice' interpreted?

## Facts
{"chosen":"'ice' is a single list item named 'ice'","options":["'ice' is a single list item named 'ice'","'ice' is short for 'ice cream' and is a different item"]}

## Ruling
'ice' is a single list item named 'ice'. The token is read at face value: it denotes one item whose name is exactly the string as written in the intake, and it is not expanded, abbreviated, or resolved into any other product ('ice cream' or otherwise). Any later draft encountering a bare, unqualified item token on a shopping list must formalize it as one ListItem with that literal name, unless the intake itself supplies the expansion.

## Reasoning
The signed-off formalization is the case's governing text, so the question is what the intake says, not what a shopper might plausibly have meant. The intake carries the four characters 'ice' and nothing else — no context, qualifier, or cross-reference that would license reading it as a contraction of 'ice cream'. The competing option requires the bench to supply a fact the record does not contain, and to do so on the strength of a colloquial abbreviation that is regional, ambiguous, and defeasible; that is the court legislating content into the spec rather than construing it. The literal reading is also the falsifiable one: it can be checked against the intake string directly, whereas 'is short for ice cream' cannot be denied or allowed by any vector the kernel can apply, and an unfalsifiable construction is unenactable. Choosing the literal reading keeps the kernel in its clerk role — matching the item name mechanically — instead of requiring it to carry a table of shopping-list idioms it has no authority to author. The cost of being wrong is also asymmetric and cheap to cure: if the requester did mean ice cream, the correct remedy is a new revision through `foundry amend` naming the item properly, which leaves the prior verdict a true statement about its own revision. This is a first-instance holding on the question; no prior ruling is departed from.

## Law applied
- SPEC-LAW: Spec is law — the signed-off formalization is the case's governing text.
- SPEC-LAW: The kernel is clerk, not court — it applies law mechanically; benches decide semantics.
- SPEC-LAW: An unfalsifiable rule is unenactable; every operative statute carries a deny and an allow vector.
- SPEC-LAW: Rulings are precedent — a modelling question answered once binds every later draft.
