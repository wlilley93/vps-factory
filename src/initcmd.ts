// vps init (§15): scaffold the directories a case run needs.
//
// This used to seed a constitutional book: .justice/ with a citator and three tiers of
// judgment directory, law/, and a gate hook. Phase 2 retired the jurisdiction (record/0037)
// -- this repo holds no book, no citations and no genesis, and adjudication belongs to the
// court. Creating that skeleton now would manufacture a jurisdiction the repo is not, so
// init scaffolds only what a case actually uses.
import fs from "node:fs";
import { R } from "./paths.js";

export async function initRepo(): Promise<void> {
  for (const d of ["cases", "record", "lean/Spec/Cases"]) fs.mkdirSync(R(d), { recursive: true });
  console.log("initialised: cases/, record/, lean/Spec/Cases/");
  console.log("adjudication is the court's — set courtRoot in vps.config.json (default ../vibe-justice-system)");
}
