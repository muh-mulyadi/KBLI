import { useEffect, useRef, useState, type ReactNode } from "react";

/* ---------------- ikon inline SVG ---------------- */

type IconProps = { size?: number; className?: string };

function base(props: IconProps) {
  return {
    width: props.size ?? 16,
    height: props.size ?? 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: props.className,
    "aria-hidden": true,
  };
}

export const IconSearch = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);
export const IconUpload = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 16V4m0 0 4 4m-4-4-4 4" />
    <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
  </svg>
);
export const IconDownload = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 4v12m0 0 4-4m-4 4-4-4" />
    <path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" />
  </svg>
);
export const IconPlus = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const IconCheck = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m4 12.5 5 5L20 6.5" />
  </svg>
);
export const IconX = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);
export const IconDatabase = (p: IconProps) => (
  <svg {...base(p)}>
    <ellipse cx="12" cy="5.5" rx="7" ry="2.8" />
    <path d="M5 5.5v13c0 1.55 3.13 2.8 7 2.8s7-1.25 7-2.8v-13" />
    <path d="M5 12c0 1.55 3.13 2.8 7 2.8s7-1.25 7-2.8" />
  </svg>
);
export const IconLayers = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m12 3 9 5-9 5-9-5 9-5Z" />
    <path d="m3 13 9 5 9-5" />
  </svg>
);
export const IconFile = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7l-4-4Z" />
    <path d="M14 3v4h4" />
  </svg>
);
export const IconReset = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
    <path d="M3 3v5h5" />
  </svg>
);
export const IconChevron = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);
export const IconStop = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="6" y="6" width="12" height="12" rx="1.5" />
  </svg>
);
export const IconPlay = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M7 4.5v15l12-7.5L7 4.5Z" />
  </svg>
);
export const IconBolt = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
  </svg>
);
export const IconTarget = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="3.5" />
    <circle cx="12" cy="12" r="0.5" fill="currentColor" />
  </svg>
);
export const IconTrash = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m3 0-1 13H7L6 7" />
  </svg>
);

/* ---------------- skor & badge ---------------- */

export function ScoreBar({
  value,
  tone,
  label,
}: {
  value: number;
  tone: "pine" | "amber" | "ink";
  label: string;
}) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setW(Math.max(0, Math.min(100, value))));
    return () => cancelAnimationFrame(id);
  }, [value]);
  const colors: Record<string, string> = {
    pine: "bg-[#1c6b54]",
    amber: "bg-[#e8a317]",
    ink: "bg-[#152420]",
  };
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="text-[10px] font-mono uppercase tracking-wider text-[#5c6b60] w-16 shrink-0">
        {label}
      </span>
      <div className="h-1.5 flex-1 rounded-full bg-[#e3e6da] overflow-hidden">
        <div
          className={`h-full rounded-full ${colors[tone]}`}
          style={{
            width: `${w}%`,
            transition: "width 700ms cubic-bezier(.22,.9,.3,1)",
          }}
        />
      </div>
      <span className="text-[11px] font-mono font-semibold w-10 text-right tabular-nums text-[#152420]">
        {value.toFixed(1)}
      </span>
    </div>
  );
}

export function SumberBadge({ sumber }: { sumber: string }) {
  const isContoh = sumber === "CONTOH";
  const isKosong = sumber === "KOSONG" || sumber === "TIDAK DITEMUKAN";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wide ring-1 ring-inset ${
        isContoh
          ? "bg-[#e5f0e9] text-[#14553f] ring-[#bcd6c6]"
          : isKosong
            ? "bg-[#ecece4] text-[#6b7266] ring-[#d5d8c9]"
            : "bg-[#faf0d8] text-[#8a5f06] ring-[#e5cd92]"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${isContoh ? "bg-[#1c6b54]" : isKosong ? "bg-[#9aa193]" : "bg-[#e8a317]"}`}
      />
      {sumber}
    </span>
  );
}

export function KbliChip({ code, big }: { code: string; big?: boolean }) {
  return (
    <span
      className={`font-mono font-bold tabular-nums ${big ? "text-4xl sm:text-5xl" : "text-base"} ${
        big ? "text-[#f3ead2]" : "text-[#14553f]"
      }`}
    >
      {code}
    </span>
  );
}

/* ---------------- teks acak (decode) untuk kode teratas ---------------- */

export function useScramble(text: string): string {
  const [out, setOut] = useState(text);
  const prev = useRef(text);
  useEffect(() => {
    if (prev.current === text) return;
    prev.current = text;
    if (!text) {
      setOut("");
      return;
    }
    let frame = 0;
    const total = 14;
    const id = window.setInterval(() => {
      frame++;
      const settled = Math.floor((frame / total) * text.length);
      let s = "";
      for (let i = 0; i < text.length; i++) {
        s += i < settled ? text[i] : String(Math.floor(Math.random() * 10));
      }
      setOut(s);
      if (frame >= total) {
        setOut(text);
        window.clearInterval(id);
      }
    }, 34);
    return () => window.clearInterval(id);
  }, [text]);
  return out;
}

/* ---------------- toast ---------------- */

export interface ToastItem {
  id: number;
  kind: "success" | "error" | "info";
  msg: string;
}

let toastId = 0;

export function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const push = (kind: ToastItem["kind"], msg: string) => {
    const id = ++toastId;
    setToasts((t) => [...t, { id, kind, msg }]);
    window.setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 4200);
  };
  return { toasts, push, dismiss: (id: number) => setToasts((t) => t.filter((x) => x.id !== id)) };
}

export function ToastHost({
  toasts,
  dismiss,
}: {
  toasts: ToastItem[];
  dismiss: (id: number) => void;
}) {
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast-in flex items-start gap-2.5 rounded-lg px-3.5 py-2.5 shadow-lg ring-1 text-sm ${
            t.kind === "success"
              ? "bg-[#12352b] text-[#e9f2ea] ring-[#1c6b54]"
              : t.kind === "error"
                ? "bg-[#3d1411] text-[#f7e4de] ring-[#8a3a30]"
                : "bg-[#152420] text-[#e9ece2] ring-[#3a4a41]"
          }`}
        >
          <span className="mt-0.5 shrink-0">
            {t.kind === "success" ? <IconCheck size={14} /> : t.kind === "error" ? <IconX size={14} /> : <IconBolt size={14} />}
          </span>
          <span className="leading-snug">{t.msg}</span>
          <button
            onClick={() => dismiss(t.id)}
            className="ml-auto shrink-0 opacity-60 hover:opacity-100 transition-opacity"
            aria-label="Tutup notifikasi"
          >
            <IconX size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}

/* ---------------- kartu section ---------------- */

export function Panel({
  children,
  className,
  delay,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <section
      className={`reveal-panel rounded-xl border border-[#dfe3d5] bg-[#fbfcf7] shadow-[0_1px_0_rgba(21,36,32,0.04),0_12px_32px_-18px_rgba(21,36,32,0.25)] ${className ?? ""}`}
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </section>
  );
}

export function PanelHead({
  kicker,
  title,
  right,
}: {
  kicker: string;
  title: string;
  right?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[#e4e7da] px-5 py-4">
      <div>
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8a5f06]">
          {kicker}
        </p>
        <h2 className="font-display text-xl font-bold text-[#152420] leading-tight mt-0.5">{title}</h2>
      </div>
      {right}
    </header>
  );
}
