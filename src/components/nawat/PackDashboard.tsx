import { useEffect, useState } from "react";
import { RefreshCw, RotateCcw, Package } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface PackInfo {
  name: string;
  title: string;
  port: number;
  health: string;
  startScript: string;
}

const PACKS: PackInfo[] = [
  { name: "core-pack", title: "النواة", port: 8790, health: "/health", startScript: "start-core.bat" },
  { name: "editor-pack", title: "المحرر", port: 5173, health: "/health", startScript: "start-editor.bat" },
  { name: "search-pack", title: "البحث والفهرسة", port: 8793, health: "/health", startScript: "start-search.bat" },
  { name: "safety-pack", title: "أمان البيانات", port: 8794, health: "/health", startScript: "start-safety.bat" },
  { name: "ai-pack", title: "السياق والذكاء", port: 8796, health: "/health", startScript: "start-ai.bat" },
  { name: "agent-pack", title: "الوكيل الذكي", port: 8790, health: "/agent/info", startScript: "start-agent.bat" },
  { name: "polish-pack", title: "التميّز", port: 8798, health: "/health", startScript: "start-polish.bat" },
];

const BRIDGE = "http://127.0.0.1:8787";

type PackState = { ok: boolean | null; metrics: Record<string, unknown> | null; ms: number | null };

async function probe(p: PackInfo): Promise<PackState> {
  const t0 = performance.now();
  try {
    const res = await fetch(`http://127.0.0.1:${p.port}${p.health}`, { signal: AbortSignal.timeout(3000) });
    const ms = Math.round(performance.now() - t0);
    let metrics: Record<string, unknown> | null = null;
    try {
      const m = await fetch(`http://127.0.0.1:${p.port}/metrics`, { signal: AbortSignal.timeout(2000) });
      if (m.ok) metrics = (await m.json()) as Record<string, unknown>;
    } catch { /* metrics اختيارية */ }
    return { ok: res.ok, metrics, ms };
  } catch {
    return { ok: false, metrics: null, ms: null };
  }
}

export function PackDashboard() {
  const [states, setStates] = useState<Record<string, PackState>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = async () => {
    const entries = await Promise.all(PACKS.map(async (p) => [p.name, await probe(p)] as const));
    setStates(Object.fromEntries(entries));
  };

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 10000);
    return () => clearInterval(id);
  }, []);

  const restart = async (p: PackInfo) => {
    if (!window.confirm(`إعادة تشغيل ${p.name} عبر الجسر؟`)) return;
    setBusy(p.name);
    try {
      const res = await fetch(`${BRIDGE}/api/ssh/exec`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host: "local", cmd: `forge\\packs\\${p.name}\\${p.startScript}` }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success(`أُرسل أمر التشغيل إلى ${p.name}`);
      setTimeout(() => void refresh(), 4000);
    } catch (e) {
      toast.error(`تعذّر الوصول للجسر 8787: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  const up = Object.values(states).filter((s) => s.ok).length;

  return (
    <div dir="rtl" className="mx-auto max-w-4xl space-y-4 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-foreground">
            <Package className="size-5 text-nawat" /> لوحة مراقبة Packs
          </h1>
          <p className="text-xs text-muted-foreground">
            {up ? `${up} من ${PACKS.length} يعمل` : "كل الـ Packs متوقفة — شغّل start-all.bat على جهازك"}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => void refresh()}>
          <RefreshCw className="size-4" /> تحديث
        </Button>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PACKS.map((p) => {
          const s = states[p.name];
          const ok = s?.ok;
          return (
            <div key={p.name} className="space-y-2 rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-foreground">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{p.title} · :{p.port}</div>
                </div>
                <span
                  className={`size-3 rounded-full ${ok == null ? "bg-muted" : ok ? "bg-success" : "bg-destructive"}`}
                  title={ok == null ? "جارٍ الفحص…" : ok ? "يعمل" : "متوقف"}
                />
              </div>
              {s?.ms != null && <div className="text-xs text-muted-foreground">الاستجابة: {s.ms}ms</div>}
              {s?.metrics && (
                <pre dir="ltr" className="max-h-24 overflow-auto rounded bg-muted/50 p-2 text-[10px] text-muted-foreground">
                  {JSON.stringify(s.metrics, null, 1)}
                </pre>
              )}
              <Button size="sm" variant="ghost" className="w-full" disabled={busy === p.name} onClick={() => void restart(p)}>
                <RotateCcw className="size-3.5" /> {busy === p.name ? "جارٍ الإرسال…" : "إعادة تشغيل عبر الجسر"}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
