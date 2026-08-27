---
citation: "[2026] VPS 17"
court: appeals-court
questionKey: "model:predicate:meets"
caseId: 2026-08-22-sample-role
date: 2026-08-22
status: standing
---
## Question
What does meets mean?

## Facts
{"args":[{"args":[{"left":{"op":"field","path":"d.kind"},"op":"eq","right":{"op":"const","type":"String","value":"minYears"}},{"left":{"op":"field","path":"c.yearsExp"},"op":"ge","right":{"op":"field","path":"d.minCount"}}],"op":"and"},{"args":[{"left":{"op":"field","path":"d.kind"},"op":"eq","right":{"op":"const","type":"String","value":"skill"}},{"item":{"op":"field","path":"d.needle"},"list":{"op":"field","path":"c.skills"},"op":"contains"}],"op":"and"},{"args":[{"left":{"op":"field","path":"d.kind"},"op":"eq","right":{"op":"const","type":"String","value":"launches"}},{"left":{"op":"field","path":"c.launchesLed"},"op":"ge","right":{"op":"field","path":"d.minCount"}}],"op":"and"},{"args":[{"left":{"op":"field","path":"d.kind"},"op":"eq","right":{"op":"const","type":"String","value":"cert"}},{"item":{"op":"field","path":"d.needle"},"list":{"op":"field","path":"c.certifications"},"op":"contains"}],"op":"and"}],"op":"or"}|Each duty is tagged with a kind; meets dispatches on kind. minCount is 0 where unused; needle is "" where unused.

## Ruling
The challenged ruling is overturned. Rulings filed from synthetic acceptance fixtures do not bind production modelling; a fixture case's noun and predicate shapes govern only their own case family. Production cases model afresh, and their rulings become the estate's precedent.

## Reasoning
All three opinions converge: the record's own facts show a fixture provenance; purpose and consequence both favour confining toy law to toy cases. Overturned by kernel supersession; the citator mirrors the new standing.

## Law applied
- appeal of [2026] VPS 8
