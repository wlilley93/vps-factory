// §16: authors the sample-role fixture set. Offsets computed via indexOf; the
// expected IRs are validated with the real schema+semantic validator before writing.
import fs from "node:fs";
import path from "node:path";
import { IRSchema } from "../src/ir/schema.js";
import { validateIR } from "../src/ir/validate.js";
import { sha8 } from "../src/precedent/questions.js";

const intake = `We are hiring a Senior Software Engineer to join our platform team in Leeds.
The role owns delivery of customer-facing services end to end.

Requirements. Candidates must have at least five years of professional software experience. Fluency in TypeScript is essential for day-to-day work. The successful candidate will have led at least two production launches from design through release. Candidates must hold a current AWS certification. Finally, the candidate communicates clearly with stakeholders across the business.
`;
fs.mkdirSync("fixtures/intake", { recursive: true });
fs.writeFileSync("fixtures/intake/sample-role.md", intake);

const r2 = intake
  .replace("at least five years", "at least seven years")
  .replace("Fluency in TypeScript is essential for day-to-day work.",
           "Fluency in TypeScript is essential for day-to-day work. Hands-on Kubernetes experience is required.");
fs.writeFileSync("fixtures/intake/sample-role-r2.md", r2);

function span(doc: string, quote: string) {
  const start = doc.indexOf(quote);
  if (start < 0) throw new Error("quote not found: " + quote);
  return { quote, start, end: start + quote.length };
}

function makeIR(doc: string, caseId: string, extraDuty: boolean) {
  const years = extraDuty ? "at least seven years of professional software experience"
                          : "at least five years of professional software experience";
  const ir = {
    caseId, sourceDoc: "intake.md",
    nouns: [
      { name: "Candidate", role: "subject" as const,
        fields: [
          { name: "name", type: "String" as const, source: span(doc, "Senior Software Engineer") },
          { name: "yearsExp", type: "Nat" as const, source: span(doc, years) },
          { name: "skills", type: "ListString" as const, source: span(doc, "Fluency in TypeScript is essential") },
          { name: "launchesLed", type: "Nat" as const, source: span(doc, "led at least two production launches") },
          { name: "certifications", type: "ListString" as const, source: span(doc, "hold a current AWS certification") }
        ],
        source: span(doc, "We are hiring a Senior Software Engineer") },
      { name: "Duty", role: "requirementItem" as const,
        fields: [
          { name: "label", type: "String" as const, source: span(doc, "Requirements") },
          { name: "kind", type: "String" as const, source: span(doc, "Requirements") },
          { name: "minCount", type: "Nat" as const, source: span(doc, "at least") },
          { name: "needle", type: "String" as const, source: span(doc, "TypeScript") }
        ],
        source: span(doc, "Requirements") }
    ],
    predicates: [{
      name: "meets",
      params: [{ name: "c", noun: "Candidate" }, { name: "d", noun: "Duty" }],
      body: { op: "or" as const, args: [
        { op: "and" as const, args: [
          { op: "eq" as const, left: { op: "field" as const, path: "d.kind" }, right: { op: "const" as const, type: "String" as const, value: "minYears" } },
          { op: "ge" as const, left: { op: "field" as const, path: "c.yearsExp" }, right: { op: "field" as const, path: "d.minCount" } } ] },
        { op: "and" as const, args: [
          { op: "eq" as const, left: { op: "field" as const, path: "d.kind" }, right: { op: "const" as const, type: "String" as const, value: "skill" } },
          { op: "contains" as const, list: { op: "field" as const, path: "c.skills" }, item: { op: "field" as const, path: "d.needle" } } ] },
        { op: "and" as const, args: [
          { op: "eq" as const, left: { op: "field" as const, path: "d.kind" }, right: { op: "const" as const, type: "String" as const, value: "launches" } },
          { op: "ge" as const, left: { op: "field" as const, path: "c.launchesLed" }, right: { op: "field" as const, path: "d.minCount" } } ] },
        { op: "and" as const, args: [
          { op: "eq" as const, left: { op: "field" as const, path: "d.kind" }, right: { op: "const" as const, type: "String" as const, value: "cert" } },
          { op: "contains" as const, list: { op: "field" as const, path: "c.certifications" }, item: { op: "field" as const, path: "d.needle" } } ] }
      ] },
      source: span(doc, "Requirements"),
      interpretationNotes: "Each duty is tagged with a kind; meets dispatches on kind. minCount is 0 where unused; needle is \"\" where unused."
    }],
    requirement: {
      name: "satisfiesRole", quantifier: "allOf" as const,
      subjectNoun: "Candidate", itemsNoun: "Duty", predicate: "meets",
      itemsData: { name: "jdDuties", values: [
        { label: extraDuty ? "7+ years experience" : "5+ years experience", kind: "minYears", minCount: extraDuty ? 7 : 5, needle: "" },
        { label: "TypeScript essential", kind: "skill", minCount: 0, needle: "TypeScript" },
        { label: "Led 2+ launches", kind: "launches", minCount: 2, needle: "" },
        { label: "AWS certification", kind: "cert", minCount: 0, needle: "AWS" },
        ...(extraDuty ? [{ label: "Kubernetes required", kind: "skill", minCount: 0, needle: "Kubernetes" }] : [])
      ] }
    },
    ambiguities: [{
      sourceText: "communicates clearly with stakeholders",
      options: ["model as declared skill membership", "exclude as unmeasurable in v1"],
      chosen: "exclude as unmeasurable in v1",
      rationale: "No objective datum in a CV decides this; modelling it as a self-declared skill would launder vagueness into false precision."
    }],
    exclusions: [{ sourceText: "communicates clearly with stakeholders", reason: "unmeasurable in v1 type system; surfaced for human decision at sign-off" }]
  };
  return ir;
}

