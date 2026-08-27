---
citation: "[2026] VPS 20"
court: first-instance
questionKey: "model:2026-08-22-legal-engine-product-lead:predicate:meets"
caseId: 2026-08-22-legal-engine-product-lead
date: 2026-08-22
status: standing
---
## Question
What does meets mean?

## Facts
{"args":[{"args":[{"left":{"op":"field","path":"d.kind"},"op":"eq","right":{"op":"const","type":"String","value":"shipped"}},{"left":{"op":"field","path":"c.productsShipped"},"op":"ge","right":{"op":"field","path":"d.minCount"}}],"op":"and"},{"args":[{"left":{"op":"field","path":"d.kind"},"op":"eq","right":{"op":"const","type":"String","value":"specs"}},{"left":{"op":"field","path":"c.machineBuildableSpecsWritten"},"op":"ge","right":{"op":"field","path":"d.minCount"}}],"op":"and"},{"args":[{"left":{"op":"field","path":"d.kind"},"op":"eq","right":{"op":"const","type":"String","value":"cases"}},{"left":{"op":"field","path":"c.businessCasesBuilt"},"op":"ge","right":{"op":"field","path":"d.minCount"}}],"op":"and"},{"args":[{"left":{"op":"field","path":"d.kind"},"op":"eq","right":{"op":"const","type":"String","value":"artifact"}},{"item":{"op":"field","path":"d.needle"},"list":{"op":"field","path":"c.complianceArtifacts"},"op":"contains"}],"op":"and"},{"args":[{"left":{"op":"field","path":"d.kind"},"op":"eq","right":{"op":"const","type":"String","value":"stakeholders"}},{"left":{"op":"field","path":"c.seniorStakeholderRooms"},"op":"eq","right":{"op":"const","type":"Bool","value":true}}],"op":"and"},{"args":[{"left":{"op":"field","path":"d.kind"},"op":"eq","right":{"op":"const","type":"String","value":"claudecode"}},{"left":{"op":"field","path":"c.claudeCodeSpecOpinions"},"op":"eq","right":{"op":"const","type":"Bool","value":true}}],"op":"and"},{"args":[{"left":{"op":"field","path":"d.kind"},"op":"eq","right":{"op":"const","type":"String","value":"discovery"}},{"left":{"op":"field","path":"c.discoveryConversationsRun"},"op":"eq","right":{"op":"const","type":"Bool","value":true}}],"op":"and"},{"args":[{"left":{"op":"field","path":"d.kind"},"op":"eq","right":{"op":"const","type":"String","value":"synthesis"}},{"left":{"op":"field","path":"c.crossCustomerSynthesis"},"op":"eq","right":{"op":"const","type":"Bool","value":true}}],"op":"and"},{"args":[{"left":{"op":"field","path":"d.kind"},"op":"eq","right":{"op":"const","type":"String","value":"materials"}},{"left":{"op":"field","path":"c.clientMaterialsProduced"},"op":"eq","right":{"op":"const","type":"Bool","value":true}}],"op":"and"},{"args":[{"left":{"op":"field","path":"d.kind"},"op":"eq","right":{"op":"const","type":"String","value":"motivation"}},{"left":{"op":"field","path":"c.motivatedByEarlyStage"},"op":"eq","right":{"op":"const","type":"Bool","value":true}}],"op":"and"}],"op":"or"}|Duties dispatch on kind. The JD states no numeric thresholds anywhere in scope, so every Nat minimum is 1 — the weakest faithful reading (recorded as an ambiguity). Bool duties marked self-declared rest on the candidate's say-so; the JD offers no external test. The whole success section is excluded as a type error: its items are predicates over a future employment trajectory (Candidate x Company x Time), not over the applicant.

## Ruling
Adopted: the draft's recorded facts for model:predicate:meets govern.

## Reasoning
First impression. The recorded facts are traceable to verbatim prose and internally consistent; the drafter's chosen resolution is the weakest faithful reading, which is the correct default for a specification whose source states no stronger one.

## Law applied
- SPEC-LAW: spec is law
- SPEC-LAW: rulings are precedent
