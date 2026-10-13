import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, TrendingDown, TrendingUp } from "lucide-react";
import { RoundsChart } from "@/components/nawat/RoundsChart";
import { useModels } from "@/lib/nawat/useModels";
import { formatBytes } from "@/lib/nawat/bridge";
import {
  CATEGORIES,
  categoryOf,
  familyOf,
  getRuns,
  growth,
  statsFor,
  versionRank,
  type ModelCategory,
  type TestRun,
} from "@/lib/nawat/model-catalog";

export const Route = createFileRoute("/model-results")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "نتائج النماذج وتطورها — NAWAT Studio" },
      { name: "description", content: "تصنيف نماذج nawat ومقارنة سرعتها وجودتها ونسبة نموها بين الإصدارات." },
      { property: "og:title", content: "نتائج النماذج وتطورها — NAWAT Studio" },
      { property: "og:description", content: "برمجة، تفكير، طرفية، وكلاء، مصغّرة — نسبة النمو لكل نموذج." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResultsPage,
});

function Growth({ v }: { v: number | null }) {
  if (v === null) return <span className="text-muted-foreground">—</span>;
  const up = v >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 ${up ? "text-success" : "text-destructive"}`}>
      {up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
      {v.toFixed(0)}%
    </span>
  );
}

function ResultsPage() {
  const { models } = useModels();
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [cat, setCat] = useState<ModelCategory | "all">("all");
  useEffect(() => setRuns(getRuns()), []);

  const families = useMemo(() => {
    const map = new Map<string, typeof models>();
    for (const m of models) {
      if (cat !== "all" && categoryOf(m.name) !== cat) continue;
      const f = familyOf(m.name);
      map.set(f, [...(map.get(f) ?? []), m]);
    }
    return [...map.entries()].map(([f, ms]) => [f, [...ms].sort((a, b) => versionRank(a.name) - versionRank(b.name))] as const);
  }, [models, cat]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: models.length };
    for (const m of models) c[categoryOf(m.name)] = (c[categoryOf(m.name)] ?? 0) + 1;
    return c;
  }, [models]);

  return (
    <main className="min-w-0 flex-1 overflow-auto p-6">
      <header className="mb-4 flex items-center gap-3">
        <Link to="/tasks" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowRight className="size-3.5" /> المهام
        </Link>
        <h1 className="text-xl font-semibold">النتائج — تطور ومقارنة النماذج</h1>
      </header>
      <p className="mb-4 text-sm text-muted-foreground">
        كل اختبار في صفحة المهام يُسجَّل هنا تلقائيًا ({runs.length} اختبار). النمو يُحسب بين كل إصدار والذي قبله في نفس العائلة.
      </p>

      <RoundsChart runs={runs} />

      <div className="mb-5 flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setCat(c.id)}
            className={`rounded-md px-3 py-1.5 text-xs ${cat === c.id ? "bg-nawat text-nawat-foreground" : "border border-border hover:bg-accent"}`}
          >
            {c.label} ({counts[c.id] ?? 0})
          </button>
        ))}
      </div>

      <div className="space-y-5">
        {families.map(([family, ms]) => (
          <section key={family} className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-3 font-mono text-sm font-semibold">
              {family} <span className="text-xs font-normal text-muted-foreground">— {ms.length} إصدار</span>
            </h2>
            <div className="overflow-auto">
              <table className="w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr className="text-start">
                    <th className="p-1 text-start">الإصدار</th>
                    <th className="p-1 text-start">الحجم</th>
                    <th className="p-1 text-start">اختبارات</th>
                    <th className="p-1 text-start">السرعة (حرف/ث)</th>
                    <th className="p-1 text-start">نمو السرعة</th>
                    <th className="p-1 text-start">الجودة ★</th>
                    <th className="p-1 text-start">نمو الجودة</th>
                    <th className="p-1 text-start">النجاح</th>
                  </tr>
                </thead>
                <tbody>
                  {ms.map((m, i) => {
                    const s = statsFor(runs, m.name);
                    const p = i > 0 ? statsFor(runs, ms[i - 1]!.name) : null;
                    const maxTps = Math.max(1, ...ms.map((x) => statsFor(runs, x.name).avgTps));
                    return (
                      <tr key={m.name} className="border-t border-border">
                        <td className="p-1 font-mono">{m.name}</td>
                        <td className="p-1">{formatBytes(m.size)}</td>
                        <td className="p-1">{s.runs}</td>
                        <td className="p-1">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-20 rounded bg-muted">
                              <div className="h-1.5 rounded bg-nawat" style={{ width: `${(s.avgTps / maxTps) * 100}%` }} />
                            </div>
                            {s.runs ? s.avgTps.toFixed(0) : "—"}
                          </div>
                        </td>
                        <td className="p-1"><Growth v={p && s.runs ? growth(p.avgTps, s.avgTps) : null} /></td>
                        <td className="p-1">{s.avgScore?.toFixed(1) ?? "—"}</td>
                        <td className="p-1">
                          <Growth v={p?.avgScore && s.avgScore ? growth(p.avgScore, s.avgScore) : null} />
                        </td>
                        <td className="p-1">{s.runs ? `${(s.okRate * 100).toFixed(0)}%` : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))}
        {families.length === 0 && <p className="text-sm text-muted-foreground">لا توجد نماذج في هذا التصنيف.</p>}
      </div>
    </main>
  );
}