const today = new Date().toISOString().slice(0, 10);
const baseId = `${today}-sample-role`;
const r2Id = `${baseId}-r2`;

const irBase = makeIR(intake, baseId, false);
const irR2 = makeIR(r2, r2Id, true);

// self-check with the real validators (write intake to a temp case-free path)
fs.writeFileSync("/tmp/_intake_check.md", intake);
const p1 = IRSchema.parse(irBase);
const errs1 = validateIR(p1, "/tmp/_intake_check.md");
if (errs1.length) throw new Error("base IR invalid: " + JSON.stringify(errs1));
fs.writeFileSync("/tmp/_intake_check2.md", r2);
const errs2 = validateIR(IRSchema.parse(irR2), "/tmp/_intake_check2.md");
if (errs2.length) throw new Error("r2 IR invalid: " + JSON.stringify(errs2));

fs.mkdirSync("fixtures/ir", { recursive: true });
fs.writeFileSync("fixtures/ir/sample-role.expected.json", JSON.stringify(irBase, null, 2));
fs.writeFileSync("fixtures/ir/sample-role-r2.expected.json", JSON.stringify(irR2, null, 2));

fs.mkdirSync("fixtures/instances", { recursive: true });
fs.writeFileSync("fixtures/instances/will.json", JSON.stringify({
  noun: "Candidate", values: { name: "Will", yearsExp: 6, skills: ["TypeScript", "Lean"], launchesLed: 3, certifications: ["AWS"] }
}, null, 2));
fs.writeFileSync("fixtures/instances/casey.json", JSON.stringify({
  noun: "Candidate", values: { name: "Casey", yearsExp: 7, skills: ["Python", "Go"], launchesLed: 4, certifications: ["AWS"] }
}, null, 2));

// ---- LLM fixtures ----
const put = (name: string, caseId: string, obj: unknown) => {
  fs.mkdirSync("fixtures/llm", { recursive: true });
  fs.writeFileSync(path.join("fixtures/llm", `${name}.${caseId}.json`),
    JSON.stringify({ text: typeof obj === "string" ? obj : JSON.stringify(obj, null, 2) }, null, 2));
};

for (const [id, ir] of [[baseId, irBase], [r2Id, irR2]] as const) {
  put("drafter", id, ir);
  // ensemble: e1/e2 identical, e3 field renamed (yearsExp -> yearsExperience)
  const e3 = JSON.parse(JSON.stringify(ir));
  e3.nouns[0].fields[1].name = "yearsExperience";
  e3.predicates[0].body.args[0].args[1].left.path = "c.yearsExperience";
  put("drafter.e1", id, ir); put("drafter.e2", id, ir); put("drafter.e3", id, e3);
  const bt = `The role requires a candidate satisfying every one of these requirements: at least ${id === r2Id ? "seven" : "five"} years of experience (yearsExp); TypeScript among their skills; at least two production launches led; an AWS certification among their certifications${id === r2Id ? "; Kubernetes among their skills" : ""}. Nothing else is required; the ability to communicate clearly with stakeholders is deliberately not modelled.`;
  put("backtranslate", id, bt);
  put("faithfulness-judge", id, { verdict: "faithful", divergences: [] });
  put("test-proposer", id, {
    shouldPass: [
      { name: "A", yearsExp: 10, skills: ["TypeScript", "Kubernetes"], launchesLed: 5, certifications: ["AWS"] },
      { name: "B", yearsExp: id === r2Id ? 7 : 5, skills: ["TypeScript", "Kubernetes"], launchesLed: 2, certifications: ["AWS"] }
    ],
    shouldFail: [
      { name: "C", yearsExp: 1, skills: ["TypeScript", "Kubernetes"], launchesLed: 5, certifications: ["AWS"] },
      { name: "D", yearsExp: 10, skills: [], launchesLed: 5, certifications: ["AWS"] }
    ],
    edge: [
      { instance: { name: "E", yearsExp: id === r2Id ? 7 : 5, skills: ["TypeScript", "Kubernetes"], launchesLed: 2, certifications: ["AWS"] }, expected: true, why: "exact boundary on both Nat thresholds" }
    ]
  });
  put("adversary", id, { counterexamples: [] });
  const qkeys = [
    "model:candidate:shape", "model:duty:shape", "model:predicate:meets",
    `interpret:${sha8("communicates clearly with stakeholders")}`
  ];
  for (const k of qkeys) {
    put("judge-first-instance." + k.replace(/[^a-z0-9]+/gi, "-"), id, {
      ruling: `The draft's recorded facts for ${k} are adopted as the governing model.`,
      reasoning: "First impression; the facts are internally consistent and traceable to the prose. Under SPEC-LAW, spec is law once signed off; this ruling fixes the modelling choice for future drafts.",
      lawApplied: ["SPEC-LAW: spec is law", "SPEC-LAW: rulings are precedent"]
    });
  }
}
// prover fixture (§16)
fs.mkdirSync("fixtures/prover", { recursive: true });
fs.writeFileSync(`fixtures/prover/${baseId}.json`, JSON.stringify([
  { tactic: "sorry", raw: "```lean\nsorry\n```", attempt: 1 },
  { tactic: "native_decide", raw: "native_decide", attempt: 2 },
  { tactic: "by decide", raw: "by decide", attempt: 3 }
], null, 2));
console.log("fixtures written:", fs.readdirSync("fixtures/llm").length, "llm fixtures");
