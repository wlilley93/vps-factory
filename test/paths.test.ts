// Locks down the property that every path in src/ is resolved against an explicit repo
// root rather than process.cwd(). Without a test that actually runs the CLI from somewhere
// else, bare relative literals creep back in within a week and nobody notices until a
// server or a scheduled run fails in a way that looks like a missing case.
import { describe, it, expect } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const exec = promisify(execFile);
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(repo, "src", "cli.ts");
const tsx = path.join(repo, "node_modules", ".bin", "tsx");

describe("repo-root resolution", () => {
  it("runs from a directory that is not the repo, via --root", async () => {
    const away = fs.mkdtempSync(path.join(os.tmpdir(), "vps-away-"));
    const { stdout } = await exec(tsx, [cli, "--root", repo, "status", "2026-08-22-sample-role"], {
      cwd: away,
      env: { ...process.env, VPS_MOCK_LLM: "1", VPS_ROOT: "" }
    });
    expect(stdout).toContain("2026-08-22-sample-role");
    expect(stdout).toContain("family=2026-08-22-sample-role");
  }, 60_000);

  it("runs from elsewhere via $VPS_ROOT", async () => {
    // `book` used to serve here; it left with the jurisdiction (record/0037). `family` is
    // the equivalent root-dependent read: it scans cases/ relative to the resolved root.
    const away = fs.mkdtempSync(path.join(os.tmpdir(), "vps-away-"));
    const { stdout } = await exec(tsx, [cli, "family", "2026-08-22-sample-role"], {
      cwd: away,
      env: { ...process.env, VPS_ROOT: repo, VPS_MOCK_LLM: "1" }
    });
    expect(stdout).toContain("2026-08-22-sample-role");
  }, 60_000);

  it("has no bare-relative filesystem literals left in src/", () => {
    // The regression this whole module exists to prevent. Rule *scopes* in kernel/seed.ts
    // ("lean/Vps/", "law/") are statute data matched against git paths, not filesystem
    // reads, so they are deliberately not caught by this pattern.
    const bad: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const f = path.join(dir, e.name);
        if (e.isDirectory()) { walk(f); continue; }
        if (!f.endsWith(".ts")) continue;
        if (f.endsWith(path.join("src", "paths.ts"))) continue;
        const src = fs.readFileSync(f, "utf8");
        const re = /fs\.(readFileSync|writeFileSync|existsSync|mkdirSync|readdirSync|appendFileSync|copyFileSync)\(\s*"(cases|lean|prompts|fixtures|record|scripts)[/"]/g;
        if (re.test(src)) bad.push(path.relative(repo, f));
        if (/cwd:\s*"lean"/.test(src)) bad.push(path.relative(repo, f) + " (cwd: \"lean\")");
      }
    };
    walk(path.join(repo, "src"));
    expect(bad).toEqual([]);
  });
});
