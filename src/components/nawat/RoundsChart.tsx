import { useMemo, useState } from "react";
import type { TestRun } from "@/lib/nawat/model-catalog";

type Metric = "score" | "out" | "in" | "ok";
const METRICS: { id: Metric; label: string }[] = [
  { id: "score", label: "Note ★" },
  { id: "out", label: "Vitesse sortie (car/s)" },
  { id: "in", label: "Vitesse entrée (car/s)" },
  { id: "ok", label: "Réussite %" },
];

function value(r: TestRun, m: Metric): number | null {
  if (m === "score") return r.score ?? null;
  if (m === "out") return r.tps || null;
  if (m === "in") return r.inTps ?? null;
  return r.ok ? 100 : 0;
}

/** One line per model across saved rounds; only real recorded runs, gaps when a value is missing. */
export function RoundsChart({ runs }: { runs: TestRun[] }) {
  const [metric, setMetric] = useState<Metric>("out");
  const { rounds, series, max } = useMemo(() => {
    const byRound = new Map<string, TestRun[]>();
    for (const r of [...runs].reverse()) {
      const k = r.round ?? r.at.slice(0, 16);
      byRound.set(k, [...(byRound.get(k) ?? []), r]);
    }
    const rounds = [...byRound.keys()].slice(-20);
    const models = [...new Set(rounds.flatMap((k) => byRound.get(k)!.map((r) => r.model)))].slice(0, 8);
    const series = models.map((model) => ({
      model,
      pts: rounds.map((k) => { const r = byRound.get(k)!.find((x) => x.model === model); return r ? value(r, metric) : null; }),
    }));
    const max = Math.max(1, ...series.flatMap((s) => s.pts.filter((v): v is number => v !== null)));
    return { rounds, series, max };
  }, [runs, metric]);

  const W = 640, H = 200, P = 24;
  const x = (i: number) => P + (rounds.length > 1 ? (i * (W - 2 * P)) / (rounds.length - 1) : (W - 2 * P) / 2);
  const y = (v: number) => H - P - (v / max) * (H - 2 * P);
  const colors = ["var(--color-nawat, currentColor)", "var(--color-primary)", "var(--color-destructive)", "var(--color-success, currentColor)", "var(--color-accent-foreground)", "var(--color-muted-foreground)", "var(--color-chart-1, currentColor)", "var(--color-chart-2, currentColor)"];

  return (
    <section className="mb-5 rounded-lg border border-border bg-card p-4">
      <header className="mb-2 flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold">Rounds — évolution</h2>
        <span className="text-[11px] text-muted-foreground">{rounds.length} rounds</span>
        <div className="flex-1" />
        {METRICS.map((m) => (
          <button key={m.id} onClick={() => setMetric(m.id)} className={`rounded px-2 py-0.5 text-[11px] ${metric === m.id ? "bg-nawat text-nawat-foreground" : "border border-border text-muted-foreground"}`}>{m.label}</button>
        ))}
      </header>
      {rounds.length === 0 ? (
        <p className="text-xs text-muted-foreground">Aucun round enregistré — lancez une tâche dans /tasks.</p>
      ) : (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} className="h-52 w-full">
            <line x1={P} y1={H - P} x2={W - P} y2={H - P} stroke="currentColor" opacity={0.2} />
            <text x={2} y={P} fontSize={9} fill="currentColor" opacity={0.6}>{max.toFixed(0)}</text>
            {series.map((s, si) => {
              const segs: string[] = []; let cur = "";
              s.pts.forEach((v, i) => { if (v === null) { if (cur) segs.push(cur); cur = ""; } else cur += `${cur ? "L" : "M"}${x(i)},${y(v)} `; });
              if (cur) segs.push(cur);
              return (
                <g key={s.model} stroke={colors[si % colors.length]} fill={colors[si % colors.length]}>
                  {segs.map((d, i) => <path key={i} d={d} fill="none" strokeWidth={2} />)}
                  {s.pts.map((v, i) => v !== null && <circle key={i} cx={x(i)} cy={y(v)} r={2.5} />)}
                </g>
              );
            })}
          </svg>
          <div className="mt-1 flex flex-wrap gap-3 text-[11px]">
            {series.map((s, si) => {
              const vals = s.pts.filter((v): v is number => v !== null);
              const g = vals.length > 1 && vals[vals.length - 2] ? ((vals[vals.length - 1]! - vals[vals.length - 2]!) / vals[vals.length - 2]!) * 100 : null;
              return (
                <span key={s.model} className="flex items-center gap-1 font-mono">
                  <span className="size-2 rounded-full" style={{ background: colors[si % colors.length] }} />
                  {s.model} {g !== null && <span className={g >= 0 ? "text-success" : "text-destructive"}>{g >= 0 ? "+" : ""}{g.toFixed(0)}%</span>}
                </span>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
