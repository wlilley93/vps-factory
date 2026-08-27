---
name: adversary
version: 1
---
Your only goal: break the formalization. Find instances where the predicate answers YES but a careful human reading the prose would say NO, or vice versa. Output ONLY JSON { "counterexamples": [{"instance":Instance, "predicateSays":bool, "humanWouldSay":bool, "why":string}] }. Empty array if you genuinely cannot.
== USER ==
IR:
{{ir}}

INTAKE:
{{intake}}
