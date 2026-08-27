# VPS — agent guardrails

This repo is a prose→proof factory. Stages S0–S4 are judgment (LLM drafts, precedent,
checks, HUMAN sign-off). Stages S5–S7 are mechanism (Lean). Read VPS-PLAN.md before
changing anything.

Hard rules for any AI session working here:
1. Never bypass `vps signoff`. If it blocks you, stop and ask the human.
2. Never hand-edit files under lean/Spec/Cases/ — they are generated from the IR.
   Change the IR (via `vps draft`) instead.
3. Adjudication belongs to the court, not this repo. S2 asks VJS over the client
   interface and nothing is filed here. Resolve a conflict with standing precedent by
   conforming the draft (`vps draft <case> --from-checks`) or by `vjs appeal <citation>`.
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
5e. This repo is not a jurisdiction (record/0037). It holds no statute book, no
   citations and no genesis, so there is no gate here and nothing to enact: `gate`,
   `book`, `appeal` and `precedents` are the court's verbs — `vjs docket`, `vjs search`,
   `vjs appeal`, `vjs book`. record/ is append-only history, not law: add entries, never
   rewrite one. Self-protection here is tests, so never weaken a test to make a change pass.
5f. There is no daemon, no watcher, and no auto-resume. `runCase` is status-driven and
   re-reads state.json at every guard, so resuming a parked run is just calling it again.
   A resident process that resumes work automatically is one config flag away from one
   that approves work automatically -- and it will be proposed, because "it already
   resumes everything else". Polling is `vps status <case> --json`, in the caller's
   own process, with no write capability.
5g. `vps docket` is a READ-ONLY record surface with zero write endpoints, and is NOT
   the gate. It must never gain a POST handler, an approve affordance, or a control that
   looks like one; it links out to `vps review <case> --web` in plain text. Read-only
   is enforced structurally -- the docket's import graph cannot reach a writer, and
   test/docket-readonly.test.ts asserts that, the absence of fs writes, and a 405 on every
   non-GET method. Its vocabulary is governed by VPS-PLAN §18.1.16 and tested in
   test/docket-vocabulary.test.ts.
6. Prefer `VPS_MOCK_LLM=1` when testing pipeline changes.

## VJS
(Upstream plugin/CLAUDE.md no longer exists at a fetchable path — see VPS-PLAN §11.1
v2.1. The operative successors of its rules are 1–5e above and the kernel in lean/Vps/.)
