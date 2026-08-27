---
citation: "[2026] VPS 8"
court: first-instance
questionKey: "model:predicate:meets"
caseId: 2026-08-22-sample-role
date: 2026-08-22
status: overturned:[2026] VPS 17
---
## Question
What does meets mean?

## Facts
{"args":[{"args":[{"left":{"op":"field","path":"d.kind"},"op":"eq","right":{"op":"const","type":"String","value":"minYears"}},{"left":{"op":"field","path":"c.yearsExp"},"op":"ge","right":{"op":"field","path":"d.minCount"}}],"op":"and"},{"args":[{"left":{"op":"field","path":"d.kind"},"op":"eq","right":{"op":"const","type":"String","value":"skill"}},{"item":{"op":"field","path":"d.needle"},"list":{"op":"field","path":"c.skills"},"op":"contains"}],"op":"and"},{"args":[{"left":{"op":"field","path":"d.kind"},"op":"eq","right":{"op":"const","type":"String","value":"launches"}},{"left":{"op":"field","path":"c.launchesLed"},"op":"ge","right":{"op":"field","path":"d.minCount"}}],"op":"and"},{"args":[{"left":{"op":"field","path":"d.kind"},"op":"eq","right":{"op":"const","type":"String","value":"cert"}},{"item":{"op":"field","path":"d.needle"},"list":{"op":"field","path":"c.certifications"},"op":"contains"}],"op":"and"}],"op":"or"}|Each duty is tagged with a kind; meets dispatches on kind. minCount is 0 where unused; needle is "" where unused.

## Ruling
The draft's recorded facts for model:predicate:meets are adopted as the governing model.

## Reasoning
First impression; the facts are internally consistent and traceable to the prose. Under SPEC-LAW, spec is law once signed off; this ruling fixes the modelling choice for future drafts.

## Law applied
- SPEC-LAW: spec is law
- SPEC-LAW: rulings are precedent
