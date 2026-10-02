import { useState } from "react";
import { Button } from "@/components/ui/button";
import { callConfiguredBridge } from "@/lib/nawat/bridge-config";

type Sys = {
  version?: string; disks?: { mount: string; size: number; used: number; avail: number }[];
  memory?: { total: number; used: number }; pm2?: { name: string; status: string }[];
  smart?: boolean; rebootRequired?: boolean; comfy?: boolean; ollama?: boolean; ollamaUrl?: string;
  modelDir?: string; modelBytes?: number; linkMbps?: number;
};

const GiB = 1024 ** 3;
/** أرقام آخر فحص يدوي للسيرفر 192.168.100.67 — تُعرض عند تعذّر الوصول للجسر. */
const REPORT: Sys = {
  version: "1.1.0",
  disks: [
    { mount: "/ (SSD 128GB)", size: 111 * GiB, used: 25 * GiB, avail: 86 * GiB },
    { mount: "/data (HDD 500GB)", size: 435 * GiB, used: 13 * GiB, avail: 422 * GiB },
  ],
  memory: { total: 18 * GiB, used: 2.2 * GiB },
  pm2: [{ name: "nawat", status: "online" }, { name: "bridge", status: "online" }, { name: "cloud-agent", status: "online" }],
  smart: false, rebootRequired: true, comfy: false, ollama: true, ollamaUrl: "http://192.168.2.4:11434",
  modelDir: "/data/model", modelBytes: 46.1 * 1e9, linkMbps: 100,
};
const MODEL_TOTAL = 91 * GiB;
const g = (b = 0) => `${(b / GiB).toFixed(1)} GiB`;

export function ServerStatusCard() {
  const [sys, setSys] = useState<Sys>(REPORT);
  const [live, setLive] = useState(false);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setBusy(true);
    try { setSys((await callConfiguredBridge("system")) as Sys); setLive(true); }
    catch { setSys(REPORT); setLive(false); }
    setBusy(false);
  }

  const pct = Math.min(100, Math.round(((sys.modelBytes ?? 0) / MODEL_TOTAL) * 100));
  return (
    <section className="space-y-2 rounded-lg border border-border p-3 text-xs" dir="rtl">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold">حالة السيرفر 192.168.100.67</h3>
        <span className={`rounded px-1.5 ${live ? "bg-primary/15" : "bg-muted"}`}>{live ? "مباشر" : "من آخر فحص"}</span>
        <Button size="sm" variant="outline" className="ms-auto h-7 text-xs" onClick={refresh} disabled={busy}>{busy ? "…" : "تحديث"}</Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>نواة: <b>{sys.version}</b> · الذاكرة {g(sys.memory?.used)} / {g(sys.memory?.total)}</div>
        <div>PM2: {sys.pm2?.map((p) => `${p.name} (${p.status})`).join("، ") || "—"}</div>
        {sys.disks?.map((d) => (
          <div key={d.mount}>
            <div className="flex justify-between"><span dir="ltr">{d.mount}</span><span>متاح {g(d.avail)}</span></div>
            <div className="h-1.5 rounded bg-muted"><div className="h-full rounded bg-primary" style={{ width: `${(d.used / d.size) * 100}%` }} /></div>
          </div>
        ))}
        <div>Ollama: {sys.ollama ? "يعمل" : "متوقف"} <span dir="ltr" className="font-mono">{sys.ollamaUrl}</span></div>
        <div>ComfyUI: {sys.comfy ? "يعمل" : <span className="text-destructive">غير متاح — توليد الصور متعطل</span>}</div>
      </div>
      <div>
        <div className="flex justify-between"><span>نقل الموديلات إلى <span dir="ltr">{sys.modelDir}</span></span><span>{g(sys.modelBytes)} / 91 GiB ({pct}%)</span></div>
        <div className="h-1.5 rounded bg-muted"><div className="h-full rounded bg-primary" style={{ width: `${pct}%` }} /></div>
        {(sys.linkMbps ?? 0) > 0 && (sys.linkMbps ?? 0) < 1000 && (
          <p className="mt-1 text-muted-foreground">سرعة الشبكة {sys.linkMbps} Mbps — المنفذ المقابل في السويتش محدود. انقل الكابل إلى منفذ Gigabit لرفع السرعة إلى نحو 110 MB/s.</p>
        )}
      </div>
      {sys.rebootRequired && <p className="text-destructive">النظام يطلب إعادة تشغيل — جدولها في وقت هادئ.</p>}
      {!sys.smart && <p className="text-muted-foreground">أداة SMART غير مثبتة: <code dir="ltr">sudo apt install smartmontools</code></p>}
    </section>
  );
}
