import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Copy, Download, FolderUp, Mic, MicOff, RefreshCw, Send, Square, Volume2, VolumeX, Zap } from "lucide-react";
import { toast } from "sonner";
import type { ChatMessage } from "@/lib/nawat/bridge";
import { modelChatStream } from "@/lib/nawat/providers";
import { useModels } from "@/lib/nawat/useModels";
import { useVoiceInput, useVoiceReply } from "@/lib/nawat/voice";
import { extractCode } from "@/components/nawat/LiveCodeStream";
import { getActiveProject, writeProjectFile } from "@/lib/nawat/projects";
import { Resizer } from "@/components/nawat/Resizer";

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
const DEFAULT_MODEL = "nawat-coder:latest";
const ORCH_SYSTEM =
  "أنت المنسق في NAWAT. لا تكتب كودًا. قسّم طلب المستخدم إلى خطوات تنفيذ قصيرة مرقمة (5 كحد أقصى) للنموذج المتخصص في الكود: البنية، الأقسام، الألوان، التفاعل. أجب بالعربية باختصار.";

function SpeedBuild() {
  const { models, refresh } = useModels();
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
      if (s.model && s.model !== "nawat-cloud") setModel(s.model);
      if (s.out) setOut(s.out);
      if (s.history) setHistory(s.history);
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    if (!model) setModel(DEFAULT_MODEL);
  }, [model, models]);
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify({ model, out, history: history.slice(-12) })); } catch { /* ignore */ }
  }, [model, out, history]);
  const [orch, setOrch] = useState("");
  const [orchOut, setOrchOut] = useState("");
  useEffect(() => { try { setOrch(localStorage.getItem(KEY + ".orch") ?? ""); } catch { /* ignore */ } }, []);
  useEffect(() => { try { localStorage.setItem(KEY + ".orch", orch); } catch { /* ignore */ } }, [orch]);
  useEffect(() => { codeRef.current?.scrollTo({ top: codeRef.current.scrollHeight }); }, [out]);
  const [layout, setLayout] = useState({ w: 420, h: 520 });
  useEffect(() => {
    try { const l = JSON.parse(localStorage.getItem(KEY + ".layout") ?? "null"); if (l?.w && l?.h) setLayout(l); } catch { /* ignore */ }
  }, []);
  useEffect(() => { try { localStorage.setItem(KEY + ".layout", JSON.stringify(layout)); } catch { /* ignore */ } }, [layout]);
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
    const signal = abort.current.signal;
    setOrchOut("");
    try {
      if (orch) {
        step(`🧭 المنسق ${orch} يخطط…`);
        let plan = "";
        const pm: ChatMessage[] = [{ role: "system", content: ORCH_SYSTEM }, { role: "user", content: text }];
        for await (const c of modelChatStream(orch, pm, signal)) { plan += c; setOrchOut(plan); }
        step("🧭 خطة المنسق جاهزة");
        msgs[msgs.length - 1] = { role: "user", content: `${text}\n\nخطة المنسق:\n${plan.slice(0, 3000)}` };
      }
      step(`● ${model} يكتب…`);
      for await (const c of modelChatStream(model, msgs, signal)) {
        acc += c;
        setOut(acc);
        const secs = Math.max(0.1, (Date.now() - t0) / 1000);
        setStats({ tps: Math.round(acc.length / 4 / secs), secs });
        window.dispatchEvent(new CustomEvent("nawat:stream", { detail: { text: acc, model, started: t0, done: false } }));
        if (!spoke && acc.includes("```")) {
          spoke = true;
          const say = acc.split("```")[0]?.trim();
          if (say && voice.enabled) voice.speak(say);
          step("◆ توليد الكود");
        }
      }
      window.dispatchEvent(new CustomEvent("nawat:stream", { detail: { text: acc, model, started: t0, done: true } }));
      if (!spoke && voice.enabled) voice.speak(acc.slice(0, 400));
      setHistory((h) => [...h, { role: "user", content: text }, { role: "assistant", content: acc.slice(0, 4000) }]);
      step("✔ جاهز — المعاينة محدثة");
      if (voice.enabled && spoke) voice.speak("انتهيت، المعاينة جاهزة.");
    } catch (e) {
      step(`✖ ${(e as Error).message}`);
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
          {models.map((m) => <option key={m.name} value={m.name}>{m.name}</option>)}
        </select>
        <button onClick={() => void refresh()} aria-label="تحديث النماذج" title="تحديث قائمة النماذج" className="rounded-md border border-border bg-background/60 p-1.5"><RefreshCw className="size-3.5" /></button>
        <span dir="ltr" className="rounded-md border border-primary/40 bg-primary/10 px-2 py-1 font-mono text-[11px] text-primary">
          {stats.tps} tok/s · {stats.secs.toFixed(1)}s
        </span>
      </header>

      <section
        className="relative z-10 flex flex-1 flex-col gap-4 p-4 lg:flex-row lg:gap-1 [perspective:1400px]"
        style={{ ["--sbw" as string]: `${layout.w}px`, ["--sbh" as string]: `${layout.h}px` }}
      >
        {/* Voice + steps */}
        <div className="flex shrink-0 flex-col gap-4 lg:w-[var(--sbw)]">
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

        <div className="hidden lg:flex">
          <Resizer axis="x" target="before" label="تغيير عرض لوحة الأوامر" min={260} max={900} onResize={(w) => setLayout((l) => ({ ...l, w }))} />
        </div>

        {/* Glass code + preview */}
        <div className="flex min-h-[520px] min-w-0 flex-1 flex-col gap-1 [transform-style:preserve-3d]">
          <div
            className="flex min-h-64 flex-col overflow-hidden rounded-2xl border border-primary/50 bg-background/30 shadow-[0_0_50px_-12px_var(--color-primary)] backdrop-blur-2xl transition-transform duration-200 lg:h-[var(--sbh)] lg:shrink-0"
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
            <pre ref={codeRef} dir="ltr" className="min-h-[50vh] flex-1 overflow-auto whitespace-pre-wrap p-3 text-start font-mono text-[12px] leading-5 lg:min-h-0">
              {code || <span className="text-muted-foreground">// الكود يظهر هنا لحظة بلحظة</span>}
            </pre>
          </div>
          <Resizer axis="y" target="before" label="تغيير ارتفاع شاشة الكود" min={160} max={1400} onResize={(h) => setLayout((l) => ({ ...l, h }))} />
          <div className="mt-3 flex-1 overflow-hidden rounded-2xl border border-border bg-background/40 backdrop-blur-xl"
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
