# Why this directory is called `Vjs` and cannot be renamed

This holds **this jurisdiction's own statute book** — not the Vibe Justice System, which is a
separate repository with its own jurisdiction. The name is historical and, more to the point,
it is now **load-bearing law**.

`[2026] VPS 30` (Book Protection Act) has `recordRequired` over the literal scope
`lean/Vjs/`. It is **entrenched**, and `entrenched_immune` — a theorem in the kernel — holds
that an entrenched instrument cannot be superseded at all. So the statute cannot be repointed
at a new path, and renaming this directory does not move the protection: it silently strips
it, leaving the generated statute book editable by hand with no record required.

That happened once already, on 2026-08-23, minutes after VPS 30 was enacted (see
`record/0034.md`). The rename built cleanly, the tests mostly passed, and the only symptom
was the gate quietly allowing a change it had denied moments before.

**Entrenchment makes directory names constitutional.** If this must ever be renamed, the
sequence is: enact a new statute over the new path FIRST, verify it denies, then move — and
accept that VPS 30 remains on the book, standing and vacuous, forever.
