# VPS — Vibe Proof System

A **prose→proof factory**. Feed it plain-text requirements — a job
description, a contract clause, a spec — and it drafts a formal
specification, runs it past precedent, checks it, puts it in front of a human
for sign-off, then proves with the Lean theorem prover whether a given input
satisfies every requirement. What exits is a machine-checkable verdict.

The pipeline is deliberately constitutional: the human is the only authority
that can sign a formalization off, and no verdict claims more than it proves.

## Why

A human reading a 40-line job description makes judgments ("does this CV
match?") that are fast, silent, and unreviewable. VPS makes the judgment
explicit — a back-translated formal specification, a list of what it
deliberately does *not* cover, and a proof — so the human's sign-off and the
machine's verdict can both be audited.

## Pipeline

| Stage | What happens |
|-------|--------------|
| S0 | Intake: raw requirements in, a case is created |
| S1 | Draft: LLM translates prose → structured IR, with a back-translation pass |
| S2 | Precedent: standing rulings consulted via the Vibe Justice System court interface |
| S3 | Checks: ensemble, traceability, and adversarial checks |
| S4 | **Human sign-off** — the only authority that can approve |
| S5 | Compile: IR → Lean |
| S6 | Prove: Lean type-checks; the prover proposes tactics only |
| S7 | Verdict: GREEN/RED with a conditionality section, per requirement |

Stages S0–S4 are judgment. Stages S5–S7 are mechanism. The two never mix.

## Quickstart

Requires Node ≥ 20 and Lean 4.15 (via [elan](https://github.com/leanprover/elan)).

```bash
npm install
npx tsx src/cli.ts doctor          # environment check
```

Run a case end to end. `VPS_MOCK_LLM=1` uses a deterministic canned provider;
set `--provider cli` (or `auto`) to use a live LLM through the `claude` CLI.

```bash
VPS_MOCK_LLM=1 npx tsx src/cli.ts intake <requirements.md>
VPS_MOCK_LLM=1 npx tsx src/cli.ts run <caseId>     # exits at the human gate
npx tsx src/cli.ts review <caseId> --web           # sign off in the browser
npx tsx src/cli.ts template <caseId> --name me > me.json
npx tsx src/cli.ts instance <caseId> me.json
npx tsx src/cli.ts prove <caseId> --instance me
npx tsx src/cli.ts verdict <caseId>
```

## What a verdict means

- **GREEN** — Lean has *proved* that your data satisfies every requirement in
  the signed-off formalization. Read the conditionality section anyway.
- **RED** — the report names each failing requirement, quotes the source
  sentence it came from, and shows the comparison that failed.

A GREEN verdict is conditional on the signed-off formalization and the input
data — never more than that.

## Trust

The kernel narrows what must be trusted; it does not abolish it. What is
proved mechanically — append-only history, authority chains, supersession,
entrenchment, the gate — is proved by Lean. What remains trusted is the
content of bench rulings and the human sign-off, as it must be.

## Layout

- `src/` — the pipeline (intake, draft, checks, prove, verdict), CLI, and the local review UI
- `lean/` — the Lean kernel (`Vps/`) and generated case specifications
- `cases/` — every case that has ever run, with its full history
- `record/` — append-only engineering history, one entry per change
- `VPS-PLAN.md` — the governing build plan

## Status

Working and self-testing. All build phases M0–M11 are green, the Lean kernel
builds clean, and the test suite passes. This is a personal research tool, not
a hosted product: the review UI is a single local page with exactly one write
endpoint, bound to `127.0.0.1`, and there is no way to automate sign-off.
