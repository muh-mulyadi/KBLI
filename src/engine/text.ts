/* ============================================================
 * text.ts — utilitas teks & skor fuzzy
 * Port TypeScript dari pipeline rapidfuzz:
 *   fuzz.ratio        -> indelRatio  (kesamaan Indel via LCS)
 *   fuzz.partial_ratio-> partialRatio (sliding window terbaik)
 *   fuzz.token_sort_ratio
 *   fuzz.token_set_ratio
 * Bobot gabungan sama dengan versi Python:
 *   0.50 * token_set + 0.30 * token_sort + 0.20 * partial
 * ============================================================ */

export function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function wordTokens(s: string): string[] {
  const n = norm(s);
  return n.length ? n.split(" ") : [];
}

/** Panjang LCS via DP dua baris — dasar rasio Indel. */
function lcsLength(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (!m || !n) return 0;
  const short = m < n ? a : b;
  const long = m < n ? b : a;
  const L = short.length;
  const W = long.length;
  let prev = new Int32Array(L + 1);
  let cur = new Int32Array(L + 1);
  for (let i = 1; i <= W; i++) {
    const ch = long.charCodeAt(i - 1);
    for (let j = 1; j <= L; j++) {
      if (short.charCodeAt(j - 1) === ch) cur[j] = prev[j - 1] + 1;
      else cur[j] = prev[j] >= cur[j - 1] ? prev[j] : cur[j - 1];
    }
    const t = prev;
    prev = cur;
    cur = t;
  }
  return prev[L];
}

/** Padanan fuzz.ratio — 100 * 2*LCS / (|a|+|b|). */
export function indelRatio(a: string, b: string): number {
  if (a === b) return a.length ? 100 : 0;
  const la = a.length;
  const lb = b.length;
  if (!la || !lb) return 0;
  // kupas prefiks/sufiks yang sama agar DP lebih kecil
  let start = 0;
  const cap = Math.min(la, lb);
  while (start < cap && a.charCodeAt(start) === b.charCodeAt(start)) start++;
  let ea = la;
  let eb = lb;
  while (ea > start && eb > start && a.charCodeAt(ea - 1) === b.charCodeAt(eb - 1)) {
    ea--;
    eb--;
  }
  const mid = lcsLength(a.slice(start, ea), b.slice(start, eb));
  const matches = start + (la - ea) + mid;
  return (200 * matches) / (la + lb);
}

/** Padanan fuzz.partial_ratio — jendela geser string pendek di string panjang. */
export function partialRatio(a: string, b: string): number {
  if (a === b) return 100;
  const la = a.length;
  const lb = b.length;
  if (!la || !lb) return 0;
  let shorter: string, longer: string;
  if (la <= lb) {
    shorter = a;
    longer = b;
  } else {
    shorter = b;
    longer = a;
  }
  const ls = shorter.length;
  const ll = longer.length;
  let best = 0;
  const limit = ll - ls;
  for (let i = 0; i <= limit; i++) {
    const r = indelRatio(shorter, longer.slice(i, i + ls));
    if (r > best) best = r;
    if (best >= 100) break;
  }
  return best;
}

/** Padanan fuzz.token_sort_ratio. */
export function tokenSortRatio(a: string, b: string): number {
  const sa = wordTokens(a).sort().join(" ");
  const sb = wordTokens(b).sort().join(" ");
  return indelRatio(sa, sb);
}

/** Padanan fuzz.token_set_ratio. */
export function tokenSetRatio(a: string, b: string): number {
  const ta = new Set(wordTokens(a));
  const tb = new Set(wordTokens(b));
  const inter: string[] = [];
  const diffA: string[] = [];
  const diffB: string[] = [];
  ta.forEach((t) => {
    if (tb.has(t)) inter.push(t);
    else diffA.push(t);
  });
  tb.forEach((t) => {
    if (!ta.has(t)) diffB.push(t);
  });
  inter.sort();
  diffA.sort();
  diffB.sort();
  const t0 = inter.join(" ").trim();
  const t1 = [...inter, ...diffA].join(" ").trim();
  const t2 = [...inter, ...diffB].join(" ").trim();
  if (!t0 && !t1 && !t2) return 0;
  let best = 0;
  const pairs: Array<[string, string]> = [
    [t0, t1],
    [t0, t2],
    [t1, t2],
  ];
  for (const [x, y] of pairs) {
    if (!x && !y) continue;
    const r = indelRatio(x, y);
    if (r > best) best = r;
  }
  return best;
}

/** Skor fuzzy gabungan persis seperti versi Python. */
export function fuzzyScore(a: string, b: string): number {
  return (
    0.5 * tokenSetRatio(a, b) + 0.3 * tokenSortRatio(a, b) + 0.2 * partialRatio(a, b)
  );
}
