import { MASTER_AGRO } from "./masterAgro";
import { MASTER_JASA } from "./masterJasa";
import { CONTOH_SEED } from "./contohList";
import type { ContohRow, MasterRow } from "../engine/classifier";

export const DEFAULT_MASTER: MasterRow[] = [...MASTER_AGRO, ...MASTER_JASA].map(
  (s) => ({ kbli: s.k, judul: s.j, deskripsi: s.d })
);

export const DEFAULT_CONTOH: ContohRow[] = CONTOH_SEED.map((s) => ({
  kegiatan: s.u,
  kbli: s.k,
}));

/** Contoh cepat untuk chip di panel pencarian. */
export const QUICK_EXAMPLES: string[] = [
  "MEMELIHARA AYAM UNTUK DIJUAL",
  "TOKO KELONTONG",
  "LAUNDRY KILOAN",
  "BENGKEL SEPADA MOTOR",
  "JASA PEMBUATAN WEBSITE",
  "WARUNG MAKAN PADANG",
];
