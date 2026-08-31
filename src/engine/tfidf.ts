/* ============================================================
 * tfidf.ts — TF-IDF word/char n-gram + matriks CSR
 * Meniru TfidfVectorizer scikit-learn:
 *   - sublinear_tf  : tf' = 1 + ln(tf)
 *   - smooth idf    : ln((1+n)/(1+df)) + 1
 *   - normalisasi L2 per dokumen
 * Hasil disimpan sebagai matriks sparse CSR agar kosinus cepat.
 * ============================================================ */

import { norm } from "./text";

export type AnalyzerKind = "word" | "char";

export interface Vectorizer {
  kind: AnalyzerKind;
  featureIndex: Map<string, number>;
  idf: Float64Array;
  nFeatures: number;
}

export interface DocMatrix {
  rows: number;
  indptr: Int32Array;
  indices: Int32Array;
  values: Float64Array;
}

export interface TfIndex {
  vec: Vectorizer;
  mat: DocMatrix;
}

/** Token word unigram + bigram (padanan analyzer="word", ngram=(1,2)). */
export function wordAnalyze(text: string): string[] {
  const toks = norm(text).split(" ").filter((t) => t.length > 0);
  const out: string[] = toks.slice();
  for (let i = 1; i < toks.length; i++) out.push(toks[i - 1] + "_" + toks[i]);
  return out;
}

/** Token char_wb n-gram 3..5 (padanan analyzer="char_wb", ngram=(3,5)). */
export function charAnalyze(text: string): string[] {
  const toks = norm(text).split(" ").filter((t) => t.length > 0);
  const out: string[] = [];
  for (const t of toks) {
    const p = " " + t + " ";
    for (let n = 3; n <= 5; n++) {
      if (p.length < n) break;
      for (let i = 0; i + n <= p.length; i++) out.push(p.slice(i, i + n));
    }
  }
  return out;
}

function analyze(kind: AnalyzerKind, text: string): string[] {
  return kind === "word" ? wordAnalyze(text) : charAnalyze(text);
}

/** Latih vectorizer + bangun matriks dokumen dalam satu lintasan ganda. */
export function buildTfIndex(texts: string[], kind: AnalyzerKind): TfIndex {
  const n = texts.length;
  const df = new Map<string, number>();
  const docTokens: string[][] = new Array(n);

  for (let d = 0; d < n; d++) {
    const toks = analyze(kind, texts[d]);
    docTokens[d] = toks;
    const uniq = new Set(toks);
    uniq.forEach((t) => df.set(t, (df.get(t) ?? 0) + 1));
  }

  const featureIndex = new Map<string, number>();
  let fi = 0;
  df.forEach((_v, t) => featureIndex.set(t, fi++));

  const idf = new Float64Array(featureIndex.size);
  df.forEach((v, t) => {
    idf[featureIndex.get(t)!] = Math.log((1 + n) / (1 + v)) + 1;
  });

  let nnz = 0;
  for (const t of docTokens) nnz += t.length;
  const indptr = new Int32Array(n + 1);
  const indices = new Int32Array(nnz);
  const values = new Float64Array(nnz);

  let ptr = 0;
  for (let d = 0; d < n; d++) {
    indptr[d] = ptr;
    const counts = new Map<number, number>();
    for (const t of docTokens[d]) {
      const c = featureIndex.get(t)!;
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    let norm2 = 0;
    counts.forEach((cnt, col) => {
      const w = (1 + Math.log(cnt)) * idf[col];
      indices[ptr] = col;
      values[ptr] = w;
      norm2 += w * w;
      ptr++;
    });
    const inv = norm2 > 0 ? 1 / Math.sqrt(norm2) : 0;
    for (let k = indptr[d]; k < ptr; k++) values[k] *= inv;
  }
  indptr[n] = ptr;

  return {
    vec: { kind, featureIndex, idf, nFeatures: featureIndex.size },
    mat: { rows: n, indptr, indices, values },
  };
}

/** Transform satu teks menjadi vektor query sparse (col -> bobot L2). */
export function transformQuery(vec: Vectorizer, text: string): Map<number, number> {
  const counts = new Map<string, number>();
  for (const t of analyze(vec.kind, text)) counts.set(t, (counts.get(t) ?? 0) + 1);

  const out = new Map<number, number>();
  let norm2 = 0;
  counts.forEach((cnt, tok) => {
    const col = vec.featureIndex.get(tok);
    if (col === undefined) return;
    const w = (1 + Math.log(cnt)) * vec.idf[col];
    out.set(col, w);
    norm2 += w * w;
  });
  const inv = norm2 > 0 ? 1 / Math.sqrt(norm2) : 0;
  if (inv !== 1) {
    const tmp = new Map<number, number>();
    out.forEach((w, c) => tmp.set(c, w * inv));
    return tmp;
  }
  return out;
}

/** Kosinus antara vektor query dan seluruh baris matriks. */
export function cosineRows(mat: DocMatrix, q: Map<number, number>): Float64Array {
  const out = new Float64Array(mat.rows);
  if (q.size === 0) return out;
  const { indptr, indices, values } = mat;
  for (let r = 0; r < mat.rows; r++) {
    let s = 0;
    for (let k = indptr[r], e = indptr[r + 1]; k < e; k++) {
      const w = q.get(indices[k]);
      if (w !== undefined) s += values[k] * w;
    }
    out[r] = s;
  }
  return out;
}

/** Indeks posisi nilai terbesar sebanyak K (tanpa sort penuh). */
export function topKIndices(arr: Float64Array, k: number): number[] {
  const n = arr.length;
  const K = Math.min(k, n);
  const idx = new Array<number>(n);
  for (let i = 0; i < n; i++) idx[i] = i;
  // partial selection: cukup untuk K kecil relatif terhadap n
  for (let i = 0; i < K; i++) {
    let best = i;
    for (let j = i + 1; j < n; j++) {
      if (arr[idx[j]] > arr[idx[best]]) best = j;
    }
    if (best !== i) {
      const t = idx[i];
      idx[i] = idx[best];
      idx[best] = t;
    }
  }
  return idx.slice(0, K);
}
