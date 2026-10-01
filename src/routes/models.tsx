import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Play, RefreshCw, RotateCcw, Square } from "lucide-react";
import {
  formatBytes,
  restartModel,
  showModel,
  startModel,
  stopModel,
  type OllamaModel,
} from "@/lib/nawat/bridge";
import { useModels } from "@/lib/nawat/useModels";

export const Route = createFileRoute("/models")({
  head: () => ({
    meta: [
      { title: "النماذج — NAWAT Studio" },
      {
        name: "description",
        content: "اكتشاف تلقائي لنماذج nawat المحلية مع التشغيل والإيقاف وعرض الحالة والذاكرة.",
      },
      { property: "og:title", content: "النماذج — NAWAT Studio" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      {
        property: "og:description",
        content: "اكتشاف تلقائي لنماذج nawat المحلية مع التشغيل والإيقاف وعرض الحالة والذاكرة.",
      },
    ],
  }),
  component: ModelsPage,
});

function ModelsPage() {
  const { models, running, loading, refresh } = useModels(5000);
  const [log, setLog] = useState<string[]>([]);
  const [details, setDetails] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const push = (m: string) =>
    setLog((l) => [`${new Date().toLocaleTimeString()} — ${m}`, ...l].slice(0, 60));

  const act = async (name: string, kind: "start" | "stop" | "restart") => {
    setBusy(name);
    push(`${kind} ${name}…`);
    try {
      if (kind === "start") await startModel(name);
      if (kind === "stop") await stopModel(name);
      if (kind === "restart") await restartModel(name);
      push(`${kind} ${name} ✓`);
    } catch (e) {
      push(`${kind} ${name} ✗ ${(e as Error).message}`);
    }
    setBusy(null);
    void refresh();
  };

  const runInfo = (m: OllamaModel) => running.find((r) => r.name === m.name);

  return (
    <main className="min-w-0 flex-1 overflow-auto p-6">
      <header className="mb-6 flex items-center gap-3">
        <div>
          <h1 className="text-xl font-semibold">النماذج المحلية</h1>
          <p className="text-sm text-muted-foreground">
            نماذج Groupe-HN الرسمية والنماذج التطويرية والخارجية المرتبطة.
          </p>
        </div>
        <div className="flex-1" />
        <button
          onClick={() => void refresh()}
          className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent"
        >
          <RefreshCw className="size-4" /> تحديث
        </button>
      </header>

      {!loading && models.length === 0 && (
        <p className="mb-4 rounded border border-border p-3 text-sm text-muted-foreground">
          لا توجد نماذج بالبادئة الحالية. غيّر البادئة من الإعدادات أو نزّل نموذجًا عبر Ollama.
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {models.map((m) => {
          const r = runInfo(m);
          return (
            <article key={m.name} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-mono text-sm font-semibold">{m.name}</h2>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] ${
                    r ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {m.official ? "متصل ويعمل" : r ? "قيد التشغيل" : "متاح"}
                </span>
              </div>
              {m.description && (
                <p className="mt-2 text-xs text-muted-foreground">{m.description}</p>
              )}
              <dl className="mt-3 grid grid-cols-2 gap-y-1 text-xs text-muted-foreground">
                <dt>الحجم</dt>
                <dd className="text-foreground">{formatBytes(m.size)}</dd>
                <dt>الذاكرة (VRAM)</dt>
                <dd className="text-foreground">{formatBytes(r?.size_vram)}</dd>
                <dt>المعاملات</dt>
                <dd className="text-foreground">{m.details?.parameter_size ?? "—"}</dd>
                <dt>الكمّية</dt>
                <dd className="text-foreground">{m.details?.quantization_level ?? "—"}</dd>
                <dt>آخر تعديل</dt>
                <dd className="text-foreground">
                  {m.modified_at === "official"
                    ? "رسمي"
                    : m.modified_at.includes("ago")
                      ? m.modified_at
                      : new Date(m.modified_at).toLocaleString()}
                </dd>
                <dt>البصمة</dt>
                <dd className="truncate font-mono text-foreground">{m.digest?.slice(0, 12)}</dd>
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  disabled={busy === m.name}
                  onClick={() => void act(m.name, "start")}
                  className="flex items-center gap-1 rounded bg-nawat px-2 py-1 text-xs text-nawat-foreground disabled:opacity-50"
                >
                  <Play className="size-3" /> تشغيل
                </button>
                <button
                  disabled={busy === m.name}
                  onClick={() => void act(m.name, "stop")}
                  className="flex items-center gap-1 rounded border border-border px-2 py-1 text-xs disabled:opacity-50"
                >
                  <Square className="size-3" /> إيقاف
                </button>
                <button
                  disabled={busy === m.name}
                  onClick={() => void act(m.name, "restart")}
                  className="flex items-center gap-1 rounded border border-border px-2 py-1 text-xs disabled:opacity-50"
                >
                  <RotateCcw className="size-3" /> إعادة تشغيل
                </button>
                <button
                  onClick={async () => {
                    try {
                      setDetails(await showModel(m.name));
                    } catch (e) {
                      push((e as Error).message);
                    }
                  }}
                  className="rounded border border-border px-2 py-1 text-xs"
                >
                  تفاصيل
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <section className="mt-8 grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="mb-2 text-sm font-semibold">سجل التشغيل</h3>
          <pre className="max-h-56 overflow-auto font-mono text-[11px] whitespace-pre-wrap text-muted-foreground">
            {log.join("\n") || "لا توجد أحداث بعد."}
          </pre>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="mb-2 text-sm font-semibold">بيانات النموذج (Modelfile / معلومات)</h3>
          <pre className="max-h-56 overflow-auto font-mono text-[11px] whitespace-pre-wrap text-muted-foreground">
            {details ? JSON.stringify(details, null, 2).slice(0, 4000) : "اختر «تفاصيل» لأي نموذج."}
          </pre>
        </div>
      </section>
    </main>
  );
}
