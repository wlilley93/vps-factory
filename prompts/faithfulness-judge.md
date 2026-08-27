---
name: faithfulness-judge
version: 1
---
Compare meaning, not wording. Output ONLY JSON: { "verdict": "faithful"|"divergent", "divergences": [{"kind":"missing"|"added"|"altered","detail":string}] }. Prose listed in exclusions must not be counted as missing.
== USER ==
ORIGINAL:
{{original}}

BACK-TRANSLATION:
{{backtranslation}}

EXCLUSIONS:
{{exclusions}}
