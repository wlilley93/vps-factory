// The Legal Engine Product Lead case: recorded model outputs (drafter, checks, judges).
// These are Claude's real drafts for this case, recorded as fixtures so the run is
// deterministic and replayable; the pipeline adjudicates them mechanically.
import fs from "node:fs";
import path from "node:path";
import { IRSchema } from "../src/ir/schema.js";
import { validateIR } from "../src/ir/validate.js";
import { sha8 } from "../src/precedent/questions.js";

const doc = fs.readFileSync("fixtures/intake/legal-engine-product-lead.md", "utf8");
const span = (quote: string) => {
  const start = doc.indexOf(quote);
  if (start < 0) throw new Error("quote not found: " + JSON.stringify(quote));
  return { quote, start, end: start + quote.length };
};

const today = new Date().toISOString().slice(0, 10);
const caseId = `${today}-legal-engine-product-lead`;

const flagKinds: [string, string, string][] = [
  // [kind, field, quote]
  ["stakeholders", "seniorStakeholderRooms", "held your own in senior stakeholder rooms"],
  ["claudecode", "claudeCodeSpecOpinions", "opinions on how to write specs for it"],
  ["discovery", "discoveryConversationsRun", "Sitting with our customers and getting to the bottom of what they actually need"],
  ["synthesis", "crossCustomerSynthesis", "spotting where three different requirements are secretly the same product"],
  ["materials", "clientMaterialsProduced", "Preparing the client-facing materials that go alongside a build"],
  ["motivation", "motivatedByEarlyStage", "keen to experience what it's like inside a small AI company"]
];

