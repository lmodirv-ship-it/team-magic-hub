// تصنيف النماذج وتسجيل نتائج الاختبارات لقياس النمو والتطور لكل نموذج.
export type ModelCategory = "coder" | "think" | "shell" | "agent" | "mini" | "provider" | "other";

export const CATEGORIES: { id: ModelCategory | "all"; label: string }[] = [
  { id: "all", label: "الكل" },
  { id: "coder", label: "برمجة" },
  { id: "think", label: "تفكير" },
  { id: "shell", label: "طرفية" },
  { id: "agent", label: "وكلاء" },
  { id: "mini", label: "مصغّرة" },
  { id: "provider", label: "مزوّد خارجي" },
  { id: "other", label: "أخرى" },
];

export function categoryOf(name: string): ModelCategory {
  const n = name.toLowerCase();
  if (n.includes("mini") || n.includes("0.5b")) return "mini";
  if (n.includes("think") || n.includes("tri")) return "think";
  if (n.includes("coder") || n.includes("build")) return "coder";
  if (n.includes("shell")) return "shell";
  if (n.includes("agent") || n.includes("tools")) return "agent";
  return "other";
}

/** العائلة = الاسم قبل ":" — تجمع إصدارات النموذج نفسه */
export function familyOf(name: string) {
  return name.split(":")[0] ?? name;
}

/** رقم الجولة/الإصدار للترتيب الزمني (r19, v17 …) */
export function versionRank(name: string) {
  const tag = name.split(":")[1] ?? "";
  const m = tag.match(/(?:r|v)(\d+)/g);
  if (!m) return 0;
  return Math.max(...m.map((x) => Number(x.slice(1))));
}

export type TestRun = {
  model: string;
  at: string;
  ms: number;
  chars: number;
  tps: number; // حرف/ثانية تقريبًا
  ok: boolean;
  score?: number; // تقييم 1-5
  prompt: string;
  /** Round id shared by every model run of one task launch. */
  round?: string;
  /** Input speed: prompt chars / time to first token (only when measured). */
  inTps?: number;
};

const RUNS_KEY = "nawat.tasks.runs.v1";

export function getRuns(): TestRun[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(RUNS_KEY) ?? "[]") as TestRun[];
  } catch {
    return [];
  }
}

export function addRun(run: TestRun) {
  const next = [run, ...getRuns()].slice(0, 2000);
  localStorage.setItem(RUNS_KEY, JSON.stringify(next));
}

export function rateRun(at: string, model: string, score: number) {
  const next = getRuns().map((r) => (r.at === at && r.model === model ? { ...r, score } : r));
  localStorage.setItem(RUNS_KEY, JSON.stringify(next));
}

export type ModelStats = {
  model: string;
  runs: number;
  avgTps: number;
  avgMs: number;
  okRate: number;
  avgScore: number | null;
};

export function statsFor(runs: TestRun[], model: string): ModelStats {
  const rs = runs.filter((r) => r.model === model);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const scores = rs.map((r) => r.score).filter((x): x is number => typeof x === "number");
  return {
    model,
    runs: rs.length,
    avgTps: avg(rs.map((r) => r.tps)),
    avgMs: avg(rs.map((r) => r.ms)),
    okRate: rs.length ? rs.filter((r) => r.ok).length / rs.length : 0,
    avgScore: scores.length ? avg(scores) : null,
  };
}

/** نسبة النمو بين قيمتين بالمئة */
export function growth(prev: number, cur: number) {
  if (!prev) return null;
  return ((cur - prev) / prev) * 100;
}
