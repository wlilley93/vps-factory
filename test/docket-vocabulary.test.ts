// §18.1.16: the UI must under-promise. The Docket is the surface most likely to be
// screenshotted and read as a dashboard of proofs, so its vocabulary is a guardrail worth
// testing rather than trusting. No "verified", no celebration, no tick; a GREEN carries its
// conditionality; a gate reads as a stop rather than a queue item to clear.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const raw = fs.readFileSync(path.join(repo, "src", "ui", "docket.html"), "utf8");

/** Comments are stripped before checking vocabulary: the page's own source names the words
 *  it is forbidden to show a reader ("no 'verified', no celebration"), and scanning raw
 *  source flags that as a violation of itself. What matters is what a viewer can read. */
const page = raw
  .replace(/<!--[\s\S]*?-->/g, "")
  .split("\n")
  .filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l))
  .join("\n");

describe("docket vocabulary (§18.1.16)", () => {
  it("never claims verification", () => {
    // "machine-checked" is allowed only in the negative ("expected, not machine-checked").
    const claims = /\bverified\b|\bproven\b|\bguaranteed\b|\bcertified\b/i;
    expect(page).not.toMatch(claims);
  });

  it("has no celebratory iconography", () => {
    expect(page).not.toMatch(/✓|✔|✅|🎉|🏆|👍/);
  });

  it("always renders GREEN with its conditionality attached", () => {
    // Every place the page can emit a green verdict must carry the qualifier.
    const greens = [...page.matchAll(/c-ok">([^<]*)</g)].map(m => m[1].trim());
    const verdictGreens = greens.filter(g => /green/i.test(g));
    expect(verdictGreens.length).toBeGreaterThan(0);
    for (const g of verdictGreens) expect(g).toMatch(/conditional/i);
  });

  it("renders the gate as a stop, not a task queue", () => {
    expect(page).toMatch(/awaiting human sign-off/);
    expect(page).not.toMatch(/action required|pending approval|approve now|\d+ pending/i);
  });

  it("carries the standing conditionality footer", () => {
    expect(page).toMatch(/conditional on a human sign-off/);
    expect(page).toMatch(/shows records, not proofs/);
  });

  it("offers no approve affordance of any kind", () => {
    // The docket must never present a control that looks like the gate.
    expect(page).not.toMatch(/<button[^>]*>\s*Approve/i);
    expect(page).not.toMatch(/\/api\/signoff/);
    expect(page).not.toMatch(/method:\s*["']POST/i);
  });

  it("says plainly where sign-off actually happens", () => {
    expect(page).toMatch(/vps review .*--web/);
  });
});
