// checks/report.md + summary.json digest.
import fs from "node:fs";
import path from "node:path";
import { caseDir } from "../state.js";

export function writeReports(caseId: string, results: { name: string; passed: boolean; details: unknown }[]): { passed: boolean } {
  const dir = path.join(caseDir(caseId), "checks");
  fs.mkdirSync(dir, { recursive: true });
  for (const r of results)
    fs.writeFileSync(path.join(dir, `${r.name}.json`), JSON.stringify(r, null, 2));
  const failures = results.filter(r => !r.passed).map(r => r.name);
  const summary = { passed: failures.length === 0, failures };
  fs.writeFileSync(path.join(dir, "summary.json"), JSON.stringify(summary, null, 2));
  const md = ["# Checks report", ""];
  for (const r of results) {
    md.push(`## ${r.name} — ${r.passed ? "PASS" : "FAIL"}`);
    md.push("```json", JSON.stringify(r.details, null, 2).slice(0, 4000), "```", "");
  }
  fs.writeFileSync(path.join(dir, "report.md"), md.join("\n"));
  return summary;
}
