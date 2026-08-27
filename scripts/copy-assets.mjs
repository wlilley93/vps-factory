// tsc emits only .js; the UI's HTML must be copied into dist/ alongside it, or
// `dist/cli.js review --web` throws ENOENT on review.html (server.ts resolves it via
// `new URL("./review.html", import.meta.url)`). Until now only `tsx src/cli.ts` worked,
// so the built CLI named in package.json's `bin` was broken.
import fs from "node:fs";
import path from "node:path";

const src = path.join("src", "ui");
const dest = path.join("dist", "ui");
fs.mkdirSync(dest, { recursive: true });
let n = 0;
for (const f of fs.readdirSync(src)) {
  if (!f.endsWith(".html")) continue;
  fs.copyFileSync(path.join(src, f), path.join(dest, f));
  n++;
}
console.log(`copy-assets: ${n} html file(s) -> ${dest}`);
