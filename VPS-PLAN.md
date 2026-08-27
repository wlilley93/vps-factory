# VPS — Implementation Plan v2.1

*(v2.1 errata, 2026-08-22: §11.1 rewritten — the upstream VJS fetch paths no longer exist on any branch; commentary is authored locally, optional fetches point at the `v1` branch paths that do exist. No other section changed. The kernel package and §21 are unchanged.)*

**A prose→proof factory, constitutionally governed.** Raw requirements (a JD, a spec, a change request) enter; a machine-checkable verdict exits. LLMs draft, a battery of checks gathers evidence of faithfulness, a human signs off in a purpose-built review UI, Lean 4 delivers the only unconditional part — the proof — and the whole apparatus is governed by the **VPS constitutional kernel**: a verified Lean statute book whose legitimacy is itself a compile-time theorem.

**This document is a build order.** It is written to be executed in one session by a Claude agent (Claude Code) on the owner's machine (macOS, Apple Silicon), starting from the zip this plan ships in. Every architectural decision is already made. The builder implements to spec, verifies each phase's acceptance test, and stops when Phase M11 passes.

**The operator's end-state (what all of this is for):** after the build, the owner will (1) feed VPS a real job description, (2) sign off the formalization in the web review UI, (3) feed their CV in as the instance, and (4) receive a machine-checked verdict that names, with quoted source sentences, exactly which requirements hold and which don't. §22 is the literal command walkthrough for that flow — the builder should treat it as the definition of done.

## Document map

| Part | Chapters | Contents |
|---|---|---|
| I — Mission & protocol | §0 | One-shot builder rules |
| II — Foundations | §1–§5 | Overview, environment, layout, config, case families |
| III — Representation & generation | §6–§7 | The IR, the Lean subsystem & codegen |
| IV — Intelligence | §8–§9 | LLM/prover providers, prompt templates |
| V — The pipeline | §10–§14 | Stages S0–S7, precedent, checks, sign-off, verdicts |
| VI — Interfaces | §15, §15.5 | CLI, the sign-off web UI |
| VII — The constitutional kernel | §21 | VPS: verified statute book, enactment, the meta-gate |
| VIII — Fixtures, phases & operation | §16, §17, §22 | Bundled fixtures, build phases M0–M11, the operator walkthrough |
| IX — Law of the build | §18–§20 | Guardrails, risks, roadmap |

Section numbers (§) are the stable cross-reference system and are deliberately not renumbered by the part structure.

---

# PART I — MISSION & PROTOCOL

## §0 — Builder protocol (read first)

