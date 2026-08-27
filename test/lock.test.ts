// The repo lock exists to stop concurrent writers corrupting the statute book: the
// citation allocator is a max+1 scan over .justice/book.json, so two simultaneous
// sign-offs would allocate the SAME [2026] VPS n — which makes `citation_unique`, a
// theorem the kernel proves, false of the artefact on disk.
import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { setRoot } from "../src/paths.js";
import { acquire, withLock } from "../src/lock.js";

let tmp: string;
const freshRoot = () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vps-lock-"));
  fs.writeFileSync(path.join(tmp, "vps.config.json"), "{}");
  setRoot(tmp);
  return tmp;
};

afterEach(() => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* */ } });

describe("repo lock", () => {
  it("refuses a second holder and names who holds it", async () => {
    freshRoot();
    const first = await acquire("run <case>");
    await expect(acquire("verdict <case>")).rejects.toThrow(/another vps command is running/);
    // and the refusal is actionable — it names the pid and the command
    await acquire("verdict <case>").catch((e: Error) => {
      expect(e.message).toContain(String(process.pid));
      expect(e.message).toContain("run <case>");
      expect(e.message).toContain("--wait");
    });
    first.release();
  });

  it("lets the next holder in once released", async () => {
    freshRoot();
    const first = await acquire("run");
    first.release();
    const second = await acquire("verdict");   // must not throw
    second.release();
    expect(fs.existsSync(path.join(tmp, ".vps-lock"))).toBe(false);
  });

  it("steals a lock whose owning process is gone, but only on this host", async () => {
    const root = freshRoot();
    const dir = path.join(root, ".vps-lock");
    fs.mkdirSync(dir);
    // pid 1 exists; a pid that cannot exist is the honest test of "provably dead".
    fs.writeFileSync(path.join(dir, "owner.json"), JSON.stringify({
      pid: 2 ** 30, host: os.hostname(), cmd: "run", at: new Date().toISOString()
    }));
    const lk = await acquire("verdict");       // stale -> stolen
    lk.release();

    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, "owner.json"), JSON.stringify({
      pid: 2 ** 30, host: "some-other-machine", cmd: "run", at: new Date().toISOString()
    }));
    // Different host: we cannot know whether that process lives, so we must NOT steal.
    await expect(acquire("verdict")).rejects.toThrow(/another vps command is running/);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("serialises concurrent writers", async () => {
    freshRoot();
    const order: string[] = [];
    const work = (tag: string) => withLock(tag, async () => {
      order.push(`${tag}:enter`);
      await new Promise(r => setTimeout(r, 40));
      order.push(`${tag}:exit`);
    }, { waitMs: 5000 });
    await Promise.all([work("a"), work("b"), work("c")]);
    // No interleaving: every enter is immediately followed by its own exit.
    for (let i = 0; i < order.length; i += 2) {
      expect(order[i + 1]).toBe(order[i].replace(":enter", ":exit"));
    }
    expect(order).toHaveLength(6);
  });
});
