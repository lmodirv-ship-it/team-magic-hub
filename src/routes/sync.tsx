import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Download, GitMerge, RefreshCw, Upload } from "lucide-react";
import { toast } from "sonner";
import { Page, Panel } from "@/components/nawat/StudioUI";
import { Button } from "@/components/ui/button";
import { callConfiguredBridge } from "@/lib/nawat/bridge-config";

export const Route = createFileRoute("/sync")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "المزامنة ودمج الإضافات — NAWAT Studio" },
      { name: "description", content: "مزامنة هذه النسخة مع نسخ السيرفر ومحرك يدمج الإضافات دون حذف أي شيء." },
      { property: "og:title", content: "المزامنة ودمج الإضافات — NAWAT Studio" },
      { property: "og:description", content: "نسخ متزامنة ودمج إضافي آمن." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SyncPage,
});

type Ver = { url?: string; ok?: boolean; local?: string; remote?: string; behind?: number; error?: string; latest?: string };
const SECRET = /token|secret|password|relayToken/i;

/** محرك الدمج: يضيف ولا يحذف. المصفوفات تُدمج بالمعرّف، والكائنات بعمق، والقيم الموجودة تبقى. */
export function mergeAdd(a: unknown, b: unknown): unknown {
  if (a === undefined || a === null) return b;
  if (Array.isArray(a) && Array.isArray(b)) {
    const key = (x: unknown) => (x && typeof x === "object" ? String((x as Record<string, unknown>).id ?? (x as Record<string, unknown>).name ?? JSON.stringify(x)) : JSON.stringify(x));
    const out = [...a];
    for (const x of b) { const i = out.findIndex((y) => key(y) === key(x)); if (i < 0) out.push(x); else out[i] = mergeAdd(out[i], x); }
    return out;
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const out = { ...(a as Record<string, unknown>) };
    for (const [k, v] of Object.entries(b as Record<string, unknown>)) out[k] = mergeAdd(out[k], v);
    return out;
  }
  return a;
}

function bundle() {
  const data: Record<string, unknown> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)!;
    if (!k.startsWith("nawat") || SECRET.test(k)) continue;
    const v = localStorage.getItem(k)!;
    try { data[k] = JSON.parse(v); } catch { data[k] = v; }
  }
  return { nawatBundle: 1, at: new Date().toISOString(), origin: location.origin, data };
}

function SyncPage() {
  const [vers, setVers] = useState<{ self?: Ver; peers?: Ver[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<string[]>([]);

  const syncCall = async (action: "status" | "update") => {
    setBusy(true);
    try { setVers((await callConfiguredBridge("sync", { action })) as { self: Ver; peers: Ver[] }); if (action === "update") toast.success("بدأ تحديث كل النسخ"); }
    catch (e) { toast.error(`السيرفر غير متاح: ${(e as Error).message}`); }
    setBusy(false);
  };

  const importBundle = async (text: string) => {
    try {
      const b = JSON.parse(text) as { nawatBundle?: number; data?: Record<string, unknown> };
      if (!b.nawatBundle || !b.data) throw new Error("ملف غير صالح");
      const lines: string[] = [];
      for (const [k, v] of Object.entries(b.data)) {
        if (SECRET.test(k)) continue;
        const cur = localStorage.getItem(k);
        let parsed: unknown; try { parsed = cur === null ? undefined : JSON.parse(cur); } catch { parsed = cur; }
        const merged = mergeAdd(parsed, v);
        localStorage.setItem(k, typeof merged === "string" ? merged : JSON.stringify(merged));
        lines.push(`${cur === null ? "+ أُضيف" : "≈ دُمج"} ${k}`);
      }
      setReport(lines);
      window.dispatchEvent(new Event("storage"));
      toast.success(`دُمجت ${lines.length} إضافة — لم يُحذف شيء`);
    } catch (e) { toast.error((e as Error).message); }
  };

  const Row = ({ v, label }: { v: Ver; label: string }) => (
    <tr className="border-t border-border">
      <td className="px-2 py-1">{label}</td>
      <td className="px-2 py-1 font-mono" dir="ltr">{v.url ?? "—"}</td>
      <td className="px-2 py-1 font-mono" dir="ltr">{v.local ?? "—"}</td>
      <td className="px-2 py-1">{v.error ? <span className="text-destructive">{v.error}</span> : v.behind ? `متأخرة ${v.behind}` : "محدّثة"}</td>
    </tr>
  );

  return (
    <Page eyebrow="Sync / Merge Engine" title="المزامنة ودمج الإضافات" description="اجعل كل نسخ نواة على السيرفر متطابقة، وادمج الإضافات بين النسخ دون حذف أي شيء.">
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="نسخ السيرفر" note="تُضبط النسخ الأخرى في SYNC_PEERS على السيرفر">
          <div className="flex gap-2">
            <Button variant="outline" disabled={busy} onClick={() => void syncCall("status")}><RefreshCw />فحص النسخ</Button>
            <Button disabled={busy} onClick={() => void syncCall("update")}><GitMerge />مزامنة الكل الآن</Button>
          </div>
          {vers && (
            <table className="mt-3 w-full text-xs">
              <thead className="text-muted-foreground"><tr><th className="px-2 text-start">النسخة</th><th className="px-2 text-start">العنوان</th><th className="px-2 text-start">الإصدار</th><th className="px-2 text-start">الحالة</th></tr></thead>
              <tbody>
                {vers.self && <Row v={vers.self} label="هذه النسخة" />}
                {(vers.peers ?? []).map((p) => <Row key={p.url} v={p} label="نسخة أخرى" />)}
              </tbody>
            </table>
          )}
        </Panel>
        <Panel title="محرك دمج الإضافات" note="أضف ولا تحذف — كلمات السر لا تُصدَّر">
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => {
              const blob = new Blob([JSON.stringify(bundle(), null, 2)], { type: "application/json" });
              const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `nawat-extensions-${Date.now()}.json`; a.click();
            }}><Download />تصدير إضافات هذه النسخة</Button>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 text-sm"><Upload className="size-4" />دمج ملف من نسخة أخرى
              <input type="file" accept=".json" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) await importBundle(await f.text()); }} />
            </label>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">يدمج الموصلات والمنافذ وسير عمل الصور والإعدادات: الجديد يُضاف، والموجود يبقى كما هو.</p>
          {report.length > 0 && <pre className="mt-2 max-h-48 overflow-auto rounded bg-muted p-2 text-[11px]">{report.join("\n")}</pre>}
        </Panel>
      </div>
    </Page>
  );
}
