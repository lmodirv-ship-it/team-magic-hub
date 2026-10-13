import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BarChart3, Play, Save } from "lucide-react";
import { getProviderForModel, modelChatStream } from "@/lib/nawat/providers";
import { useModels } from "@/lib/nawat/useModels";
import { ghnChatStream } from "@/lib/nawat/groupe-hn-platform";
import { TrainingLivePanel } from "@/components/nawat/TrainingLivePanel";
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

/** Specialised task presets; the original product-card task stays first. */
const TASK_PRESETS: { label: string; prompt: string }[] = [
  { label: "Carte produit (React)", prompt: "اكتب مكوّن React لبطاقة منتج مع Tailwind." },
  { label: "Code — API", prompt: "Écris une petite API REST Node.js (Express) avec CRUD pour des voitures." },
  { label: "Code — correction", prompt: "Trouve et corrige le bug : function sum(a){ return a.reduce((x,y)=>x+y) } sum([])" },
  { label: "Chat", prompt: "Explique en 5 phrases ce qu'est un modèle de langage local." },
  { label: "Shell", prompt: "Donne la commande PowerShell pour lister les 10 plus gros fichiers d'un dossier." },
  { label: "Outils / JSON", prompt: "Retourne uniquement un JSON {name, price, currency} pour : voiture Clio 2020 à 95000 MAD." },
  { label: "SQL", prompt: "Écris une table SQL 'cars' et une requête des 5 voitures les moins chères." },
  { label: "Vision (description)", prompt: "Décris comment tu analyserais une photo de voiture pour estimer son état." },
  { label: "Darija", prompt: "شرح بالدارجة المغربية كيفاش نبدا مشروع صغير ديال البرمجة." },
  { label: "Étude", prompt: "Résume la différence entre HTTP et WebSocket pour un étudiant." },
  { label: "Business", prompt: "Propose un plan marketing en 5 points pour une plateforme de vente de voitures au Maroc." },
  { label: "Réflexion", prompt: "Un train part à 8h à 80 km/h, un autre à 9h à 120 km/h. Quand le second rattrape-t-il le premier ? Explique." },
];

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
  const [engine, setEngine] = useState<"ghn" | "local">("ghn");
  const [chain, setChain] = useState(true);
  const shown = models.filter((m) =>
    cat === "all" ? true : cat === "provider" ? !!getProviderForModel(m.name) : categoryOf(m.name) === cat,
  );

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
    const round = new Date().toISOString();
    const stream = engine === "ghn" ? ghnChatStream : modelChatStream;
    const previous: { model: string; text: string }[] = [];
    const one = async (m: string) => {
        const t0 = performance.now();
        let acc = "";
        let ttft: number | null = null;
        try {
          const content = chain && previous.length
            ? `${full}\n\n--- Réponses des modèles précédents (améliore-les) ---\n${previous.map((p) => `[${p.model}]\n${p.text.slice(0, 2000)}`).join("\n\n")}`
            : full;
          for await (const c of stream(m, [{ role: "user", content }])) {
            if (ttft === null) ttft = performance.now() - t0;
            acc += c;
            setResults((rs) =>
              rs.map((r) =>
                r.model === m ? { ...r, output: acc, ms: performance.now() - t0 } : r,
              ),
            );
          }
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
          round,
          ...(ttft ? { inTps: full.length / Math.max(ttft / 1000, 0.001) } : {}),
        });
        setResults((rs) =>
          rs.map((r) => (r.model === m ? { ...r, output: acc, ms, done: true, at } : r)),
        );
        if (!acc.includes("⚠️")) previous.push({ model: m, text: acc });
    };
    if (chain) { for (const m of selected) await one(m); }
    else await Promise.all(selected.map(one));
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
          <div className="mt-2 flex flex-wrap gap-1">
            {TASK_PRESETS.map((t) => (
              <button key={t.label} onClick={() => setPrompt(t.prompt)} className="rounded border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground">{t.label}</button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="flex overflow-hidden rounded border border-border text-xs">
              <button onClick={() => setEngine("ghn")} className={`px-2 py-1 ${engine === "ghn" ? "bg-nawat text-nawat-foreground" : ""}`}>Groupe-HN</button>
              <button onClick={() => setEngine("local")} className={`px-2 py-1 ${engine === "local" ? "bg-nawat text-nawat-foreground" : ""}`}>Local</button>
            </div>
            <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={chain} onChange={(e) => setChain(e.target.checked)} /> Un par un (chacun voit les précédents)</label>
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
          <Link
            to="/model-results"
            className="mt-3 flex w-fit items-center gap-1 rounded border border-nawat px-3 py-1.5 text-xs text-nawat hover:bg-accent"
          >
            <BarChart3 className="size-3.5" /> النتائج — تطور ومقارنة النماذج
          </Link>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-2 text-sm font-semibold">النماذج</h2>
          <div className="mb-2 flex flex-wrap gap-1">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                onClick={() => setCat(c.id)}
                className={`rounded px-2 py-0.5 text-[11px] ${cat === c.id ? "bg-nawat text-nawat-foreground" : "border border-border text-muted-foreground"}`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <label className="mb-1 flex items-center gap-2 text-xs font-medium">
            <input
              type="checkbox"
              aria-label="Tout sélectionner"
              checked={shown.length > 0 && shown.every((m) => selected.includes(m.name))}
              onChange={(e) => {
                const names = shown.map((m) => m.name);
                setSelected((s) => (e.target.checked ? [...new Set([...s, ...names])] : s.filter((x) => !names.includes(x))));
              }}
            />
            Tout sélectionner ({shown.length})
          </label>
          <div className="max-h-96 space-y-1 overflow-auto">
            {shown.map((m) => (
              <label key={m.name} className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={selected.includes(m.name)}
                  onChange={() => toggle(m.name)}
                />
                <span className="font-mono">{m.name}</span>
              </label>
            ))}
            {shown.length === 0 && (
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
              {r.done && r.at && (
                <span className="flex gap-0.5" title="قيّم الجودة">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        rateRun(r.at!, r.model, s);
                        setResults((rs) => rs.map((x) => (x.model === r.model ? { ...x, score: s } : x)));
                      }}
                      className={`text-xs ${(r.score ?? 0) >= s ? "text-nawat" : "text-muted-foreground"}`}
                    >
                      ★
                    </button>
                  ))}
                </span>
              )}
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

      <TrainingLivePanel />

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
