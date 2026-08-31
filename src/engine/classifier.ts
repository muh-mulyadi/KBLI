/* ============================================================
 * classifier.ts — mesin hybrid Pencari KBLI
 * Alur identik dengan versi Streamlit (V5):
 *   1. CONTOH jadi referensi utama:
 *        semantic = (0.60*word + 0.40*char) * 100
 *        skor baris = 0.55*semantic + 0.45*fuzzy
 *        agregasi per KBLI: 0.70*best + 0.30*rata-rata top-3
 *   2. Jika skor terbaik < ambang -> fallback KBLI_MASTER:
 *        skor = 0.75*semantic(deskripsi) + 0.25*fuzzy
 * Optimasi web: two-stage retrieval — fuzzy hanya dihitung
 * untuk kandidat semantik teratas, sehingga ribuan record
 * tetap cepat diproses di browser.
 * ============================================================ */

import { fuzzyScore, norm } from "./text";
import {
  buildTfIndex,
  cosineRows,
  topKIndices,
  transformQuery,
  type TfIndex,
} from "./tfidf";

export interface ContohRow {
  kegiatan: string;
  kbli: string;
}

export interface MasterRow {
  kbli: string;
  judul: string;
  deskripsi: string;
}

export interface Candidate {
  rank: number;
  kbli: string;
  judul: string;
  skor: number;
  fuzzy: number;
  semantic: number;
  sumber: "CONTOH" | "KBLI_MASTER (DESKRIPSI)";
  referensi: string;
}

export type SumberHasil =
  | "CONTOH"
  | "KBLI_MASTER (DESKRIPSI)"
  | "TIDAK DITEMUKAN"
  | "KOSONG";

export interface ClassifyResult {
  candidates: Candidate[];
  sumber: SumberHasil;
  altMaster: Candidate[]; // alternatif MASTER saat CONTOH diterima
}

export interface Engine {
  version: number;
  contoh: ContohRow[];
  master: MasterRow[];
  contohNorm: string[];
  masterNorm: string[];
  contohWord: TfIndex | null;
  contohChar: TfIndex | null;
  masterWord: TfIndex | null;
  judulByKbli: Map<string, string>;
}

/* ---------- cache indeks (dibangun ulang hanya saat versi berubah) ---------- */

let cached: Engine | null = null;

export function getEngine(
  contoh: ContohRow[],
  master: MasterRow[],
  version: number
): Engine {
  if (cached && cached.version === version) return cached;

  const contohNorm = contoh.map((r) => norm(r.kegiatan));
  const masterNorm = master.map((r) => norm(r.deskripsi));

  const judulByKbli = new Map<string, string>();
  for (const m of master) {
    const k = String(m.kbli);
    if (!judulByKbli.has(k)) judulByKbli.set(k, m.judul);
  }

  cached = {
    version,
    contoh,
    master,
    contohNorm,
    masterNorm,
    contohWord: contoh.length ? buildTfIndex(contohNorm, "word") : null,
    contohChar: contoh.length ? buildTfIndex(contohNorm, "char") : null,
    masterWord: master.length ? buildTfIndex(masterNorm, "word") : null,
    judulByKbli,
  };
  return cached;
}

export function invalidateEngine(): void {
  cached = null;
}

/* ---------- pencarian CONTOH ---------- */

export function searchContoh(engine: Engine, query: string, n: number): Candidate[] {
  if (!engine.contoh.length || !engine.contohWord || !engine.contohChar) return [];
  const nq = norm(query);
  if (!nq) return [];

  const sw = cosineRows(
    engine.contohWord.mat,
    transformQuery(engine.contohWord.vec, nq)
  );
  const sc = cosineRows(
    engine.contohChar.mat,
    transformQuery(engine.contohChar.vec, nq)
  );

  const rows = engine.contoh.length;
  const sem = new Float64Array(rows);
  for (let i = 0; i < rows; i++) sem[i] = (0.6 * sw[i] + 0.4 * sc[i]) * 100;

  // two-stage: fuzzy hanya pada kandidat semantik teratas
  const K = rows <= 300 ? rows : Math.max(60, n * 15);
  const picks = topKIndices(sem, K);

  interface Picked {
    i: number;
    sem: number;
    fuzz: number;
    final: number;
  }
  const perRow: Picked[] = picks.map((i) => {
    const f = fuzzyScore(nq, engine.contohNorm[i]);
    return { i, sem: sem[i], fuzz: f, final: 0.55 * sem[i] + 0.45 * f };
  });

  const groups = new Map<string, Picked[]>();
  for (const p of perRow) {
    const k = String(engine.contoh[p.i].kbli);
    const g = groups.get(k);
    if (g) g.push(p);
    else groups.set(k, [p]);
  }

  const agg: Candidate[] = [];
  groups.forEach((g, kbli) => {
    g.sort((a, b) => b.final - a.final);
    const top = g.slice(0, 3);
    const best = top[0].final;
    const support = top.reduce((s, t) => s + t.final, 0) / top.length;
    agg.push({
      rank: 0,
      kbli,
      judul: engine.judulByKbli.get(kbli) ?? "—",
      skor: round1(0.7 * best + 0.3 * support),
      fuzzy: round1(top[0].fuzz),
      semantic: round1(top[0].sem),
      sumber: "CONTOH",
      referensi: top.map((t) => engine.contoh[t.i].kegiatan).join(" | "),
    });
  });

  agg.sort((a, b) => b.skor - a.skor);
  return agg.slice(0, n).map((c, i) => ({ ...c, rank: i + 1 }));
}

