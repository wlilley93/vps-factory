---
citation: "[2026] VPS 26"
court: first-instance
questionKey: "interpret:49e9db1e"
caseId: 2026-08-23-shopping-list
date: 2026-08-23
status: standing
---
## Question
How is 'some chocolate' interpreted?

## Facts
{"chosen":"'some' fixes no numeric threshold: presence of chocolate suffices","options":["'some' fixes no numeric threshold: presence of chocolate suffices","'some' means a specific quantity to be supplied later"]}

## Ruling
'some chocolate' is interpreted as an unquantified existential: the requirement is satisfied when at least one item on the list is chocolate, and no numeric threshold, weight, or count is read into the word 'some'. Formalize as an existential predicate over the item collection (∃ item, isChocolate item), not as a comparison against a quantity parameter. The alternative reading — that 'some' names a specific quantity to be supplied later — is rejected.

## Reasoning
Two readings were open. The rejected reading treats 'some' as a placeholder for a numeric threshold whose value arrives after sign-off. That defeats the governing principle that the signed-off formalization is the case's governing text: a predicate whose truth condition depends on a number not yet fixed is not a text that can govern anything, and a bench cannot sign off on what it has not been shown. It is also unenactable in the kernel's sense — a rule with an open parameter has neither a determinate deny vector nor a determinate allow vector until the parameter is closed, so it cannot be falsified against the input data. The chosen reading is enactable on both vectors: a list containing no chocolate item denies; a list containing at least one allows. It also matches ordinary usage — 'some chocolate' on a shopping list is a request that chocolate be present, not a request for an unstated mass. Note the scope of this ruling: it fixes the semantics of bare 'some' only. Where an intake states an explicit quantity ('two bars of chocolate', '200g of chocolate'), that quantity is part of the spec and binds; the present ruling does not license discarding it. Where a later case genuinely needs a threshold for a bare 'some', the route is `foundry amend` to a revision that states the number, not reinterpretation of this word. No prior ruling addresses this question, so nothing is departed from.

## Law applied
- SPEC-LAW: Spec is law — the signed-off formalization is the case's governing text
- SPEC-LAW: An unfalsifiable rule is unenactable; every operative statute carries a deny and an allow vector
- SPEC-LAW: The kernel is clerk, not court — it applies law mechanically; benches decide semantics
- SPEC-LAW: Rulings are precedent — a modelling question answered once binds every later draft
