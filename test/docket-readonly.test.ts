// "The docket cannot write" has to be a checkable property, not a comment. Three tests:
// the import graph never reaches a writer, the file contains no fs write call, and the
// running server refuses every non-GET method.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = (rel: string) => path.join(repo, "src", rel);

/** Follow relative imports from an entry file and return every reachable src/ module. */
function transitiveImports(entry: string): string[] {
  const seen = new Set<string>();
  const stack = [entry];
  while (stack.length) {
    const f = stack.pop()!;
    if (seen.has(f) || !fs.existsSync(f)) continue;
    seen.add(f);
    const text = fs.readFileSync(f, "utf8");
    for (const m of text.matchAll(/from\s+"(\.[^"]+)"/g)) {
      const rel = m[1].replace(/\.js$/, ".ts");
      stack.push(path.resolve(path.dirname(f), rel));
    }
  }
  return [...seen];
}

describe("the docket is read-only", () => {
  /** Comments must be stripped before scanning: model.ts's own header names the writers it
   *  is required to stay away from, and a naive scan flags that prose as a violation. */
  const stripComments = (s: string) =>
    s.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").filter(l => !l.trim().startsWith("//")).join("\n");

  it("never imports anything that can mutate the record", () => {
    const reachable = transitiveImports(src("ui/docket.ts"));
    // Writers, by name. If the docket can reach any of these, a future edit could call one.
    const forbidden = ["s4_signoff", "advance", "writeState", "fileRuling", "enact", "initState", "writeBook"];
    const offenders: string[] = [];
    for (const f of reachable) {
      const code = stripComments(fs.readFileSync(f, "utf8"));
      for (const line of code.split("\n")) {
        if (!/^\s*import\b/.test(line)) continue;
        for (const name of forbidden) {
          if (new RegExp(`\\b${name}\\b`).test(line)) {
            offenders.push(`${path.relative(repo, f)} imports ${name}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("contains no filesystem write call", () => {
    const text = fs.readFileSync(src("ui/docket.ts"), "utf8");
    const writes = /fs\.(writeFileSync|appendFileSync|mkdirSync|rmSync|renameSync|copyFileSync|unlinkSync)/g;
    expect(text.match(writes)).toBeNull();
  });

  it("also holds for the read model it is built on", () => {
    const text = fs.readFileSync(src("ui/model.ts"), "utf8");
    const writes = /fs\.(writeFileSync|appendFileSync|mkdirSync|rmSync|renameSync|copyFileSync|unlinkSync)/g;
    expect(text.match(writes)).toBeNull();
  });

  it("refuses every non-GET method at runtime", async () => {
    const { serveDocket } = await import("../src/ui/docket.js");
    const port = 4831;
    await serveDocket(port, false);
    const attempt = (method: string) => new Promise<number>((resolve, reject) => {
      const req = http.request({ host: "127.0.0.1", port, path: "/api/cases", method }, r => {
        r.resume(); resolve(r.statusCode ?? 0);
      });
      req.on("error", reject);
      req.end();
    });
    for (const m of ["POST", "PUT", "PATCH", "DELETE"]) {
      expect(await attempt(m)).toBe(405);
    }
    expect(await attempt("GET")).toBe(200);
  }, 30_000);
});
