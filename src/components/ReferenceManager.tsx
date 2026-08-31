import { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { useReferenceStore } from "../store/useReferenceStore";
import type { ContohRow, MasterRow } from "../engine/classifier";
import type { Notify } from "./SingleSearch";
import {
  IconDatabase,
  IconDownload,
  IconPlus,
  IconReset,
  IconTrash,
  IconUpload,
  Panel,
  PanelHead,
} from "./ui";

function downloadText(name: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const PAGE = 10;

export function ReferenceManager({ notify }: { notify: Notify }) {
  const store = useReferenceStore();
  const { contoh, master, updatedAt, storageWarning, clearStorageWarning } = store;

  const [kegiatan, setKegiatan] = useState("");
  const [kbli, setKbli] = useState("");
  const [formErr, setFormErr] = useState("");

  const [mode, setMode] = useState<"contoh" | "master">("contoh");
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(0);
  const [armReset, setArmReset] = useState(false);

  const contohFile = useRef<HTMLInputElement>(null);
  const masterFile = useRef<HTMLInputElement>(null);

  const submitAdd = () => {
    const res = store.addContoh(kegiatan, kbli);
    if (res.ok) {
      setFormErr("");
      setKegiatan("");
      setKbli("");
      notify("success", res.msg);
    } else {
      setFormErr(res.msg);
    }
  };

  const onContohCsv = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = Papa.parse<Record<string, string>>(String(reader.result ?? ""), {
        header: true,
        skipEmptyLines: true,
      });
      const fields = (res.meta.fields ?? []).map((f) => f.trim().toLowerCase());
      const iu = fields.indexOf("kegiatan utama");
      const ik = fields.indexOf("kbli");
      if (iu < 0 || ik < 0) {
        notify("error", "CSV harus memiliki kolom: kegiatan utama dan kbli");
        return;
      }
      const keys = res.meta.fields!;
      const rows: ContohRow[] = res.data.map((r) => ({
        kegiatan: r[keys[iu]] ?? "",
        kbli: r[keys[ik]] ?? "",
      }));
      const out = store.importContoh(rows);
      notify(out.ok ? "success" : "error", out.msg);
    };
    reader.readAsText(file);
  };

  const onMasterCsv = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = Papa.parse<Record<string, string>>(String(reader.result ?? ""), {
        header: true,
        skipEmptyLines: true,
      });
      const fields = (res.meta.fields ?? []).map((f) => f.trim().toLowerCase());
      const ik = fields.indexOf("kbli");
      if (ik < 0) {
        notify("error", "CSV harus memiliki kolom: KBLI, Judul, Deskripsi");
        return;
      }
      const keys = res.meta.fields!;
      const ijud = fields.indexOf("judul");
      const idesk = fields.indexOf("deskripsi");
      const rows: MasterRow[] = res.data.map((r) => ({
        kbli: r[keys[ik]] ?? "",
        judul: ijud >= 0 ? r[keys[ijud]] ?? "" : "",
        deskripsi: idesk >= 0 ? r[keys[idesk]] ?? "" : "",
      }));
      const out = store.importMaster(rows);
      notify(out.ok ? "success" : "error", out.msg);
    };
    reader.readAsText(file);
  };

  const downloadXlsx = () => {
    const wb = XLSX.utils.book_new();
    const wsC = XLSX.utils.json_to_sheet(
      contoh.map((c) => ({ "kegiatan utama": c.kegiatan, kbli: c.kbli }))
    );
    const wsM = XLSX.utils.json_to_sheet(
      master.map((m) => ({ KBLI: m.kbli, Judul: m.judul, Deskripsi: m.deskripsi }))
    );
    XLSX.utils.book_append_sheet(wb, wsC, "CONTOH");
    XLSX.utils.book_append_sheet(wb, wsM, "KBLI_MASTER");
    XLSX.writeFile(wb, "REFERENSI_KBLI.xlsx");
    notify("success", "REFERENSI_KBLI.xlsx diunduh (2 sheet: CONTOH & KBLI_MASTER).");
  };

  const filteredContoh = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return contoh
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => !f || c.kegiatan.toLowerCase().includes(f) || c.kbli.includes(f));
  }, [contoh, filter]);

  const filteredMaster = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return master.filter(
      (m) => !f || m.kbli.includes(f) || m.judul.toLowerCase().includes(f) || m.deskripsi.toLowerCase().includes(f)
    );
  }, [master, filter]);

  const pageItems = <T,>(arr: T[]): T[] => arr.slice(page * PAGE, page * PAGE + PAGE);
  const totalPage = (len: number) => Math.max(1, Math.ceil(len / PAGE));

  const switchMode = (m: "contoh" | "master") => {
    setMode(m);
    setPage(0);
    setFilter("");
  };

  return (
    <div className="space-y-5">
      {storageWarning && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-[#e5cd92] bg-[#faf0d8] px-4 py-2.5 text-xs font-medium text-[#8a5f06]">
          <span>
            Penyimpanan browser penuh — perubahan tetap berlaku untuk sesi ini namun tidak
            tersimpan permanen.
          </span>
          <button onClick={clearStorageWarning} className="font-mono font-bold uppercase hover:underline">
            Tutup
          </button>
        </div>
      )}

      {/* statistik */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Referensi CONTOH", value: contoh.length, sub: "kegiatan → KBLI", tone: "#1c6b54" },
          { label: "Kode KBLI_MASTER", value: master.length, sub: "judul & deskripsi", tone: "#e8a317" },
          { label: "Pembaruan terakhir", value: -1, sub: new Date(updatedAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }), tone: "#152420" },
        ].map((s) => (
          <div key={s.label} className="reveal-panel rounded-xl border border-[#dfe3d5] bg-[#fbfcf7] px-5 py-4">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8b9587]">{s.label}</p>
            <p className="mt-1 font-display text-3xl font-extrabold tabular-nums" style={{ color: s.tone }}>
              {s.value >= 0 ? s.value.toLocaleString("id-ID") : "•••"}
            </p>
            <p className="text-xs text-[#5c6b60]">{s.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* tambah manual */}
        <Panel delay={50} className="overflow-hidden">
          <PanelHead kicker="Kurasi manual" title="Tambah referensi kegiatan → KBLI" />
          <div className="p-5 space-y-3.5">
            <label className="block">
              <span className="text-xs font-semibold text-[#152420]">Kegiatan utama baru</span>
              <textarea
                value={kegiatan}
                onChange={(e) => setKegiatan(e.target.value)}
                rows={2}
                placeholder="Contoh: JUALAN SEBLAK DI RUMAH"
                className="mt-1.5 w-full resize-none rounded-lg border border-[#d5dac9] bg-white px-3.5 py-2.5 text-sm font-medium text-[#152420] placeholder:text-[#9aa193] outline-none focus:border-[#1c6b54] focus:ring-2 focus:ring-[#1c6b54]/20"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-[#152420]">Kode KBLI</span>
              <input
                value={kbli}
                onChange={(e) => setKbli(e.target.value)}
                placeholder="Contoh: 56102"
                className="mt-1.5 w-full rounded-lg border border-[#d5dac9] bg-white px-3.5 py-2.5 font-mono text-sm font-semibold text-[#152420] placeholder:font-sans placeholder:font-normal placeholder:text-[#9aa193] outline-none focus:border-[#1c6b54] focus:ring-2 focus:ring-[#1c6b54]/20"
              />
            </label>
            {formErr && (
              <p className="rounded-md bg-[#f7e4de] px-3 py-2 text-xs font-medium text-[#8a3a30]">{formErr}</p>
            )}
            <button
              onClick={submitAdd}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#14553f] px-4 py-2.5 text-sm font-bold text-[#e9f2ea] transition-all hover:bg-[#1c6b54] active:scale-[0.98]"
            >
              <IconPlus size={14} /> Tambahkan ke CONTOH
            </button>
            <p className="text-[11px] leading-snug text-[#5c6b60]">
              Kode divalidasi terhadap KBLI_MASTER. Setiap penambahan langsung melatih ulang
              indeks semantik.
            </p>
          </div>
        </Panel>

        {/* impor & ekspor */}
        <Panel delay={100} className="overflow-hidden">
          <PanelHead kicker="Impor & ekspor" title="Sinkronkan berkas referensi" />
          <div className="p-5 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                onClick={() => contohFile.current?.click()}
                className="group rounded-lg border border-dashed border-[#c9cfbc] bg-white px-4 py-4 text-left transition-all hover:border-[#1c6b54] hover:bg-[#f4f7ee]"
              >
                <span className="flex items-center gap-2 text-sm font-bold text-[#152420]">
                  <span className="text-[#14553f] transition-transform group-hover:-translate-y-0.5"><IconUpload size={16} /></span>
                  Impor CONTOH (CSV)
                </span>
                <code className="mt-2 block rounded bg-[#f2f4ea] px-2 py-1.5 font-mono text-[10px] text-[#5c6b60]">
                  kegiatan utama,kbli
                </code>
              </button>
              <button
                onClick={() => masterFile.current?.click()}
                className="group rounded-lg border border-dashed border-[#c9cfbc] bg-white px-4 py-4 text-left transition-all hover:border-[#8a5f06] hover:bg-[#faf6e9]"
              >
                <span className="flex items-center gap-2 text-sm font-bold text-[#152420]">
                  <span className="text-[#8a5f06] transition-transform group-hover:-translate-y-0.5"><IconUpload size={16} /></span>
                  Impor KBLI_MASTER (CSV)
                </span>
                <code className="mt-2 block rounded bg-[#f2f4ea] px-2 py-1.5 font-mono text-[10px] text-[#5c6b60]">
                  KBLI,Judul,Deskripsi
                </code>
              </button>
              <input ref={contohFile} type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onContohCsv(f); e.target.value = ""; }} />
              <input ref={masterFile} type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onMasterCsv(f); e.target.value = ""; }} />
            </div>

            <div className="rounded-lg border border-[#dfe3d5] bg-white p-3.5">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-[#8b9587]">
                Impor master penuh untuk cakupan KBLI 2020 lengkap
              </p>
              <p className="mt-1 text-[11px] leading-snug text-[#5c6b60]">
                Referensi bawaan berisi ±{master.length.toLocaleString("id-ID")} kode kurasi.
                Impor berkas KBLI_MASTER Anda sendiri — kode yang sama akan diganti, kode baru
                ditambahkan.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={downloadXlsx}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#8a5f06] px-4 py-2.5 text-sm font-bold text-[#faf0d8] transition-all hover:bg-[#a3720b] active:scale-[0.98]"
              >
                <IconDownload size={14} /> Download REFERENSI_KBLI.xlsx
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    const csv = Papa.unparse(contoh.map((c) => ({ "kegiatan utama": c.kegiatan, kbli: c.kbli })));
                    downloadText("CONTOH.csv", "\uFEFF" + csv, "text/csv;charset=utf-8");
                    notify("success", "Sheet CONTOH diunduh sebagai CSV.");
                  }}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#d5dac9] bg-white px-3 py-2 text-xs font-semibold text-[#3c4b41] transition-colors hover:border-[#14553f] hover:text-[#14553f]"
                >
                  <IconDownload size={13} /> CONTOH.csv
                </button>
                <button
                  onClick={() => {
                    const csv = Papa.unparse(master.map((m) => ({ KBLI: m.kbli, Judul: m.judul, Deskripsi: m.deskripsi })));
                    downloadText("KBLI_MASTER.csv", "\uFEFF" + csv, "text/csv;charset=utf-8");
                    notify("success", "Sheet KBLI_MASTER diunduh sebagai CSV.");
                  }}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#d5dac9] bg-white px-3 py-2 text-xs font-semibold text-[#3c4b41] transition-colors hover:border-[#14553f] hover:text-[#14553f]"
                >
                  <IconDownload size={13} /> KBLI_MASTER.csv
                </button>
              </div>
            </div>
          </div>
        </Panel>
      </div>

      {/* penjelajah referensi */}
      <Panel delay={140} className="overflow-hidden">
        <PanelHead
          kicker="Penjelajah"
          title={mode === "contoh" ? `Referensi CONTOH (${contoh.length.toLocaleString("id-ID")})` : `KBLI_MASTER (${master.length.toLocaleString("id-ID")})`}
          right={
            <button
              onClick={() => {
                if (!armReset) {
                  setArmReset(true);
                  window.setTimeout(() => setArmReset(false), 3000);
                  return;
                }
                store.resetAll();
                setArmReset(false);
                notify("info", "Referensi dikembalikan ke bawaan aplikasi.");
              }}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wide transition-all ${
                armReset
                  ? "bg-[#3d1411] text-[#f7e4de] animate-pulse"
                  : "border border-[#d5dac9] bg-white text-[#5c6b60] hover:border-[#3d1411] hover:text-[#3d1411]"
              }`}
            >
              <IconReset size={12} /> {armReset ? "Klik lagi untuk konfirmasi" : "Reset bawaan"}
            </button>
          }
        />
        <div className="flex flex-wrap items-center gap-3 border-b border-[#eef0e4] bg-[#fafbf5] px-5 py-3">
          <div className="flex overflow-hidden rounded-lg border border-[#d5dac9]">
            {(["contoh", "master"] as const).map((m) => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className={`px-3.5 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wide transition-colors ${
                  mode === m ? "bg-[#14553f] text-[#e9f2ea]" : "bg-white text-[#5c6b60] hover:bg-[#f2f4ea]"
                }`}
              >
                {m === "contoh" ? "CONTOH" : "KBLI_MASTER"}
              </button>
            ))}
          </div>
          <input
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(0);
            }}
            placeholder={mode === "contoh" ? "Saring kegiatan atau kode…" : "Saring kode, judul, deskripsi…"}
            className="min-w-52 flex-1 rounded-lg border border-[#d5dac9] bg-white px-3 py-1.5 text-sm outline-none focus:border-[#1c6b54] focus:ring-2 focus:ring-[#1c6b54]/20"
          />
          <span className="font-mono text-[11px] text-[#8b9587] tabular-nums">
            Hal {page + 1}/{mode === "contoh" ? totalPage(filteredContoh.length) : totalPage(filteredMaster.length)}
          </span>
        </div>

        {mode === "contoh" ? (
          <div className="divide-y divide-[#eef0e4]">
            {pageItems(filteredContoh).map(({ c, i }) => (
              <div key={`${c.kegiatan}-${i}`} className="group flex items-center gap-3 px-5 py-2 text-sm transition-colors hover:bg-[#f6f8ef]">
                <span className="font-mono text-xs font-bold text-[#14553f] tabular-nums w-14 shrink-0">{c.kbli}</span>
                <span className="min-w-0 flex-1 truncate font-medium text-[#3c4b41]">{c.kegiatan}</span>
                <button
                  onClick={() => {
                    store.removeContohAt(i);
                    notify("info", "Referensi dihapus dari CONTOH.");
                  }}
                  className="shrink-0 rounded p-1 text-[#c2c8b8] opacity-0 transition-all hover:bg-[#f7e4de] hover:text-[#8a3a30] group-hover:opacity-100"
                  aria-label={`Hapus ${c.kegiatan}`}
                >
                  <IconTrash size={14} />
                </button>
              </div>
            ))}
            {!filteredContoh.length && (
              <p className="px-5 py-8 text-center text-sm text-[#8b9587]">Tidak ada hasil untuk saringan ini.</p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-[#eef0e4]">
            {pageItems(filteredMaster).map((m) => (
              <div key={m.kbli} className="flex items-start gap-3 px-5 py-2.5 text-sm transition-colors hover:bg-[#f6f8ef]">
                <span className="font-mono text-xs font-bold text-[#8a5f06] tabular-nums w-14 shrink-0 pt-0.5">{m.kbli}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold leading-snug text-[#152420]">{m.judul}</p>
                  <p className="mt-0.5 line-clamp-1 text-xs text-[#5c6b60]">{m.deskripsi}</p>
                </div>
              </div>
            ))}
            {!filteredMaster.length && (
              <p className="px-5 py-8 text-center text-sm text-[#8b9587]">Tidak ada hasil untuk saringan ini.</p>
            )}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-[#eef0e4] px-5 py-2.5">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="rounded-lg border border-[#d5dac9] bg-white px-3 py-1 text-xs font-semibold text-[#3c4b41] transition-colors hover:border-[#14553f] hover:text-[#14553f] disabled:opacity-35 disabled:pointer-events-none"
          >
            ← Sebelumnya
          </button>
          <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide text-[#8b9587]">
            <IconDatabase size={11} /> tersimpan di browser
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPage((mode === "contoh" ? filteredContoh : filteredMaster).length) - 1, p + 1))}
            disabled={page >= totalPage((mode === "contoh" ? filteredContoh : filteredMaster).length) - 1}
            className="rounded-lg border border-[#d5dac9] bg-white px-3 py-1 text-xs font-semibold text-[#3c4b41] transition-colors hover:border-[#14553f] hover:text-[#14553f] disabled:opacity-35 disabled:pointer-events-none"
          >
            Berikutnya →
          </button>
        </div>
      </Panel>
    </div>
  );
}
