import { useEffect, useRef, useState } from "react";
import { Minus, Plus, X } from "lucide-react";
import { useWorkspace } from "@/lib/nawat/workspace";
import { extractCode, useModelStream } from "./LiveCodeStream";

const GLOWS = {
  cyan: "oklch(0.8 0.15 200)",
  blue: "oklch(0.65 0.2 255)",
  violet: "oklch(0.62 0.24 300)",
  pink: "oklch(0.7 0.22 350)",
} as const;
type Glow = keyof typeof GLOWS;
const KEY = "nawat.floatbox.v1";
type Prefs = { glass: boolean; size: number; glow: Glow; x: number; y: number };
const DEF: Prefs = { glass: true, size: 13, glow: "violet", x: 80, y: 90 };

export function FloatingCodeBox({ onClose }: { onClose: () => void }) {
  const { vfs, active } = useWorkspace() as unknown as { vfs: Record<string, unknown>; active: string | null };
  const [stream] = useModelStream();
  const [p, setP] = useState<Prefs>(DEF);
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setP({ ...DEF, ...(JSON.parse(raw) as Partial<Prefs>) });
    } catch { /* ignore */ }
  }, []);
  const save = (n: Partial<Prefs>) =>
    setP((o) => {
      const v = { ...o, ...n };
      try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* ignore */ }
      return v;
    });

  const fileEntry = active ? vfs[active] : undefined;
  const fileText =
    typeof fileEntry === "string"
      ? fileEntry
      : fileEntry && typeof (fileEntry as { content?: unknown }).content === "string"
        ? ((fileEntry as { content: string }).content)
        : "";
  const live = stream && !stream.done ? extractCode(stream.text) : "";
  const text = live || fileText;
  const color = GLOWS[p.glow];

  return (
    <div
      className={`fixed z-50 flex w-[min(560px,90vw)] flex-col overflow-hidden rounded-xl border ${p.glass ? "bg-background/40 backdrop-blur-xl" : "bg-background"}`}
      style={{ left: p.x, top: p.y, height: 360, borderColor: color, boxShadow: `0 0 24px ${color}, inset 0 0 12px ${color}33` }}
      onPointerMove={(e) => drag.current && save({ x: e.clientX - drag.current.dx, y: e.clientY - drag.current.dy })}
      onPointerUp={() => (drag.current = null)}
    >
      <div
        className="flex cursor-move select-none items-center gap-2 border-b border-border/50 px-2 py-1.5 text-xs"
        onPointerDown={(e) => {
          (e.currentTarget.parentElement as HTMLElement).setPointerCapture(e.pointerId);
          drag.current = { dx: e.clientX - p.x, dy: e.clientY - p.y };
        }}
      >
        <span className="font-semibold">الكود أثناء الكتابة</span>
        {live && <span className="size-1.5 animate-pulse rounded-full" style={{ background: color }} />}
        <div className="ms-auto flex items-center gap-1" onPointerDown={(e) => e.stopPropagation()}>
          <button className={`rounded px-1.5 py-0.5 ${p.glass ? "bg-accent" : ""}`} onClick={() => save({ glass: !p.glass })}>شفاف</button>
          <button aria-label="تصغير الخط" onClick={() => save({ size: Math.max(9, p.size - 1) })}><Minus className="size-3" /></button>
          <button aria-label="الحجم الافتراضي" className="px-1" onClick={() => save({ size: 13 })}>1</button>
          <button aria-label="تكبير الخط" onClick={() => save({ size: Math.min(24, p.size + 1) })}><Plus className="size-3" /></button>
          {(Object.keys(GLOWS) as Glow[]).map((g) => (
            <button
              key={g}
              aria-label={`لون ${g}`}
              className={`size-3.5 rounded-full ${p.glow === g ? "ring-2 ring-foreground" : ""}`}
              style={{ background: GLOWS[g] }}
              onClick={() => save({ glow: g })}
            />
          ))}
          <button aria-label="إغلاق" onClick={onClose}><X className="size-3.5" /></button>
        </div>
      </div>
      <pre dir="ltr" className="min-h-0 flex-1 overflow-auto whitespace-pre p-3 text-start font-mono" style={{ fontSize: p.size }}>
        {text || <span className="text-muted-foreground">افتح ملفاً من المستكشف للبدء</span>}
      </pre>
      {active && !live && <div dir="ltr" className="border-t border-border/50 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">{active}</div>}
    </div>
  );
}
