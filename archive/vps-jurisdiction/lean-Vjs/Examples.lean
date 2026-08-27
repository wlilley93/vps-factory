/-
GENERATED example vectors (Art. 8): every operative rule demonstrates one world
it denies and one it allows. native_decide: String.isPrefixOf does not
kernel-reduce (PROVENANCE); the compiler joins the trusted base for these
vectors only (§21.9).
-/
import Vps.Book

namespace Vjs
open Vps

-- [2026] VPS 30 (Book Protection Act): deny vector
example : gate { pathsChanged := ["lean/Vjs/Book.lean"], recordsAdded := 0 }
    = .deny [actBookProtection.cite] := by native_decide

-- [2026] VPS 30: allow vector
example : gate { pathsChanged := ["lean/Vjs/Book.lean", "record/0033.md"], recordsAdded := 1 }
    = .allow := by native_decide

-- [2026] VPS 5 (Judgment Integrity Act): deny vector
example : gate { pathsChanged := [".justice/judgments/first-instance/001-x.md"], recordsAdded := 0 }
    = .deny [actJudgmentIntegrity.cite] := by native_decide

-- [2026] VPS 5: allow vector
example : gate { pathsChanged := [".justice/judgments/first-instance/001-x.md", "record/0009.md"], recordsAdded := 1 }
    = .allow := by native_decide

-- [2026] VPS 4 (Record Discipline Act): deny vector
example : gate { pathsChanged := ["law/2026-vps-4.md"], recordsAdded := 0 }
    = .deny [actRecordDiscipline.cite] := by native_decide

-- [2026] VPS 4: allow vector
example : gate { pathsChanged := ["law/2026-vps-4.md", "record/0008.md"], recordsAdded := 1 }
    = .allow := by native_decide

-- [2026] VPS 3 (Gate Integrity Act): deny vector
example : gate { pathsChanged := ["gate/pre-commit"], recordsAdded := 1 }
    = .deny [actGateIntegrity.cite] := by native_decide

-- [2026] VPS 3: allow vector
example : gate { pathsChanged := ["src/cli.ts"], recordsAdded := 0 }
    = .allow := by native_decide

-- [2026] VPS 2 (Kernel Protection Act): deny vector
example : gate { pathsChanged := ["lean/Vps/Gate.lean"], recordsAdded := 0 }
    = .deny [actKernelProtection.cite] := by native_decide

-- [2026] VPS 2: allow vector
example : gate { pathsChanged := ["lean/Vps/Gate.lean", "record/0002.md"], recordsAdded := 1 }
    = .allow := by native_decide

end Vjs
