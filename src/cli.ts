#!/usr/bin/env node
// VPS CLI (§15). Exit codes: 0 ok · 2 human gate · 3 checks · 4 lean · 5 llm · 6 gate denial · 1 internal.
import { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import { s0_intake, s0b_amend, s1_draft, s2_precedent, s3_checks, s4_signoff, s5_compile, s6_prove, s7_verdict } from "./pipeline/stages.js";
import { runCase, reprove } from "./pipeline/run.js";
import { readState, caseDir } from "./state.js";
import { Instance } from "./ir/schema.js";
import { validateInstance } from "./ir/validate.js";
import { R, root, casesDir, setRoot, resolveRoot, invocationCwd } from "./paths.js";
import { withLock } from "./lock.js";
import { setOutMode, isJson, say, warn, finish, fail } from "./out.js";
import { gateInfo } from "./gateinfo.js";

const program = new Command().name("vps");
// Legacy error path, routed through the envelope so a --json caller never sees empty
// stdout on failure — empty stdout is indistinguishable from "the process was killed".
const die = (e: any): never => fail("vps", e);

// §15.2's global flags. `--root` and `--config` must take effect before any command body
// touches the filesystem; `preSubcommand` is the only hook that runs early enough.
program
  .option("--root <path>", "repository root (default: $VPS_ROOT, else nearest ancestor with vps.config.json)")
  .option("--config <path>", "path to vps.config.json")
  .option("--provider <p>", "llm provider: cli | api | mock (VPS_MOCK_LLM=1 still wins)")
  .option("--wait <seconds>", "wait this long for the repo lock instead of failing fast", "0")
  .option("--json", "emit one machine-readable envelope on stdout (exit codes are unchanged)");

program.hook("preSubcommand", (thisCmd) => {
  const o = thisCmd.opts();
  if (o.config) process.env.VPS_CONFIG = path.resolve(invocationCwd, o.config);
  if (o.provider) process.env.VPS_PROVIDER = o.provider;
  if (o.json) setOutMode("json");
  setRoot(resolveRoot(o.root));
});


/** Mutating commands take the repo-wide advisory lock. Read-only commands (doctor, review,
 *  status, family, precedents, book, template) deliberately do not — they must stay usable
 *  while a long S3 run holds it. `gate` is excluded too: it runs from a pre-commit hook and
 *  must never block a commit. */
const mutating = <A extends unknown[]>(name: string, fn: (...a: A) => Promise<void> | void) =>
  async (...a: A) => {
    const waitMs = Number(program.opts().wait ?? 0) * 1000;
    try { await withLock(name, async () => { await fn(...a); }, { waitMs }); }
    catch (e) { die(e); }
  };

/** User-supplied file arguments resolve against the shell's cwd, never the repo root —
 *  `vps intake ../drafts/role.md` must mean what the user typed. */
const userFile = (f: string) => path.resolve(invocationCwd, f);

program.command("doctor").action(async () => {
  const { execa } = await import("execa");
  const r = await execa("sh", [R("scripts", "doctor.sh")], { reject: false, stdio: "inherit", cwd: root() });
  process.exit(r.exitCode ?? 1);
});

program.command("init").action(async () => {
  const { initRepo } = await import("./initcmd.js");
  await initRepo().catch(die);
});

// `appeal`, `precedents`, `gate` and `book` are gone from this CLI. They were the court's
// verbs, and this repository is no longer a jurisdiction: it holds no book, no citations and
// no genesis. Ask the court instead — `vjs docket`, `vjs search`, `vjs appeal`, `vjs book`.

program.command("intake <file>").option("--slug <s>").action((file, o) => {
  try { const id = s0_intake(userFile(file), o.slug); say(id); finish("intake", { caseId: id, result: { caseId: id } }); }
  catch (e) { fail("intake", e); }
});

program.command("amend <case> <file>").action((c, f) => {
  try { const id = s0b_amend(c, userFile(f)); say(id); finish("amend", { caseId: id, result: { caseId: id, supersedes: c } }); }
  catch (e) { fail("amend", e, c); }
});

program.command("draft <case>").option("--from-checks").action(mutating("draft", async (c: string, o: any) => {
  await s1_draft(c, { fromChecks: !!o.fromChecks });
}));

program.command("precedent <case>").action(mutating("precedent", async (c: string) => {
  const { conflicts } = await s2_precedent(c);
  if (conflicts.length) { warn(conflicts.join("\n")); finish("precedent", { caseId: c, exitCode: 2, result: { conflicts } }); }
  say("precedent-checked");
  finish("precedent", { caseId: c, result: { conflicts: [] } });
}));

program.command("check <case>").action(mutating("check", async (c: string) => {
  const ok = await s3_checks(c);
  if (!ok) process.exit(3);
}));

program.command("review <case>").option("--web").option("--port <n>").action(async (c, o) => {
  if (o.web) {
    const { serveReview } = await import("./ui/server.js");
    await serveReview(c, o.port ? Number(o.port) : 4780).catch(die);
    return;
  }
  const { printBundle } = await import("./reviewBundle.js");
  printBundle(c);
});

program.command("signoff <case>")
  .option("--approve").option("--reject").option("--by <name>").option("--notes <n>", "", "")
  .action(async (c, o) => {
    if (!o.by) die(new Error("--by <name> required"));
    if (!o.approve && !o.reject) die(new Error("--approve or --reject required"));
    const r = await s4_signoff(c, o.approve ? "approve" : "reject", o.by, o.notes).catch(die);
    if (r.rulingCitation) say("signed off; ruling " + r.rulingCitation);
    else say("rejected; returned to drafted");
    finish("signoff", { caseId: c, result: { decision: o.approve ? "approve" : "reject", by: o.by, rulingCitation: r.rulingCitation ?? null }, gate: gateInfo(c) });
  });

program.command("instance <case> <file>").action((c, f) => {
  try {
    const inst = Instance.parse(JSON.parse(fs.readFileSync(userFile(f), "utf8")));
    const ir = JSON.parse(fs.readFileSync(path.join(caseDir(c), "draft.ir.json"), "utf8"));
    const errs = validateInstance(ir, inst);
    if (errs.length) { warn(JSON.stringify(errs, null, 2)); finish("instance", { caseId: c, exitCode: 1, result: { errors: errs } }); }
    const name = path.basename(f).replace(/\.json$/, "");
    fs.copyFileSync(userFile(f), path.join(caseDir(c), "instances", name + ".json"));
    say(`registered instance ${name}`);
    finish("instance", { caseId: c, result: { instance: name } });
  } catch (e) { die(e); }
});

program.command("template <case>").option("--name <n>", "", "me").action((c, o) => {
  try {
    const ir = JSON.parse(fs.readFileSync(path.join(caseDir(c), "draft.ir.json"), "utf8"));
    const subj = ir.nouns.find((n: any) => n.role === "subject");
    const values: Record<string, unknown> = {};
    for (const f of subj.fields) values[f.name] =
      f.type === "Nat" ? 0 : f.type === "Bool" ? false : f.type === "String" ? "" : [];
    if ("name" in values) values["name"] = o.name;
    const tpl = { noun: subj.name, values };
    say(JSON.stringify(tpl, null, 2));
    finish("template", { caseId: c, result: tpl });
  } catch (e) { die(e); }
});

program.command("compile <case>").action(mutating("compile", async (c: string) => { await s5_compile(c); say("compiled"); finish("compile", { caseId: c }); }));

program.command("prove <case>").requiredOption("--instance <name>").option("--prover").action(mutating("prove", async (c: string, o: any) => {
  const ok = await s6_prove(c, o.instance, !!o.prover);
  say(ok ? "proved" : "proof-failed");
  finish("prove", { caseId: c, result: { instance: o.instance, proved: ok } });
}));

program.command("verdict <case>").action(mutating("verdict", async (c: string) => {
  const p = await s7_verdict(c); say(p); finish("verdict", { caseId: c, result: { verdictPath: p } });
}));

program.command("reprove <case>").action(mutating("reprove", async (c: string) => {
  await reprove(c);
  const rp = path.join(caseDir(c), "regression.report.md");
  say(rp);
  finish("reprove", { caseId: c, result: { regressionReport: rp } });
}));

program.command("family <case>").action((c) => {
  try {
    const st = readState(c);
    const fam = st.familyId;
    const members = fs.readdirSync(casesDir()).filter(x => x === fam || x.startsWith(fam + "-r")).sort();
    for (const m of members) {
      const s = readState(m);
      say(`${m}  r${s.revision}  ${s.status}${s.supersededBy ? "  superseded-by:" + s.supersededBy : ""}${s.supersedes ? "  supersedes:" + s.supersedes : ""}`);
    }
  } catch (e) { die(e); }
});

program.command("run <case>").option("--instance <name>").option("--force-from <stage>").action(mutating("run", async (c: string, o: any) => {
  const out = await runCase(c, { instance: o.instance, forceFrom: o.forceFrom });
  finish("run", {
    caseId: c, exitCode: out.exitCode, status: out.status, stage: out.stage,
    result: { stopped: out.stopped, ran: out.ran, ...out.detail },
    gate: gateInfo(c), next: out.next
  });
}));

// The poller for an asynchronous gate: one readFileSync, no LLM, no Lean. A headless
// caller loops on this until `gate.signoff && !gate.signoff.stale`, then re-runs `run`.
// The Docket (read-only). A separate command and a separate port from `review --web`,
// which keeps its own single page and single write endpoint untouched. Port 4791 because
// review scans 4780-4790 inclusive.
// S8: general theorems (§20 / Phase 6b). A claim about the FORMALIZATION, quantified over
// every subject — not a verdict about one instance.
program.command("theorem <case>")
  .requiredOption("--property <p>", "stricter | exclusive")
  .option("--against <case>", "the weaker case, for --property stricter")
  .option("--duty <label...>", "two duty labels, for --property exclusive")
  .action(mutating("theorem", async (c: string, o: any) => {
    const { proveTheorem } = await import("./pipeline/theorem.js");
    const duties = Array.isArray(o.duty) && o.duty.length === 2 ? [o.duty[0], o.duty[1]] as [string, string] : undefined;
    const r = await proveTheorem(c, { property: o.property, against: o.against, duties });
    say(r.deferred ? "deferred" : r.proved ? "holds" : "not established (see the file: a refused proof is not a disproof)");
    say(r.path);
    finish("theorem", { caseId: c, exitCode: r.deferred ? 0 : r.proved ? 0 : 4, result: r });
  }));

program.command("docket").option("--port <n>").option("--no-open").action(async (o) => {
  const { serveDocket } = await import("./ui/docket.js");
  await serveDocket(o.port ? Number(o.port) : 4791, o.open !== false).catch(die);
});

program.command("status <case>").action((c) => {
  try {
    const s = readState(c);
    say(`${s.caseId}  family=${s.familyId} r${s.revision}  status=${s.status}`);
    for (const h of s.history) say(`  ${h.at}  ${h.status}  by ${h.by}${h.note ? "  — " + h.note : ""}`);
    finish("status", {
      caseId: c, status: s.status,
      result: { familyId: s.familyId, revision: s.revision, supersedes: s.supersedes,
                supersededBy: s.supersededBy, history: s.history },
      gate: gateInfo(c)
    });
  } catch (e) { fail("status", e, c); }
});




program.parseAsync().catch(die);
