import { useEffect, useState } from "react";
import { BatchClassify } from "./components/BatchClassify";
import { ReferenceManager } from "./components/ReferenceManager";
import { SingleSearch } from "./components/SingleSearch";
import {
  IconBolt,
  IconDatabase,
  IconLayers,
  IconSearch,
  ToastHost,
  useToasts,
} from "./components/ui";
import { useReferenceStore } from "./store/useReferenceStore";

type TabId = "single" | "batch" | "ref";

const TABS: { id: TabId; num: string; label: string; Icon: (p: { size?: number }) => JSX.Element }[] = [
  { id: "single", num: "01", label: "Pencarian Tunggal", Icon: IconSearch },
  { id: "batch", num: "02", label: "Klasifikasi Massal", Icon: IconLayers },
  { id: "ref", num: "03", label: "Kelola Referensi", Icon: IconDatabase },
];

export default function App() {
  const [tab, setTab] = useState<TabId>("single");
  const { toasts, push, dismiss } = useToasts();
  const contoh = useReferenceStore((s) => s.contoh);
  const master = useReferenceStore((s) => s.master);
  const storageWarning = useReferenceStore((s) => s.storageWarning);
  const clearStorageWarning = useReferenceStore((s) => s.clearStorageWarning);

  useEffect(() => {
    if (storageWarning) {
      push("info", "Penyimpanan browser penuh — referensi berlaku untuk sesi ini saja.");
      clearStorageWarning();
    }
  }, [storageWarning, push, clearStorageWarning]);

  return (
    <div className="relative min-h-screen overflow-x-clip">
      {/* lapisan ambient */}
      <div className="bg-dots pointer-events-none fixed inset-0 -z-10" aria-hidden />
      <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden>
        <div className="absolute -top-40 right-[-10%] h-[480px] w-[480px] rounded-full bg-[#1c6b54] opacity-[0.07] blur-[110px]" />
        <div className="absolute top-[38%] left-[-12%] h-[420px] w-[420px] rounded-full bg-[#e8a317] opacity-[0.08] blur-[110px]" />
      </div>

      {/* strip utilitas */}
      <div className="bg-[#0d1f19] text-[#9db5a6]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] sm:px-6">
          <span>Utilitas Klasifikasi Lapangan Usaha</span>
          <span className="hidden items-center gap-1.5 sm:inline-flex">
            <i className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#4fae8b]" />
            mesin hybrid aktif
          </span>
        </div>
      </div>

      {/* kepala */}
      <header className="relative overflow-hidden bg-[#10251e] text-[#e9f2ea]">
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage: "radial-gradient(rgba(233,242,234,0.13) 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        />
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full border-[22px] border-[#1c6b54] opacity-25" />
        <div className="relative mx-auto max-w-6xl px-4 pb-10 pt-9 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-2xl">
              <p className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.24em] text-[#e8a317]">
                <IconBolt size={12} />
                Exact · Fuzzy · TF-IDF Semantik · Agregasi KBLI
              </p>
              <h1 className="font-display mt-3 text-4xl font-extrabold leading-[1.02] tracking-tight sm:text-6xl">
                Pencari <span className="text-[#e8a317]">KBLI</span>
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#9db5a6] sm:text-base">
                Versi web dari mesin hybrid V5 — berjalan penuh di browser, tanpa server.
                CONTOH menjadi referensi utama, deskripsi KBLI_MASTER menjadi fallback,
                dan seluruh referensi tersimpan di perangkat Anda.
              </p>
            </div>

            {/* stempel + statistik */}
            <div className="flex items-center gap-5">
              <div className="hidden rotate-[-6deg] rounded-lg border-2 border-dashed border-[#e8a317] px-3.5 py-2 text-center md:block">
                <p className="font-display text-lg font-extrabold leading-none text-[#e8a317]">KBLI</p>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-[#9db5a6]">2020 · 5 digit</p>
              </div>
              <dl className="grid grid-cols-2 gap-4 text-right">
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-widest text-[#9db5a6]">CONTOH</dt>
                  <dd className="font-display text-3xl font-extrabold tabular-nums text-[#f3ead2]">
                    {contoh.length.toLocaleString("id-ID")}
                  </dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-widest text-[#9db5a6]">MASTER</dt>
                  <dd className="font-display text-3xl font-extrabold tabular-nums text-[#f3ead2]">
                    {master.length.toLocaleString("id-ID")}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </header>

      {/* bilah tab lengket */}
      <nav className="sticky top-0 z-40 border-b border-[#dfe3d5] bg-[#f1f2ec]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 sm:px-6">
          {TABS.map(({ id, num, label, Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`relative flex shrink-0 items-center gap-2 px-4 py-3.5 text-sm font-bold transition-colors ${
                tab === id ? "text-[#14553f]" : "text-[#5c6b60] hover:text-[#152420]"
              }`}
            >
              <span
                className={`font-mono text-[10px] font-bold ${tab === id ? "text-[#8a5f06]" : "text-[#9aa193]"}`}
              >
                {num}
              </span>
              <Icon size={15} />
              {label}
              <span
                className={`absolute inset-x-3 bottom-0 h-[3px] rounded-t-full bg-[#14553f] transition-all duration-300 ${
                  tab === id ? "opacity-100 scale-x-100" : "opacity-0 scale-x-50"
                }`}
              />
            </button>
          ))}
        </div>
      </nav>

      {/* konten */}
      <main className="mx-auto max-w-6xl px-4 py-7 sm:px-6">
        <div key={tab}>
          {tab === "single" && <SingleSearch notify={push} />}
          {tab === "batch" && <BatchClassify notify={push} />}
          {tab === "ref" && <ReferenceManager notify={push} />}
        </div>
      </main>

      <footer className="border-t border-[#dfe3d5] bg-[#e9ecdf]/60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-5 sm:px-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#8b9587]">
            Pencari KBLI · edisi web · two-stage retrieval
          </p>
          <p className="text-xs text-[#5c6b60]">
            Skor = 0.55 × TF-IDF (word + char n-gram) + 0.45 × fuzzy · agregasi 0.70 × terbaik + 0.30 × dukungan
          </p>
        </div>
      </footer>

      <ToastHost toasts={toasts} dismiss={dismiss} />
    </div>
  );
}
