import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Page, Panel } from "@/components/nawat/StudioUI";
import { Button } from "@/components/ui/button";
import { FEATURES } from "@/lib/nawat/features-ledger";

export const Route = createFileRoute("/ledger")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "سجل الميزات — NAWAT Studio" },
      { name: "description", content: "السجل الدائم لكل ميزات NAWAT Studio برقمها وتاريخها — أضف ولا تحذف." },
      { property: "og:title", content: "سجل الميزات — NAWAT Studio" },
      { property: "og:description", content: "كل ميزة مسجلة برقم حتى لا تُحذف." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LedgerPage,
});

const GOAL = 600;

function LedgerPage() {
  const [q, setQ] = useState("");
  const [area, setArea] = useState("");
  const areas = useMemo(() => [...new Set(FEATURES.map((f) => f.area))], []);
  const list = FEATURES.filter((f) => (!area || f.area === area) && (!q || f.title.includes(q)));
  const pct = Math.min(100, (FEATURES.length / GOAL) * 100);
  const exportJson = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(FEATURES, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url; a.download = "nawat-features.json"; a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <Page eyebrow="أضف ولا تحذف" title="سجل الميزات" description="كل ميزة تُبنى تُسجَّل هنا برقم دائم. أنت تبني برنامجًا قويًا خطوة بخطوة 💪">
      <div className="grid gap-4">
        <Panel title="التقدم" note={`${FEATURES.length} / ${GOAL}`}>
          <div className="h-3 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${pct}%` }} /></div>
        </Panel>
        <div className="flex flex-wrap gap-2">
          <input className="control" placeholder="بحث..." value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="control" value={area} onChange={(e) => setArea(e.target.value)}>
            <option value="">كل المحاور</option>
            {areas.map((a) => <option key={a}>{a}</option>)}
          </select>
          <Button variant="outline" size="sm" onClick={exportJson}><Download />تصدير JSON</Button>
        </div>
        <ul className="grid gap-2">
          {list.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-2 rounded border border-border p-2 text-sm">
              <span><code className="text-primary">#{String(f.id).padStart(3, "0")}</code> {f.title}</span>
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                {f.area} · {f.date}
                {f.route && <a href={f.route} className="underline">فتح</a>}
              </span>
            </li>
          ))}
        </ul>
        <Link to="/settings" className="text-xs underline">العودة للإعدادات</Link>
      </div>
    </Page>
  );
}
