# Deferred Lean verification ledger

**2026-10-07: one historical gate evaluation remains deferred, not verified.**

## Previously discharged

The batch queued on 2026-08-22 — 16 `lake build Vps` enactments ([2026] VPS 6–21),
9 per-case `lake env lean --json` checks, and 3 gate evaluations — was recorded as
executed on 2026-08-23 against Lean 4.15.0 (arm64-apple-darwin23.6.0, commit
11651562caae). See `record/0018.md` for that historical evidence; this cleanup did
not re-run those checks. That discharge does not cover the unchecked entry below.

## Still deferred

- [ ] gate eval via Lean for facts {"pathsChanged":["README.md"],"recordsAdded":0}

This entry is not discharged by a successful factory build. The factory retired its
jurisdiction in `record/0037.md` (also noted in VPS-PLAN §21): it has no local book
or constitutional gate, and `lean/lakefile.toml` declares only `Spec`, with no kernel
dependency. Reproducing this historical evaluation would require its original book
and kernel context; restoring them or running a court evaluation is outside DEV-436.
No allow/deny result is claimed, and this historical gate entry is not a case verdict.

The runner appends here when Lean is unreachable. A deferred case verdict must be
read as expected, not machine-checked, until its own Lean check is executed.

## DEV-436 package verification — 2026-10-07

### Baseline and residual import

From the worktree root at `c79442b73905e75a3eb64a3bc5c05f862dc3b4d5`, export the tracked
Lean package into a fresh directory (no build cache):

```sh
scratch=$(mktemp -d)
git archive HEAD lean | tar -x -C "$scratch"
lake --dir "$scratch/lean" env lean --version
lake --dir "$scratch/lean" build
```

Measured output (both Lake commands exited 0):

```text
Lean (version 4.15.0, arm64-apple-darwin23.6.0, commit 11651562caae, Release)
✔ [2/4] Built Spec.Core
✔ [3/4] Built Spec
Build completed successfully.
```

The default build already passed: `lean/Spec.lean` imports only `Spec.Core` and
never reaches `Spec/GateEval.lean`. Directly checking the residual file with the
following exact command exited 1:

```sh
lake --dir /var/folders/d3/kjqpj9f92m751wdg7rsnn56c0000gn/T/tmp.lHLqghCkD0/lean env lean /var/folders/d3/kjqpj9f92m751wdg7rsnn56c0000gn/T/tmp.lHLqghCkD0/lean/Spec/GateEval.lean
```

```text
/var/folders/d3/kjqpj9f92m751wdg7rsnn56c0000gn/T/tmp.lHLqghCkD0/lean/Spec/GateEval.lean:1:0: error: unknown module prefix 'Vps'

No directory 'Vps' or file 'Vps.olean' in the search path entries:
/var/folders/d3/kjqpj9f92m751wdg7rsnn56c0000gn/T/tmp.lHLqghCkD0/lean/./.lake/build/lib
/Users/williamlilley/.elan/toolchains/leanprover--lean4---v4.15.0/lib/lean
/Users/williamlilley/.elan/toolchains/leanprover--lean4---v4.15.0/lib/lean
```

Removed `lean/Spec/GateEval.lean`, rather than declaring a kernel dependency or
repointing the evaluation: it was a throwaway remnant of the retired gate, not a
factory specification. Its facts concerned `record/0032.md` and `scripts/doctor.sh`
with one record added, so it was not the README evaluation deferred above either.
The manifest and pinned toolchain are unchanged.

### Corrected package

From the worktree root, copy only existing tracked Lean files into another fresh
directory, excluding all cached build products and the removed file:

```sh
scratch=$(mktemp -d)
git ls-files -z lean | while IFS= read -r -d '' file; do
  if test -f "$file"; then
    mkdir -p "$scratch/$(dirname "$file")"
    cp "$file" "$scratch/$file"
  fi
done
lake --dir "$scratch/lean" env lean --version
lake --dir "$scratch/lean" build
```

Measured output (both Lake commands exited 0):

```text
Lean (version 4.15.0, arm64-apple-darwin23.6.0, commit 11651562caae, Release)
✔ [2/4] Built Spec.Core
✔ [3/4] Built Spec
Build completed successfully.
```

The acceptance command from the worktree root, `(cd lean && lake build)`, also
exited 0, with exact output:

```text
Build completed successfully.
```

These builds verify the default `Spec` target, not every generated case/theorem,
the application test suite, or the deferred historical gate evaluation. README's
Trust/Layout/Status text and CLAUDE.md's VJS note now reflect the Spec-only package
and the court-owned kernel relationship, not a vendored `lean/Vps/` kernel.
