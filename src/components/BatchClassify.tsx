import { Fragment, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { classifyBatch, getEngine, type BatchRow } from "../engine/classifier";
import { useReferenceStore } from "../store/useReferenceStore";
import type { Notify } from "./SingleSearch";
import {
  IconChevron,
  IconDownload,
  IconFile,
  IconPlay,
  IconStop,
  IconUpload,
  IconX,
  Panel,
  PanelHead,
  SumberBadge,
} from "./ui";

type Phase = "idle" | "running" | "done";

interface Parsed {
  name: string;
  columns: string[];
  rows: Record<string, string>[];
}

const COL_HINTS = ["kegiatan utama", "keg_utama", "kegiatan_utama", "nama_usaha"];

function detectColumn(columns: string[]): string {
  const lowerMap = new Map(columns.map((c) => [c.trim().toLowerCase(), c]));
  for (const h of COL_HINTS) {
    const hit = lowerMap.get(h);
    if (hit) return hit;
  }
  return columns[0] ?? "";
}

function downloadBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function BatchClassify({ notify }: { notify: Notify }) {
  const contoh = useReferenceStore((s) => s.contoh);
  const master = useReferenceStore((s) => s.master);
  const version = useReferenceStore((s) => s.version);

  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [col, setCol] = useState("");
  const [n, setN] = useState(3);
  const [threshold, setThreshold] = useState(70);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState({ done: 0, total: 0, current: "" });
  const [results, setResults] = useState<BatchRow[] | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const stopRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      notify("error", "Format tidak didukung. Unggah file CSV.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const res = Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: true,
      });
      if (!res.data.length || !res.meta.fields?.length) {
        notify("error", "CSV kosong atau tidak memiliki header kolom.");
        return;
      }
      const columns = res.meta.fields;
      setParsed({ name: file.name, columns, rows: res.data });
      setCol(detectColumn(columns));
      setResults(null);
      setPhase("idle");
      setExpanded(null);
      notify("success", `${res.data.length.toLocaleString("id-ID")} record berhasil dibaca dari ${file.name}.`);
    };
    reader.readAsText(file);
  };

  const stats = useMemo(() => {
    if (!results) return null;
    const c = { CONTOH: 0, MASTER: 0, KOSONG: 0, NONE: 0 };
    for (const r of results) {
      if (r.sumber === "CONTOH") c.CONTOH++;
      else if (r.sumber === "KOSONG") c.KOSONG++;
      else if (r.sumber === "TIDAK DITEMUKAN") c.NONE++;
      else c.MASTER++;
    }
    return c;
  }, [results]);

  const run = async () => {
    if (!parsed) return;
    const engine = getEngine(contoh, master, version);
    const inputs = parsed.rows.map((r) => String(r[col] ?? ""));
    stopRef.current = false;
    setPhase("running");
    setResults(null);
    setExpanded(null);
    setProgress({ done: 0, total: inputs.length, current: "" });
    const t0 = performance.now();
    const { rows, stopped } = await classifyBatch(engine, inputs, {
      n,
      threshold,
      shouldStop: () => stopRef.current,
      onProgress: (done, total, current) => setProgress({ done, total, current }),
    });
    setElapsedMs(performance.now() - t0);
    setResults(rows);
    setPhase("done");
    if (stopped) notify("info", "Proses dihentikan. Hasil parsial tetap bisa diunduh.");
    else notify("success", `${rows.length.toLocaleString("id-ID")} record selesai diklasifikasikan.`);
  };

  const downloadCsv = () => {
    if (!parsed || !results) return;
    const rankCols: string[] = [];
    for (let r = 1; r <= n; r++)
      rankCols.push(`KBLI_${r}`, `JUDUL_${r}`, `SKOR_${r}`, `FUZZY_${r}`, `SEMANTIC_${r}`, `REFERENSI_${r}`);
    const fields = [...parsed.columns, "KEGIATAN_UTAMA_INPUT", "SUMBER_REFERENSI", ...rankCols];
    const out = parsed.rows.slice(0, results.length).map((src, i) => {
      const r = results[i];
      const row: Record<string, string | number> = { ...src };
      row.KEGIATAN_UTAMA_INPUT = r.input;
      row.SUMBER_REFERENSI = r.sumber;
      for (let rank = 1; rank <= n; rank++) {
        const cand = r.candidates[rank - 1];
        row[`KBLI_${rank}`] = cand?.kbli ?? "";
        row[`JUDUL_${rank}`] = cand?.judul ?? "";
        row[`SKOR_${rank}`] = cand?.skor ?? "";
        row[`FUZZY_${rank}`] = cand?.fuzzy ?? "";
        row[`SEMANTIC_${rank}`] = cand?.semantic ?? "";
        row[`REFERENSI_${rank}`] = cand?.referensi ?? "";
      }
      return row;
    });
    const csv = Papa.unparse(out, { columns: fields });
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    downloadBlob("hasil_klasifikasi_kbli.csv", blob);
    notify("success", "CSV hasil klasifikasi diunduh (UTF-8 BOM, siap Excel).");
  };

  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
  const preview = parsed?.rows.slice(0, 8) ?? [];

  return (
    <div className="grid gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
      {/* ------- panel kiri: unggah & atur ------- */}
      <div className="space-y-5">
        <Panel delay={40} className="overflow-hidden">
          <PanelHead kicker="Langkah 01" title="Unggah CSV ribuan record" />
          <div className="p-5 space-y-4">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files?.[0];
                if (f) handleFile(f);
              }}
              onClick={() => inputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
              className={`group cursor-pointer rounded-lg border-2 border-dashed px-4 py-8 text-center transition-all ${
                dragOver
                  ? "border-[#1c6b54] bg-[#e5f0e9] scale-[1.01]"
                  : "border-[#c9cfbc] bg-white hover:border-[#1c6b54] hover:bg-[#f4f7ee]"
              }`}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = "";
                }}
              />
              <div className={`mx-auto flex h-11 w-11 items-center justify-center rounded-full transition-colors ${dragOver ? "bg-[#14553f] text-[#e9f2ea]" : "bg-[#e9ecdf] text-[#14553f] group-hover:bg-[#14553f] group-hover:text-[#e9f2ea]"}`}>
                <IconUpload size={20} />
              </div>
              {parsed ? (
                <>
                  <p className="mt-3 text-sm font-bold text-[#152420] break-all">{parsed.name}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-[#5c6b60]">
                    {parsed.rows.length.toLocaleString("id-ID")} baris · {parsed.columns.length} kolom — klik untuk mengganti
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-3 text-sm font-bold text-[#152420]">Seret file CSV ke sini</p>
                  <p className="mt-0.5 text-xs text-[#5c6b60]">atau klik untuk memilih file</p>
                </>
              )}
            </div>

            {parsed && (
              <label className="block">
                <span className="text-xs font-semibold text-[#152420]">Kolom kegiatan utama</span>
                <select
                  value={col}
                  onChange={(e) => setCol(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-[#d5dac9] bg-white px-3 py-2.5 text-sm font-medium text-[#152420] outline-none focus:border-[#1c6b54] focus:ring-2 focus:ring-[#1c6b54]/20"
                >
                  {parsed.columns.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-[#5c6b60]">
                  Kolom terdeteksi otomatis dari nama: kegiatan utama, keg_utama, kegiatan_utama, nama_usaha.
                </p>
              </label>
            )}
          </div>
        </Panel>

        <Panel delay={90} className="overflow-hidden">
          <PanelHead kicker="Langkah 02" title="Atur parameter mesin" />
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="text-xs font-semibold text-[#152420]">Kandidat / record</span>
                  <span className="font-mono text-xs font-bold text-[#14553f] bg-[#e5f0e9] rounded px-1.5 py-0.5 tabular-nums">{n}</span>
                </div>
                <input type="range" min={1} max={5} value={n} onChange={(e) => setN(Number(e.target.value))} className="kbli-range w-full" />
              </label>
              <label className="block">
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="text-xs font-semibold text-[#152420]">Ambang CONTOH</span>
                  <span className="font-mono text-xs font-bold text-[#14553f] bg-[#e5f0e9] rounded px-1.5 py-0.5 tabular-nums">{threshold}</span>
                </div>
                <input type="range" min={50} max={95} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className="kbli-range w-full" />
              </label>
            </div>
            <div className="flex gap-2">
              {phase === "running" ? (
                <button
                  onClick={() => (stopRef.current = true)}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-[#3d1411] px-4 py-3 text-sm font-bold text-[#f7e4de] transition-all hover:bg-[#5a201b] active:scale-[0.98]"
                >
                  <IconStop size={15} /> Hentikan
                </button>
              ) : (
                <button
                  onClick={run}
                  disabled={!parsed || !col}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-[#14553f] px-4 py-3 text-sm font-bold text-[#e9f2ea] shadow-[0_8px_20px_-8px_rgba(20,85,63,0.6)] transition-all hover:bg-[#1c6b54] active:scale-[0.98] disabled:opacity-40 disabled:shadow-none disabled:pointer-events-none"
                >
                  <IconPlay size={15} />
                  {results ? "Klasifikasi Ulang" : "Mulai Klasifikasi"}
                </button>
              )}
              {parsed && (
                <button
                  onClick={() => {
                    setParsed(null);
                    setResults(null);
                    setPhase("idle");
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#d5dac9] bg-white px-3.5 text-sm font-semibold text-[#5c6b60] transition-colors hover:border-[#3d1411] hover:text-[#3d1411]"
                  aria-label="Hapus file"
                >
                  <IconX size={14} />
                </button>
              )}
            </div>
          </div>
        </Panel>
      </div>

      {/* ------- panel kanan: proses & hasil ------- */}
      <div className="space-y-5">
        {parsed && (
          <Panel delay={70} className="overflow-hidden">
            <PanelHead
              kicker="Pratinjau"
              title={`Data sumber — ${parsed.rows.length.toLocaleString("id-ID")} record`}
              right={<SumberBadge sumber={col ? `kolom: ${col}` : "KOSONG"} />}
            />
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#e4e7da] bg-[#f2f4ea]">
                    {parsed.columns.map((c) => (
                      <th key={c} className={`whitespace-nowrap px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-wide ${c === col ? "text-[#14553f] bg-[#e5f0e9]" : "text-[#5c6b60]"}`}>
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eef0e4]">
                  {preview.map((r, i) => (
                    <tr key={i} className="transition-colors hover:bg-[#f6f8ef]">
                      {parsed.columns.map((c) => (
                        <td key={c} className={`max-w-[220px] truncate whitespace-nowrap px-3 py-1.5 ${c === col ? "font-semibold text-[#14553f]" : "text-[#3c4b41]"}`}>
                          {r[c]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="border-t border-[#eef0e4] px-3 py-2 font-mono text-[10px] text-[#8b9587]">
              Semua kolom asli dipertahankan pada hasil akhir.
            </p>
          </Panel>
        )}

        {phase !== "idle" && (
          <Panel delay={90} className="p-5">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[#5c6b60]">
                {phase === "running" ? "Memproses…" : "Selesai"}
              </p>
              <p className="font-mono text-xs font-semibold tabular-nums text-[#152420]">
                {progress.done.toLocaleString("id-ID")} / {progress.total.toLocaleString("id-ID")} · {pct}%
              </p>
            </div>
            <div className="mt-2.5 h-3 overflow-hidden rounded-full bg-[#e3e6da]">
              <div
                className={`h-full rounded-full transition-[width] duration-200 ${phase === "running" ? "progress-stripes bg-[#1c6b54]" : "bg-[#e8a317]"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-2 truncate font-mono text-[11px] text-[#8b9587]">
              {phase === "running" && progress.current ? `→ ${progress.current}` : phase === "done" ? `${(elapsedMs / 1000).toFixed(2)} detik untuk ${progress.total.toLocaleString("id-ID")} record (${Math.round(progress.total / Math.max(1, elapsedMs / 1000)).toLocaleString("id-ID")} record/detik)` : "menyiapkan mesin…"}
            </p>

            {phase === "done" && stats && results && (
              <>
                <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-[#e3e6da]">
                  {stats.CONTOH > 0 && <div className="bg-[#1c6b54]" style={{ width: `${(stats.CONTOH / results.length) * 100}%` }} title={`CONTOH: ${stats.CONTOH}`} />}
                  {stats.MASTER > 0 && <div className="bg-[#e8a317]" style={{ width: `${(stats.MASTER / results.length) * 100}%` }} title={`KBLI_MASTER: ${stats.MASTER}`} />}
                  {stats.KOSONG > 0 && <div className="bg-[#9aa193]" style={{ width: `${(stats.KOSONG / results.length) * 100}%` }} title={`Kosong: ${stats.KOSONG}`} />}
                  {stats.NONE > 0 && <div className="bg-[#8a3a30]" style={{ width: `${(stats.NONE / results.length) * 100}%` }} title={`Tidak ditemukan: ${stats.NONE}`} />}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-[#3c4b41]">
                  <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#1c6b54]" />CONTOH {stats.CONTOH.toLocaleString("id-ID")}</span>
                  <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#e8a317]" />KBLI_MASTER {stats.MASTER.toLocaleString("id-ID")}</span>
                  <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#9aa193]" />Kosong {stats.KOSONG.toLocaleString("id-ID")}</span>
                  <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#8a3a30]" />Nihil {stats.NONE.toLocaleString("id-ID")}</span>
                </div>
                <button
                  onClick={downloadCsv}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#8a5f06] px-4 py-3 text-sm font-bold text-[#faf0d8] shadow-[0_8px_20px_-8px_rgba(138,95,6,0.7)] transition-all hover:bg-[#a3720b] active:scale-[0.98]"
                >
                  <IconDownload size={15} /> Download hasil klasifikasi CSV
                </button>
              </>
            )}
          </Panel>
        )}

        {results && (
          <Panel delay={120} className="overflow-hidden">
            <PanelHead
              kicker="Hasil"
              title={`${results.length.toLocaleString("id-ID")} record terklasifikasi`}
              right={
                <span className="font-mono text-[10px] uppercase tracking-wide text-[#8b9587]">
                  pratinjau {Math.min(50, results.length)} baris pertama
                </span>
              }
            />
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#e4e7da] bg-[#f2f4ea]">
                    <th className="px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-wide text-[#5c6b60]">#</th>
                    <th className="px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-wide text-[#5c6b60]">Kegiatan (input)</th>
                    <th className="px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-wide text-[#5c6b60]">Sumber</th>
                    <th className="px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-wide text-[#5c6b60]">KBLI teratas</th>
                    <th className="px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-wide text-[#5c6b60]">Judul</th>
                    <th className="px-3 py-2 text-right font-mono text-[10px] font-bold uppercase tracking-wide text-[#5c6b60]">Skor</th>
                    <th className="w-8 px-2 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eef0e4]">
                  {results.slice(0, 50).map((r, i) => {
                    const top = r.candidates[0];
                    return (
                      <Fragment key={`row-${i}`}>
                        <tr
                          onClick={() => setExpanded(expanded === i ? null : i)}
                          className="cursor-pointer transition-colors hover:bg-[#f6f8ef]"
                        >
                          <td className="px-3 py-2 font-mono text-[#8b9587] tabular-nums">{i + 1}</td>
                          <td className="max-w-[240px] truncate px-3 py-2 font-medium text-[#152420]">{r.input || <span className="italic text-[#9aa193]">(kosong)</span>}</td>
                          <td className="px-3 py-2"><SumberBadge sumber={r.sumber} /></td>
                          <td className="px-3 py-2 font-mono font-bold text-[#14553f] tabular-nums">{top?.kbli ?? "—"}</td>
                          <td className="max-w-[220px] truncate px-3 py-2 text-[#3c4b41]">{top?.judul ?? "—"}</td>
                          <td className="px-3 py-2 text-right font-mono font-semibold tabular-nums text-[#152420]">{top ? top.skor.toFixed(1) : "—"}</td>
                          <td className="px-2 py-2 text-[#8b9587]">
                            {r.candidates.length > 1 && (
                              <span className={`inline-block transition-transform ${expanded === i ? "rotate-180" : ""}`}>
                                <IconChevron size={12} />
                              </span>
                            )}
                          </td>
                        </tr>
                        {expanded === i && r.candidates.length > 1 && (
                          <tr key={`x-${i}`} className="bg-[#f6f8ef]">
                            <td />
                            <td colSpan={6} className="px-3 py-2">
                              <div className="flex flex-wrap gap-1.5">
                                {r.candidates.map((c, ci) => (
                                  <span key={`${c.kbli}-${ci}`} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11px] ring-1 ring-inset ${ci === 0 ? "bg-[#e5f0e9] text-[#14553f] ring-[#bcd6c6] font-bold" : "bg-white text-[#3c4b41] ring-[#dfe3d5]"}`}>
                                    {c.kbli} · {c.skor.toFixed(1)}
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {results.length > 50 && (
              <p className="flex items-center gap-2 border-t border-[#eef0e4] px-3 py-2.5 text-[11px] text-[#5c6b60]">
                <IconFile size={13} />
                {(results.length - 50).toLocaleString("id-ID")} record lain tersedia di file CSV hasil unduhan.
              </p>
            )}
          </Panel>
        )}

        {!parsed && phase === "idle" && (
          <Panel delay={100} className="p-10 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#e9ecdf] text-[#14553f]">
              <IconFile size={26} />
            </div>
            <h3 className="font-display mt-4 text-xl font-bold text-[#152420]">Belum ada file</h3>
            <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-[#5c6b60]">
              Unggah CSV dengan kolom kegiatan utama — semua kolom asli dipertahankan dan
              hasil klasifikasi (KBLI_1..{n}, skor, sumber referensi) ditambahkan sebagai kolom baru.
            </p>
          </Panel>
        )}
      </div>
    </div>
  );
}