1. Build phases **M0 → M11 in order** (§17). Do not skip ahead. Each milestone ends with an acceptance test; run it and confirm it passes before continuing. `git commit` after each milestone with message `M<n>: <name>`. **M7 is the ship line** — a working factory. M8 (the DeepSeek-Prover rung), M9 (the sign-off web UI), M10 (families & amendments), and M11 (the constitutional kernel) are additive and must not destabilise it: if any cannot be completed, M7's acceptance tests must still pass unchanged, and the CLI sign-off path must remain fully functional regardless of M9's fate. (Order note: M10 touches `state.ts` and the UI; M11 rewires the precedent store's numbering and the lakefile — they land last deliberately, in that order.)
2. Where this plan gives **verbatim file contents**, use them exactly. Where it gives **behavioural specs** (TypeScript modules), implement to the spec; you choose internal details.
3. **Do-nots** (§18) are hard constraints. Re-read them before writing any code.
4. If an external step fails (elan download, VJS fetch), apply the named fallback in §19 and continue. Never silently skip a stage.
5. All LLM-dependent tests run with `VPS_MOCK_LLM=1` against bundled fixtures (§16), so the end-to-end test is deterministic and free. Live-LLM smoke test is the final, optional step of M7. Kernel tests (M11) need no LLM at all.
5b. **Unbuilt Lean is prose.** Every Lean artefact — vendored kernel, generated case file, generated statute book, fixture — is compiled as part of the phase that introduces it, before that phase is called done. No exceptions; a Lean file that has never passed `lean` has verified nothing. (This rule exists because the kernel this plan vendors was received with three compile errors nobody had hit, precisely because it had never been built.)
5c. **The zip is the source of truth for the kernel.** The nine files under `kernel/Vps/` in this package are verified against the pinned toolchain (`kernel/PROVENANCE.md` records how). Copy them; never retype or "improve" them. Changing constitutional text is an Article 10 amendment — a human decision, outside this build.
6. Target machine: macOS (M4 Pro), zsh, Node ≥ 20, git, network access. `claude` CLI is likely present; handle its absence (§8).

---

# PART II — FOUNDATIONS

## §1 — System overview

### 1.1 The eight stages

```
  ┌────────────────────────────────────────────── JUDGMENT HALF ──────────────────────────────────────────────┐
  │                                                                                                            │
  │  S0 INTAKE      S1 DRAFT (LLM)      S2 PRECEDENT (VJS)      S3 CHECKS (evidence)      S4 SIGN-OFF (human)  │
  │  prose in   →   IR proposed     →   consistent w/ record →  traceability, round-trip, →  approved &        │
  │                                                             tests, ensemble, adversary   recorded as ruling│
  └───────────────────────────────────────────────────┬────────────────────────────────────────────────────────┘
                                                      │  (gate: exit code 2 until human approves)
  ┌───────────────────────────────────────────────────▼──────────── MECHANICAL HALF ──────────────────────────┐
  │                                                                                                            │
  │  S5 COMPILE (Lean type-check)   S6 PROVE (decide → native_decide → LLM repair loop)   S7 VERDICT           │
  │  IR → generated .lean       →   theorem attempt against real instance             →   GREEN (proved) or    │
  │                                                                                       RED (named failure)  │
  └────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

Failure feedback: S7-RED and S6 failures route back to S1 (redraft) or S4 (re-review) with the exact Lean diagnostic attached. S3 failures route back to S1.

### 1.2 The two kinds of correctness (design invariant)

- **S0–S4** deal in *judgment*. No compiler can validate them. Their tools are drafts, precedent, evidence, and a human. Outputs here are **recorded decisions**, never guarantees.
- **S5–S7** deal in *mechanism*. Lean either accepts or refuses. Outputs here are **guarantees — conditional on S0–S4**.
- Every GREEN verdict must therefore carry the conditionality clause verbatim (§14). The system must never claim more than it has.

### 1.3 Key architectural decisions (already made — do not revisit)

| Decision | Choice | Why |
|---|---|---|
| Pipeline language | TypeScript (Node ≥ 20, ESM) | Owner's estate is JS/TS; VJS is JS |
| Formal layer | Lean 4, **core only — no Mathlib** | Mathlib = 1hr+ first build; core `decide`/`native_decide` covers v1 |
| LLM never writes raw Lean in S1 | LLM emits a JSON **IR**; deterministic TS codegen emits Lean | Constrained IR → template output compiles predictably; freeform LLM Lean does not |
| Predicates are `Bool`-valued | `Prop` defined as `predB … = true` | Collapses S6 to `decide`/`native_decide` in the common case |
| Storage | Files in git, no database | Auditable, diffable, VJS-native |
| Precedent | VJS-compatible `.justice/` layout behind a `PrecedentStore` interface | Keeps the function, holds the implementation loosely; fixes VJS's manual citation numbering |
| LLM access | Provider interface: `claude` CLI (default if present) or Anthropic API | CLI rides the owner's existing Claude Code auth |
| Proof search | Separate `ProofProvider` (DeepSeek-Prover), **off by default**, rung 4 of the S6 ladder | v1 goals are decidable — search is scaffolding for v2's general theorems (§20) |
| UI | One local page for S4 sign-off only (`review --web`); everything else stays CLI + git | S4 is the only stage that is a human judgment; a UI there hardens the gate — anywhere else it's decoration or overstatement (§15.5.1) |
| Governance | The VPS constitutional kernel (owner-authored, compile-verified) is S2's substrate and the repo's meta-gate (§21) | Precedent mechanics — append-only book, citations, rank, entrenchment, denial-naming — become theorems instead of conventions; the LLM bench's judgment stays outside the kernel by design (Art. 8) |
| Case Lean file | ONE file per case, fully re-derived from IR (pure function) | No cross-file import headaches; regeneration is idempotent |

---

## §2 — Prerequisites & environment setup

The builder performs these in M0 via `scripts/doctor.sh` (write it) and manual commands:

```bash
# 1. Node ≥ 20
node --version                          # expect v20+ ; else stop and report

# 2. elan + Lean 4 — pinned to the kernel's verified toolchain
curl https://raw.githubusercontent.com/leanprover/elan/master/elan-init.sh -sSf | sh -s -- -y
source "$HOME/.elan/env"
elan toolchain install leanprover/lean4:v4.15.0     # the version kernel/PROVENANCE.md verifies against
lean --version
# lean/lean-toolchain is copied verbatim from kernel/lean-toolchain (v4.15.0).
# Upgrading the toolchain later is allowed ONLY together with re-running the full
# kernel verification suite (M11 acceptance) on the new version — never alone.

# 3. LLM access probe
command -v claude && echo "CLI provider available"
[ -n "$ANTHROPIC_API_KEY" ] && echo "API provider available"
# At least one must be available for live mode; mock mode needs neither.

# 4. git
git --version
```

`scripts/doctor.sh` prints a PASS/FAIL table for the four checks and exits non-zero on any FAIL. The first `lake build` downloads/compiles the toolchain artefacts; allow several minutes once.

---

## §3 — Repository layout

Create the repo at `~/Projects/vps-factory` (or the cwd Claude Code was launched in):

```
vps-factory/
├── CLAUDE.md                      # agent guardrails for future sessions (§18.2 — verbatim)
├── VPS-PLAN.md                # this document, committed for reference
├── README.md                      # short usage doc, written at M7
├── package.json                   # ESM, bin: {"vps": "dist/cli.js"}
├── tsconfig.json                  # strict, NodeNext
├── vps.config.json            # §4
├── scripts/doctor.sh
├── src/
│   ├── cli.ts                     # commander-based CLI (§15)
│   ├── state.ts                   # case state machine (§5)
│   ├── ir/
│   │   ├── schema.ts              # zod schemas for IR (§6)
│   │   └── validate.ts            # parse + semantic validation (§6.5)
│   ├── codegen/
│   │   └── lean.ts                # renderCaseLean(ir, instance, opts) (§7.4)
│   ├── lean/
│   │   ├── runner.ts              # lake/lean invocation + JSON diagnostics (§7.5)
│   │   └── diagnose.ts            # per-duty failure analysis (§7.6)
│   ├── llm/
│   │   ├── provider.ts            # interface + factory (§8)
│   │   ├── claudeCli.ts
│   │   ├── anthropicApi.ts
│   │   ├── mock.ts
│   │   ├── proofProvider.ts       # DeepSeek-Prover backends (§8.6)
│   │   └── json.ts                # extract/repair JSON from model output (§8.4)
│   ├── precedent/
│   │   ├── store.ts               # PrecedentStore over .justice/ (§11)
│   │   ├── questions.ts           # question extraction + normalisation (§11.3)
│   │   └── court.ts               # first-instance judge, appeal panel (§11.5)
│   ├── checks/
│   │   ├── traceability.ts        # deterministic (§12.1)
│   │   ├── roundtrip.ts           # LLM back-translation + judge (§12.2)
│   │   ├── knownAnswer.ts         # #eval test battery (§12.3)
│   │   ├── ensemble.ts            # K independent drafts, structural diff (§12.4)
│   │   ├── adversarial.ts         # red-team counterexamples (§12.5)
│   │   └── report.ts              # checks/report.md + summary.json
│   ├── ui/
│   │   ├── server.ts              # local-only review server (§15.5.2)
│   │   └── review.html            # single-file sign-off page (§15.5.3)
│   ├── kernel/
│   │   ├── book.ts                # book.json ledger, renderBook/renderExamples codegen (§21.3)
│   │   ├── enact.ts               # enactment protocol: regen → build → keep/rollback (§21.5)
│   │   └── gate.ts                # Facts extraction + gate evaluation + pre-commit (§21.7)
│   └── pipeline/
│       ├── s0_intake.ts … s7_verdict.ts
│       └── run.ts                 # orchestrator with sign-off gate
├── prompts/                       # all prompt templates, versioned (§9)
│   ├── drafter.md
│   ├── backtranslate.md
│   ├── faithfulness-judge.md
│   ├── test-proposer.md
│   ├── adversary.md
│   ├── judge-first-instance.md
│   ├── judge-appeal.md
│   ├── prover.md                  # DeepSeek-Prover completion prompt (§8.6)
│   └── proof-repair.md
├── lean/
│   ├── lean-toolchain             # v4.15.0, copied from kernel/lean-toolchain (§2)
│   ├── lakefile.toml              # §7.2 verbatim (Spec + Vps libs)
│   ├── Spec/
│   │   ├── Core.lean              # §7.3 verbatim
│   │   └── Cases/                 # generated, one file per case
│   └── Vps/                       # the constitutional kernel (§21) — vendored at M11
│       ├── World.lean Instrument.lean Genesis.lean        # constitutional text (Art. 10)
│       ├── Legitimacy.lean Gate.lean Precedent.lean Proofs.lean
│       ├── Book.lean              # GENERATED from .justice/book.json (§21.3)
│       └── Examples.lean          # GENERATED example vectors (Art. 8) (§21.3)
├── gate/
│   └── pre-commit                 # installed hook; edits to gate/ are constitutionally denied (§21.7)
├── record/                        # record entries; recordRequired rules count additions here
├── law/
│   └── genesis.md                 # the sovereign genesis text; sha256 pinned into Genesis.lean (§21.8)
├── .justice/                      # precedent record (§11) on the kernel substrate (§21.6)
│   ├── SPEC-LAW.md  VPR.md  INDEX.md          # commentary + citator (memo table)
│   ├── book.json                  # THE statute-book ledger; Book.lean is generated from this (§21.3)
│   ├── suites/
│   └── judgments/{first-instance,appeals-court,supreme-court}/
├── cases/                         # one directory per case (§5.2)
└── fixtures/                      # §16: sample docs + recorded LLM outputs
    ├── intake/sample-role.md
    ├── instances/will.json  casey.json
    ├── ir/sample-role.expected.json
    └── llm/…                      # per (prompt, case) recorded responses
```

Dependencies (keep minimal): `commander`, `zod`, `@anthropic-ai/sdk`, `execa`. Dev: `typescript`, `tsx`, `vitest`.

---

## §4 — Configuration

`vps.config.json` (created by `vps init`, all fields required):

```json
{
  "provider": "auto",              // "auto" | "cli" | "api" | "mock"
  "model": "claude-sonnet-4-6",    // used by the API provider; CLI uses its own session model
  "ensembleK": 3,                   // independent drafts in S3 ensemble check
  "maxJsonRepairs": 3,              // re-asks when model output isn't valid JSON
  "maxProofRepairs": 5,             // LLM proof-repair iterations in S6
  "roundtripThreshold": "faithful", // judge must return verdict "faithful" to pass
  "ensembleThreshold": 0.6,         // §12.4 convergence score minimum
  "leanTimeoutMs": 120000,
  "citationCourtCode": "VPS",      // citations are [year] VPS ordinal, allocated by the kernel book (§21.6)
  "prover": {
    "enabled": false,              // v1 default: OFF. The decide-ladder handles v1 goals.
    "backend": "ollama",           // "ollama" | "openai-compatible" | "deepseek-api" | "mock"
    "model": "deepseek-prover-v2:7b",
    "endpoint": "http://localhost:11434",
    "attempts": 8,                 // sampled candidate proofs per goal (best-of-n)
    "temperature": 1.0,            // sampling diversity matters more than precision here
    "timeoutMsPerAttempt": 120000,
    "maxTokens": 2048
  }
}
```

Environment: `VPS_MOCK_LLM=1` forces the mock provider; `VPS_PROVIDER` overrides `provider`; `ANTHROPIC_API_KEY` enables the API provider. `provider:"auto"` = CLI if `claude` binary found, else API if key present, else error 5 (§15.3).

---

## §5 — Case model & state machine

### 5.1 States

```
intake → drafted → precedent-checked → checks-passed → signed-off → compiled → proved → verdict-green
                                     ↘ checks-failed                        ↘ proof-failed → verdict-red
                                                     ↘ rejected (back to drafted with notes)
```

Stored in `cases/<caseId>/state.json`:
`{ "caseId", "familyId", "revision", "supersedes", "supersededBy", "status", "history": [{ "status", "at", "by", "note" }] }` (family fields per §5.3; for a base case `familyId === caseId`, `revision = 1`, `supersedes = null`).
Transitions only via `src/state.ts::advance(caseId, to, meta)`, which validates legality against the diagram above and appends to history. Illegal transition ⇒ throw.

### 5.2 Case directory

`caseId` = `YYYY-MM-DD-<slug>` (slug from intake filename, kebab-case). Layout:

```
cases/2026-08-22-sample-role/
├── state.json
├── intake.md                  # verbatim copy of the source prose (S0)
├── amend.context.json         # revisions only: previousCase, previousIrSha, proseDiff (§5.3)
├── draft.ir.json              # current IR (S1, possibly redrafted)
├── draft.history/             # prior IRs, timestamped
├── precedent.report.json      # rulings applied / filed (S2)
├── checks/
│   ├── traceability.json  roundtrip.json  known-answer.json
│   ├── ensemble.json  adversarial.json
│   ├── summary.json           # {passed: bool, failures: [...]}
│   └── report.md              # human-readable digest for the sign-off bundle
├── signoff.json               # {approved, by, at, notes, rulingCitation}
├── instances/<name>.json      # real-world data (CVs, system states)
├── lean.snapshot.lean         # copy of the generated case file at last S5/S6 run
├── proof.result.json          # tactic used, iterations, diagnostics
└── verdict.md                 # S7 output (§14)
```

---

### 5.3 Case families & revisions (the amendment model)

Requirements change. An updated JD, a new batch of duties on an existing spec, a reworded clause — all are **revisions**, and a revision is always a **new linked case**, never a mutation of an old one. `intake.md` stays byte-immutable forever (offsets, hashes, and the chain of custody depend on it); history is append-only.

- **Family** = a base case plus its revisions. `familyId` = the base `caseId`; revision cases are `"<familyId>-r<n>"` (base is implicitly r1). `state.json` gains: `familyId`, `revision: n`, `supersedes: caseId|null`, `supersededBy: caseId|null` (set on the predecessor when a successor is *signed off*, not merely created — a draft revision supersedes nothing).
- **Created by** `vps amend <case> <new-intake-file>` (§10 S0). Copies nothing but links: the new case gets its own fresh `intake.md`, and `amend.context.json` recording `{ previousCase, previousIrSha, proseDiff }` where `proseDiff` is a word-level diff (LCS over whitespace-split tokens — implement in `src/diff.ts`, no dependency) between the two intakes.
- **Instances are family-scoped.** `vps instance` registers into the case as before, but `reprove` (§10 S6b) sweeps every instance ever registered anywhere in the family — instance JSONs are copied forward into the new revision's `instances/` at amend time so each case dir remains self-contained.
- **Verdicts are revision-scoped and permanent.** A GREEN under r1 remains a true statement *about r1* forever; it says nothing about r2. The family's *current* status is the latest signed-off revision's verdicts. Verdict headers carry `revision` and, where superseded, a pointer to the successor (§14).
- **Precedent is family-neutral.** Rulings live in `.justice/` and apply across the whole estate, which is exactly what makes revision drafts cheap (§10 S1) and keeps sibling families (new product ideas) consistent with each other. A revision that needs to *depart* from a standing ruling goes through `vps appeal` like anyone else — amendments get no special licence to re-litigate settled modelling law.
- **Two shapes of "new input", one rule:** changes to an existing spec ⇒ `amend` (same family). A genuinely new spec or product idea ⇒ `vps intake` (new family), which still inherits the entire precedent record — the per-input cost of formalization falls as settled law accumulates.

# PART III — REPRESENTATION & GENERATION

## §6 — The IR (Formalization Interchange Representation)

The IR is the contract between the judgment half and the mechanical half. LLMs produce it; humans review it; codegen consumes it.

**Type system (v2, 2026-08-23 — [2026] VPS 28):** `Nat`, `Int`, `Bool`, `String`, `List String`, `List Nat`, plus an optional `unit` on numeric fields (`plain` | `date` | `scaled(n)`) and a `between` operator that desugars to `and(ge, le)`. Dates are Nat days since 1970-01-01; fixed-point quantities are integers in 10^-n units. No `Rat`, no `Float`, no `Std.Time`, no arithmetic operators — the reasons are in the ruling, and the short version is that the expressive win comes from the type checker refusing cross-unit comparisons, not from new runtime primitives, so codegen stays inside core Lean and the TS mirror needs no new arms. Comparisons require matching units; integers are bounded by 2^53-1 so the mirror cannot silently diverge from the kernel.

### 6.1 Top-level shape (zod, in `src/ir/schema.ts`)

```ts
SourceSpan = { quote: string,           // VERBATIM substring of intake.md
               start: number, end: number }   // char offsets into intake.md

Field      = { name: Ident, type: "Nat"|"Bool"|"String"|"ListString"|"ListNat",
               source: SourceSpan }

Noun       = { name: PascalIdent,       // e.g. "Candidate", "Duty"
               role: "subject"|"requirementItem",
               fields: Field[], source: SourceSpan }

Predicate  = { name: Ident,             // e.g. "meets"
               params: { name: Ident, noun: PascalIdent }[],   // exactly 2 in v1: subject, requirementItem
               body: Expr,              // §6.2
               source: SourceSpan,
               interpretationNotes: string }   // the judgement call, in prose

Requirement= { name: Ident,             // e.g. "satisfiesRole"
               quantifier: "allOf",     // v1: only allOf
               subjectNoun: PascalIdent,
               itemsNoun: PascalIdent,
               itemsData: { name: Ident, values: object[] },  // the requirement instances
                                        // extracted FROM THE PROSE (the duties themselves)
               predicate: Ident }

Ambiguity  = { sourceText: string, options: string[], chosen: string, rationale: string }
Exclusion  = { sourceText: string, reason: string }   // prose deemed unmodelable in v1

IR = { caseId, sourceDoc,
       nouns: Noun[], predicates: Predicate[], requirement: Requirement,
       ambiguities: Ambiguity[], exclusions: Exclusion[] }
```

`Ident` = `/^[a-z][A-Za-z0-9]*$/`; `PascalIdent` = `/^[A-Z][A-Za-z0-9]*$/`. Reject Lean reserved words (`Type`, `Prop`, `Sort`, `theorem`, `def`, `structure`, `instance`, `class`, …) as identifiers.

### 6.2 Expression AST (`Expr`)

```
Expr := { op: "const",    type: "Nat"|"Bool"|"String", value: number|boolean|string }
      | { op: "field",    path: string }                  // "c.yearsExp" — param.field only, 1 level
      | { op: "ge"|"gt"|"le"|"lt", left: Expr, right: Expr }   // Nat × Nat → Bool
      | { op: "eq"|"ne",  left: Expr, right: Expr }            // same-type (Nat|String|Bool) → Bool
      | { op: "and"|"or", args: Expr[] }                       // ≥2 args, Bool
      | { op: "not",      arg: Expr }                          // Bool
      | { op: "contains", list: Expr, item: Expr }             // ListString ∋ String | ListNat ∋ Nat
```

No nested quantifiers inside predicate bodies in v1: the only quantification is the requirement's top-level `allOf` over `itemsData`.

### 6.3 Instance files

`cases/<id>/instances/<name>.json`:
`{ "noun": "Candidate", "values": { "name": "...", "yearsExp": 6, "skills": ["TypeScript","Lean"] } }` — must type-check against the noun's fields (validated in `validate.ts`).

### 6.4 Worked example (matches the bundled fixture, §16)

```json
{
  "caseId": "2026-08-22-sample-role",
  "sourceDoc": "intake.md",
  "nouns": [
    { "name": "Candidate", "role": "subject",
      "fields": [
        { "name": "yearsExp", "type": "Nat", "source": { "quote": "at least five years of professional software experience", "start": 142, "end": 196 } },
        { "name": "skills", "type": "ListString", "source": { "quote": "TypeScript is essential", "start": 231, "end": 254 } },
        { "name": "launchesLed", "type": "Nat", "source": { "quote": "led at least two production launches", "start": 288, "end": 324 } },
        { "name": "certifications", "type": "ListString", "source": { "quote": "holds a current AWS certification", "start": 356, "end": 389 } } ],
      "source": { "quote": "We are hiring a Senior Software Engineer", "start": 0, "end": 40 } },
    { "name": "Duty", "role": "requirementItem",
      "fields": [
        { "name": "label", "type": "String", "source": { "quote": "Requirements", "start": 120, "end": 132 } },
        { "name": "kind", "type": "String", "source": { "quote": "Requirements", "start": 120, "end": 132 } },
        { "name": "minCount", "type": "Nat", "source": { "quote": "at least", "start": 142, "end": 150 } },
        { "name": "needle", "type": "String", "source": { "quote": "TypeScript", "start": 231, "end": 241 } } ],
      "source": { "quote": "Requirements", "start": 120, "end": 132 } }
  ],
  "predicates": [ { "name": "meets", "params": [ { "name": "c", "noun": "Candidate" }, { "name": "d", "noun": "Duty" } ],
      "body": { "op": "or", "args": [
        { "op": "and", "args": [ { "op": "eq", "left": {"op":"field","path":"d.kind"}, "right": {"op":"const","type":"String","value":"minYears"} },
                                  { "op": "ge", "left": {"op":"field","path":"c.yearsExp"}, "right": {"op":"field","path":"d.minCount"} } ] },
        { "op": "and", "args": [ { "op": "eq", "left": {"op":"field","path":"d.kind"}, "right": {"op":"const","type":"String","value":"skill"} },
                                  { "op": "contains", "list": {"op":"field","path":"c.skills"}, "item": {"op":"field","path":"d.needle"} } ] },
        { "op": "and", "args": [ { "op": "eq", "left": {"op":"field","path":"d.kind"}, "right": {"op":"const","type":"String","value":"launches"} },
                                  { "op": "ge", "left": {"op":"field","path":"c.launchesLed"}, "right": {"op":"field","path":"d.minCount"} } ] },
        { "op": "and", "args": [ { "op": "eq", "left": {"op":"field","path":"d.kind"}, "right": {"op":"const","type":"String","value":"cert"} },
                                  { "op": "contains", "list": {"op":"field","path":"c.certifications"}, "item": {"op":"field","path":"d.needle"} } ] } ] },
      "source": { "quote": "Requirements", "start": 120, "end": 132 },
      "interpretationNotes": "Each duty is tagged with a kind; meets dispatches on kind. minCount is 0 where unused; needle is \"\" where unused." } ],
  "requirement": { "name": "satisfiesRole", "quantifier": "allOf",
    "subjectNoun": "Candidate", "itemsNoun": "Duty", "predicate": "meets",
    "itemsData": { "name": "jdDuties", "values": [
      { "label": "5+ years experience", "kind": "minYears", "minCount": 5, "needle": "" },
      { "label": "TypeScript essential", "kind": "skill",    "minCount": 0, "needle": "TypeScript" },
      { "label": "Led 2+ launches",      "kind": "launches", "minCount": 2, "needle": "" },
      { "label": "AWS certification",    "kind": "cert",     "minCount": 0, "needle": "AWS" } ] } },
  "ambiguities": [ { "sourceText": "communicates clearly with stakeholders",
      "options": ["model as declared skill membership", "exclude as unmeasurable in v1"],
      "chosen": "exclude as unmeasurable in v1",
      "rationale": "No objective datum in a CV decides this; modelling it as a self-declared skill would launder vagueness into false precision." } ],
  "exclusions": [ { "sourceText": "communicates clearly with stakeholders", "reason": "unmeasurable in v1 type system; surfaced for human decision at sign-off" } ]
}
```

*(The exact `start`/`end` offsets in the fixture must match the bundled `intake/sample-role.md`; the builder computes them when writing the fixture.)*

### 6.5 Semantic validation (`validate.ts`) — beyond zod

1. Every `field.path` resolves to a declared param + field; expression type-checks bottom-up against §6.2's typing rules.
2. Every `SourceSpan.quote` is found **verbatim** at `[start,end)` in `intake.md` (single source of truth for traceability).
3. `requirement.itemsData.values[*]` type-check against the items noun.
4. Identifier hygiene (§6.1) and uniqueness.
Errors are collected (not fail-fast) and returned as `{path, message}[]` — these are fed back to the drafter on redraft.

---

## §7 — Lean subsystem

### 7.1 Toolchain

Pinned in `lean/lean-toolchain` (exact version resolved in M0). All Lean commands run from `lean/` with `lake env`.

### 7.2 `lean/lakefile.toml` (verbatim)

```toml
name = "vps"
version = "0.1.0"
defaultTargets = ["Spec", "Vps"]

[[lean_lib]]
name = "Spec"

[[lean_lib]]
name = "Vps"
```

*(At M1, before the kernel is vendored, create the file with only the `Spec` lib and `defaultTargets = ["Spec"]`; M11 adds the `Vps` stanza when it vendors `lean/Vps/`.)*

### 7.3 `lean/Spec/Core.lean` (verbatim)

```lean
/-! Spec core. Shared marker + sanity theorem used by M1's acceptance test. -/
namespace Spec
def version : String := "0.1.0"
theorem sanity : 2 + 2 = 4 := by decide
end Spec
```

### 7.4 Codegen — `renderCaseLean(ir, instances, opts): string`

Pure function; the case file is always **fully regenerated**, never edited in place. `opts = { diagnostics: bool, theoremTactic: string | null, instanceName: string | null }`. Output file: `lean/Spec/Cases/<ModuleName>.lean`, where `ModuleName` = PascalCase(slug) + year (strip leading digits; e.g. `SampleRole2026`). Template:

```lean
import Spec.Core
namespace Spec.Cases.<ModuleName>

-- §nouns: one structure per noun, in dependency order
structure Candidate where
  name : String
  yearsExp : Nat
  skills : List String
  launchesLed : Nat
  certifications : List String
deriving Repr, DecidableEq

structure Duty where
  label : String
  kind : String
  minCount : Nat
  needle : String
deriving Repr, DecidableEq

-- §predicates: Bool-valued; comparisons compile to `decide (…)`
def meetsB (c : Candidate) (d : Duty) : Bool :=
  (decide (d.kind = "minYears") && decide (c.yearsExp ≥ d.minCount)) ||
  (decide (d.kind = "skill")    && c.skills.contains d.needle)      ||
  (decide (d.kind = "launches") && decide (c.launchesLed ≥ d.minCount)) ||
  (decide (d.kind = "cert")     && c.certifications.contains d.needle)

-- §requirement data (from IR.itemsData)
def jdDuties : List Duty := [
  { label := "5+ years experience", kind := "minYears", minCount := 5, needle := "" },
  { label := "TypeScript essential", kind := "skill", minCount := 0, needle := "TypeScript" },
  { label := "Led 2+ launches", kind := "launches", minCount := 2, needle := "" },
  { label := "AWS certification", kind := "cert", minCount := 0, needle := "AWS" } ]

-- §requirement predicate (Bool + Prop views)
def satisfiesRoleB (c : Candidate) : Bool := jdDuties.all (meetsB c)
def satisfiesRole  (c : Candidate) : Prop := satisfiesRoleB c = true

-- §instance (only when opts.instanceName set)
def will : Candidate := { name := "Will", yearsExp := 6,
  skills := ["TypeScript","Lean"], launchesLed := 3, certifications := ["AWS"] }

-- §theorem (only when opts.theoremTactic set)
theorem verdict_will : satisfiesRole will := by decide

-- §diagnostics (only when opts.diagnostics)
#eval (jdDuties.filter (fun d => !(meetsB will d))).map (·.label)
#eval jdDuties.map (fun d => (d.label, meetsB will d))

end Spec.Cases.<ModuleName>
```

Codegen rules: Expr→Lean is a direct recursive mapping — `ge/gt/le/lt/eq/ne` become `decide (lhs op rhs)`; `and/or` become `&&`/`||` chains; `contains` becomes `list.contains item`; string consts are quoted/escaped; field paths print as-is. Emit nothing for empty optional sections.

### 7.5 Runner (`src/lean/runner.ts`)

- `checkFile(relPath)` → `execa("lake", ["env","lean","--json", relPath], { cwd:"lean", timeout: cfg.leanTimeoutMs })`. Parse stdout as JSON-lines diagnostics: `{severity, pos, endPos, data}` per line. Return `{ ok: severity has no "error", diagnostics }`. `#eval` output arrives as `severity:"information"` — capture it.
- `buildAll()` → `lake build` (used in M1 and S5 acceptance).
- First run may compile stdlib artefacts; do not treat slowness < timeout as failure.

### 7.6 Diagnosis (`src/lean/diagnose.ts`)

On S6 failure or for RED verdicts: regenerate with `diagnostics:true, theoremTactic:null`, run `checkFile`, parse the two `#eval` information messages → `{ failingDuties: string[], perDuty: {label, pass}[] }`. Map each failing duty label back to its IR `itemsData` entry and that entry's provenance (the requirement/predicate `SourceSpan`s) so the verdict can cite the original prose.

---

# PART IV — INTELLIGENCE

## §8 — LLM subsystem

### 8.1 Provider interface (`src/llm/provider.ts`)

```ts
interface LLMProvider {
  complete(req: { promptName: string; caseId: string; system: string;
                  user: string; maxTokens?: number }): Promise<string>;
}
```

Factory `getProvider(cfg)` implements the `auto` policy (§4). Every call is logged to `cases/<id>/llm.log.jsonl` (promptName, ms, provider, chars — never log API keys).

### 8.2 `claudeCli.ts`

`execa("claude", ["-p", combinedPrompt, "--output-format", "json"], { timeout: 300000 })`, where `combinedPrompt` = system + "\n\n---\n\n" + user. Parse the JSON envelope and return its result text field; if the envelope shape is unrecognised, fall back to treating stdout as plain text. If `--output-format json` itself errors, retry once with plain `-p`.

### 8.3 `anthropicApi.ts`

`@anthropic-ai/sdk` `messages.create({ model: cfg.model, max_tokens: 4096, system, messages:[{role:"user",content:user}] })`; join text blocks.

### 8.4 JSON discipline (`src/llm/json.ts`)

`completeJson<T>(schema, req)`: call provider → strip ```json fences → `JSON.parse` → zod parse. On any failure, re-ask up to `maxJsonRepairs` times with the error appended: `"Your previous output failed validation: <errors>. Output ONLY corrected JSON."` Exhausted ⇒ throw code 5.

### 8.5 `mock.ts` + caching

Mock provider resolves `fixtures/llm/<promptName>.<caseId>.json` → `{ text: string }`; missing fixture ⇒ descriptive error naming the expected path. Live providers also write a content-addressed cache `cases/<id>/.llmcache/<sha256(system+user)>.txt` and reuse it on identical re-runs (delete `.llmcache/` to force fresh).

### 8.6 Proof provider (DeepSeek-Prover) — `src/llm/proofProvider.ts`

A **separate interface** from `LLMProvider`, because the job is different: given a Lean goal, return candidate *tactic blocks*, sampled n times. Lean adjudicates; the prover only proposes.

```ts
interface ProofCandidate { tactic: string; raw: string; attempt: number }

interface ProofProvider {
  readonly name: string;
  /** Sample `n` candidate tactic blocks for the goal. Never returns definitions or data. */
  propose(req: {
    caseId: string;
    /** Full generated case file with the theorem's `by` block left as `sorry`. */
    context: string;
    /** The theorem statement alone, e.g. "satisfiesRole will". */
    goal: string;
    /** Prior failed attempts with their Lean diagnostics, for repair-style prompting. */
    history: { tactic: string; error: string }[];
    n: number;
  }): Promise<ProofCandidate[]>;
}
```

**Backends** (`getProofProvider(cfg.prover)`):

| backend | transport | notes |
|---|---|---|
| `ollama` (default) | `POST {endpoint}/api/generate` `{model, prompt, stream:false, options:{temperature, num_predict}}` | Local. On an M4 Pro a 7B-class DeepSeek-Prover quant runs comfortably; install via `ollama pull <model>`. Zero cost, no network egress. |
| `openai-compatible` | `POST {endpoint}/v1/chat/completions` | For llama.cpp `--server`, vLLM, LM Studio, etc. |
| `deepseek-api` | DeepSeek's hosted API, key from `DEEPSEEK_API_KEY` | Remote fallback if local weights aren't available. |
| `mock` | reads `fixtures/prover/<caseId>.json` → `ProofCandidate[]` | Deterministic tests (§16). |

**Prompt shape** (`prompts/prover.md`, DeepSeek-Prover style — it is trained on Lean 4 completion, not chat):

```
Complete the following Lean 4 proof. Output ONLY the tactic block that replaces `sorry` —
no fences, no commentary, no restatement of the theorem.

{{context_with_sorry}}

{{#if history}}Previous attempts failed:
{{#each history}}- `{{tactic}}` → {{error}}
{{/each}}{{/if}}
```

**Sanitisation (mandatory).** Prover output is untrusted text. Before use: strip fences and any leading `by`; reject any candidate containing `sorry`, `axiom`, `native_decide` *if* `cfg.prover.allowNativeDecide` is false (default false — see §18.1.9), `structure`, `def `, `theorem`, `import`, or `set_option maxHeartbeats` above 400000. Rejected candidates are logged and skipped, not repaired.

**Adjudication is unchanged.** Each surviving candidate is spliced into a regenerated case file and run through `checkFile` (§7.5). First candidate that type-checks with zero errors wins. A proposed proof that Lean rejects is simply discarded — the prover can never widen what counts as proved.

---

## §9 — Prompt templates (`prompts/*.md`)

Each file has front-matter (`name`, `version`) and a body with `{{placeholders}}`. Builder writes full versions containing at least the clauses below (these clauses are load-bearing — keep their substance verbatim).

**drafter.md** — input `{{intake}}`, `{{irSchema}}`, `{{precedents}}` (may be empty), `{{priorErrors}}` (may be empty).
Key clauses: "You translate prose requirements into the VPS IR. Output ONLY a JSON object matching the schema — no prose, no fences." · "Every noun, field and predicate MUST carry a `source` whose `quote` is a VERBATIM substring of the intake document." · "Restrict types to Nat, Bool, String, ListString, ListNat. Encode requirement items as data (`itemsData`), with a single dispatching predicate." · "Do NOT invent requirements not present in the prose. Prose you cannot model measurably goes in `exclusions` with a reason; genuine interpretation choices go in `ambiguities` with options, your choice, and rationale." · "Where `{{precedents}}` contains rulings, you must conform to them exactly." · "If `{{priorErrors}}` is non-empty, fix precisely those issues." · **Revision clauses** (present only when `{{previousIR}}` is supplied): "This is a revision of an existing, human-approved formalization. `{{previousIR}}` is that formalization; `{{proseDiff}}` shows exactly what changed in the prose. Change ONLY what the diff requires. Every noun, field, predicate branch, and itemsData entry not touched by the diff must be restated **identically** — same names, same structure, same values. Do not improve, rename, or reorganise untouched material." 

**backtranslate.md** — input `{{ir}}` only (never the intake). "Translate this formal IR back into plain-English requirements prose. State exactly what the formalization requires — nothing more, nothing less, including what is absent."

**faithfulness-judge.md** — input `{{original}}`, `{{backtranslation}}`, `{{exclusions}}`. "Compare meaning, not wording. Output ONLY JSON: `{ \"verdict\": \"faithful\"|\"divergent\", \"divergences\": [{\"kind\":\"missing\"|\"added\"|\"altered\",\"detail\":string}] }`. Prose listed in exclusions must not be counted as missing."

**test-proposer.md** — input `{{ir}}`, `{{intake}}`. "Propose test instances for the subject noun. Output ONLY JSON `{ \"shouldPass\": Instance[], \"shouldFail\": Instance[], \"edge\": [{\"instance\":Instance, \"expected\":bool, \"why\":string}] }` with ≥2/≥2/≥1 entries, values type-correct for the noun."

**adversary.md** — input `{{ir}}`, `{{intake}}`. "Your only goal: break the formalization. Find instances where the predicate answers YES but a careful human reading the prose would say NO, or vice versa. Output ONLY JSON `{ \"counterexamples\": [{\"instance\":Instance, \"predicateSays\":bool, \"humanWouldSay\":bool, \"why\":string}] }`. Empty array if you genuinely cannot."

**judge-first-instance.md** — input `{{question}}`, `{{facts}}`, `{{specLaw}}`, `{{priorRulings}}`. "You are a single judge at First Instance. Decide the modelling question. Output ONLY JSON `{ \"ruling\": string, \"reasoning\": string, \"lawApplied\": string[] }`. Be consistent with prior rulings; if you must depart, say so explicitly and why."

**judge-appeal.md** — same inputs plus `{{challenge}}`; run **three separate calls** with persona headers (textualist / purposivist / pragmatist), then a fourth synthesis call outputting `{ \"upheld\": bool, \"ruling\": string, \"reasoning\": string }`.

**proof-repair.md** — input `{{leanFile}}`, `{{diagnostics}}`, `{{attemptHistory}}`. "The theorem at the end fails. Output ONLY the replacement tactic block for `by …` — no fences, no commentary. Prefer `decide`, `native_decide`, `simp; decide`. Do not modify definitions or data."

---

# PART V — THE PIPELINE

## §10 — Stage specifications

Each stage = `src/pipeline/sN_*.ts` exporting `run(caseId, cfg): Promise<StageResult>`; each validates the case is in a legal prior state, does its work, advances state, and writes its artefacts.

**S0 intake** — `vps intake <file> [--slug s]`: create case dir, copy prose to `intake.md` verbatim (byte-identical — offsets depend on it), init `state.json` at `intake` (base case: `revision 1`).

**S0b amend** — `vps amend <case> <file>`: validate `<case>` exists and is not already superseded; create `"<familyId>-r<n+1>"` with its own verbatim `intake.md`; write `amend.context.json` (prose diff per §5.3); copy the predecessor's `instances/*.json` forward; init state at `intake` with family links. The predecessor's `supersededBy` is set later, at the successor's sign-off (S4).

**S1 draft** — build drafter prompt (embed §6 schema as JSON-schema text via `zod-to-json-schema` or a hand-written equivalent; embed applicable precedents from S2's store lookup — on first run, empty). **For revisions**, additionally embed `{{previousIR}}` (the predecessor's signed-off IR) and `{{proseDiff}}`, with the drafter instructed (§9) to change *only what the diff requires* and to restate everything untouched identically — minimal-delta drafting is what keeps revision review cheap and precedent-consistent. `completeJson(IRSchema)` → semantic validation (§6.5); for revisions, additionally compute the **IR diff** vs `previousIR` (structural: nouns/fields/predicate-body/itemsData added-removed-changed; implement in `src/diff.ts`) and persist it as `ir.diff.json` — validation warns if the IR changed in places the prose diff doesn't touch (drift signal, surfaced at S4). On errors, redraft with `priorErrors` (≤ `maxJsonRepairs`). Persist `draft.ir.json` (archiving any prior to `draft.history/`). → `drafted`.

**S2 precedent** — extract questions from IR (§11.3); for each, look up the citator. Matched & consistent ⇒ record "applied". Matched & **conflicting** ⇒ redraft once with the ruling injected into `{{precedents}}`; still conflicting ⇒ stop, exit 2, tell the human to either conform the draft or `vps appeal <citation>`. Novel ⇒ First Instance sits (§11.5), ruling filed + applied. Write `precedent.report.json` (`applied[]`, `filed[]`, `conflicts[]`). → `precedent-checked`.

**S3 checks** — run §12.1→12.5 in order (deterministic first, cheap-LLM before expensive). Aggregate `checks/summary.json` + `report.md`. All pass ⇒ `checks-passed`; else `checks-failed` (exit 3) with the failure list; `vps draft <case> --from-checks` feeds failures back to S1.

**S4 sign-off** — `vps review <case>` prints the bundle: intake prose · back-translation side-by-side · ambiguities & exclusions table · predicate `interpretationNotes` · check summary · precedents applied. `vps signoff <case> --approve --by "<name>" [--notes …]` writes `signoff.json`, files a First-Instance ruling *"Formalization of <caseId> approved as faithful"* (citation recorded in signoff.json), → `signed-off`; **for a revision**, also sets the predecessor's `supersededBy` now (approval is the moment supersession becomes real — a rejected or abandoned revision never supersedes anything). `--reject --notes …` → back to `drafted` with notes appended for the next draft. **No flag exists to skip this gate.**

**S5 compile** — regenerate case file from IR (no instance, no theorem, no diagnostics); `checkFile`; also validate any present instance files against the IR. Errors here mean codegen or IR bugs — surface diagnostics verbatim, exit 4. → `compiled`.

**S6 prove** — `vps prove <case> --instance will [--prover]`. Ladder, in order, each rung regenerated + `checkFile`, full history in `proof.result.json`:

| # | Rung | When it runs |
|---|---|---|
| 1 | `decide` | always — wins for essentially every v1 goal (finite, concrete, `Bool`-valued) |
| 2 | `native_decide` | if 1 fails (kernel reduction too slow for large `itemsData`) |
| 3 | `simp; decide` | if 2 fails |
| 4 | **prover** (§8.6): sample `cfg.prover.attempts` candidates, sanitise, try each | only if `cfg.prover.enabled` **or** `--prover` passed, AND rungs 1–3 failed |
| 5 | general-LLM repair loop ≤ `maxProofRepairs` via proof-repair.md | last resort |

Rung 4 sits *below* the decide-ladder deliberately: on v1's decidable goals a proof-search model is strictly slower and no more capable than evaluation, so reaching for it first would waste time and hide codegen bugs behind a plausible-looking proof. It earns its place only when a goal is genuinely non-decidable — i.e. once the v2 general-theorem work lands (§20). Success ⇒ snapshot to `lean.snapshot.lean`, record `{rung, tactic, attempts, provider}` → `proved`. Exhausted ⇒ diagnosis (§7.6) → `proof-failed`.

**If rung 4 or 5 succeeds where 1–3 failed, flag it.** `proof.result.json` sets `"searchRequired": true`, and `verdict.md` gains a line under *What this guarantees*: "This goal required proof search rather than evaluation — the proof is machine-checked and valid, but the statement is no longer a finite computation, so re-verify after any IR change." This is a signal the case has outgrown v1's scope.

**S6b reprove (families)** — `vps reprove <case>`: for a signed-off revision, run S5 once, then S6+S7 for **every** instance in the case's `instances/` (the family's full set, per §5.3), writing per-instance `proof.result.<name>.json` and `verdict.<name>.md`, plus `regression.report.md`: a table of *instance × (predecessor verdict, this verdict)* with every **flip** called out — e.g. "will: GREEN@r1 → RED@r2 — fails 'Kubernetes required' (¶3: '<quote>')" via §7.6 provenance. Flips are the headline; unchanged rows are one line each. This is the change-request property made concrete: an amendment that breaks something previously proved surfaces as a named, quoted proof failure immediately, not as a bug report later.

**S7 verdict** — render `verdict.md` (§14) from state + proof result (+ diagnosis if RED). → `verdict-green` | `verdict-red`. Multi-instance cases (post-`reprove`) hold one verdict file per instance; `verdict.md` without a suffix is the most recent single-instance run's, for backward compatibility with M6.

**Orchestrator** — `vps run <case> [--instance name]`: S1→S3, then exit 2 with the review instruction if not signed off; if signed off, S5→S7. Idempotent: completed stages skipped unless `--force-from <stage>`.

---

## §11 — Precedent subsystem (VJS integration)

### 11.1 Install (M5)

**Author locally — do not fetch.** (Verified against the live repo 2026-08-22: `wlilley93/vibe-justice-system@master` is now the v2 Rust lawpack, and **no branch** carries `SPEC-LAW.md`, `VPR.md`, `plugin/CLAUDE.md`, `plugin/skills/`, or `.justice/suites/` at fetchable paths — the previously advertised URLs 404.) Instead: write two short local commentary files into `.justice/` — `SPEC-LAW.md` (statement of principles, ~20 lines: spec is law; rulings are precedent; the kernel is clerk, not court; every denial names its instrument) and `VPR.md` (proceedings in brief: question keys, First Instance sits once per novel key, appeals supersede) — their **operative** content is supplied by the kernel from M11 (§21); these are commentary only. *Optionally* fetch from the `v1` branch the ancestors that do exist — `CLAUDE.md` (append under a `## VJS` heading), `Constitution/VPR.md`, `.claude/skills/submit-request-to-court/SKILL.md`, `.claude/skills/submit-breach-to-court/SKILL.md` — treating any failure per §19 (stub with URL note). Create `judgments/{first-instance,appeals-court,supreme-court}/` and `INDEX.md` (header: `# Citator\n\n| Citation | Court | Question key | File |\n|---|---|---|---|`). Attribute VJS (MIT) and the VPS kernel (owner-authored) in README.

### 11.2 Judgment file format (ours, VJS-compatible)

`judgments/first-instance/<NNN>-<slug>.md`:

```markdown
---
citation: "[2026] VPS 7"
court: first-instance
questionKey: "model:duty:shape"
caseId: 2026-08-22-sample-role
date: 2026-08-22
status: standing        # standing | overturned:<citation>
---
## Question
…
## Facts
…
## Ruling
…
## Reasoning
…
## Law applied
- SPEC-LAW §…
```

### 11.3 Question extraction & keys (`questions.ts`)

From an IR, emit normalized question keys + human question text:
- `model:<noun>:shape` — "How is <Noun> modelled?" facts = sorted `field:type` list.
- `model:predicate:<name>` — "What does <name> mean?" facts = canonicalised body (stable JSON, sorted keys) + interpretationNotes.
- `interpret:<sha8(sourceText)>` — one per ambiguity: "How is '<sourceText>' interpreted?" facts = options + chosen.
Consistency test = ruling's recorded facts equal the draft's facts for the same key (string compare of the canonical forms).

### 11.4 Store (`store.ts`)

`lookup(questionKey)` → parse INDEX.md; return standing judgment or null. `file(court, questionKey, caseId, {question, facts, ruling, reasoning, lawApplied})` → write the judgment markdown; append the INDEX row; **allocate the citation and record the ruling's existence by enacting it into the kernel book** (§21.6) — from M11 onward, ordinal allocation and standing/overturned status are the kernel's, not a max+1 scan (which serves only as the pre-M11 interim through M5–M10). `overturn(citation, byCitation)` = enact a superseding ruling (§21.6); the kernel's `effectiveB` is then the source of truth for standing, mirrored into the judgment's front-matter for human readers.

### 11.5 Courts (`court.ts`)

- **First Instance** (automated, in-pipeline): one `completeJson` call with judge-first-instance.md; file ruling.
- **Appeal** (`vps appeal <citation> --grounds "…"`, human-initiated only): three persona calls + synthesis (judge-appeal.md); if not upheld, file appeals-court ruling and mark original `overturned`.
- **Supreme Court**: out of scope for v1 — directory exists; command prints "not implemented (v2)".

---

## §12 — Checks subsystem

All checks write `{name, passed, details}` JSON; `report.md` digests all five.

**12.1 Traceability (deterministic).** (a) Every `SourceSpan` verifies (§6.5 rule 2 — re-run here for the report). (b) **Coverage**: split intake into sentences (regex on `[.!?]\s+` is fine); a sentence is *covered* if any span overlaps it or its text appears in ambiguities/exclusions. Report uncovered sentences as warnings (listed in the sign-off bundle), spans-verify failures as hard failures. Pass = zero hard failures.

**12.2 Round-trip.** backtranslate.md (IR only, fresh context) → faithfulness-judge.md(original, backtranslation, exclusions). Pass = verdict `faithful`. Divergences listed verbatim in the report either way.

**12.3 Known-answer tests.** test-proposer.md → validate instances against IR → codegen a diagnostics-style file evaluating `satisfiesRoleB` on each proposed instance via `#eval` lines tagged with indices → `checkFile` → compare each result to expectation. Pass = 100% match. Mismatch names the instance, expected, got — this is a formalization bug by construction.

**12.4 Ensemble.** Run the drafter `ensembleK` times fresh (no precedents beyond those already applied, `priorErrors` empty). Normalise each IR: sort keys; canonical rename (subject noun→`S`, item noun→`I`, fields→sorted `name:type`). Score pairwise agreement: fraction of (field set, predicate canonical body, itemsData length) triples matching; convergence = mean pairwise. Pass = convergence ≥ `ensembleThreshold`. Below: report the exact divergent elements — those are the prose's genuinely underspecified points, surfaced for the human.

**12.5 Adversarial.** adversary.md → for each returned counterexample, evaluate `predicateSays` for real via the §12.3 machinery. A counterexample is *confirmed* iff the real evaluation equals `predicateSays` and differs from `humanWouldSay`. Pass = zero confirmed. Confirmed ones print instance + why, verbatim.

Order: 12.1 → 12.4 → 12.2 → 12.3 → 12.5 (cheap/deterministic before expensive; ensemble early so divergence context reaches the human even if later checks fail).

---

## §13 — Sign-off gate

Covered in S4 (§10), with an optional web surface in §15.5. Three invariants the builder must enforce in code: (1) S5–S7 refuse to run unless `signoff.json.approved === true` for the **current** `draft.ir.json` (store the IR's sha256 in signoff.json; any redraft invalidates sign-off); (2) approval always files the ruling — sign-off *is* precedent; (3) CLI and web approve/reject share **one** S4 implementation — the web server calls it, never re-implements it, so the gate cannot fork.

---

## §14 — Verdict format (`verdict.md`)

GREEN:

```markdown
# VERDICT — GREEN ✅
**Case:** {caseId} (family {familyId}, revision {n}) · **Instance:** {name} · **Date:** {date}
{if superseded: "> ⚠ SUPERSEDED by {supersededBy} on {date}. This verdict remains a true statement about revision {n}'s formalization only. See the successor's verdicts for current status."}
**Theorem:** `verdict_{name} : satisfiesRole {name}` — accepted by Lean {leanVersion} via `{tactic}`.

## What this guarantees
Lean has verified, for every requirement item in the signed-off formalization, that the
provided instance data satisfies the signed-off predicate. This is a machine-checked proof,
not a test: within the model, no case was sampled — all were covered.

## What this is conditional on (read this)
1. **The formalization** ({irSha}) faithfully representing the source prose — a human
   judgment, signed off by {signoffBy} on {signoffDate} (ruling {citation}), supported by
   the checks in `checks/report.md`, and proved by nothing.
2. **The instance data** being true. Lean verified `IF this data THEN satisfied`; it cannot
   verify the data itself.
3. **Exclusions:** the following prose was deliberately not modelled and is NOT covered by
   this verdict: {exclusions list}.

## Chain of custody
intake {intakeSha} → IR {irSha} → lean {leanSha} → proof {tactic}, {iterations} attempt(s).
```

RED: same header with ❌; then `## Failing requirements` — per failing duty: label, the original prose quote (via §7.6 provenance), the instance values involved, and the evaluated comparison (e.g. `yearsExp = 4 < required 5`); then `## Possible causes` (data wrong / formalization wrong → `vps signoff --reject` path / requirement genuinely unmet) and the same conditionality section.

---

# PART VI — INTERFACES

## §15 — CLI specification

### 15.1 Commands

```
vps init                                  # scaffold cases/, record/, lean/Spec/Cases/ (see §21 note)
vps doctor                                # environment checks (§2)
vps intake <file> [--slug s]              # S0 (new family)
vps amend <case> <file>                   # S0b: new revision in an existing family (§5.3)
vps draft <case> [--from-checks]          # S1
vps precedent <case>                      # S2
vps check <case> [--only t,r,k,e,a]       # S3
vps review <case> [--web] [--port n]      # sign-off bundle: terminal, or local web UI (§15.5)
vps signoff <case> (--approve|--reject) --by <name> [--notes …]   # S4
vps instance <case> <file>                # register + validate an instance json
vps compile <case>                        # S5
vps prove <case> --instance <name> [--prover]                     # S6
vps verdict <case>                        # S7 (render/refresh)
vps reprove <case>                        # S6b: all family instances + regression report
vps family <case>                         # revision tree: cases, statuses, supersession links
vps run <case> [--instance <name>] [--force-from <stage>]         # orchestrator
vps status <case>                         # state + history table
vps appeal <citation> --grounds "…"       # §11.5
vps precedents [--grep …]                 # list citator
vps gate [--staged|--paths a,b [--records n]]                     # §21.7 meta-gate; exit 6 = denial
vps book [--json]                         # list the statute book: citation, kind, rule, standing
vps template <case> [--name me]           # emit a skeleton instance JSON from the signed-off IR
```

### 15.2 Global flags

`--config <path>` · `--provider cli|api|mock` · `--prover` (force-enable rung 4 for this run) · `--json` (machine-readable stage results on stdout). Env: `VPS_PROVER=ollama|openai-compatible|deepseek-api|mock` overrides `prover.backend`.

### 15.3 Exit codes

`0` success · `2` human gate (sign-off required / precedent conflict) · `3` checks failed · `4` Lean failure · `5` LLM/provider failure · `6` constitutional gate denial (§21.7) · `1` internal error. `vps run` prints, on exit 2, the exact next command the human should run.

---

### 15.4 `vps review --web` (see §15.5)

Launches the sign-off UI instead of the terminal bundle. All other commands are terminal-only by design.

## §15.5 — Sign-off web UI (S4 surface)

### 15.5.1 Why a UI exists here and nowhere else

S4 is the only stage whose entire output is a human judgment, and judgment quality depends on presentation: comparing prose against a back-translation is a visual diffing task; traceability is a click-to-highlight task; ambiguities and exclusions must be individually confronted, not scrolled past. Every other stage is either batch machinery (S1–S3, S5–S7) or better served git-native (precedent). **Scope is therefore exactly one page: the review-and-sign-off bundle.** No dashboard, no pipeline monitor, no precedent browser (a read-only rulings list linked from the case is the sole extra, §15.5.4). Any future UI beyond this page is a v2/§20 matter.

### 15.5.2 Architecture

- `vps review <case> --web [--port 4780]` starts a **local-only** HTTP server (`src/ui/server.ts`, Node `http` — no framework) bound to `127.0.0.1`, prints the URL, and opens the browser (`open <url>` on macOS; ignore failure).
- **Read surface:** `GET /api/case` returns one JSON bundle assembled server-side from the case dir: intake text, current IR + its sha256, checks summary + individual reports, precedent report, applied rulings (resolved from `.justice/`), and the S4 state.
- **Write surface — exactly one endpoint:** `POST /api/signoff` `{ decision: "approve"|"reject", by: string, notes: string, ambiguityAcks: string[], exclusionAcks: string[], irSha: string }`. The server re-reads `draft.ir.json`, recomputes its sha, and rejects with `409` if it differs from `irSha` (the page is stale — reload). On approve it executes the **same S4 code path as the CLI** (writes `signoff.json`, files the ruling, advances state — one implementation, two frontends); on reject it routes to the same reject path with notes. Then responds with the next command to run and the server shuts down after a short grace period. Nothing else on the server writes anything.
- **Frontend:** one self-contained `src/ui/review.html` (inline CSS + vanilla JS, no build step, no CDN — the tool must work offline). Served at `/`. Keep it under ~1,500 lines; it is a form, not an app.
- The CLI text bundle (§10 S4) remains fully functional and byte-equivalent in content; `--web` is presentation only.

### 15.5.3 Page specification (top to bottom)

1. **Header** — case id, current status, IR sha (short), signer name input (required, prefilled from `$USER`).
2. **Exclusions banner** — if any exclusions exist, a full-width high-contrast banner listing each excluded sentence verbatim with its reason, each with a required checkbox: *"I understand this is NOT covered by any verdict."* This is the most dangerous information in the system and is deliberately unmissable and unskippable.
3. **Revision panel** (revisions only; omitted entirely for base cases) — leads the review: (a) the word-level prose diff, rendered add/remove inline; (b) the structural IR diff from `ir.diff.json` grouped as added / removed / changed, each entry linking to its node in the traceability tree; (c) drift warnings (IR changes outside the prose diff) in the same visual register as the exclusions banner — drift is the thing a revision reviewer most needs to catch; (d) precedent delta: rulings newly filed by this revision vs. carried over. The reviewer of a revision reads the delta first and the full document second — this panel is why revision review stays honest at r5 instead of decaying into rubber-stamping.
4. **Faithfulness panel** — intake prose (left) and back-translation (right) side by side; sentence-level alignment where the faithfulness judge reported divergences, with divergent sentences highlighted and the judge's `{kind, detail}` shown between the columns. Verbatim texts, no paraphrase.
5. **Traceability panel** — the intake text again, now as the interactive layer: sentences covered by a `SourceSpan` are normal; uncovered sentences are visibly dimmed with a "not modelled" tag; sentences in exclusions carry the banner's mark. Below it, the IR rendered as a tree (nouns → fields, predicate → `interpretationNotes`, requirement → `itemsData` table). Hovering/selecting any IR node highlights its exact source span in the text above, and vice-versa. This is a direct rendering of §6's `SourceSpan` data — no new analysis.
6. **Ambiguities panel** — one card per ambiguity: the source text, all `options`, the drafter's `chosen` pre-selected, and its `rationale`. Each card has a required radio: *Accept this interpretation* / *Reject draft (send back with note)*. Choosing reject on any card switches the page's terminal action to Reject and requires a note. The human cannot approve without having answered every card — this is the gate-hardening the UI exists for.
7. **Checks panel** — the five checks as pass/fail rows; each expands to its raw JSON report. Ensemble divergences and adversarial counterexamples (if any survived) render verbatim.
8. **Precedent panel** — rulings applied and filed for this case: citation, question, one-line ruling; citation links open the judgment markdown read-only (`GET /api/ruling/:citation`).
9. **Action bar** (sticky footer) — **Approve and file ruling** (enabled only when: signer named, every exclusion acknowledged, every ambiguity answered *Accept*) or **Reject with notes** (enabled when signer named and notes non-empty). Below the buttons, in the same visual weight as the buttons themselves, the standing text: *"Approval records a human judgment that this formalization faithfully represents the prose. It is the load-bearing condition of every future GREEN verdict for this case. Nothing on this page is proved."*

### 15.5.4 Design constraints (for the builder's front-end pass)

- **The interface must not overstate the system.** No trophy language, no green-tick iconography on approval, no "verified" anywhere — the page's job is calibrated judgment, and the conditionality text of §14 governs its vocabulary. Status colours: checks may use pass/fail colour; the approve action itself stays neutral.
- Ground the visual identity in what the page is — a **reading instrument for cross-examining a document** — rather than a generic dashboard: typographic hierarchy tuned for long verbatim text, a quiet palette that lets the highlight colours (spans, divergences, exclusions) carry all the meaning, and the exclusions banner as the page's single loudest element. One signature interaction: the bidirectional span↔IR highlight (item 4), executed precisely. Everything else stays disciplined.
- Quality floor, unannounced: keyboard operable end-to-end (the whole flow is a form), visible focus, sensible at a narrow window, `prefers-reduced-motion` respected (there is almost no motion to reduce), works offline, no external requests of any kind.

### 15.5.5 Failure & edge behaviour

- Case not in `checks-passed` (or `rejected` awaiting re-review) ⇒ server refuses to start with the correct next command.
- `409` stale-IR on submit ⇒ page shows a plain error naming the cause and a reload control; nothing is written.
- Server crash mid-review writes nothing: `signoff.json` is written atomically (temp file + rename) by the shared S4 path.
- `--web` on a case already signed off ⇒ read-only rendering of the bundle plus the recorded `signoff.json`, action bar replaced by the record.

# PART VII — THE CONSTITUTIONAL KERNEL

## §21 — VPS: the verified statute book, enactment, and the meta-gate

> **SUPERSEDED by record/0037 (Phase 2).** This part describes the factory as its own
> jurisdiction: a vendored kernel, a seed book, enactment, and a commit-time meta-gate.
> All of it was retired. Every statute it could enact governed its own directories and none
> governed work, because the rule language is path-shaped over a git diff. Adjudication moved
> to the court (VJS), which owns the kernel relationship; this repo holds no book, no
> citations and no genesis, and `gate`, `book`, `appeal` and `precedents` are gone from the
> CLI. The old jurisdiction is archived unaltered under `archive/vps-jurisdiction/`.
> Read this part as history: it explains what the kernel guarantees and why, which is still
> true of the kernel — but not as a description of this repository.

### 21.1 What this is, and where it came from

VPS (Vibe Proof System) is the owner's own Lean 4 kernel: the successor to VJS in which the governance layer's guarantees are theorems rather than conventions. A statute book is a `List Instrument`; `Lawful` has exactly two constructors (genesis, enact), so deletion and tampering are unrepresentable; and the proof suite establishes, over **every** lawful book: no self-made law (`sovereign_floor`), no citation reuse (`citation_unique`), no dangling supersession (`supersession_grounded`), no low-rank repeal (`supersession_respects_rank` — a ruling cannot repeal a statute), entrenched law is immune and always in force (`entrenched_immune`, `entrenched_effective`), every denial names its law (`every_deny_names_its_law`), and entrenched law always bites (`entrenched_bites`). `res_judicata` proves a sound precedent memo table can never disagree with deliberation.

**Provenance.** The nine files under `kernel/Vps/` in this package are the owner's v2 with three minimal compile fixes applied, verified end-to-end on `leanprover/lean4:v4.15.0` including adversarial controls (a rank-violating and an entrenchment-violating enactment each **fail to compile**; a lawful supersession compiles and takes effect). `kernel/PROVENANCE.md` records the toolchain, the patch sites, and the control results. The builder copies these files; it never retypes or edits them (Protocol 5c).

**Two roles in VPS.** (1) **S2's substrate**: precedent-record mechanics — citations, standing, supersession, entrenchment — move from file conventions into the proved book. (2) **The repo's meta-gate**: the guardrails of §18 that are expressible as path rules become enacted statutes, enforced at commit time by a gate whose "every denial names its instrument" property is a theorem. What stays **outside** the kernel, by its own Art. 8 design: the LLM bench's *content* (how a Duty is modelled is open-ended and therefore unrepresentable as an operative rule) and the human sign-off judgment. The kernel makes the record incorruptible, not the decisions correct — the same two-kinds-of-correctness invariant as §1.2, now with a proved boundary.

### 21.2 Vendoring

At M11: copy `kernel/Vps/*.lean` → `lean/Vps/`, add the `Vps` lib to the lakefile (§7.2), confirm `lean/lean-toolchain` equals `kernel/lean-toolchain` (v4.15.0), and `lake build` — the kernel must be green **as shipped** before any generation touches it. Seven files are **constitutional text** and stay vendored-invariant: `World`, `Instrument`, `Genesis` (until the digest pin, §21.8), `Legitimacy`, `Gate`, `Precedent`, `Proofs`. Two are **generated** from this point on: `Book.lean` and `Examples.lean` (§21.3); the shipped versions are the canonical templates the codegen must reproduce in shape.

### 21.3 Generated law: `book.json` → `Book.lean` + `Examples.lean`

The single source of truth for the book is `.justice/book.json` — an array, newest first, of:

```ts
BookEntry = {
  year: number, ordinal: number,
  slug: Ident,                       // Lean def name, e.g. "actKernelProtection"
  kind: "charter"|"statute"|"ruling"|"note",
  rule: { type: "pathForbidden"|"recordRequired", scope: string } | { type: "free" },
  entrenched: boolean,
  supersedes: { year, ordinal } | null,
  authority: { type: "sovereign" } | { type: "derived", parent: { year, ordinal } },
  title: string, summary: string,    // for law/ prose and gate messages
  vectors?: {                        // REQUIRED for operative (non-free) rules — Art. 8 in data
    deny: { pathsChanged: string[], recordsAdded: number },
    allow: { pathsChanged: string[], recordsAdded: number } }
}
```

`renderBook(entries)` regenerates `Book.lean` **whole** (regenerate-don't-patch, as everywhere): one `def <slug> : Instrument := …` per entry, `theBook` newest-first, and `book_lawful` as the nested `Lawful.enact … (by decide) (by decide)` term — one layer per non-genesis entry, matching the shipped template exactly. `renderExamples(entries)` emits, for every operative rule, its deny and allow vectors as `example : gate {…} = .deny [<slug>.cite] := by native_decide` / `= .allow := by native_decide` — **the enactment of an operative rule without both vectors is refused in TypeScript before Lean is ever consulted**: unfalsifiable law is unenactable, mechanically. `.free` rules (genesis, rulings, pure grants) need no vectors.

Decision, recorded: inside `book_lawful` the steps stay `by decide` (String *equality* kernel-reduces; verified in this package), while example vectors use `by native_decide` (the gate's `String.isPrefixOf` does **not** kernel-reduce — found the hard way, see PROVENANCE). `native_decide` trusts the compiler as well as the kernel; that trade is accepted for the vectors and the trust note in §21.9 says so out loud.

### 21.4 The seed book (VPS's own constitution)

`vps init` (post-M11 re-run, or M11 itself) seeds `book.json` with:

| Citation | Slug | Kind | Rule | Entrenched | Purpose |
|---|---|---|---|---|---|
| [2026] VPS 1 | `genesisInstrument` | charter | free | ✅ | Root of every authority chain (vendored in Genesis.lean, listed in the ledger for completeness) |
| [2026] VPS 2 | `actKernelProtection` | statute | recordRequired `lean/Vps/` | ✅ | Kernel changes must carry a record entry explaining themselves |
| [2026] VPS 3 | `actGateIntegrity` | statute | pathForbidden `gate/` | — | Hook scripts change only by lawful enactment shipping with the change |
| [2026] VPS 4 | `actRecordDiscipline` | statute | recordRequired `law/` | — | Changes to the law's prose mirror must add a record |
| [2026] VPS 5 | `actJudgmentIntegrity` | statute | recordRequired `.justice/judgments/` | ✅ | Hand edits to judgments without a record are denied; VPS's own filings auto-satisfy (§21.7) |

All statutes: authority derived from ⟨2026, 1⟩. Each operative rule carries its deny/allow vectors in the ledger (builder writes obvious ones, e.g. VPS 2 deny = `{["lean/Vps/Gate.lean"], 0}`, allow = same paths plus a `record/` file and `recordsAdded 1`).

### 21.5 The enactment protocol — the build IS the enactment

`enact(entry)` in `src/kernel/enact.ts`:

1. Snapshot `book.json`; append the entry (TypeScript pre-checks: slug/citation fresh in the ledger, vectors present for operative rules).
2. `renderBook` + `renderExamples`; `lake build Vps` (timeout: `leanTimeoutMs`).
3. **Green** → keep; write the prose mirror `law/<year>-vps-<ordinal>.md` (title, summary, full instrument fields); write the record stub `record/<NNNN>.md` (auto-numbered; one line: citation + reason) — the record stub is what makes the *commit* of this enactment satisfy VPS 2/4/5.
4. **Red** → restore the snapshot, delete generated deltas, surface Lean's diagnostics verbatim, exit 4. An enactment the kernel rejects **never happened**: `authorityResolves`, `supersessionLawful` (rank guard), `fresh`, and entrenchment are enforced by `by decide` inside `book_lawful` — the TypeScript pre-checks are a courtesy, not the authority.

### 21.6 S2 on the kernel

From M11, filing a ruling (§11.4/§11.5) becomes: bench deliberates (LLM, unchanged) → judgment markdown written with citation `[<year>] VPS <ordinal>` where the ordinal is the ledger's next → **`enact`** `{ kind: "ruling", rule: {type:"free"}, authority: derived ⟨2026,1⟩, slug: "ruling<Year>N<ordinal>" }` → INDEX row appended. The judgment file is the *payload* (the content-bearing half the kernel deliberately cannot represent); the instrument is the *spine* (existence, citation, standing — the half that is now proved). `vps appeal` overturning a ruling = enact a new ruling with `supersedes: ⟨year,ordinal⟩` — the rank guard is satisfied by construction (ruling ⊇ ruling), entrenchment is enforced by the kernel, and standing thereafter reads from `effectiveB`, mirrored into front-matter as `status: overturned:[…]` for humans. `res_judicata`'s framing for VPS: INDEX is the memo table; for gate questions its soundness is checkable; for bench content, "sound" means "lawfully enacted" — the ceremony is trusted, and §21.9 says so.

### 21.7 The meta-gate

`vps gate [--staged | --paths a,b [--records n]]` (`src/kernel/gate.ts`):

- **Facts extraction** (the trusted base — deliberately small and dumb): `--staged` reads `git diff --cached --name-status`; `pathsChanged` = all touched paths, `recordsAdded` = count of status-`A` paths under `record/`. `--paths` takes an explicit list; `--records` defaults to the count of given paths under `record/`.
- **Evaluation**: regenerate a throwaway `lean/Spec/GateEval.lean` importing `Vps.Book` with `#eval gate { pathsChanged := […], recordsAdded := n }`, `checkFile` it (§7.5), parse the info message. `.allow` → exit 0. `.deny cites` → exit **6**, printing each citation with its `law/` title and summary — every denial names its law, and the theorem behind that sentence is in the kernel.
- **Hook**: M11 writes `gate/pre-commit` (calls `vps gate --staged`, blocks on exit 6) and installs it to `.git/hooks/pre-commit`. The hook's own directory is governed by VPS 3: changing it requires shipping a lawful superseding enactment in the same change — the gate protects itself.
- VPS's own write paths compose cleanly: every judgment filing writes its record stub (§21.5), so commits produced by normal VPS operation pass VPS 5 without ceremony; only *hand* edits to judgments get denied.

### 21.8 Pinning the genesis

M11's final step, before its acceptance run: write `law/genesis.md` — the sovereign grant, a few plain sentences naming the owner, the repository, the date, and the sentence "All force in this repository descends from this text via [2026] VPS 1." Compute its sha256; replace `sha256:GENESIS-PLACEHOLDER-PIN-ME` in `lean/Vps/Genesis.lean` with `sha256:<digest>`; rebuild (the whole book re-proves against the pinned digest); commit with `record/0001.md` ("genesis pinned"). This is the one sanctioned edit to constitutional text in the build, it happens exactly once, and after it VPS 2 governs every future touch of `lean/Vps/`.

### 21.9 Trust notes (rendered into README, verbatim in substance)

**Proved, over every lawful book:** append-only legitimacy, authority chains, citation freshness, rank-guarded supersession, entrenchment immunity and force, denial-naming. **Trusted:** the Facts extractor (small and dumb by design), the enactment ceremony code in `enact.ts`, `native_decide` in the example vectors and gate evaluation (compiler in the TCB), the genesis pin, and — as everywhere in VPS — the content of bench rulings and the human sign-off. The kernel narrows what must be trusted; it does not abolish it, and no output of this system may claim otherwise.

# PART VIII — FIXTURES, PHASES & OPERATION

## §16 — Fixtures (bundled; builder authors these)

**`fixtures/intake/sample-role.md`** — ~10 sentences, containing *exactly* these modelable requirements plus one vague line:

> We are hiring a Senior Software Engineer to join our platform team in Leeds.
> The role owns delivery of customer-facing services end to end.
>
> Requirements. Candidates must have at least five years of professional software experience. Fluency in TypeScript is essential for day-to-day work. The successful candidate will have led at least two production launches from design through release. Candidates must hold a current AWS certification. Finally, the candidate communicates clearly with stakeholders across the business.

**`fixtures/instances/will.json`** — passes everything: `yearsExp 6, skills ["TypeScript","Lean"], launchesLed 3, certifications ["AWS"]`.
**`fixtures/instances/casey.json`** — fails exactly the TypeScript duty: `yearsExp 7, skills ["Python","Go"], launchesLed 4, certifications ["AWS"]`.

**`fixtures/ir/sample-role.expected.json`** — the §6.4 IR with offsets corrected to the real file (builder computes them programmatically when writing the fixture — do not hand-count).

**`fixtures/kernel/`** — shipped in the zip, copied verbatim: `RogueRank.lean` (a ruling superseding a statute — must FAIL to compile), `RogueEntrenched.lean` (a statute superseding entrenched law — must FAIL to compile), `LawfulSupersession.lean` (a statute lawfully superseding VPS 3, then a vector showing the old act no longer bites — must compile). M11's test runner asserts the failures fail with `'decide' proved … is false` and the success succeeds. These reference the seed slugs of §21.4, so they compile (or correctly refuse to) against the generated seed book unchanged.

**`fixtures/prover/2026-08-22-sample-role.json`** — a `ProofCandidate[]` for the mock proof backend, used only by M8's test: `[{ "tactic": "sorry", "raw": "```lean\nsorry\n```", "attempt": 1 }, { "tactic": "native_decide", "raw": "native_decide", "attempt": 2 }, { "tactic": "decide", "raw": "by decide", "attempt": 3 }]`. This deliberately exercises all three paths: candidate 1 is rejected by sanitisation (`sorry`), candidate 2 is rejected by sanitisation (`native_decide` disallowed by default), candidate 3 is stripped of its leading `by` and accepted by Lean.

**`fixtures/intake/sample-role-r2.md`** — the base intake with **one sentence changed and one added**: "at least five years" becomes "at least seven years", and a new sentence "Hands-on Kubernetes experience is required." appears after the TypeScript sentence. Everything else byte-identical.

**`fixtures/ir/sample-role-r2.expected.json`** — the base expected IR with exactly two deltas: the minYears duty's `minCount` becomes 7, and a new duty `{ label: "Kubernetes required", kind: "skill", minCount: 0, needle: "Kubernetes" }` is appended (offsets recomputed against the r2 intake). Under this revision `will.json` flips RED (yearsExp 6 < 7, no Kubernetes) and `casey.json` stays RED — the flip is the M10 acceptance target.

**`fixtures/llm/*.json`** — recorded outputs for every prompt used on this case, so `VPS_MOCK_LLM=1` exercises the whole pipeline: `drafter.2026-08-22-sample-role.json` (returns the expected IR), three ensemble variants (`drafter.…​.e1/e2/e3.json` — mock provider disambiguates ensemble calls by an `attempt` suffix in `promptName`; make e1/e2 identical to the expected IR and e3 differ only in a field name, yielding convergence ≈ 0.67 ≥ 0.6), `backtranslate.…`, `faithfulness-judge.…` (faithful, no divergences), `test-proposer.…` (2 pass / 2 fail / 1 edge, all consistent with the predicate), `adversary.…` (`{"counterexamples":[]}`), `judge-first-instance.…` (one per question key — mock disambiguates by key suffix; rulings that simply endorse the draft's facts). **Plus the r2 revision set** for `…-sample-role-r2`: a drafter fixture returning the r2 expected IR, and revision-run fixtures for backtranslate / faithfulness-judge / test-proposer / adversary / judge-first-instance covering only the two new/changed question keys (the rest resolve from standing precedent, which the mock run must demonstrate by filing nothing for them).

---

## §17 — Build phases (M0–M11) & acceptance tests

**M0 — Scaffold & environment.** Repo skeleton, package.json/tsconfig, `scripts/doctor.sh`, elan installed, toolchain pinned.
✅ `bash scripts/doctor.sh` → all PASS. `git init` done, first commit.

**M1 — Lean skeleton.** lakefile.toml, Core.lean.
✅ `cd lean && lake build` exits 0 (Core.lean's `sanity` proves).

**M2 — IR + codegen (no LLM).** schema.ts, validate.ts, lean.ts, fixtures for intake/IR/instances.
✅ Vitest: (a) expected IR parses + semantically validates against the fixture intake; (b) `renderCaseLean(expectedIR, will, {theoremTactic:"decide", instanceName:"will"})` writes the case file and `checkFile` returns ok; (c) same with `casey` and `diagnostics:true, theoremTactic:null` → diagnosis reports exactly `["TypeScript essential"]` failing.

**M3 — LLM layer + S0/S1.** providers, json.ts, mock fixtures, prompts, intake+draft stages, state machine.
✅ `VPS_MOCK_LLM=1 vps intake fixtures/intake/sample-role.md && VPS_MOCK_LLM=1 vps draft 2026-08-22-sample-role` → `draft.ir.json` deep-equals the expected fixture; status `drafted`.

**M4 — Checks.** all five + report.
✅ `VPS_MOCK_LLM=1 vps check <case>` → exit 0, `checks/summary.json.passed === true`, report.md exists and lists the exclusion + the ensemble divergence note.

**M5 — Precedent.** `.justice/` install (with fallback), store, questions, first-instance court, S2.
✅ `VPS_MOCK_LLM=1 vps precedent <case>` → ≥3 rulings filed with sequential citations, INDEX rows present; re-running reports them as `applied`, files nothing new (idempotence).

**M6 — Sign-off → proof → verdict.** S4–S7, diagnose, verdict templates, instance command.
✅ `vps signoff <case> --approve --by "Will"` (files a ruling) → `vps instance <case> fixtures/instances/will.json` → `vps prove <case> --instance will` → status `proved`, tactic `decide` or `native_decide` → `vps verdict <case>` → GREEN with conditionality section. Then register `casey`, prove → `proof-failed`, verdict RED naming the TypeScript duty **and quoting** "Fluency in TypeScript is essential" from the intake.

**M7 — Orchestrator, README, live smoke.**
✅ Fresh clone simulation: delete `cases/`, run `VPS_MOCK_LLM=1 vps run` from intake to exit-2 gate, sign off, `vps run --instance will` to GREEN — one command each side of the gate. Write README.md (install, the two-command happy path, the conditionality caveat). *Optional if credentials available:* one live run with `--provider cli` on the same fixture; success = pipeline completes to the gate regardless of whether the live IR matches the fixture byte-for-byte (it won't — that's expected; checks and sign-off are what governs live drafts).


**M8 — Prover rung (build after M7; do not let it block M7).** `proofProvider.ts` with all four backends, `prompts/prover.md`, sanitisation, rung 4 wired into the S6 ladder, `--prover` flag, `searchRequired` flagging, prover fixtures.
✅ (a) Vitest: sanitisation rejects `sorry`, `axiom`, `def `, `import`, and (by default) `native_decide`; strips fences and leading `by`. (b) `VPS_PROVER=mock vps prove <case> --instance will --prover --force-from prove` with rungs 1–3 stubbed to fail → candidates 1 and 2 rejected by sanitisation, candidate 3 accepted by Lean, `proof.result.json.rung === 4` and `searchRequired === true`, verdict carries the search-required line. (c) If `ollama` is installed locally and the model is pulled, one live `--provider`-style smoke run; skip cleanly with a logged notice if not — M8 must pass without local weights.


**M9 — Sign-off web UI (build after M8; M7 remains the ship line).** `src/ui/server.ts`, `src/ui/review.html`, `--web`/`--port` flags, shared-path wiring, read-only mode.
✅ (a) Vitest against a case fixture in `checks-passed`: `GET /api/case` returns the full bundle with the correct `irSha`; `POST /api/signoff` with a stale `irSha` → `409` and no files written; with missing exclusion acks or an unanswered ambiguity → `422` and no files written. (b) Valid approve via the endpoint produces a `signoff.json` **byte-identical in content fields** to one produced by the CLI on a copy of the same case, and files the same ruling — proving the shared code path. (c) Server refuses to start on a case in `drafted`, naming the next command. (d) Reject with notes returns the case to `drafted` with the notes in history. (e) Manual smoke: open the page, confirm the exclusions banner renders for the sample case's one exclusion, span↔IR highlighting works both directions, keyboard-only completion of the whole flow is possible, and the approve button stays disabled until every acknowledgement is made. (f) `--web` on the already-signed case renders read-only. No external network requests occur at any point (assert: page loads with network disabled beyond localhost).

**M10 — Families, amendments & regression (build after M9; M7 remains the ship line).** §5.3 model in `state.ts`, `src/diff.ts` (word-level prose diff + structural IR diff), `amend`/`reprove`/`family` commands, revision inputs in S1, drift warning, supersession-at-signoff, revision panel in the web UI, verdict revision headers, r2 fixtures.
✅ All with `VPS_MOCK_LLM=1`, starting from the M7 end-state (base case signed off, will GREEN, casey RED):
(a) `vps amend 2026-08-22-sample-role fixtures/intake/sample-role-r2.md` → case `…-sample-role-r2` exists with `revision 2`, `supersedes` set, `amend.context.json` whose prose diff contains exactly the seven-years change and the Kubernetes addition, and both instance files copied forward; predecessor's `supersededBy` still null.
(b) `vps draft …-r2` → IR deep-equals the r2 expected fixture; `ir.diff.json` reports exactly two changes (minCount 5→7; one duty added) and zero drift warnings.
(c) `vps precedent …-r2` → files rulings **only** for the new/changed question keys; every untouched key resolves as `applied` from the base case's rulings — this is the precedent-makes-revisions-cheap property, asserted.
(d) checks pass; `vps signoff …-r2 --approve --by "Will"` → predecessor's `supersededBy` now set; `vps family` prints both cases with the link.
(e) `vps reprove …-r2` → `regression.report.md` exists; will's row reads GREEN@base → RED@r2 and **names the two failing duties with quoted source sentences** ("at least seven years…", "Hands-on Kubernetes experience is required."); casey's row is RED→RED, one line. Base case's own verdicts are untouched on disk; re-rendering the base verdict now carries the SUPERSEDED banner.
(f) Vitest for `src/diff.ts` on crafted inputs (insert/delete/replace at start, middle, end; identical inputs → empty diff), and a drift test: hand-mutate an untouched field name in a copy of the r2 IR → validation emits exactly one drift warning naming that field.
(g) Web UI on the r2 case in `checks-passed` renders the revision panel first, with the two IR-diff entries linking into the traceability tree; base cases render no revision panel.

**M11 — The constitutional kernel (build last; M7 remains the ship line).** Vendor `kernel/Vps/` → `lean/Vps/`; lakefile gains the `Vps` lib; `src/kernel/{book,enact,gate}.ts`; `book.json` seeded per §21.4; `renderBook`/`renderExamples`; store rewired to kernel numbering + enact-on-file (§11.4/§21.6); `vps gate`/`book`/`template`; `gate/pre-commit` installed; genesis pinned (§21.8); kernel fixtures wired.
✅ No LLM needed except (e):
(a) **Kernel green as shipped**: after vendoring and before any generation, `lake build` passes (Vps included).
(b) **Regeneration fidelity**: `renderBook`/`renderExamples` from the seed ledger produce a book that builds, with `theBook` order, `book_lawful` shape, and vectors matching the shipped templates' structure; a golden test diffs generated `Book.lean` against expectations.
(c) **Adversarial controls**: `RogueRank.lean` and `RogueEntrenched.lean` FAIL to compile (runner asserts non-zero exit and `is false` in diagnostics); `LawfulSupersession.lean` compiles and its post-supersession `.allow` vector holds.
(d) **The gate has teeth**: `vps gate --paths lean/Vps/Gate.lean` → exit 6 citing `[2026] VPS 2` with its law/ title; `--paths lean/Vps/Gate.lean,record/0002.md` → exit 0; `--paths gate/pre-commit --records 1` → exit 6 citing `[2026] VPS 3`. In a temp clone with the hook installed, a staged commit touching `gate/` is blocked; one adding a kernel change plus a record passes.
(e) **Enactment end-to-end** (`VPS_MOCK_LLM=1`): re-run M5's precedent flow on a fresh case copy → each filed ruling now enacts: `book.json` grew, `Book.lean` regenerated and built, `record/` stubs written, INDEX citations equal the kernel ordinals; re-run is idempotent (applied, nothing new). **Rollback**: force an entry with a bad parent citation → build fails → `book.json` byte-identical to its snapshot, no generated deltas remain, exit 4.
(f) **Appeal = supersession**: `vps appeal` on one filed ruling → superseding ruling enacted, build green, `#eval effectiveB` shows the old ruling out of force, front-matter mirrors `overturned`, and `vps book` displays standing correctly.
(g) **Genesis pinned**: `law/genesis.md` exists; its sha256 appears in `Genesis.lean`; `grep PLACEHOLDER lean/Vps/` is empty; the build re-proves; `record/0001.md` exists.
(h) M5's and M2's original acceptance tests still pass unchanged (store rewiring and lakefile growth broke nothing).
---


## §22 — Operator walkthrough: the first real case (JD → sign-off → CV → verdict)

The definition of done. After all phases are green, this is the owner's literal session — the builder finishes M11 by writing this section (adapted to any deviations) into README.md.

**1. Feed it the JD.** Save the job description as plain text/markdown, then:
```bash
vps intake ~/jd-senior-eng.md          # prints the caseId
vps run <caseId>                        # S1 draft → S2 precedent (rulings enacted into the book)
                                            # → S3 checks — then exits 2 at the human gate
```
First live run notes: expect ~8–12 LLM calls; the draft will not match the bundled fixtures — that is what the checks and your review are for. If a check fails (exit 3), read `cases/<id>/checks/report.md` and `vps draft <caseId> --from-checks` to redraft against the named failures.

**2. Sign off in the interface.**
```bash
vps review <caseId> --web               # opens the browser on 127.0.0.1
```
Read the back-translation against the JD; follow the span highlights; **acknowledge every exclusion** (prose the formalization deliberately does not cover — your verdict will not cover it either); answer every ambiguity card; approve. Approval files and enacts the ruling that every future verdict for this case is conditional on. If anything reads wrong, Reject with notes — the drafter redrafts against them.

**3. Feed it your CV.**
```bash
vps template <caseId> --name me > me.json   # skeleton with the exact fields the signed-off IR expects
$EDITOR me.json                                  # fill with TRUE values — the verdict is conditional on this data
vps instance <caseId> me.json
vps prove <caseId> --instance me
vps verdict <caseId>
open cases/<caseId>/verdict.md
```
**GREEN** = Lean has proved, for every requirement in the signed-off formalization, that this data satisfies it — read the conditionality section anyway; it is the honest half of the claim. **RED** = the report names each failing requirement, quotes the JD sentence it came from, and shows the comparison that failed — fix the data if it was wrong, reject the formalization if *it* was wrong, or accept that the requirement is genuinely unmet.

**4. When the JD changes later.**
```bash
vps amend <caseId> ~/jd-v2.md && vps run <newCaseId>
vps review <newCaseId> --web            # the revision panel leads: read the delta first
vps reprove <newCaseId>                 # every family instance re-proved
open cases/<newCaseId>/regression.report.md # flips are the headline
```

**5. House rules the constitution enforces for you** (denials cite their law, exit 6): kernel edits need a `record/` entry; `gate/` changes only by lawful enactment; hand-edited judgments without records are denied. `vps book` shows the law in force.

# PART IX — LAW OF THE BUILD

## §18 — Guardrails

### 18.1 For the builder (this session)

1. **No Mathlib.** Core Lean only. If a proof seems to need Mathlib, the IR is outside v1 scope — fail loudly.
2. **The LLM never authors Lean in S1–S3.** Only the IR. (S6 repair may author *tactic blocks only*.)
3. **Never bypass or weaken the S4 gate** — no `--yes`, no auto-approve, no env override.
4. Case Lean files are **regenerated, never patched**; the IR is the single source of truth.
5. Verdicts must always include the conditionality section. A GREEN without it is a bug.
6. Precedent conflicts stop the line (exit 2) — the pipeline never silently overrides a standing ruling, and never files rulings above First Instance without a human command.
7. Don't invent config options, stages, or IR fields beyond this plan. Undecided ⇒ smallest thing that satisfies the acceptance test, noted in README's "deviations" section.
8. Keep intake.md byte-identical to the source file forever — offsets depend on it.
9. **The prover proposes; Lean disposes.** Prover output is untrusted text: sanitise per §8.6, splice, and let `checkFile` adjudicate. Never accept a proof because the model asserted it, never let prover output introduce definitions, data, `sorry`, `axiom`, or `import`, and never disable sanitisation to make a stubborn goal close. `native_decide` is disallowed from prover output by default because it moves trust from the kernel to compiled code — a human may enable it per-case via `prover.allowNativeDecide`, but a model may not choose it for you.
10. **Prover off by default (`prover.enabled: false`), and always below the decide-ladder.** If a v1 goal needs rung 4, treat that as a *bug signal* — the likely cause is a codegen or IR fault, not a hard theorem. Investigate before celebrating the proof.
11. **The UI is one page, one write.** `review --web` binds to 127.0.0.1 only, serves no external assets, exposes exactly one writing endpoint, and that endpoint calls the shared S4 code path. No approve-all affordance, no way to submit with unacknowledged exclusions or unanswered ambiguities, no framework, no build step. Do not add pages, dashboards, or endpoints beyond §15.5.
12. **Amendments never mutate.** `intake.md`, signed-off IRs, filed rulings, and past verdicts are append-only history. A revision is a new case; supersession is a pointer set at the successor's sign-off, never a deletion or edit. `reprove` writes new verdict files; it never rewrites old ones. No command may edit a superseded case except to render its SUPERSEDED banner.
13. **Minimal-delta drafting is enforced, not hoped for.** Revision drafts that change IR material outside the prose diff produce drift warnings that surface at S4 in the exclusions-banner register; the builder must not soften this to an info-level log. Departing from standing precedent in a revision goes through `vps appeal` — the amend path grants no re-litigation licence.
14. **The kernel is copied, never retyped; generated law is regenerated, never patched.** `Book.lean` and `Examples.lean` come only from `renderBook`/`renderExamples` over `book.json`; the seven constitutional files come only from `kernel/Vps/` (the genesis pin of §21.8 being the single sanctioned exception). If an enactment's build fails, roll back — never "fix" generated law by hand to make the book compile.
15. **The kernel narrows trust; it must not be described as abolishing it.** Every place the system speaks about VPS (README, gate messages, verdicts) inherits §21.9's framing: mechanics proved, bench content and ceremony trusted. And per Protocol 5b: no Lean artefact ships unbuilt.
16. **The UI must under-promise.** No "verified" language, no success celebration on approve. The action-bar standing text in §15.5.3(9) appears verbatim and is never demoted visually below the buttons.

### 18.2 `CLAUDE.md` (repo root — verbatim, then append VJS's plugin/CLAUDE.md under `## VJS`)

```markdown
# VPS — agent guardrails

This repo is a prose→proof factory. Stages S0–S4 are judgment (LLM drafts, precedent,
checks, HUMAN sign-off). Stages S5–S7 are mechanism (Lean). Read VPS-PLAN.md before
changing anything.

Hard rules for any AI session working here:
1. Never bypass `vps signoff`. If it blocks you, stop and ask the human.
2. Never hand-edit files under lean/Spec/Cases/ — they are generated from the IR.
   Change the IR (via `vps draft`) instead.
3. Never edit .justice/judgments/ by hand. Rulings are filed only through vps
   commands. Conflicts with standing rulings go through `vps appeal`.
4. A GREEN verdict is conditional on the signed-off formalization and the input data.
   Never describe it as more than that.
5. No Mathlib. No new IR ops or types without a plan revision and a ruling.
5b. The prover (rung 4) proposes tactics only. Never accept a proof Lean has not
   type-checked, never disable output sanitisation, and never let prover output
   modify a theorem statement, a definition, or the requirement data.
5c. The review UI (`vps review --web`) is the S4 gate's surface, not a product.
   One page, one write endpoint, local-only, shared S4 code path. Never add an
   approve shortcut, weaken its required acknowledgements, or grow it new pages.
5d. Requirements changes go through `vps amend` (new revision), never by editing
   an existing case's intake or IR. Old verdicts are permanent statements about their
   revision. After signing off a revision, run `vps reprove` and read the
   regression report before trusting any prior GREEN.
5e. The statute book is law. Never edit lean/Vps/, Book.lean, Examples.lean,
   .justice/book.json, record/, or law/ by hand: rulings enact through vps
   commands, and the build is the enactment. If `vps gate` denies your commit
   (exit 6), read the cited law — do not route around the gate, do not touch
   gate/, and never weaken a rule to make a change pass.
6. Prefer `VPS_MOCK_LLM=1` when testing pipeline changes.
```

---

## §19 — Risk register & fallbacks

| Risk | Detection | Fallback |
|---|---|---|
| elan install blocked | doctor FAIL | Retry once; else report the exact curl error and stop M0 — Lean is load-bearing |
| First `lake build` slow | >2 min | Expected once; only fail past `leanTimeoutMs` on *subsequent* runs |
| `native_decide` unavailable/odd on toolchain | S6 attempt error | Ladder already falls through to `simp; decide` + repair loop |
| `claude` CLI envelope shape differs | JSON parse fail in claudeCli | Fall back to plain-text stdout; if still failing, provider `api`; if no key, instruct user, exit 5 |
| Model returns broken JSON | zod fail | §8.4 repair loop, ≤3, then exit 5 with the raw output saved to the case dir |
| VJS fetch 404s | HTTP error | Stub files with source URL note (§11.1); formats in this plan are self-sufficient |
| Drafter hallucinates quotes | §6.5 rule 2 | Hard validation failure → redraft with errors; never soften this check |
| Ensemble flaky in live mode | convergence < threshold | That's signal, not noise: it fails the check and surfaces divergences to the human — intended |
| Offsets drift (editor re-saves intake) | traceability failure | intake.md is written once by `vps intake`; treat any hash change as case-invalidating |
| Ollama absent / model not pulled | connection refused on `propose` | M8 test (c) skips cleanly; runtime falls through rung 4 to rung 5 with a logged notice — never fail the case for a missing optional backend |
| Prover emits prose, fences, or a whole file | sanitisation | Reject the candidate, log it, move to the next sample — no repair, no partial splice |
| Prover output type-checks but proves something else | — | Structurally impossible: the theorem statement is generated by codegen from the IR and the prover only replaces the `by` block. Never let prover output touch the statement |
| 7B prover quant is slow on first load | >timeout on attempt 1 | `timeoutMsPerAttempt` applies per candidate; allow one cold-start retry before falling to rung 5 |
| Port 4780 in use | listen error | Retry on 4781–4790, print the bound port; `--port` overrides |
| Browser fails to open | `open` non-zero | Print the URL and continue serving — never fail the review for this |
| Reviewer edits IR while page open | stale `irSha` on submit | `409`, nothing written, page instructs reload (§15.5.5) |
| UI drifts from CLI gate semantics | M9 test (b) | Shared S4 code path is an invariant (§13.3); any divergence is a release blocker |
| Revision quietly rewrites untouched modelling | drift warnings in `ir.diff.json` | Surface at S4 in the loudest register (§18.1.13); reviewer decides, never auto-accepted |
| Family grows, reprove gets slow | many instances × revisions | Acceptable in v1 (goals are `decide`-fast); batch/parallel reprove is a §20 item |
| Stale GREEN trusted after an amendment | superseded case consulted | SUPERSEDED banner on every superseded verdict render, `family` command shows current head; CLAUDE.md 5d mandates reprove-then-read |
| Kernel fails to build as shipped | M11 (a) | Stop; diff `lean/Vps/` against `kernel/Vps/` (should be byte-identical) and confirm the toolchain is exactly v4.15.0 — do not "fix" kernel proofs; report instead |
| Enactment build fails mid-flight | non-zero `lake build Vps` | §21.5 rollback: ledger snapshot restored, generated deltas removed, exit 4 with diagnostics — the enactment never happened |
| `decide` sticks on string prefixes in future law | new rule shapes | Vectors and gate eval already use `native_decide`; `book_lawful` needs only string equality — if a future Rule constructor breaks that, it is an Article 10 amendment, not a tactic swap |
| Gate hook bypassed with `--no-verify` | human choice | Out of scope to prevent; the gate governs the honest path, and CI re-running `vps gate` on the pushed diff is the §20 answer |
| Book grows large, `book_lawful` slow | many rulings | Linear nesting of `by decide` steps; acceptable for v1 scale — kernel-side proof caching is a §20 item |

---

## §20 — Out of scope (v2 roadmap — do not build now)

*(2026-08-23: **richer types shipped** — see §6 and [2026] VPS 28. **The read-only Docket shipped** — see README deviation 7; it is a separate surface from the S4 gate and holds no write endpoint. **General theorems shipped** — `vps theorem <case> --property stricter|exclusive`, see [2026] VPS 29. §20 predicted these "will also require enabling Mathlib"; that is wrong, and in the cheaper direction. `omega` and `List.all_eq_true` are both core Lean 4.15, so revision-strictness closes with one hand-proved lemma (`Spec.all_of_subset`) plus a decidable subset check, and duty-exclusivity closes with `simp` then `omega`. §18.1.1 stands unamended and §18.1.10 extends rather than retires: a general goal this fragment cannot close has left the fragment. Two limits are on the record — the subset argument is syntactic, so a RAISED threshold is not established though it is semantically stricter; and revisions whose model changed are refused as not comparable rather than compared unsoundly.)*

Nested quantifiers and temporal logic · Mathlib option for genuinely mathematical specs · Supreme Court + anonymised community precedent submission · brownfield mode (extract requirements from an existing codebase per VJS's guidance) · web dashboard · packaging/publishing · parallel/batch `reprove` across large families · cross-family impact analysis (which families' precedents a proposed appeal would disturb) · ~~proof of *general* theorems~~ (SHIPPED 2026-08-23, [2026] VPS 29) rather than concrete instances.

**Note on the kernel:** shipped in v1 as §21. Deferred kernel work: CI re-verification of `vps gate` on pushed diffs (the `--no-verify` answer) · richer `Rule` constructors (any extension is an Article 10 amendment re-establishing every proof) · kernel-side performance work for large books · a `Verdict` payload generalisation if bench rulings ever need machine-readable content in the kernel itself (today the payload deliberately lives outside it, per Art. 8).

**Note on the UI:** v1 ships exactly one page (§15.5). Pipeline dashboards, a precedent browser beyond the read-only rulings links, multi-case views, and remote/hosted access are all v2 — and any of them must inherit §18.1.14's under-promising rule before they inherit anything else.

**Note on the prover:** M8 installs the DeepSeek-Prover rung now, but it is scaffolding waiting for its use case. Rung 4 will sit idle on v1 goals, because `decide` wins every time a goal is a finite computation. It starts earning its keep the moment the general-theorem work above lands — those goals are `∀` over infinite domains, cannot be evaluated, and need genuine proof search. Expect that step to also require enabling Mathlib (currently forbidden by §18.1.1), since general theorems reach for library lemmas; that is a deliberate, plan-revising decision, not something to switch on quietly.

---

*End of plan. Builder: begin at M0.*
