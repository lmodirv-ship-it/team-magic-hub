import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, LayoutGrid, Play, Save, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Page, Panel } from "@/components/nawat/StudioUI";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useModels } from "@/lib/nawat/useModels";
import { elapsedOf, formatDuration, useAtelier, type ModelRun } from "@/lib/nawat/atelier";
import { LIBRARY_ROOT, slugifyModel, useWorkspace } from "@/lib/nawat/workspace";
import { formatBytes } from "@/lib/nawat/bridge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/atelier")({
  head: () => ({
    meta: [
      { title: "الورشة متعددة النماذج — NAWAT Studio" },
      {
        name: "description",
        content: "شغّل نفس الطلب على عدة نماذج في وقت واحد وقارن النتائج والزمن.",
      },
      { property: "og:title", content: "الورشة متعددة النماذج — NAWAT Studio" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      {
        property: "og:description",
        content: "تشغيل متوازٍ لكل النماذج المختارة مع مؤقّت لكل نموذج وحفظ تلقائي في المكتبة.",
      },
    ],
  }),
  component: AtelierPage,
});

const STATUS_LABEL: Record<ModelRun["status"], string> = {
  idle: "جاهز",
  queued: "في الانتظار",
  streaming: "قيد التوليد",
  done: "اكتمل",
  error: "خطأ",
  stopped: "متوقف",
};

function statusTone(status: ModelRun["status"]) {
  switch (status) {
    case "streaming":
      return "border-nawat/40 bg-nawat/10 text-nawat";
    case "done":
      return "border-success/30 bg-success/10 text-success";
    case "error":
      return "border-destructive/40 bg-destructive/10 text-destructive";
    case "stopped":
      return "border-warning/30 bg-warning/10 text-warning";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

function gridClass(count: number) {
  if (count <= 1) return "grid-cols-1";
  if (count <= 4) return "grid-cols-1 lg:grid-cols-2";
  if (count <= 9) return "grid-cols-1 md:grid-cols-2 xl:grid-cols-3";
  return "grid-cols-1 md:grid-cols-2 xl:grid-cols-4";
}

function ResultCard({
  run,
  now,
  onStop,
  onSave,
}: {
  run: ModelRun;
  now: number;
  onStop: () => void;
  onSave: () => void;
}) {
  const ms = elapsedOf(run, now);
  const speed = ms > 300 ? Math.round((run.output.length / ms) * 1000) : 0;
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (run.status === "streaming" && bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [run.output, run.status]);

  return (
    <article className="glass-panel flex h-[420px] min-w-0 flex-col overflow-hidden rounded-lg">
      <header className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span className="min-w-0 flex-1 truncate font-mono text-xs font-medium" title={run.model}>
          {run.model}
        </span>
        <span
          className={cn(
            "shrink-0 rounded border px-1.5 py-0.5 text-[10px]",
            statusTone(run.status),
          )}
        >
          {STATUS_LABEL[run.status]}
        </span>
        <span className="shrink-0 font-mono text-[11px] text-muted-foreground tabular-nums">
          {formatDuration(ms)}
        </span>
      </header>

      <div
        ref={bodyRef}
        className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap px-3 py-2 text-[13px] leading-6"
      >
        {run.error ? (
          <p className="text-destructive">{run.error}</p>
        ) : run.output ? (
          run.output
        ) : (
          <p className="text-muted-foreground">
            {run.status === "streaming" ? "…" : "لا يوجد ناتج بعد."}
          </p>
        )}
      </div>

      <footer className="flex items-center gap-1 border-t border-border px-2 py-1.5">
        <span className="font-mono text-[10px] text-muted-foreground">
          {run.output.length} حرف {speed ? `· ${speed} حرف/ث` : ""}
        </span>
        <div className="flex-1" />
        {run.status === "streaming" ? (
          <Button size="sm" variant="ghost" onClick={onStop}>
            <Square className="size-3.5" /> إيقاف
          </Button>
        ) : (
          <>
            <Button
              size="sm"
              variant="ghost"
              disabled={!run.output}
              onClick={() => {
                void navigator.clipboard.writeText(run.output);
                toast.success("تم النسخ");
              }}
            >
              <Copy className="size-3.5" /> نسخ
            </Button>
            <Button size="sm" variant="ghost" disabled={!run.output || run.saved} onClick={onSave}>
              <Save className="size-3.5" /> {run.saved ? "محفوظ" : "حفظ"}
            </Button>
          </>
        )}
      </footer>
    </article>
  );
}

function AtelierPage() {
  const { models, loading, error } = useModels();
  const { state, run, stop, stopAll, clear, markSaved } = useAtelier();
  const { writeFile } = useWorkspace();
  const [selected, setSelected] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("");
  const [system, setSystem] = useState("");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!state.running) return;
    const id = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(id);
  }, [state.running]);

  useEffect(() => {
    setSelected((s) => s.filter((m) => models.some((model) => model.name === m)));
  }, [models]);

  const runs = useMemo(() => Object.values(state.runs), [state.runs]);

  const saveRun = (r: ModelRun) => {
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
    const path = `${LIBRARY_ROOT}/${stamp}-${slugifyModel(r.model)}.md`;
    const body = [
      `# ${r.model}`,
      "",
      `- التاريخ: ${new Date().toLocaleString("fr-FR")}`,
      `- المدة: ${formatDuration(elapsedOf(r, Date.now()))}`,
      "",
      "## الطلب",
      "",
      state.prompt,
      "",
      "## الناتج",
      "",
      r.output,
      "",
    ].join("\n");
    writeFile(path, body, {
      model: r.model,
      source: "atelier",
      prompt: state.prompt,
      durationMs: elapsedOf(r, Date.now()),
    });
    markSaved(r.model);
  };

  // Auto-save each finished run into the library.
  const savedRef = useRef(new Set<string>());
  useEffect(() => {
    runs.forEach((r) => {
      const key = `${state.startedAt}:${r.model}`;
      if (r.status === "done" && r.output && !savedRef.current.has(key)) {
        savedRef.current.add(key);
        saveRun(r);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runs, state.startedAt]);

  const toggle = (name: string) =>
    setSelected((s) => (s.includes(name) ? s.filter((x) => x !== name) : [...s, name]));

  const launch = () => {
    if (!prompt.trim()) {
      toast.error("اكتب الطلب أولًا.");
      return;
    }
    if (selected.length === 0) {
      toast.error("اختر نموذجًا واحدًا على الأقل.");
      return;
    }
    run(selected, prompt.trim(), system);
  };

  return (
    <Page
      eyebrow="Atelier"
      title="الورشة متعددة النماذج"
      description="طلب واحد، عدة نماذج في وقت واحد. مؤقّت لكل نموذج، عرض شبكي، وحفظ تلقائي في المكتبة."
      actions={
        <div className="flex gap-2">
          {state.running ? (
            <Button variant="destructive" onClick={stopAll}>
              <Square className="size-4" /> إيقاف الكل
            </Button>
          ) : (
            <Button onClick={launch}>
              <Play className="size-4" /> تشغيل ({selected.length})
            </Button>
          )}
          <Button variant="outline" onClick={clear} disabled={runs.length === 0}>
            <Trash2 className="size-4" /> مسح
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Panel
          title="النماذج المتاحة"
          note={loading ? "جارٍ الفحص…" : `${models.length} نموذج`}
          actions={
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelected(models.map((m) => m.name))}
              >
                الكل
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
                لا شيء
              </Button>
            </div>
          }
        >
          {error && (
            <p className="mb-3 rounded border border-warning/30 bg-warning/10 p-2 text-[11px] text-warning">
              {error}
            </p>
          )}
          <ul className="max-h-[320px] space-y-1 overflow-auto">
            {models.map((m) => (
              <li key={m.name}>
                <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-accent/50">
                  <Checkbox
                    aria-label={`اختيار النموذج ${m.name}`}
                    title={`اختيار النموذج ${m.name}`}
                    checked={selected.includes(m.name)}
                    onCheckedChange={() => toggle(m.name)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-xs">{m.name}</span>
                    <span className="block text-[10px] text-muted-foreground">
                      {formatBytes(m.size)}
                      {m.official ? " · رسمي" : ""}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </Panel>

        <div className="min-w-0 space-y-4">
          <Panel title="الطلب الموحّد" note="يُرسل إلى كل النماذج المختارة">
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              placeholder="اكتب طلبك هنا…"
              className="resize-y font-mono text-sm"
            />
            <Textarea
              value={system}
              onChange={(e) => setSystem(e.target.value)}
              rows={2}
              placeholder="تعليمات النظام (اختياري)"
              className="mt-2 resize-y text-xs"
            />
          </Panel>

          {runs.length === 0 ? (
            <div className="glass-panel grid h-64 place-items-center rounded-lg text-center text-sm text-muted-foreground">
              <div>
                <LayoutGrid className="mx-auto mb-2 size-6" />
                اختر النماذج واضغط تشغيل لعرض النتائج جنبًا إلى جنب.
              </div>
            </div>
          ) : (
            <div className={cn("grid gap-3", gridClass(runs.length))}>
              {runs.map((r) => (
                <ResultCard
                  key={r.model}
                  run={r}
                  now={now}
                  onStop={() => stop(r.model)}
                  onSave={() => saveRun(r)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </Page>
  );
}
