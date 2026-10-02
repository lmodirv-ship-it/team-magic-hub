import { useRef, useState } from "react";
import { CheckCircle2, Circle, Loader2, Play, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { callConfiguredBridge } from "@/lib/nawat/bridge-config";

type Status = "waiting" | "working" | "done" | "failed";
type Stage = { id: string; label: string; model?: string; status: Status; ms?: number; note?: string };

const FAST = "qwen3:4b";
const STRONG = "qwen3.5:9b";

const initial = (): Stage[] => [
  { id: "modules", label: "اختيار الوحدات", status: "waiting" },
  { id: "questions", label: "أسئلة البنية", model: FAST, status: "waiting" },
  { id: "approve", label: "اعتماد البنية", status: "waiting" },
  { id: "files", label: "إنشاء ملفات الموقع", model: STRONG, status: "waiting" },
  { id: "images", label: "الصور (ComfyUI)", status: "waiting" },
  { id: "preview", label: "تشغيل المعاينة", status: "waiting" },
];

const MODULES = ["رأس الصفحة", "من نحن", "الخدمات", "معرض", "أسعار", "تواصل", "تذييل"];

async function ask(model: string, prompt: string, maxTokens = 1024): Promise<string> {
  const run = async (m: string) => {
    const r = (await callConfiguredBridge("chat", { model: m, noThink: true, maxTokens, messages: [{ role: "user", content: prompt }] })) as { message?: { content?: string } } | null;
    const text = r?.message?.content?.trim();
    if (!text) throw new Error("رد فارغ");
    return text;
  };
  try { return await run(model); } catch { return run(STRONG); } // احتياط تلقائي
}

function extractHtml(text: string) {
  const m = text.match(/```(?:html)?\s*([\s\S]*?)```/i);
  const html = (m?.[1] ?? text).trim();
  return /<html|<body|<div/i.test(html) ? html : `<!doctype html><html lang="ar" dir="rtl"><body><pre>${html.replace(/</g, "&lt;")}</pre></body></html>`;
}

export function SiteBuildTracker() {
  const [request, setRequest] = useState("");
  const [modules, setModules] = useState<string[]>(["رأس الصفحة", "الخدمات", "تواصل", "تذييل"]);
  const [stages, setStages] = useState<Stage[]>(initial);
  const [questions, setQuestions] = useState("");
  const [answers, setAnswers] = useState("");
  const [html, setHtml] = useState("");
  const [busy, setBusy] = useState(false);
  const t0 = useRef(0);

  const set = (id: string, status: Status, note?: string) =>
    setStages((s) => s.map((x) => {
      if (x.id !== id) return x;
      if (status === "working") t0.current = performance.now();
      return { ...x, status, note, ms: status === "working" ? undefined : Math.round(performance.now() - t0.current) };
    }));

  async function start() {
    if (!request.trim()) return;
    setBusy(true); setStages(initial()); setHtml(""); setQuestions("");
    set("modules", "done", modules.join("، "));
    set("questions", "working");
    try {
      const q = await ask(FAST, `طلب موقع: ${request}\nالوحدات: ${modules.join("، ")}\nاكتب أهم الأسئلة القصيرة لفهم البنية (الجمهور، الألوان، المحتوى). أسئلة فقط، مرقمة.`, 400);
      setQuestions(q); set("questions", "done");
      set("approve", "working", "بانتظار إجاباتك");
    } catch (e) { set("questions", "failed", String((e as Error).message)); }
    setBusy(false);
  }

  async function build() {
    setBusy(true);
    set("approve", "done");
    set("files", "working");
    // المراحل المستقلة بالتوازي: الكود + فحص ComfyUI
    const imgCheck = (async () => {
      set("images", "working");
      try {
        const h = (await callConfiguredBridge("health")) as { comfy?: boolean } | null;
        set("images", h?.comfy ? "done" : "failed", h?.comfy ? "ComfyUI متاح" : "ComfyUI غير متاح — استُخدمت ألوان بدل الصور");
      } catch { set("images", "failed", "تعذّر فحص ComfyUI"); }
    })();
    try {
      const out = await ask(STRONG, `أنشئ صفحة HTML واحدة كاملة (CSS داخلي، عربية RTL، متجاوبة) لهذا الطلب:\n${request}\nالوحدات: ${modules.join("، ")}\nإجابات العميل:\n${answers}\nأعد الكود فقط داخل \`\`\`html.`, 4096);
      setHtml(extractHtml(out)); set("files", "done");
      await imgCheck;
      set("preview", "done", "معروض في لوحة العرض");
    } catch (e) { set("files", "failed", String((e as Error).message)); await imgCheck; }
    setBusy(false);
  }

  const Icon = ({ s }: { s: Status }) =>
    s === "done" ? <CheckCircle2 className="size-4 text-primary" /> : s === "working" ? <Loader2 className="size-4 animate-spin" /> : s === "failed" ? <XCircle className="size-4 text-destructive" /> : <Circle className="size-4 text-muted-foreground" />;

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-3 overflow-auto p-3 text-sm" dir="rtl">
      <div className="space-y-2">
        <h2 className="font-semibold">تتبع الطلب حتى بناء الموقع</h2>
        <Textarea value={request} onChange={(e) => setRequest(e.target.value)} placeholder="صف الموقع المطلوب…" className="min-h-16 text-xs" />
        <div className="flex flex-wrap gap-1">
          {MODULES.map((m) => (
            <button key={m} onClick={() => setModules((v) => v.includes(m) ? v.filter((x) => x !== m) : [...v, m])}
              className={`rounded border px-2 py-0.5 text-xs ${modules.includes(m) ? "border-primary bg-primary/15" : "border-border"}`}>{m}</button>
          ))}
        </div>
        <Button size="sm" onClick={start} disabled={busy || !request.trim()}><Play className="size-3" /> ابدأ</Button>
      </div>

      <ol className="space-y-1 rounded border border-border p-2">
        {stages.map((s) => (
          <li key={s.id} className="flex items-center gap-2 text-xs">
            <Icon s={s.status} /> <span className="font-medium">{s.label}</span>
            {s.model && <span className="font-mono text-muted-foreground" dir="ltr">{s.model}</span>}
            {s.ms != null && s.status !== "waiting" && <span className="text-muted-foreground">{(s.ms / 1000).toFixed(1)} ث</span>}
            {s.note && <span className="truncate text-muted-foreground">— {s.note}</span>}
          </li>
        ))}
      </ol>

      {questions && (
        <div className="space-y-2">
          <pre className="whitespace-pre-wrap rounded bg-muted p-2 text-xs">{questions}</pre>
          <Textarea value={answers} onChange={(e) => setAnswers(e.target.value)} placeholder="إجاباتك…" className="min-h-16 text-xs" />
          <Button size="sm" onClick={build} disabled={busy}>اعتماد البنية وبناء الموقع</Button>
        </div>
      )}

      {html && <iframe title="معاينة الموقع" srcDoc={html} sandbox="allow-scripts" className="min-h-[420px] w-full flex-1 rounded border border-border bg-background" />}
    </div>
  );
}
