import { useEffect, useMemo, useState } from "react";
import { classify, getEngine, type Candidate } from "../engine/classifier";
import { QUICK_EXAMPLES } from "../data";
import { useReferenceStore } from "../store/useReferenceStore";
import {
  IconBolt,
  IconCheck,
  IconChevron,
  IconSearch,
  IconTarget,
  IconX,
  Panel,
  PanelHead,
  ScoreBar,
  SumberBadge,
  useScramble,
} from "./ui";

export type Notify = (kind: "success" | "error" | "info", msg: string) => void;

function Slider({
  label,
  value,
  min,
  max,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  hint?: string;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-xs font-semibold text-[#152420]">{label}</span>
        <span className="font-mono text-xs font-bold text-[#14553f] bg-[#e5f0e9] rounded px-1.5 py-0.5 tabular-nums">
          {value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="kbli-range w-full"
      />
      {hint && <p className="mt-1 text-[11px] leading-snug text-[#5c6b60]">{hint}</p>}
    </label>
  );
}

function CandidateCard({
  c,
  top,
  notify,
  delay,
}: {
  c: Candidate;
  top: boolean;
  notify: Notify;
  delay: number;
}) {
  const [open, setOpen] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(c.kbli);
      notify("success", `Kode KBLI ${c.kbli} disalin ke papan klip.`);
    } catch {
      notify("error", "Peramban menolak akses papan klip.");
    }
  };

  return (
    <article
      className="reveal-panel group relative rounded-lg border bg-white/70 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_28px_-14px_rgba(21,36,32,0.35)]"
      style={{ animationDelay: `${delay}ms`, borderColor: top ? "#1c6b54" : "#e2e5d7" }}
    >
      {top && (
        <span className="absolute -top-2.5 left-4 rounded-full bg-[#14553f] px-2 py-0.5 text-[9px] font-mono font-bold uppercase tracking-widest text-[#e9f2ea]">
          Kandidat Utama
        </span>
      )}
      <div className="flex items-start gap-3 p-4">
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-mono text-sm font-bold ${
            top ? "bg-[#14553f] text-[#e9f2ea]" : "bg-[#e9ecdf] text-[#3c4b41]"
          }`}
        >
          {c.rank}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <button
              onClick={copy}
              title="Klik untuk menyalin kode"
              className="font-mono text-lg font-bold text-[#14553f] tabular-nums hover:text-[#8a5f06] transition-colors"
            >
              {c.kbli}
            </button>
            <SumberBadge sumber={c.sumber} />
          </div>
          <h3 className="mt-0.5 text-sm font-semibold leading-snug text-[#152420]">{c.judul}</h3>
          <div className="mt-2.5 grid gap-1.5 sm:grid-cols-3 max-w-2xl">
            <ScoreBar label="Skor" value={c.skor} tone="pine" />
            <ScoreBar label="Semantik" value={c.semantic} tone="amber" />
            <ScoreBar label="Fuzzy" value={c.fuzzy} tone="ink" />
          </div>
          <button
            onClick={() => setOpen((o) => !o)}
            className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-mono font-semibold uppercase tracking-wide text-[#5c6b60] hover:text-[#14553f] transition-colors"
          >
            Referensi pembanding
            <span className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
              <IconChevron size={12} />
            </span>
          </button>
          {open && (
            <p className="ref-in mt-2 rounded-md bg-[#f2f4ea] px-3 py-2 text-xs leading-relaxed text-[#3c4b41]">
              {c.referensi || "—"}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <div className="font-display text-2xl font-extrabold tabular-nums text-[#152420]">
            {c.skor.toFixed(1)}
          </div>
          <div className="text-[9px] font-mono uppercase tracking-widest text-[#8b9587]">skor</div>
        </div>
      </div>
    </article>
  );
}

export function SingleSearch({ notify }: { notify: Notify }) {
  const contoh = useReferenceStore((s) => s.contoh);
  const master = useReferenceStore((s) => s.master);
  const version = useReferenceStore((s) => s.version);

  const [raw, setRaw] = useState("");
  const [query, setQuery] = useState("");
  const [n, setN] = useState(3);
  const [threshold, setThreshold] = useState(70);

  useEffect(() => {
    const t = window.setTimeout(() => setQuery(raw), raw.trim() ? 320 : 0);
    return () => window.clearTimeout(t);
  }, [raw]);

  const result = useMemo(() => {
    if (!query.trim()) return null;
    const engine = getEngine(contoh, master, version);
    const t0 = performance.now();
    const res = classify(engine, query, n, threshold);
    return { res, ms: performance.now() - t0 };
  }, [query, n, threshold, contoh, master, version]);

  const top = result?.res.candidates[0];
  const scrambleCode = useScramble(top?.kbli ?? "");

  return (
    <div className="grid gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
      {/* ------- konsol input ------- */}
      <Panel delay={40} className="h-fit lg:sticky lg:top-24 overflow-hidden">
        <PanelHead kicker="Langkah 01" title="Deskripsikan kegiatan usaha" />
        <div className="p-5 space-y-5">
          <div>
            <label htmlFor="kegiatan" className="text-xs font-semibold text-[#152420]">
              Kegiatan utama
            </label>
            <div className="relative mt-1.5">
              <textarea
                id="kegiatan"
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    setQuery(raw);
                  }
                }}
                rows={3}
                placeholder="Contoh: MEMELIHARA AYAM UNTUK DIJUAL"
                className="w-full resize-none rounded-lg border border-[#d5dac9] bg-white px-3.5 py-3 pr-9 text-sm font-medium text-[#152420] placeholder:text-[#9aa193] outline-none transition-all focus:border-[#1c6b54] focus:ring-2 focus:ring-[#1c6b54]/20"
              />
              {raw && (
                <button
                  onClick={() => {
                    setRaw("");
                    setQuery("");
                  }}
                  className="absolute right-2.5 top-2.5 text-[#9aa193] hover:text-[#152420] transition-colors"
                  aria-label="Bersihkan input"
                >
                  <IconX size={14} />
                </button>
              )}
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[11px] font-mono text-[#8b9587]">
              <span>{raw.length} karakter</span>
              <span>{raw.trim() ? "mencari otomatis…" : "tekan Enter untuk mencari"}</span>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-mono font-semibold uppercase tracking-widest text-[#8b9587] mb-1.5">
              Coba contoh cepat
            </p>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_EXAMPLES.map((q) => (
                <button
                  key={q}
                  onClick={() => {
                    setRaw(q);
                    setQuery(q);
                  }}
                  className="rounded-full border border-[#d5dac9] bg-white px-2.5 py-1 text-[11px] font-medium text-[#3c4b41] transition-all hover:border-[#1c6b54] hover:bg-[#e5f0e9] hover:text-[#14553f] active:scale-95"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 border-t border-dashed border-[#dfe3d5] pt-4">
            <Slider label="Jumlah kandidat" min={1} max={10} value={n} onChange={setN} />
            <Slider
              label="Ambang CONTOH"
              min={50}
              max={95}
              value={threshold}
              onChange={setThreshold}
              hint="Jika skor kandidat CONTOH di bawah ambang, sistem memakai deskripsi KBLI_MASTER."
            />
          </div>

          <button
            onClick={() => setQuery(raw)}
            disabled={!raw.trim()}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#14553f] px-4 py-3 text-sm font-bold text-[#e9f2ea] shadow-[0_8px_20px_-8px_rgba(20,85,63,0.6)] transition-all hover:bg-[#1c6b54] active:scale-[0.98] disabled:opacity-40 disabled:shadow-none disabled:pointer-events-none"
          >
            <IconSearch size={15} />
            Klasifikasi Sekarang
          </button>
        </div>
      </Panel>

      {/* ------- hasil ------- */}
      <div className="space-y-4">
        {!result && (
          <Panel delay={90} className="p-10 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#e9ecdf] text-[#14553f]">
              <IconTarget size={26} />
            </div>
            <h3 className="font-display mt-4 text-xl font-bold text-[#152420]">
              Mesin hybrid siap
            </h3>
            <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-[#5c6b60]">
              Ketik kegiatan usaha seapa adanya — huruf besar, singkatan, atau salah ketik
              tidak masalah. Skor menggabungkan kemiripan kata (TF-IDF) dan kemiripan
              ejaan (fuzzy), lalu diagregasi per kode KBLI.
            </p>
            <div className="mx-auto mt-5 grid max-w-lg gap-2 text-left">
              {["CONTOH selalu menjadi referensi utama", "KBLI_MASTER menjadi fallback berbasis deskripsi", "Agregasi dukungan: contoh yang konsisten memperkuat kandidat"].map((t) => (
                <div key={t} className="flex items-center gap-2 rounded-md bg-[#f2f4ea] px-3 py-2 text-xs font-medium text-[#3c4b41]">
                  <span className="text-[#1c6b54]"><IconCheck size={13} /></span>
                  {t}
                </div>
              ))}
            </div>
          </Panel>
        )}

        {result && result.res.sumber === "TIDAK DITEMUKAN" && (
          <Panel delay={40} className="p-8 text-center">
            <p className="font-display text-lg font-bold text-[#152420]">Tidak ditemukan kandidat.</p>
            <p className="mt-1 text-sm text-[#5c6b60]">
              Coba frasa lain atau tambahkan referensi baru lewat tab Kelola Referensi.
            </p>
          </Panel>
        )}

        {result && top && (
          <>
            {/* kandidat utama */}
            <section
              className="reveal-panel relative overflow-hidden rounded-xl bg-[#10251e] p-6 text-[#e9f2ea] shadow-[0_18px_44px_-20px_rgba(16,37,30,0.65)]"
              style={{ animationDelay: "30ms" }}
            >
              <div className="pointer-events-none absolute inset-0 opacity-[0.35]" style={{ backgroundImage: "radial-gradient(rgba(233,242,234,0.14) 1px, transparent 1px)", backgroundSize: "18px 18px" }} />
              <div className="relative flex flex-wrap items-center gap-x-8 gap-y-5">
                <div>
                  <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#e8a317]">
                    Hasil teratas · {result.res.sumber}
                  </p>
                  <p className="font-mono mt-2 text-5xl font-bold tabular-nums tracking-tight text-[#f3ead2] sm:text-6xl">
                    {scrambleCode}
                  </p>
                  <h3 className="mt-2 max-w-md font-display text-lg font-bold leading-snug">
                    {top.judul}
                  </h3>
                </div>
                <div className="ml-auto w-full sm:w-64 space-y-2.5">
                  <div className="flex items-baseline justify-between">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-[#9db5a6]">Skor gabungan</span>
                    <span className="font-display text-3xl font-extrabold tabular-nums text-[#e8a317]">
                      {top.skor.toFixed(1)}
                    </span>
                  </div>
                  <div>
                    <div className="h-2 overflow-hidden rounded-full bg-[#24443a]">
                      <div className="h-full rounded-full bg-gradient-to-r from-[#1c6b54] to-[#e8a317] transition-[width] duration-700" style={{ width: `${Math.min(100, top.skor)}%` }} />
                    </div>
                    <div className="mt-1.5 flex justify-between font-mono text-[10px] text-[#9db5a6]">
                      <span>semantik {top.semantic.toFixed(1)}</span>
                      <span>fuzzy {top.fuzzy.toFixed(1)}</span>
                    </div>
                  </div>
                  <p className="flex items-center gap-1.5 pt-1 text-[11px] text-[#9db5a6]">
                    <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#4fae8b]" />
                    Selesai dalam {result.ms.toFixed(1)} ms
                  </p>
                </div>
              </div>
            </section>

            {/* daftar kandidat */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[#5c6b60]">
                  {result.res.candidates.length} kandidat ditemukan
                </h3>
                <SumberBadge sumber={result.res.sumber} />
              </div>
              {result.res.candidates.map((c, i) => (
                <CandidateCard key={`${c.kbli}-${i}`} c={c} top={i === 0} notify={notify} delay={60 + i * 55} />
              ))}
            </div>

            {result.res.sumber === "CONTOH" && result.res.altMaster.length > 0 && (
              <Panel delay={140}>
                <PanelHead
                  kicker="Pembanding"
                  title="Alternatif dari KBLI_MASTER"
                  right={
                    <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide text-[#8b9587]">
                      <IconBolt size={11} /> berbasis deskripsi resmi
                    </span>
                  }
                />
                <div className="divide-y divide-[#eef0e4]">
                  {result.res.altMaster.map((a) => (
                    <div key={a.kbli} className="flex items-center gap-3 px-5 py-2.5 text-sm transition-colors hover:bg-[#f6f8ef]">
                      <span className="font-mono font-bold text-[#8a5f06] tabular-nums">{a.kbli}</span>
                      <span className="min-w-0 flex-1 truncate text-[#3c4b41]">{a.judul}</span>
                      <span className="font-mono text-xs font-semibold tabular-nums text-[#152420]">{a.skor.toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              </Panel>
            )}
          </>
        )}
      </div>
    </div>
  );
}
