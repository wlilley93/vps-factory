// §15.5: local-only sign-off server. One page, one write endpoint, shared S4 path.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { readState } from "../state.js";
import { caseDir } from "../paths.js";
import { buildBundle } from "./model.js";
import { s4_signoff } from "../pipeline/stages.js";
import { execa } from "execa";

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

// The read model moved to ./model.ts so a read-only surface can be built on it without
// importing this file's write path. Re-exported: `review --web` is unchanged.
export { buildBundle } from "./model.js";

export async function serveReview(caseId: string, basePort: number): Promise<void> {
  const st = readState(caseId);
  const readOnly = st.status !== "checks-passed";
  if (readOnly && !fs.existsSync(path.join(caseDir(caseId), "signoff.json"))) {
    console.error(`review --web requires checks-passed (is: ${st.status}). Next: vps check ${caseId}`);
    process.exit(1);
  }
  const html = fs.readFileSync(new URL("./review.html", import.meta.url), "utf8");
  const server = http.createServer(async (req, res) => {
    const send = (code: number, body: string, type = "application/json") => {
      res.writeHead(code, { "content-type": type }); res.end(body);
    };
    try {
      if (req.method === "GET" && req.url === "/") return send(200, html, "text/html");
      if (req.method === "GET" && req.url === "/api/case")
        return send(200, JSON.stringify({ ...buildBundle(caseId), readOnly }));
      if (req.method === "GET" && req.url?.startsWith("/api/ruling/")) {
        // Rulings live in the court's docket, not here.
        const cit = decodeURIComponent(req.url.slice("/api/ruling/".length));
        return send(409, JSON.stringify({
          error: "rulings are held by the court, not by this factory",
          citation: cit, where: `vjs search "${cit}"`
        }));
      }
      if (req.method === "POST" && req.url === "/api/signoff") {
        if (readOnly) return send(409, JSON.stringify({ error: "case is not awaiting sign-off" }));
        let body = ""; for await (const c of req) body += c;
        const p = JSON.parse(body);
        const bundle = buildBundle(caseId);
        if (p.irSha !== bundle.irSha) return send(409, JSON.stringify({ error: "stale IR — reload the page" }));
        if (!p.by) return send(422, JSON.stringify({ error: "signer name required" }));
        if (p.decision === "approve") {
          const needExcl = bundle.ir.exclusions.map((x: any) => x.sourceText);
          const needAmb = bundle.ir.ambiguities.map((a: any) => a.sourceText);
          if (!needExcl.every((x: string) => (p.exclusionAcks ?? []).includes(x)))
            return send(422, JSON.stringify({ error: "every exclusion must be acknowledged" }));
          if (!needAmb.every((a: string) => (p.ambiguityAcks ?? []).includes(a)))
            return send(422, JSON.stringify({ error: "every ambiguity must be answered Accept (reject the draft otherwise)" }));
        } else if (!p.notes) return send(422, JSON.stringify({ error: "reject requires notes" }));
        const r = await s4_signoff(caseId, p.decision, p.by, p.notes ?? "");
        const next = p.decision === "approve"
          ? `vps run ${caseId} --instance <name>` : `vps draft ${caseId} --from-checks`;
        send(200, JSON.stringify({ ok: true, rulingCitation: r.rulingCitation ?? null, next }));
        setTimeout(() => server.close(), 1500);
        return;
      }
      send(404, JSON.stringify({ error: "not found" }));
    } catch (e: any) { send(500, JSON.stringify({ error: String(e?.message ?? e) })); }
  });
  // Bind, or fail loudly. The previous loop let the counter run past the last candidate and
  // then printed a URL nothing was listening on — a sign-off page that looks available and
  // simply is not is worse than an error, because the human believes the gate is open.
  // Also removes the error listener on success: it was re-registered on the same server
  // object each iteration, accumulating handlers.
  let bound = -1;
  for (let p = basePort; p < basePort + 11; p++) {
    try {
      await new Promise<void>((ok, no) => {
        const onErr = (e: unknown) => no(e);
        server.once("error", onErr);
        server.listen(p, "127.0.0.1", () => { server.removeListener("error", onErr); ok(); });
      });
      bound = p; break;
    } catch { /* port busy — try the next */ }
  }
  if (bound === -1) {
    throw Object.assign(new Error(`no free port in ${basePort}–${basePort + 10}; free one or pass --port`), { code: 1 });
  }
  const port = bound;
  console.log(`review: http://127.0.0.1:${port}/  (${readOnly ? "read-only" : "awaiting sign-off"})`);
  execa("open", [`http://127.0.0.1:${port}/`]).catch(() => { /* print-only */ });
}
