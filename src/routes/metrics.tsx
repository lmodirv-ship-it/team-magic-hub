import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { clearMetrics, useMetrics } from "@/lib/nawat/metrics";
import { useTableMouse } from "@/components/nawat/DataTable";

export const Route = createFileRoute("/metrics")({
  head: () => ({
    meta: [
      { title: "قياس السرعة — NAWAT Studio" },
      { name: "description", content: "أزمنة فتح الملفات والحفظ والبحث ورد النماذج مقاسة فعليًا." },
      { property: "og:title", content: "قياس السرعة — NAWAT Studio" },
      { property: "og:description", content: "أزمنة حقيقية: متوسط، p50، p95، الأسوأ." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MetricsPage,
});

const fmt = (n: number) => `${n.toFixed(1)} ms`;

function MetricsPage() {
  const rows = useMetrics();
  const tm = useTableMouse("metrics");
  return (
    <div dir="rtl" className="mx-auto w-full max-w-4xl overflow-auto p-6">
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-xl font-bold">قياس السرعة</h1>
        <span className="text-sm text-muted-foreground">أرقام هذه الجلسة فقط — استعمل المحرر ثم ارجع هنا</span>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={clearMetrics}>مسح</Button>
      </div>
      {rows.length === 0 ? (
        <p className="glass-panel rounded-lg p-6 text-center text-muted-foreground">لا توجد قياسات بعد. افتح ملفات واحفظ وابحث في صفحة مساحة العمل.</p>
      ) : (
        <table className="glass-panel w-full overflow-hidden rounded-lg text-sm">
          <thead className="bg-panel text-muted-foreground">
            <tr>
              {["العملية", "العدد", "المتوسط", "p50", "p95", "الأسوأ"].map((h, i) => (
                <th key={h} {...tm.thProps(i)} className={`px-3 py-2 text-start ${tm.thProps(i).className}`}>
                  {h}
                  {tm.sortMark(i)}
                  {i > 0 && tm.resizeHandle(i)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tm.sortRows(rows, (r, col) => (col === 0 ? r.name : col === 1 ? r.count : col === 2 ? r.avg : col === 3 ? r.p50 : col === 4 ? r.p95 : r.max)).map((r) => (
              <tr key={r.name} {...tm.trProps(r.name)} className={`border-t border-border ${tm.trProps(r.name).className}`}>
                <td className="px-3 py-2">{r.name}</td>
                <td className="px-3 py-2">{r.count}</td>
                <td className="px-3 py-2" dir="ltr">{fmt(r.avg)}</td>
                <td className="px-3 py-2" dir="ltr">{fmt(r.p50)}</td>
                <td className="px-3 py-2" dir="ltr">{fmt(r.p95)}</td>
                <td className="px-3 py-2" dir="ltr">{fmt(r.max)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
