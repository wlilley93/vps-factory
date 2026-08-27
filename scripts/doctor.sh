#!/bin/sh
# VPS environment doctor (§2). PASS/FAIL table; non-zero exit on FAIL.
ok=0
check() { name="$1"; shift; if "$@" >/dev/null 2>&1; then echo "PASS  $name"; else echo "FAIL  $name"; ok=1; fi; }
node_major=$(node -e 'console.log(process.versions.node.split(".")[0])' 2>/dev/null || echo 0)
if [ "$node_major" -ge 20 ]; then echo "PASS  node >= 20 (v$(node -v 2>/dev/null))"; else echo "FAIL  node >= 20"; ok=1; fi
check "git" git --version
# A version string is the evidence, not the binary. elan installs shims that exist on PATH
# even when no toolchain is selected for the directory (elan --default-toolchain none), so
# `command -v lean` succeeds while lean cannot run a thing. Reporting PASS on that is a check
# that passes about itself rather than about Lean.
if command -v lean >/dev/null 2>&1; then
  leanver=$(lean --version 2>/dev/null | head -1)
  if [ -n "$leanver" ]; then echo "PASS  lean ($leanver)"
  else echo "FAIL  lean: on PATH but reports no version — elan has no toolchain selected here (try: elan default leanprover/lean4:v4.15.0)"; ok=1; fi
else echo "FAIL  lean (see README deviations: Lean execution deferred in this environment)"; ok=1; fi
if command -v claude >/dev/null 2>&1; then echo "PASS  llm provider: claude CLI"; elif [ -n "$ANTHROPIC_API_KEY" ]; then echo "PASS  llm provider: API key"; else echo "NOTE  no live LLM provider (mock mode only)"; fi

# Kernel provenance. Nothing is vendored: the engine arrives as a pinned lake dependency,
# so there is no second copy to drift and no digest list to maintain. This replaces the
# check record/0020 introduced with a demolition date — the date arrived (record/0033).
if [ -f lean/lake-manifest.json ]; then
  if grep -q '"name": "vps"' lean/lake-manifest.json; then
    echo "PASS  kernel is a pinned dependency (no vendored copy)"
  else
    echo "FAIL  lean/lake-manifest.json does not pin the vps kernel"; ok=1
  fi
fi

exit $ok
