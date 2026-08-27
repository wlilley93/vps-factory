// Word-level prose diff (LCS over whitespace tokens) + structural IR diff (§5.3, M10). No deps.
export interface WordEdit { op: "keep" | "add" | "del"; text: string }

export function wordDiff(a: string, b: string): WordEdit[] {
  const A = a.split(/\s+/).filter(Boolean), B = b.split(/\s+/).filter(Boolean);
  const n = A.length, m = B.length;
  const L: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
    L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out: WordEdit[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) { out.push({ op: "keep", text: A[i] }); i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) { out.push({ op: "del", text: A[i] }); i++; }
    else { out.push({ op: "add", text: B[j] }); j++; }
  }
  while (i < n) { out.push({ op: "del", text: A[i++] }); }
  while (j < m) { out.push({ op: "add", text: B[j++] }); }
  return out;
}

export function diffSummary(edits: WordEdit[]): { added: string[]; removed: string[] } {
  const runs = (op: "add" | "del") => {
    const acc: string[] = []; let cur: string[] = [];
    for (const e of edits) {
      if (e.op === op) cur.push(e.text);
      else if (cur.length) { acc.push(cur.join(" ")); cur = []; }
    }
    if (cur.length) acc.push(cur.join(" "));
    return acc;
  };
  return { added: runs("add"), removed: runs("del") };
}

// Structural IR diff: nouns/fields, predicate bodies, itemsData (canonical JSON compare).
export interface IrDelta { kind: "added" | "removed" | "changed"; path: string; detail: string }

const canon = (v: unknown): string => JSON.stringify(sort(v));
function sort(v: any): any {
  if (Array.isArray(v)) return v.map(sort);
  if (v && typeof v === "object")
    return Object.fromEntries(Object.keys(v).sort().map(k => [k, sort(v[k])]));
  return v;
}

export function irDiff(prev: any, next: any): IrDelta[] {
  const out: IrDelta[] = [];
  const byName = (xs: any[]) => new Map(xs.map((x: any) => [x.name, x]));
  const pn = byName(prev.nouns), nn = byName(next.nouns);
  for (const [name, noun] of nn) {
    const old = pn.get(name);
    if (!old) { out.push({ kind: "added", path: `nouns.${name}`, detail: "noun added" }); continue; }
    const pf = byName(old.fields), nf = byName((noun as any).fields);
    for (const [f, fv] of nf) {
      const ov = pf.get(f);
      if (!ov) out.push({ kind: "added", path: `nouns.${name}.${f}`, detail: "field added" });
      else if ((ov as any).type !== (fv as any).type)
        out.push({ kind: "changed", path: `nouns.${name}.${f}`, detail: `type ${(ov as any).type} -> ${(fv as any).type}` });
    }
    for (const f of pf.keys()) if (!nf.has(f)) out.push({ kind: "removed", path: `nouns.${name}.${f}`, detail: "field removed" });
  }
  for (const name of pn.keys()) if (!nn.has(name)) out.push({ kind: "removed", path: `nouns.${name}`, detail: "noun removed" });
  const pp = byName(prev.predicates), np = byName(next.predicates);
  for (const [name, pred] of np) {
    const old = pp.get(name);
    if (!old) { out.push({ kind: "added", path: `predicates.${name}`, detail: "predicate added" }); continue; }
    if (canon((old as any).body) !== canon((pred as any).body))
      out.push({ kind: "changed", path: `predicates.${name}`, detail: "body changed" });
  }
  for (const name of pp.keys()) if (!np.has(name)) out.push({ kind: "removed", path: `predicates.${name}`, detail: "predicate removed" });
  const pv = prev.requirement.itemsData.values, nv = next.requirement.itemsData.values;
  const key = (d: any) => d.label ?? canon(d);
  const pm = new Map(pv.map((d: any) => [key(d), d])), nm = new Map(nv.map((d: any) => [key(d), d]));
  for (const [k, d] of nm) {
    const old = pm.get(k);
    if (!old) out.push({ kind: "added", path: `itemsData[${k}]`, detail: "requirement item added" });
    else if (canon(old) !== canon(d)) out.push({ kind: "changed", path: `itemsData[${k}]`, detail: `values ${canon(old)} -> ${canon(d)}` });
  }
  for (const k of pm.keys()) if (!nm.has(k)) out.push({ kind: "removed", path: `itemsData[${k}]`, detail: "requirement item removed" });
  return out;
}

// Drift: IR deltas whose path text has no overlap with the prose diff's added/removed runs.
export function driftWarnings(deltas: IrDelta[], prose: { added: string[]; removed: string[] }): IrDelta[] {
  const changedText = (prose.added.join(" ") + " " + prose.removed.join(" ")).toLowerCase();
  return deltas.filter(d => {
    const tokens = (d.path + " " + d.detail).toLowerCase().match(/[a-z]{4,}/g) ?? [];
    return !tokens.some(t => changedText.includes(t));
  });
}
