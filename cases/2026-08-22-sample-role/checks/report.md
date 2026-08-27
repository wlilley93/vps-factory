# Checks report

## traceability — PASS
```json
{
  "hardFailures": [],
  "uncoveredSentences": [
    "The role owns delivery of customer-facing services end to end."
  ]
}
```

## ensemble — PASS
```json
{
  "convergence": 0.778,
  "threshold": 0.6,
  "divergent": [
    "e1/e3: field sets differ",
    "e2/e3: field sets differ"
  ]
}
```

## roundtrip — PASS
```json
{
  "backtranslation": "The role requires a candidate satisfying every one of these requirements: at least five years of experience (yearsExp); TypeScript among their skills; at least two production launches led; an AWS certification among their certifications. Nothing else is required; the ability to communicate clearly with stakeholders is deliberately not modelled.",
  "verdict": "faithful",
  "divergences": []
}
```

## known-answer — PASS
```json
{
  "mismatches": [],
  "total": 5,
  "leanDeferred": true
}
```

## adversarial — PASS
```json
{
  "confirmed": [],
  "proposed": 0
}
```
