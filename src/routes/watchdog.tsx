import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

export const Route = createFileRoute("/watchdog")({
  head: () => ({
    meta: [
      { title: "المراقبة الذاتية Watchdog | NAWAT" },
      { name: "description", content: "فحص دوري لخدمات السيرفر المحلي: Ollama والجسر والمصنع ومنافذ ComfyUI." },
      { property: "og:title", content: "المراقبة الذاتية Watchdog — NAWAT" },
      { property: "og:description", content: "تعرف فورًا على الخدمة المتوقفة وأمر إصلاحها." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  staticData: { sitemap: true },
  component: Watchdog,
});

const HOST_KEY = "nawat.watchdog.host";
const LOG_KEY = "nawat.watchdog.log";
const SERVICES = [
  { name: "Ollama", port: 11434, path: "/api/tags", fix: "sudo systemctl restart ollama" },
  { name: "الجسر", port: 8788, path: "/api/ping", fix: "nawat serve bridge" },
  { name: "المصنع", port: 8789, path: "/", fix: "nawat serve factory" },
  ...[8188, 8189, 8190, 8191, 8192].map((port) => ({ name: `ComfyUI ${port}`, port, path: "/", fix: "comfy-ctl restart" })),
];
type Res = { up: boolean; ms: number };

async function probe(url: string): Promise<Res> {
  const t0 = performance.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    await fetch(url, { mode: "no-cors", signal: ctrl.signal });
    return { up: true, ms: Math.round(performance.now() - t0) };
  } catch {
    return { up: false, ms: Math.round(performance.now() - t0) };
  } finally {
    clearTimeout(timer);
  }
}

function Watchdog() {
  const [host, setHost] = useState("192.168.100.67");
  const [res, setRes] = useState<Record<number, Res>>({});
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setHost(localStorage.getItem(HOST_KEY) || "192.168.100.67");
    setLog(JSON.parse(localStorage.getItem(LOG_KEY) || "[]"));
  }, []);

  const run = useCallback(async () => {
    setBusy(true);
    const out: Record<number, Res> = {};
    await Promise.all(SERVICES.map(async (s) => { out[s.port] = await probe(`http://${host}:${s.port}${s.path}`); }));
    setRes(out);
    const up = Object.values(out).filter((r) => r.up).length;
    setLog((l) => {
      const next = [`${new Date().toLocaleTimeString("ar")} — ${up}/${SERVICES.length} تعمل`, ...l].slice(0, 50);
      localStorage.setItem(LOG_KEY, JSON.stringify(next));
      return next;
    });
    setBusy(false);
  }, [host]);

  useEffect(() => {
    void run();
    const id = setInterval(() => void run(), 30_000);
    return () => clearInterval(id);
  }, [run]);

  return (
    <main dir="rtl" className="min-w-0 flex-1 overflow-auto p-6">
      <h1 className="text-xl font-semibold">🛡️ المراقبة الذاتية</h1>
      <p className="mb-4 text-sm text-muted-foreground">فحص تلقائي كل 30 ثانية لخدمات سيرفرك. الخدمات الاختيارية المتوقفة لا تمنع العمل.</p>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input value={host} onChange={(e) => { setHost(e.target.value); localStorage.setItem(HOST_KEY, e.target.value); }} className="w-56 rounded-md border border-border bg-background px-2 py-1 text-sm" dir="ltr" />
        <button onClick={() => void run()} disabled={busy} className="rounded-md bg-primary px-3 py-1 text-sm text-primary-foreground">{busy ? "⏳ يفحص…" : "🔄 افحص الآن"}</button>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">ملاحظة: على الموقع الآمن (https) قد يمنع المتصفح الفحص المباشر للشبكة المحلية — افتح النسخة المحلية أو تطبيق سطح المكتب لنتيجة دقيقة.</p>
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <table className="w-full rounded-lg border border-border bg-card text-sm">
          <thead><tr className="text-muted-foreground"><th className="p-2 text-right">الخدمة</th><th className="p-2 text-right">المنفذ</th><th className="p-2 text-right">الحالة</th><th className="p-2 text-right">الإصلاح</th></tr></thead>
          <tbody>
            {SERVICES.map((s) => {
              const r = res[s.port];
              return (
                <tr key={s.port} className="border-t border-border">
                  <td className="p-2">{s.name}</td>
                  <td className="p-2 font-mono" dir="ltr">{s.port}</td>
                  <td className="p-2">{!r ? "…" : r.up ? `🟢 ${r.ms}ms` : "⏸ متوقف"}</td>
                  <td className="p-2 font-mono text-xs" dir="ltr">{r && !r.up ? s.fix : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="rounded-lg border border-border bg-card p-3 text-xs">
          <h2 className="mb-2 text-sm font-medium">السجل</h2>
          {log.map((l, i) => <div key={i} className="border-t border-border py-1">{l}</div>)}
        </div>
      </div>
    </main>
  );
}