/* ---------- pencarian KBLI_MASTER ---------- */

export function searchMaster(engine: Engine, query: string, n: number): Candidate[] {
  if (!engine.master.length || !engine.masterWord) return [];
  const nq = norm(query);
  if (!nq) return [];

  const sim = cosineRows(
    engine.masterWord.mat,
    transformQuery(engine.masterWord.vec, nq)
  );
  const rows = engine.master.length;
  const sem = new Float64Array(rows);
  for (let i = 0; i < rows; i++) sem[i] = sim[i] * 100;

  const K = rows <= 300 ? rows : Math.max(48, n * 12);
  const picks = topKIndices(sem, K);

  const seen = new Map<string, Candidate>();
  for (const i of picks) {
    const m = engine.master[i];
    const k = String(m.kbli);
    if (seen.has(k)) continue;
    const f = fuzzyScore(nq, engine.masterNorm[i]);
    seen.set(k, {
      rank: 0,
      kbli: k,
      judul: m.judul,
      skor: round1(0.75 * sem[i] + 0.25 * f),
      fuzzy: round1(f),
      semantic: round1(sem[i]),
      sumber: "KBLI_MASTER (DESKRIPSI)",
      referensi: m.deskripsi,
    });
  }

  const out = [...seen.values()].sort((a, b) => b.skor - a.skor);
  return out.slice(0, n).map((c, i) => ({ ...c, rank: i + 1 }));
}

/* ---------- klasifikasi (logika V5) ---------- */

export function classify(
  engine: Engine,
  query: string,
  n: number,
  threshold: number
): ClassifyResult {
  const ex = searchContoh(engine, query, n);
  if (ex.length && ex[0].skor >= threshold) {
    return { candidates: ex, sumber: "CONTOH", altMaster: searchMaster(engine, query, 3) };
  }
  const ms = searchMaster(engine, query, n);
  if (ms.length) return { candidates: ms, sumber: "KBLI_MASTER (DESKRIPSI)", altMaster: [] };
  return { candidates: [], sumber: "TIDAK DITEMUKAN", altMaster: [] };
}

/* ---------- batch (chunked agar UI tetap responsif) ---------- */

export interface BatchRow {
  input: string;
  sumber: SumberHasil;
  candidates: Candidate[];
}

export interface BatchOptions {
  n: number;
  threshold: number;
  onProgress: (done: number, total: number, current: string) => void;
  shouldStop: () => boolean;
}

export async function classifyBatch(
  engine: Engine,
  inputs: string[],
  opts: BatchOptions
): Promise<{ rows: BatchRow[]; stopped: boolean }> {
  const total = inputs.length;
  const rows: BatchRow[] = new Array(total);
  const CHUNK = 32;
  let stopped = false;

  for (let start = 0; start < total; start += CHUNK) {
    if (opts.shouldStop()) {
      stopped = true;
      break;
    }
    const end = Math.min(start + CHUNK, total);
    for (let i = start; i < end; i++) {
      const val = String(inputs[i] ?? "");
      if (!val.trim()) {
        rows[i] = { input: val, sumber: "KOSONG", candidates: [] };
      } else {
        const res = classify(engine, val, opts.n, opts.threshold);
        rows[i] = { input: val, sumber: res.sumber, candidates: res.candidates };
      }
    }
    opts.onProgress(end, total, end < total ? inputs[end] : "");
    // beri napas pada event loop agar progress bar tergambar
    await new Promise<void>((r) => setTimeout(r, 0));
  }
  return { rows: rows.slice(0, stopped ? rows.findIndex((r) => !r) : total), stopped };
}

function round1(x: number): number {
  return Math.round(x * 10) / 10;
}
