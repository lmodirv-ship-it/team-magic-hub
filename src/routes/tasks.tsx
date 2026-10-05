import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BarChart3, Play, Save } from "lucide-react";
import { modelChatStream } from "@/lib/nawat/providers";
import { useModels } from "@/lib/nawat/useModels";
import { useWorkspace } from "@/lib/nawat/workspace";
import { addRun, CATEGORIES, categoryOf, rateRun, type ModelCategory } from "@/lib/nawat/model-catalog";

export const Route = createFileRoute("/tasks")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "المهام والمقارنة — NAWAT Studio" },
      {
        name: "description",
        content: "أرسل مهمة واحدة إلى عدة نماذج nawat وقارن النتائج واحفظها في المشروع.",
      },
      { property: "og:title", content: "المهام والمقارنة — NAWAT Studio" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      {
        property: "og:description",
        content: "أرسل مهمة واحدة إلى عدة نماذج nawat وقارن النتائج واحفظها في المشروع.",
      },
    ],
  }),
  component: TasksPage,
});

type Result = { model: string; output: string; ms: number; done: boolean; at?: string; score?: number };

const HISTORY_KEY = "nawat.tasks.v1";

function TasksPage() {
  const { models } = useModels();
  const { vfs, createFile, writeFile } = useWorkspace();
  const [selected, setSelected] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("اكتب مكوّن React لبطاقة منتج مع Tailwind.");
  const [contextFile, setContextFile] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<{ prompt: string; at: string }[]>([]);
  const [cat, setCat] = useState<ModelCategory | "all">("all");
  const shown = models.filter((m) => cat === "all" || categoryOf(m.name) === cat);

  useEffect(() => {
    try {
      setHistory(
        JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]") as { prompt: string; at: string }[],
      );
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!selected.length && models[0]) setSelected([models[0].name]);
  }, [models, selected.length]);

  const toggle = (name: string) =>
    setSelected((s) => (s.includes(name) ? s.filter((x) => x !== name) : [...s, name]));

  const run = async () => {
    if (!selected.length || !prompt.trim()) return;
    setRunning(true);
    const full = contextFile
      ? `${prompt}\n\n--- ${contextFile} ---\n${(vfs[contextFile] ?? "").slice(0, 8000)}`
      : prompt;
    setResults(selected.map((m) => ({ model: m, output: "", ms: 0, done: false })));
    await Promise.all(
      selected.map(async (m) => {
        const t0 = performance.now();
        let acc = "";
        try {
          for await (const c of modelChatStream(m, [{ role: "user", content: full }])) {
            acc += c;
            setResults((rs) =>
              rs.map((r) =>
                r.model === m ? { ...r, output: acc, ms: performance.now() - t0 } : r,
              ),
            );
          }
        let ok = true;
        } catch (e) {
          acc += `\n⚠️ ${(e as Error).message}`;
        }
        const ms = performance.now() - t0;
        const at = new Date().toISOString();
        addRun({
          model: m,
          at,
          ms,
          chars: acc.length,
          tps: acc.length / Math.max(ms / 1000, 0.001),
          ok: !acc.includes("⚠️") && acc.length > 0,
          prompt: prompt.slice(0, 200),
        });
        setResults((rs) =>
          rs.map((r) => (r.model === m ? { ...r, output: acc, ms, done: true, at } : r)),
        );
      }),
    );
    const next = [{ prompt, at: new Date().toISOString() }, ...history].slice(0, 30);
    setHistory(next);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    setRunning(false);
  };

  return (
    <main className="min-w-0 flex-1 overflow-auto p-6">
      <h1 className="text-xl font-semibold">المهام ومقارنة النماذج</h1>
      <p className="mb-5 text-sm text-muted-foreground">
        نفّذ نفس المهمة على أكثر من نموذج محلي في وقت واحد وقارن المخرجات.
      </p>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-lg border border-border bg-card p-4">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={5}
            className="w-full resize-none rounded-md border border-border bg-background p-3 text-sm outline-none focus:border-nawat"
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select
              value={contextFile}
              onChange={(e) => setContextFile(e.target.value)}
              className="rounded border border-border bg-background px-2 py-1 text-xs"
            >
              <option value="">بدون ملف سياق</option>
              {Object.keys(vfs).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <button
              onClick={() => void run()}
              disabled={running}
              className="flex items-center gap-1 rounded bg-nawat px-3 py-1.5 text-xs text-nawat-foreground disabled:opacity-50"
            >
              <Play className="size-3.5" />{" "}
              {running ? "جارٍ التنفيذ…" : "تشغيل على النماذج المحددة"}
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-2 text-sm font-semibold">النماذج</h2>
          <div className="space-y-1">
            {models.map((m) => (
              <label key={m.name} className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={selected.includes(m.name)}
                  onChange={() => toggle(m.name)}
                />
                <span className="font-mono">{m.name}</span>
              </label>
            ))}
            {models.length === 0 && (
              <p className="text-xs text-muted-foreground">لا توجد نماذج متاحة.</p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {results.map((r) => (
          <article key={r.model} className="rounded-lg border border-border bg-card p-4">
            <header className="mb-2 flex items-center gap-2">
              <h3 className="font-mono text-xs font-semibold">{r.model}</h3>
              <span className="text-[11px] text-muted-foreground">{(r.ms / 1000).toFixed(1)}s</span>
              <div className="flex-1" />
              <button
                title="حفظ النتيجة في ملف"
                onClick={() => {
                  const p = prompt2(r.model);
                  if (!p) return;
                  createFile(p);
                  writeFile(p, r.output);
                }}
              >
                <Save className="size-3.5 text-muted-foreground hover:text-foreground" />
              </button>
            </header>
            <pre className="max-h-96 overflow-auto font-mono text-[11px] whitespace-pre-wrap">
              {r.output || "…"}
            </pre>
          </article>
        ))}
      </div>

      <section className="mt-8 rounded-lg border border-border bg-card p-4">
        <h2 className="mb-2 text-sm font-semibold">سجل المهام المحفوظ محليًا</h2>
        <ul className="space-y-1 text-xs text-muted-foreground">
          {history.map((h, i) => (
            <li key={i} className="truncate">
              {new Date(h.at).toLocaleString()} — {h.prompt}
            </li>
          ))}
          {history.length === 0 && <li>لا توجد مهام بعد.</li>}
        </ul>
      </section>
    </main>
  );
}

function prompt2(model: string) {
  return window.prompt("حفظ النتيجة في ملف", `my-app/results/${model.replace(/[:/]/g, "-")}.md`);
}
