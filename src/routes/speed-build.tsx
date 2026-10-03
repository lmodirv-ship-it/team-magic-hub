import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Copy, Download, FolderUp, Mic, MicOff, Send, Square, Volume2, VolumeX, Zap } from "lucide-react";
import { toast } from "sonner";
import type { ChatMessage } from "@/lib/nawat/bridge";
import { modelChatStream } from "@/lib/nawat/providers";
import { useModels } from "@/lib/nawat/useModels";
import { useVoiceInput, useVoiceReply } from "@/lib/nawat/voice";
import { extractCode } from "@/components/nawat/LiveCodeStream";
import { getActiveProject, writeProjectFile } from "@/lib/nawat/projects";

export const Route = createFileRoute("/speed-build")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "Speed Build — بناء فائق السرعة | NAWAT Studio" },
      { name: "description", content: "ابنِ مواقع وأكوادًا بسرعة بالصوت: تحدث، والنموذج يجيب بالصوت ويكتب الكود في شاشة زجاجية ثلاثية الأبعاد." },
      { property: "og:title", content: "Speed Build — NAWAT Studio" },
      { property: "og:description", content: "بناء فائق السرعة بالصوت مع شاشة كود زجاجية ثلاثية الأبعاد ومعاينة فورية." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SpeedBuild,
});

const KEY = "nawat.speedbuild.v1";
const SYSTEM =
  "أنت NAWAT Speed Builder. أجب بسرعة وباختصار. ابدأ بجملة عربية واحدة قصيرة تشرح ما تفعله (تُقرأ بالصوت)، ثم ضع الكود كاملًا داخل كتلة واحدة ```html (صفحة HTML كاملة بـ CSS داخلي، عربية RTL، متجاوبة وجميلة) ما لم يُطلب غير ذلك. لا تفكير طويل.";

type Step = { label: string; at: number };
const CLOUD = "nawat-cloud";

async function* cloudStream(messages: ChatMessage[], signal: AbortSignal): AsyncGenerator<string> {
  const r = await fetch("/api/speed-build", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages }), signal });
  if (!r.ok || !r.body) throw new Error((await r.text().catch(() => "")) || `خطأ ${r.status}`);
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    yield dec.decode(value, { stream: true });
  }
}

