import { useEffect, useState } from "react";

const samples = new Map<string, number[]>();
const EVT = "nawat:metrics";
const MAX = 500;

export function record(name: string, ms: number) {
  const list = samples.get(name) ?? [];
  list.push(ms);
  if (list.length > MAX) list.shift();
  samples.set(name, list);
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVT));
}

export function measure<T>(name: string, fn: () => T): T {
  const t = performance.now();
  try {
    return fn();
  } finally {
    record(name, performance.now() - t);
  }
}

function pct(sorted: number[], p: number) {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] ?? 0;
}

export type MetricRow = { name: string; count: number; avg: number; p50: number; p95: number; max: number };

export function snapshot(): MetricRow[] {
  return [...samples.entries()].map(([name, list]) => {
    const s = [...list].sort((a, b) => a - b);
    return {
      name,
      count: s.length,
      avg: s.reduce((a, b) => a + b, 0) / s.length,
      p50: pct(s, 50),
      p95: pct(s, 95),
      max: s.at(-1) ?? 0,
    };
  });
}

export function clearMetrics() {
  samples.clear();
  window.dispatchEvent(new Event(EVT));
}

export function useMetrics() {
  const [rows, setRows] = useState<MetricRow[]>([]);
  useEffect(() => {
    const sync = () => setRows(snapshot());
    sync();
    window.addEventListener(EVT, sync);
    return () => window.removeEventListener(EVT, sync);
  }, []);
  return rows;
}