const ir = {
  caseId, sourceDoc: "intake.md",
  nouns: [
    { name: "Candidate", role: "subject" as const,
      fields: [
        { name: "name", type: "String" as const, source: span("Product Lead") },
        { name: "productsShipped", type: "Nat" as const, source: span("You've built products before") },
        { name: "machineBuildableSpecsWritten", type: "Nat" as const, source: span("specification a machine can build from") },
        { name: "businessCasesBuilt", type: "Nat" as const, source: span("NPV, second-order effects") },
        { name: "complianceArtifacts", type: "ListString" as const, source: span("DPIAs, RFP responses, InfoSec questionnaires") },
        ...flagKinds.map(([, field, quote]) => ({ name: field, type: "Bool" as const, source: span(quote) }))
      ],
      source: span("Who we're looking for") },
    { name: "Duty", role: "requirementItem" as const,
      fields: [
        { name: "label", type: "String" as const, source: span("You'll be great in this role if") },
        { name: "kind", type: "String" as const, source: span("That means") },
        { name: "minCount", type: "Nat" as const, source: span("You've built products before") },
        { name: "needle", type: "String" as const, source: span("DPIAs, RFP responses, InfoSec questionnaires") }
      ],
      source: span("You'll be great in this role if") }
  ],
  predicates: [{
    name: "meets",
    params: [{ name: "c", noun: "Candidate" }, { name: "d", noun: "Duty" }],
    body: { op: "or" as const, args: [
      { op: "and" as const, args: [
        { op: "eq" as const, left: { op: "field" as const, path: "d.kind" }, right: { op: "const" as const, type: "String" as const, value: "shipped" } },
        { op: "ge" as const, left: { op: "field" as const, path: "c.productsShipped" }, right: { op: "field" as const, path: "d.minCount" } } ] },
      { op: "and" as const, args: [
        { op: "eq" as const, left: { op: "field" as const, path: "d.kind" }, right: { op: "const" as const, type: "String" as const, value: "specs" } },
        { op: "ge" as const, left: { op: "field" as const, path: "c.machineBuildableSpecsWritten" }, right: { op: "field" as const, path: "d.minCount" } } ] },
      { op: "and" as const, args: [
        { op: "eq" as const, left: { op: "field" as const, path: "d.kind" }, right: { op: "const" as const, type: "String" as const, value: "cases" } },
        { op: "ge" as const, left: { op: "field" as const, path: "c.businessCasesBuilt" }, right: { op: "field" as const, path: "d.minCount" } } ] },
      { op: "and" as const, args: [
        { op: "eq" as const, left: { op: "field" as const, path: "d.kind" }, right: { op: "const" as const, type: "String" as const, value: "artifact" } },
        { op: "contains" as const, list: { op: "field" as const, path: "c.complianceArtifacts" }, item: { op: "field" as const, path: "d.needle" } } ] },
      ...flagKinds.map(([kind, field]) => (
        { op: "and" as const, args: [
          { op: "eq" as const, left: { op: "field" as const, path: "d.kind" }, right: { op: "const" as const, type: "String" as const, value: kind } },
          { op: "eq" as const, left: { op: "field" as const, path: `c.${field}` }, right: { op: "const" as const, type: "Bool" as const, value: true } } ] }
      ))
    ] },
    source: span("you turn a customer's real problem into a specification a machine can build from"),
    interpretationNotes: "Duties dispatch on kind. The JD states no numeric thresholds anywhere in scope, so every Nat minimum is 1 — the weakest faithful reading (recorded as an ambiguity). Bool duties marked self-declared rest on the candidate's say-so; the JD offers no external test. The whole success section is excluded as a type error: its items are predicates over a future employment trajectory (Candidate x Company x Time), not over the applicant."
  }],
  requirement: {
    name: "suitedToRole", quantifier: "allOf" as const,
    subjectNoun: "Candidate", itemsNoun: "Duty", predicate: "meets",
    itemsData: { name: "roleDuties", values: [
      { label: "Built products before", kind: "shipped", minCount: 1, needle: "" },
      { label: "Writes machine-buildable specs and iterates them", kind: "specs", minCount: 1, needle: "" },
      { label: "Held own in senior stakeholder rooms", kind: "stakeholders", minCount: 0, needle: "" },
      { label: "Claude Code spec opinions", kind: "claudecode", minCount: 0, needle: "" },
      { label: "Runs customer discovery conversations", kind: "discovery", minCount: 0, needle: "" },
      { label: "Cross-customer synthesis", kind: "synthesis", minCount: 0, needle: "" },
      { label: "Business cases: NPV, second-order effects", kind: "cases", minCount: 1, needle: "" },
      { label: "Compliance artifact: DPIA", kind: "artifact", minCount: 0, needle: "DPIA" },
      { label: "Compliance artifact: RFP response", kind: "artifact", minCount: 0, needle: "RFP response" },
      { label: "Client-facing build materials", kind: "materials", minCount: 0, needle: "" },
      { label: "Keen on early-stage AI company (self-declared)", kind: "motivation", minCount: 0, needle: "" }
    ] }
  },
  ambiguities: [
    { sourceText: "Not so technical that you'd rather be building the thing yourself",
      options: ["model the upper bound via a self-declared preference proxy", "exclude as an unmeasurable interval"],
      chosen: "exclude as an unmeasurable interval",
      rationale: "The sentence pair defines an interval — technical enough to write specs, not so technical as to prefer building — whose endpoints have no measurable definition. Any proxy launders a personality judgment into data. It also sits oddly against this exercise, which rewards building." },
    { sourceText: "We're hiring for attitude and potential more than exact track record",
      options: ["treat every Who-section item as a hard conjunct", "soften to k-of-n with an unstated k", "exclude the clause"],
      chosen: "treat every Who-section item as a hard conjunct",
      rationale: "This clause, read literally, demotes every requirement in its section to optional without saying which, or how many, matter. allOf-minus-an-unstated-k is not a specification. The formalisation keeps allOf and records the clause as the JD's central self-contradiction: it states requirements, then states they are not requirements." },
    { sourceText: "If you've used Claude Code and have opinions on how to write specs for it",
      options: ["an illustrative example, not a requirement", "a requirement — the JD's only concrete technical marker"],
      chosen: "a requirement — the JD's only concrete technical marker",
      rationale: "Grammatically it is an example (\"that's the kind of thing\"); practically it is the one testable technical signal in the document. Modelled as a duty so it is visible and falsifiable; flagged so the reviewer can strike it." },
    { sourceText: "You've built products before",
      options: ["minimum 1", "some higher unstated bar"],
      chosen: "minimum 1",
      rationale: "The in-scope sections contain no numbers at all — no years, no counts, no thresholds. Every Nat minimum in this model is therefore 1, the weakest faithful reading. If Legal Engine means more than 1 of anything, the JD does not say so." }
  ],
  exclusions: [
    { sourceText: "Not so technical that you'd rather be building the thing yourself",
      reason: "unmeasurable upper bound on technicality; the interval's endpoints are undefined" },
    { sourceText: "have views on what makes them good",
      reason: "the products duty is modelled as a shipped-count; the 'views' half has no observable datum in a CV" },
    { sourceText: "You care about clarity and usability at a level that most people find slightly tiresome",
      reason: "the metric is other people's mild annoyance; unmeasurable" },
    { sourceText: "You'd rather have five things on your plate and figure out which two matter than have one narrow remit",
      reason: "a preference ordering, not a capability; no observable datum. Also in tension with 'Ambiguity gets resolved once' — the five-things person re-prioritises continuously" },
    { sourceText: "Cut Edu's client meetings by more than half",
      reason: "success metric with no recorded baseline (half of what number?), and a predicate over future employment, not the applicant. Also gameable: cancelling meetings is not success" },
    { sourceText: "Built out standardised product specs across everything we offer",
      reason: "future trajectory; 'everything we offer' is unversioned and will have changed by month six" },
    { sourceText: "Taken the lead on how we prioritise what to build",
      reason: "future trajectory; also contradicts 'Helping decide what gets built next' and 'Helping to make the call' — the JD assigns both helper and lead authority for the same decision without sequencing them" },
    { sourceText: "Earned the trust of a real chunk of our client base",
      reason: "'real chunk' names no threshold; direction-of-ideas is observable but the quantity is not" }
  ]
};