function SpeedBuild() {
  const { models } = useModels();
  const [model, setModel] = useState("");
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [stats, setStats] = useState({ tps: 0, secs: 0 });
  const abort = useRef<AbortController | null>(null);
  const codeRef = useRef<HTMLPreElement>(null);
  const voice = useVoiceReply();
  const mic = useVoiceInput((t) => void run(t));

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) ?? "{}") as { model?: string; out?: string; history?: ChatMessage[] };
      if (s.model) setModel(s.model);
      if (s.out) setOut(s.out);
      if (s.history) setHistory(s.history);
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    if (!model) setModel(CLOUD);
  }, [model]);
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify({ model, out, history: history.slice(-12) })); } catch { /* ignore */ }
  }, [model, out, history]);
  useEffect(() => { codeRef.current?.scrollTo({ top: codeRef.current.scrollHeight }); }, [out]);
  useEffect(() => { if (mic.error) toast.error(mic.error); }, [mic.error]);

  const step = (label: string) => setSteps((s) => [...s, { label, at: Date.now() }]);
  const code = extractCode(out);
  const html = /<html|<body|<div/i.test(code) ? code : "";
  const talk = out.split("```")[0]?.trim() ?? "";

  async function run(text: string) {
    if (!text.trim() || !model || busy) return;
    voice.stop();
    setBusy(true); setInput(""); setOut(""); setSteps([]);
    step("⚡ استلام الأمر");
    const msgs: ChatMessage[] = [{ role: "system", content: SYSTEM }, ...history.slice(-6), { role: "user", content: text }];
    abort.current = new AbortController();
    const t0 = Date.now();
    let acc = "";
    let spoke = false;
    const label = model === CLOUD ? "NAWAT السحابي" : model;
    step(`● ${label} يكتب…`);
    const signal = abort.current.signal;
    // محلي أولًا مع مهلة قصيرة، ثم احتياط سحابي تلقائي إن لم يبدأ الرد
    async function* source(): AsyncGenerator<string> {
      if (model === CLOUD) { yield* cloudStream(msgs, signal); return; }
      const local = modelChatStream(model, msgs, signal);
      const first = await Promise.race([
        local.next(),
        new Promise<"timeout">((r) => setTimeout(() => r("timeout"), 15000)),
      ]).catch(() => "timeout" as const);
      if (first === "timeout" || first.done) {
        step("↻ النموذج المحلي غير متاح — تحويل للسحابي");
        yield* cloudStream(msgs, signal);
        return;
      }
      yield first.value;
      for await (const c of { [Symbol.asyncIterator]: () => local }) yield c;
    }
    try {
      for await (const c of source()) {
        acc += c;
        setOut(acc);
        const secs = Math.max(0.1, (Date.now() - t0) / 1000);
        setStats({ tps: Math.round(acc.length / 4 / secs), secs });
        window.dispatchEvent(new CustomEvent("nawat:stream", { detail: { text: acc, model, started: t0, done: false } }));
        if (!spoke && acc.includes("```")) {
          spoke = true;
          const say = acc.split("```")[0]?.trim();
          if (say && voice.enabled) voice.speak(say);
          step("🧩 توليد الكود");
        }
      }
      window.dispatchEvent(new CustomEvent("nawat:stream", { detail: { text: acc, model, started: t0, done: true } }));
      if (!spoke && voice.enabled) voice.speak(acc.slice(0, 400));
      setHistory((h) => [...h, { role: "user", content: text }, { role: "assistant", content: acc.slice(0, 4000) }]);
      step("✅ جاهز — المعاينة محدثة");
      if (voice.enabled && spoke) voice.speak("انتهيت، المعاينة جاهزة.");
    } catch (e) {
      step(`⚠️ ${(e as Error).message}`);
      toast.error((e as Error).message);
    }
    setBusy(false);
  }

  async function saveServer() {
    const p = getActiveProject();
    if (!p) { toast.error("اختر مشروعًا من صفحة المشاريع أولًا"); return; }
    try { await writeProjectFile(p, "index.html", code); toast.success(`حُفظ في ${p}/index.html`); }
    catch (e) { toast.error((e as Error).message); }
  }
  function download() {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([code], { type: "text/html" }));
    a.download = "index.html"; a.click();
  }

  return (
    <main
      dir="rtl"
      className="relative flex min-w-0 flex-1 flex-col overflow-auto bg-background"
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        setTilt({ x: ((e.clientY - r.top) / r.height - 0.5) * -6, y: ((e.clientX - r.left) / r.width - 0.5) * 8 });
      }}
    >
      {/* 3D grid floor */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden [perspective:700px]">
        <div
          className="absolute -inset-x-1/2 bottom-[-30%] h-[90%] animate-[sbgrid_6s_linear_infinite] opacity-40"
          style={{
            transform: "rotateX(70deg)",
            backgroundImage:
              "linear-gradient(var(--color-primary) 1px, transparent 1px), linear-gradient(90deg, var(--color-primary) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage: "linear-gradient(to top, black, transparent)",
          }}
        />
        <div className="absolute start-1/4 top-10 size-72 rounded-full bg-primary/25 blur-3xl" />
        <div className="absolute end-10 top-1/3 size-64 rounded-full bg-accent/30 blur-3xl" />
      </div>
      <style>{`@keyframes sbgrid{from{background-position:0 0}to{background-position:0 48px}}`}</style>

      <header className="relative z-10 flex flex-wrap items-center gap-3 px-4 pt-4">
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <Zap className="size-5 text-primary" /> Speed Build
        </h1>
        <span className="text-xs text-muted-foreground">تحدث أو اكتب — النموذج يجيب بالصوت ويكتب الكود لحظيًا</span>
        <select value={model} onChange={(e) => setModel(e.target.value)} className="ms-auto rounded-md border border-border bg-background/60 px-2 py-1 text-xs backdrop-blur" aria-label="النموذج">
          {models.length === 0 && <option value="">لا توجد نماذج</option>}
          {models.map((m) => <option key={m.name} value={m.name}>{m.name}</option>)}
        </select>
        <span dir="ltr" className="rounded-md border border-primary/40 bg-primary/10 px-2 py-1 font-mono text-[11px] text-primary">
          {stats.tps} tok/s · {stats.secs.toFixed(1)}s
        </span>
      </header>

      <section className="relative z-10 grid flex-1 gap-4 p-4 lg:grid-cols-[1fr_1.1fr] [perspective:1400px]">
        {/* Voice + steps */}
        <div className="flex flex-col gap-4">
          <div
            className="rounded-2xl border border-primary/40 bg-background/40 p-5 shadow-[0_0_40px_-10px_var(--color-primary)] backdrop-blur-xl transition-transform duration-200"
            style={{ transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` }}
          >
            <div className="flex flex-col items-center gap-3">
              <button
                onClick={mic.toggle}
                disabled={!mic.supported}
                aria-label={mic.listening ? "إيقاف الاستماع" : "تحدث الآن"}
                className={`relative grid size-24 place-items-center rounded-full border-2 transition ${mic.listening ? "border-destructive bg-destructive/20" : "border-primary bg-primary/15 hover:scale-105"}`}
              >
                {(mic.listening || voice.speaking) && <span className="absolute inset-0 animate-ping rounded-full border-2 border-primary/60" />}
                {mic.listening ? <MicOff className="size-9" /> : <Mic className="size-9 text-primary" />}
              </button>
              <p className="text-sm text-muted-foreground">
                {!mic.supported ? "المتصفح لا يدعم الإدخال الصوتي" : mic.listening ? "أستمع إليك…" : voice.speaking ? "NAWAT يتحدث…" : "اضغط وتحدث بأمرك"}
              </p>
              <button onClick={voice.toggle} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                {voice.enabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />} {voice.enabled ? "الرد الصوتي مفعّل" : "الرد الصوتي متوقف"}
              </button>
            </div>
            <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); void run(input); }}>
              <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="مثال: صفحة هبوط لمطعم مغربي بألوان دافئة"
                className="min-w-0 flex-1 rounded-lg border border-border bg-background/60 px-3 py-2 text-sm" />
              {busy ? (
                <button type="button" onClick={() => abort.current?.abort()} className="rounded-lg bg-destructive px-3 text-destructive-foreground" aria-label="إيقاف"><Square className="size-4" /></button>
              ) : (
                <button type="submit" className="rounded-lg bg-primary px-3 text-primary-foreground" aria-label="إرسال"><Send className="size-4" /></button>
              )}
            </form>
          </div>

          <ol className="space-y-1 rounded-2xl border border-border bg-background/40 p-3 text-xs backdrop-blur-xl">
            {steps.length === 0 && <li className="text-muted-foreground">خطوات التنفيذ تظهر هنا</li>}
            {steps.map((s, i) => (
              <li key={i} className="flex justify-between"><span>{s.label}</span>
                <span dir="ltr" className="font-mono text-muted-foreground">+{((s.at - (steps[0]?.at ?? s.at)) / 1000).toFixed(1)}s</span></li>
            ))}
          </ol>
          {talk && <p className="rounded-2xl border border-border bg-background/40 p-3 text-sm backdrop-blur-xl">{talk}</p>}
        </div>

        {/* Glass code + preview */}
        <div className="flex min-h-[520px] flex-col gap-4 [transform-style:preserve-3d]">
          <div
            className="flex min-h-64 flex-1 flex-col overflow-hidden rounded-2xl border border-primary/50 bg-background/30 shadow-[0_0_50px_-12px_var(--color-primary)] backdrop-blur-2xl transition-transform duration-200"
            style={{ transform: `rotateX(${tilt.x * 0.6}deg) rotateY(${tilt.y * -0.6}deg) translateZ(20px)` }}
          >
            <div className="flex items-center gap-2 border-b border-border/50 px-3 py-1.5 text-xs">
              <span className="font-semibold">الكود أثناء الكتابة</span>
              {busy && <span className="size-1.5 animate-pulse rounded-full bg-primary" />}
              <div className="ms-auto flex gap-2">
                <button aria-label="نسخ" title="نسخ" onClick={() => code && navigator.clipboard.writeText(code)}><Copy className="size-3.5" /></button>
                <button aria-label="تنزيل" title="تنزيل" onClick={download} disabled={!code}><Download className="size-3.5" /></button>
                <button aria-label="حفظ في السيرفر" title="حفظ في مشروع السيرفر" onClick={saveServer} disabled={!code}><FolderUp className="size-3.5" /></button>
              </div>
            </div>
            <pre ref={codeRef} dir="ltr" className="max-h-80 min-h-0 flex-1 overflow-auto whitespace-pre-wrap p-3 text-start font-mono text-[12px] leading-5">
              {code || <span className="text-muted-foreground">// الكود يظهر هنا لحظة بلحظة</span>}
            </pre>
          </div>
          <div className="flex-1 overflow-hidden rounded-2xl border border-border bg-background/40 backdrop-blur-xl"
            style={{ transform: `rotateX(${tilt.x * 0.4}deg) rotateY(${tilt.y * 0.4}deg)` }}>
            {html ? (
              <iframe title="معاينة الموقع" srcDoc={html} sandbox="allow-scripts" className="h-full min-h-72 w-full bg-white" />
            ) : (
              <div className="grid h-full min-h-72 place-items-center text-sm text-muted-foreground">المعاينة الفورية</div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
