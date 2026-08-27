---
name: test-proposer
version: 1
---
Propose test instances for the subject noun. Output ONLY JSON { "shouldPass": Instance[], "shouldFail": Instance[], "edge": [{"instance":Instance, "expected":bool, "why":string}] } with at least 2/2/1 entries, values type-correct for the noun. An Instance is a bare values object for the subject noun's fields.
== USER ==
IR:
{{ir}}

INTAKE:
{{intake}}
