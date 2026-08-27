// §12.1: deterministic — spans verify + sentence coverage.
import fs from "node:fs";
import path from "node:path";
import { caseDir } from "../state.js";
import type { IR } from "../ir/schema.js";

export interface TraceResult {
  name: "traceability"; passed: boolean;
  details: { hardFailures: string[]; uncoveredSentences: string[] };
}

export function traceability(ir: IR, caseId: string): TraceResult {
  const intake = fs.readFileSync(path.join(caseDir(caseId), "intake.md"), "utf8");
  const hard: string[] = [];
  const spans: { start: number; end: number }[] = [];
  const check = (label: string, s: { quote: string; start: number; end: number }) => {
    if (intake.slice(s.start, s.end) !== s.quote) hard.push(`${label}: span/quote mismatch`);
    else spans.push({ start: s.start, end: s.end });
  };
  for (const n of ir.nouns) { check(`noun ${n.name}`, n.source); n.fields.forEach(f => check(`field ${n.name}.${f.name}`, f.source)); }
  ir.predicates.forEach(p => check(`predicate ${p.name}`, p.source));

  const uncovered: string[] = [];
  let idx = 0;
  for (const raw of intake.split(/(?<=[.!?])\s+/)) {
    const sentence = raw.trim();
    const start = intake.indexOf(raw, idx); const end = start + raw.length; idx = end;
    if (sentence.length < 12 || sentence.startsWith("#")) continue;
    const covered = spans.some(s => s.start < end && s.end > start)
      || ir.ambiguities.some(a => sentence.includes(a.sourceText) || a.sourceText.includes(sentence))
      || ir.exclusions.some(x => sentence.includes(x.sourceText) || x.sourceText.includes(sentence));
    if (!covered) uncovered.push(sentence.slice(0, 140));
  }
  return { name: "traceability", passed: hard.length === 0, details: { hardFailures: hard, uncoveredSentences: uncovered } };
}
