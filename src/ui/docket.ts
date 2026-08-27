// The Docket: a read-only view of the record. GET only, no write path of any kind.
//
// This is NOT the sign-off gate. `review --web` remains exactly what §15.5 specifies — one
// page, one write endpoint, the shared S4 code path — and is untouched by this file. The
// Docket exists because the record is worth reading: what each stage decided, which
// judgment calls were recorded as ambiguities, what was deliberately excluded, and how each
// *matter* fared against each revision of its *source requirement set*.
//
// Four layers make "read-only" structurally true rather than a promise:
//   1. Import graph — this file imports ./model.js (which touches no writer) and nothing
//      that can mutate. Enforced by test/docket-readonly.test.ts.
//   2. Method allowlist as the first line of the handler, before any routing.
//   3. No fs write call appears in this file, checked by the same test.
//   4. Binds 127.0.0.1 only, with a CSP that makes "no external requests" mechanical.
import http from "node:http";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { execa } from "execa";
import {
  listCases, listRequirementSets, buildBundleSafe, assertCaseId,
  readVerdicts, readRegression
} from "./model.js";
import { root } from "../paths.js";

const CSP = "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; img-src data:";

export async function serveDocket(basePort: number, open = true): Promise<void> {
  const html = fs.readFileSync(new URL("./docket.html", import.meta.url), "utf8");

  const server = http.createServer(async (req, res) => {
    const send = (code: number, body: string, type = "application/json") => {
      res.writeHead(code, {
        "content-type": type,
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
        "content-security-policy": CSP
      });
      res.end(body);
    };
    const json = (code: number, v: unknown) => send(code, JSON.stringify(v), "application/json");

    // Method allowlist FIRST, before routing — so no future route can accidentally accept
    // a write. There is no POST/PUT/PATCH/DELETE handler anywhere below.
    if (req.method !== "GET" && req.method !== "HEAD") {
      return json(405, { error: "the docket is read-only; sign-off happens in `vps review <case> --web`" });
    }

    try {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      const p = url.pathname;

      if (p === "/") return send(200, html, "text/html; charset=utf-8");
      if (p === "/api/health") return json(200, { ok: true, root: root(), cases: listCases().length });
      if (p === "/api/sets") return json(200, { sets: listRequirementSets(), generatedAt: new Date().toISOString() });
      if (p === "/api/cases") return json(200, { cases: listCases() });

      if (p.startsWith("/api/case/")) {
        const rest = p.slice("/api/case/".length);
        const [rawId, sub] = rest.split("/");
        const id = assertCaseId(decodeURIComponent(rawId));
        if (!sub) return json(200, { ...buildBundleSafe(id), readOnly: true, docket: true });
        if (sub === "verdicts") return json(200, { files: readVerdicts(id) });
        if (sub === "regression") return json(200, { text: readRegression(id) });
        return json(404, { error: "not found" });
      }

      if (p.startsWith("/api/ruling/")) {
        // Rulings live in the court's docket, not here. This factory holds no judgments, so
        // rather than 404 on a citation that certainly exists somewhere, say where.
        const cit = decodeURIComponent(p.slice("/api/ruling/".length));
        return json(409, {
          error: "rulings are held by the court, not by this factory",
          citation: cit,
          where: `vjs ask <key>  ·  vjs search "${cit}"  ·  vjs docket`
        });
      }

      return json(404, { error: "not found" });
    } catch (e: any) {
      const code = typeof e?.code === "number" && e.code >= 400 && e.code < 600 ? e.code : 500;
      return json(code, { error: String(e?.message ?? e) });
    }
  });

  let bound = -1;
  for (let port = basePort; port < basePort + 11; port++) {
    try {
      await new Promise<void>((ok, no) => {
        const onErr = (e: unknown) => no(e);
        server.once("error", onErr);
        server.listen(port, "127.0.0.1", () => { server.removeListener("error", onErr); ok(); });
      });
      bound = port; break;
    } catch { /* busy */ }
  }
  if (bound === -1) throw Object.assign(new Error(`no free port in ${basePort}–${basePort + 10}`), { code: 1 });

  console.error(`docket: http://127.0.0.1:${bound}/  (read-only)`);
  if (open) execa("open", [`http://127.0.0.1:${bound}/`]).catch(() => { /* print-only */ });
}