const parsed = IRSchema.parse(ir);
fs.writeFileSync("/tmp/_intake_real.md", doc);
const errs = validateIR(parsed, "/tmp/_intake_real.md");
if (errs.length) { console.error(JSON.stringify(errs, null, 2)); throw new Error("real IR invalid"); }

const put = (name: string, obj: unknown) =>
  fs.writeFileSync(path.join("fixtures/llm", `${name}.${caseId}.json`),
    JSON.stringify({ text: typeof obj === "string" ? obj : JSON.stringify(obj) }, null, 2));

put("drafter", ir);
const e3 = JSON.parse(JSON.stringify(ir));
e3.nouns[0].fields[1].name = "productsBuilt";
const fix = (e: any): void => {
  if (e && typeof e === "object") {
    if (e.op === "field" && e.path === "c.productsShipped") e.path = "c.productsBuilt";
    for (const v of Object.values(e)) if (v && typeof v === "object") Array.isArray(v) ? v.forEach(fix) : fix(v);
  }
};
fix(e3.predicates[0].body);
put("drafter.e1", ir); put("drafter.e2", ir); put("drafter.e3", e3);

put("backtranslate",
`The role admits a candidate who satisfies ALL of the following, jointly:
has shipped at least one product; has written at least one specification precise enough for a machine (or an agent-assisted engineer) to build from, and iterated it; has held their own in senior stakeholder rooms; has used Claude Code and holds opinions on writing specs for it; has run customer discovery conversations; has synthesised requirements across multiple customers into common products; has built at least one business case reasoning about NPV and second-order effects; has produced at least one DPIA and at least one RFP response; has produced client-facing build materials (training/onboarding/first-90-days); and declares themselves keen on early-stage AI company life.
Nothing else is required. Deliberately not required: any upper bound on technicality; caring about clarity to a tiresome degree; preferring five parallel workstreams; and every six-month outcome (standardised specs across the offering, halving Edu's meetings, owning compliance, leading prioritisation, earning client trust) — those describe a future employment, not an applicant.`);
put("faithfulness-judge", { verdict: "faithful", divergences: [] });

const inst = (over: Record<string, unknown>) => ({
  name: "T", productsShipped: 1, machineBuildableSpecsWritten: 1, businessCasesBuilt: 1,
  complianceArtifacts: ["DPIA", "RFP response"], seniorStakeholderRooms: true,
  claudeCodeSpecOpinions: true, discoveryConversationsRun: true, crossCustomerSynthesis: true,
  clientMaterialsProduced: true, motivatedByEarlyStage: true, ...over
});
put("test-proposer", {
  shouldPass: [inst({ name: "AllBoxes" }), inst({ name: "Veteran", productsShipped: 12, businessCasesBuilt: 9 })],
  shouldFail: [inst({ name: "NoSpecs", machineBuildableSpecsWritten: 0 }), inst({ name: "NoDpia", complianceArtifacts: ["RFP response"] })],
  edge: [{ instance: inst({ name: "Boundary" }), expected: true, why: "exactly 1 on every Nat threshold — the weakest candidate the model admits, exposing how low the JD's unstated bars sit" }]
});
put("adversary", { counterexamples: [
  { instance: inst({ name: "Claimant", productsShipped: 1, machineBuildableSpecsWritten: 1 }),
    predicateSays: false, humanWouldSay: true,
    why: "attempt: the attitude clause suggests a strong-attitude candidate passes with gaps — testing whether the model quietly softened allOf" },
  { instance: inst({ name: "Hollow", motivatedByEarlyStage: false }),
    predicateSays: true, humanWouldSay: false,
    why: "attempt: self-declared motivation false should still pass if the model treats declarations as decoration — testing the declaration duty has teeth" }
] });

for (const k of ["model:candidate:shape", "model:duty:shape", "model:predicate:meets",
  ...ir.ambiguities.map(a => `interpret:${sha8(a.sourceText)}`)]) {
  put("judge-first-instance." + k.replace(/[^a-z0-9]+/gi, "-"), {
    ruling: `Adopted: the draft's recorded facts for ${k} govern.`,
    reasoning: "First impression. The recorded facts are traceable to verbatim prose and internally consistent; the drafter's chosen resolution is the weakest faithful reading, which is the correct default for a specification whose source states no stronger one.",
    lawApplied: ["SPEC-LAW: spec is law", "SPEC-LAW: rulings are precedent"]
  });
}
console.log("real-case fixtures written for", caseId);
