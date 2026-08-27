# Deferred Lean verification ledger

**Discharged 2026-08-23. This ledger is empty.**

Every entry queued on 2026-08-22 — 16 `lake build Vps` enactments ([2026] VPS 6–21), 9
per-case `lake env lean --json` checks, and 3 gate evaluations — has been executed against
Lean 4.15.0 (arm64-apple-darwin23.6.0, commit 11651562caae), the pinned toolchain. See
`record/0018.md` for what ran, what it found, and the two defects it exposed.

Protocol 5b is satisfied for everything listed here: no artefact in this repository now
claims verification it has not received. The runner re-opens this file automatically if
Lean ever becomes unreachable again; a non-empty ledger means DEFERRED verdicts are being
issued and must be read as expected, not machine-checked.
- [ ] gate eval via Lean for facts {"pathsChanged":["README.md"],"recordsAdded":0}
