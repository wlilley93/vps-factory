// One advisory lock per repository, held for the duration of a mutating command.
//
// Why repo-wide rather than per-case: the worst corruption available here is not a lost
// history entry, it is a duplicated citation. `nextOrdinal()` is a max+1 scan over
// `.justice/book.json`, so two concurrent sign-offs allocate the SAME `[2026] VPS n` and
// the statute book — whose uniqueness is supposed to be the theorem `citation_unique` —
// ends up holding two different instruments at one citation. A per-case lock would not
// protect the allocator, because the allocator is global. The workload is one human plus
// maybe one script, so serialising whole commands costs nothing and the simplicity IS the
// correctness argument.
//
// Mechanism is `mkdir`, not `open(O_EXCL)`: mkdir is the atomic primitive that behaves
// identically on APFS, ext4 and NFS, and cannot be left half-created.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { R } from "./paths.js";

export interface Lock { release(): void }

interface Owner { pid: number; host: string; cmd: string; at: string }

const lockDir = () => R(".vps-lock");
const ownerFile = () => path.join(lockDir(), "owner.json");

function readOwner(): Owner | null {
  try { return JSON.parse(fs.readFileSync(ownerFile(), "utf8")) as Owner; }
  catch { return null; }
}

/** A lock is stale only if its owning process is provably gone ON THIS HOST. Never steal
 *  on elapsed time: S3 legitimately holds the lock for minutes while it makes 7+ LLM
 *  calls, and stealing from a live run is worse than waiting for a dead one. */
function isStale(o: Owner | null): boolean {
  if (!o) return true;                       // unreadable owner file — treat as abandoned
  if (o.host !== os.hostname()) return false; // different machine: cannot know, so never steal
  try { process.kill(o.pid, 0); return false; } catch { return true; }
}

function describe(o: Owner | null): string {
  if (!o) return "another vps command is running in this repo";
  const age = Math.round((Date.now() - Date.parse(o.at)) / 1000);
  return `another vps command is running in this repo (pid ${o.pid}, \`${o.cmd}\`, started ${age}s ago)`;
}

/**
 * Acquire the repo lock. Fails fast by default — a blocking default would silently queue
 * a caller behind a multi-minute S3 run with no output. Pass waitMs to block.
 */
export async function acquire(cmd: string, opts: { waitMs?: number } = {}): Promise<Lock> {
  const waitMs = opts.waitMs ?? 0;
  const deadline = Date.now() + waitMs;
  for (;;) {
    try {
      fs.mkdirSync(lockDir());
      const owner: Owner = { pid: process.pid, host: os.hostname(), cmd, at: new Date().toISOString() };
      fs.writeFileSync(ownerFile(), JSON.stringify(owner, null, 2));
      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        try { fs.rmSync(lockDir(), { recursive: true, force: true }); } catch { /* best effort */ }
      };
      // Best-effort cleanup on normal exit. Deliberately no SIGINT handler: swallowing
      // Ctrl-C to tidy up is a worse failure than leaving a lock a later run can detect.
      process.once("exit", release);
      return { release };
    } catch (e: any) {
      if (e?.code !== "EEXIST") throw e;
      const owner = readOwner();
      if (isStale(owner)) {
        try { fs.rmSync(lockDir(), { recursive: true, force: true }); } catch { /* raced */ }
        continue;
      }
      if (Date.now() >= deadline) {
        throw Object.assign(
          new Error(`${describe(owner)}\n  wait for it to finish, or re-run with --wait <seconds>`),
          { code: 1 }
        );
      }
      await new Promise(r => setTimeout(r, 200));
    }
  }
}

export async function withLock<T>(cmd: string, fn: () => Promise<T>, opts?: { waitMs?: number }): Promise<T> {
  const lk = await acquire(cmd, opts);
  try { return await fn(); } finally { lk.release(); }
}
