import { create } from "zustand";
import { DEFAULT_CONTOH, DEFAULT_MASTER } from "../data";
import type { ContohRow, MasterRow } from "../engine/classifier";
import { invalidateEngine } from "../engine/classifier";

const LS_CONTOH = "pkbli5:contoh";
const LS_MASTER = "pkbli5:master";
const LS_META = "pkbli5:meta";

interface Meta {
  version: number;
  updatedAt: number;
}

function loadJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function loadInitial(): { contoh: ContohRow[]; master: MasterRow[]; meta: Meta } {
  const contoh = loadJson<ContohRow[]>(LS_CONTOH) ?? DEFAULT_CONTOH;
  const master = loadJson<MasterRow[]>(LS_MASTER) ?? DEFAULT_MASTER;
  const meta = loadJson<Meta>(LS_META) ?? { version: 1, updatedAt: Date.now() };
  return { contoh, master, meta };
}

export interface RefStore {
  contoh: ContohRow[];
  master: MasterRow[];
  version: number;
  updatedAt: number;
  storageWarning: boolean;

  addContoh: (kegiatan: string, kbli: string) => { ok: boolean; msg: string };
  importContoh: (rows: ContohRow[]) => {
    ok: boolean;
    msg: string;
    added: number;
    dup: number;
  };
  importMaster: (rows: MasterRow[]) => {
    ok: boolean;
    msg: string;
    added: number;
    replaced: number;
  };
  removeContohAt: (index: number) => void;
  resetAll: () => void;
  clearStorageWarning: () => void;
}

function persist(contoh: ContohRow[], master: MasterRow[], meta: Meta): boolean {
  try {
    const c = JSON.stringify(contoh);
    const m = JSON.stringify(master);
    if (c.length + m.length > 4_500_000) return false;
    localStorage.setItem(LS_CONTOH, c);
    localStorage.setItem(LS_MASTER, m);
    localStorage.setItem(LS_META, JSON.stringify(meta));
    return true;
  } catch {
    return false;
  }
}

const init = loadInitial();

export const useReferenceStore = create<RefStore>((set, get) => ({
  contoh: init.contoh,
  master: init.master,
  version: init.meta.version,
  updatedAt: init.meta.updatedAt,
  storageWarning: false,

  addContoh: (kegiatan, kbli) => {
    const s = get();
    const k = kegiatan.trim();
    const code = kbli.trim();
    if (!k || !code) return { ok: false, msg: "Isi kegiatan utama dan kode KBLI." };
    const masterCodes = new Set(s.master.map((m) => m.kbli));
    if (!masterCodes.has(code))
      return { ok: false, msg: `Kode KBLI ${code} tidak ditemukan di KBLI_MASTER.` };
    if (s.contoh.some((c) => c.kegiatan.toLowerCase() === k.toLowerCase() && c.kbli === code))
      return { ok: false, msg: "Referensi identik sudah ada di CONTOH." };

    const contoh = [...s.contoh, { kegiatan: k, kbli: code }];
    const meta: Meta = { version: s.version + 1, updatedAt: Date.now() };
    const ok = persist(contoh, s.master, meta);
    invalidateEngine();
    set({
      contoh,
      version: meta.version,
      updatedAt: meta.updatedAt,
      storageWarning: !ok,
    });
    return { ok: true, msg: "Referensi baru berhasil ditambahkan ke CONTOH." };
  },

  importContoh: (rows) => {
    const s = get();
    const masterCodes = new Set(s.master.map((m) => m.kbli));
    const seen = new Set(s.contoh.map((c) => `${c.kegiatan.toLowerCase()}::${c.kbli}`));
    let added = 0;
    let dup = 0;
    const next = [...s.contoh];
    for (const r of rows) {
      const k = String(r.kegiatan ?? "").trim();
      const code = String(r.kbli ?? "").trim();
      if (!k || !code || !masterCodes.has(code)) continue;
      const key = `${k.toLowerCase()}::${code}`;
      if (seen.has(key)) {
        dup++;
        continue;
      }
      seen.add(key);
      next.push({ kegiatan: k, kbli: code });
      added++;
    }
    if (!added)
      return { ok: false, msg: "Tidak ada baris valid. Periksa kolom 'kegiatan utama' dan 'kbli'.", added, dup };
    const meta: Meta = { version: s.version + 1, updatedAt: Date.now() };
    const ok = persist(next, s.master, meta);
    invalidateEngine();
    set({ contoh: next, version: meta.version, updatedAt: meta.updatedAt, storageWarning: !ok });
    return {
      ok: true,
      msg: `${added.toLocaleString("id-ID")} referensi CONTOH diimpor${dup ? `, ${dup.toLocaleString("id-ID")} duplikat dilewati` : ""}.`,
      added,
      dup,
    };
  },

  importMaster: (rows) => {
    const s = get();
    const idx = new Map(s.master.map((m, i) => [m.kbli, i] as const));
    const next = [...s.master];
    let added = 0;
    let replaced = 0;
    for (const r of rows) {
      const code = String(r.kbli ?? "").trim();
      const judul = String(r.judul ?? "").trim();
      const deskripsi = String(r.deskripsi ?? "").trim();
      if (!code) continue;
      const row: MasterRow = {
        kbli: code,
        judul: judul || "Tanpa Judul",
        deskripsi: deskripsi || judul || code,
      };
      const ex = idx.get(code);
      if (ex !== undefined) {
        next[ex] = row;
        replaced++;
      } else {
        idx.set(code, next.length);
        next.push(row);
        added++;
      }
    }
    if (!added && !replaced)
      return { ok: false, msg: "Tidak ada baris valid. Butuh kolom KBLI, Judul, Deskripsi.", added, replaced };
    const meta: Meta = { version: s.version + 1, updatedAt: Date.now() };
    const ok = persist(s.contoh, next, meta);
    invalidateEngine();
    set({ master: next, version: meta.version, updatedAt: meta.updatedAt, storageWarning: !ok });
    return {
      ok: true,
      msg: `KBLI_MASTER diperbarui: ${added.toLocaleString("id-ID")} kode baru, ${replaced.toLocaleString("id-ID")} diganti.`,
      added,
      replaced,
    };
  },

  removeContohAt: (index) => {
    const s = get();
    const contoh = s.contoh.filter((_, i) => i !== index);
    const meta: Meta = { version: s.version + 1, updatedAt: Date.now() };
    const ok = persist(contoh, s.master, meta);
    invalidateEngine();
    set({ contoh, version: meta.version, updatedAt: meta.updatedAt, storageWarning: !ok });
  },

  resetAll: () => {
    const meta: Meta = { version: get().version + 1, updatedAt: Date.now() };
    try {
      localStorage.removeItem(LS_CONTOH);
      localStorage.removeItem(LS_MASTER);
      localStorage.removeItem(LS_META);
    } catch {
      /* abaikan */
    }
    invalidateEngine();
    set({
      contoh: DEFAULT_CONTOH,
      master: DEFAULT_MASTER,
      version: meta.version,
      updatedAt: meta.updatedAt,
      storageWarning: false,
    });
  },

  clearStorageWarning: () => set({ storageWarning: false }),
}));
