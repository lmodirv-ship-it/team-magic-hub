import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Menu, Settings, ChevronDown, ChevronLeft, User, Globe, Sparkles, Clock, SquareTerminal, Eye,
  Plus, Mic, Send, X, Trash2, MessageCircle, Folder, Layers, Brain, Languages, Zap, Search, SlidersHorizontal,
} from "lucide-react";
import logoAsset from "@/assets/nawat-main-logo.jpg.asset.json";

export const Route = createFileRoute("/mobile")({
  head: () => ({
    meta: [
      { title: "nawat-chat — تطبيق الهاتف" },
      { name: "description", content: "تطبيق NAWAT للهاتف: دردشة مع نماذج الخادم، بحث الويب، تفكير ممتد، وتوليد الصور عبر ComfyUI." },
      { property: "og:title", content: "nawat-chat — تطبيق الهاتف" },
      { property: "og:description", content: "دردشة عربية مع نماذج NAWAT المحلية من هاتفك." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
    ],
  }),
  component: MobileApp,
});

type Msg = { id: string; role: "user" | "ai"; text: string; time: string; secs?: number; image?: string | undefined };
type Model = { name: string; port?: number };

const KEY = "nawat.mobile.v1";
const DEFAULT_MODELS: Model[] = [
  { name: "nawat-vision", port: 8090 }, { name: "nawat-data", port: 8091 }, { name: "nawat-tools", port: 8092 },
  { name: "nawat-mm", port: 8093 }, { name: "nawat-tri", port: 8094 }, { name: "nawat-think", port: 8095 },
  { name: "nawat-agent", port: 8096 }, { name: "mimo-9b", port: 8097 },
];
const TOOLS = [
  ["calc", "الحاسبة", "عمليات حسابية فورية (2+2، جذر، نسبة…)"],
  ["convert", "التحويلات", "وحدات وعملات (كم←ميل، درهم←دولار…)"],
  ["time", "الوقت والتاريخ", "الساعة، التاريخ الميلادي والهجري، أيام الأسبوع"],
  ["weather", "الطقس", "طقس أي مدينة مباشرة من الشبكة"],
  ["memory", "الذاكرة", "«تذكر أن…» — يحتفظ بما تطلبه ويعيده لك"],
  ["kb", "قاعدة المعرفة", "هوية نواة، النماذج، المصمم، الخصوصية…"],
  ["wiki", "ويكيبيديا", "بحث معرفي مباشر (عربي) دون مرور بالنموذج"],
  ["ddg", "البحث السريع", "إجابة DuckDuckGo المباشرة"],
  ["github", "GitHub", "مستودعات مفتوحة المصدر حسب النجوم"],
  ["image", "توليد الصور", "«ارسم…» يبني وصفًا ويولّد صورة عبر ComfyUI"],
] as const;

type State = {
  bridge: string; comfy: string; model: string; web: boolean; think: boolean; relayToken: string;
  lang: "ar" | "en" | "fr"; localFirst: boolean; tools: Record<string, boolean>; msgs: Msg[];
};
const initial: State = {
  bridge: "http://192.168.100.66:8788", comfy: "http://192.168.2.4:8188", model: "nawat-vision",
  web: true, think: false, lang: "ar", localFirst: true, relayToken: "",
  tools: Object.fromEntries(TOOLS.map(([k]) => [k, true])), msgs: [],
};
const CLOUD_BRIDGE = "https://nawat.groupe-hn.com";
const isCloud = (u: string) => {
  try {
    return new URL(u).origin === CLOUD_BRIDGE;
  } catch {
    return false;
  }
};

// يوحّد الاتصال: محلي مباشرة إلى الجسر، أو سحابي عبر مرحّل الموقع المنشور.
async function bridgeCall(s: State, kind: "chat" | "models" | "health", payload: Record<string, unknown> = {}) {
  if (!isCloud(s.bridge)) {
    const path = kind === "chat" ? "/api/chat" : kind === "models" ? "/api/models" : "/api/health";
    const r = await fetch(s.bridge + path, kind === "chat"
      ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) } : {});
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }
  const base = s.bridge.replace(/\/$/, "") + "/api/public/relay";
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${s.relayToken}` };
  let r = await fetch(`${base}/submit`, { method: "POST", headers, body: JSON.stringify({ kind, payload, wait: 20 }) });
  let d = await r.json();
  for (let i = 0; d.status === "pending" && i < 15; i++) {
    r = await fetch(`${base}/result/${d.id}`, { headers });
    d = await r.json();
  }
  if (d.status !== "done") throw new Error(d.error ?? "لم يرد الخادم المحلي");
  return d.result;
}

const now = () => new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
const uid = () => Math.random().toString(36).slice(2);

function MobileApp() {
  const [s, setS] = useState<State>(initial);
  const [tab, setTab] = useState<"chat" | "files" | "projects" | "models" | "settings">("chat");
  const [sheet, setSheet] = useState<null | "quick" | "models">(null);
  const [models, setModels] = useState<Model[]>(DEFAULT_MODELS);
  const [online, setOnline] = useState<boolean | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { const raw = localStorage.getItem(KEY); if (raw) setS({ ...initial, ...JSON.parse(raw) }); } catch { /* ignore */ }
  }, []);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ } }, [s]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [s.msgs.length, busy]);

  const up = (p: Partial<State>) => setS((o) => ({ ...o, ...p }));

  const ping = async () => {
    try {
      if (isCloud(s.bridge)) {
        const r = await fetch(s.bridge.replace(/\/$/, "") + "/api/public/relay/status");
        const d = await r.json(); setOnline(!!d.agentOnline); return;
      }
      const c = new AbortController(); const t = setTimeout(() => c.abort(), 4000);
      await fetch(`${s.bridge}/api/ping`, { signal: c.signal, mode: "no-cors" });
      clearTimeout(t); setOnline(true);
    } catch { setOnline(false); }
  };
  const loadModels = async () => {
    try {
      const d = await bridgeCall(s, "models");
      const list: Model[] = (Array.isArray(d) ? d : d.models ?? []).map((m: string | Model) => typeof m === "string" ? { name: m } : m);
      if (list.length) setModels(list);
    } catch { /* keep defaults */ }
  };
  useEffect(() => { ping(); loadModels(); const i = setInterval(ping, 15000); return () => clearInterval(i); }, [s.bridge, s.relayToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = async (text = input) => {
    const t = text.trim(); if (!t || busy) return;
    setInput("");
    const userMsg: Msg = { id: uid(), role: "user", text: t, time: now() };
    const history = [...s.msgs, userMsg];
    up({ msgs: history }); setBusy(true);
    const start = performance.now();
    let reply: Msg;
    try {
      const drawing = s.tools["image"] && /^(ارسم|ارسم لي|draw)/i.test(t);
      const d = await bridgeCall(s, "chat", {
          model: s.model, stream: false, web: s.web, think: s.think, image: drawing,
          tools: Object.keys(s.tools).filter((k) => s.tools[k]),
          messages: history.map((m) => ({ role: m.role === "ai" ? "assistant" : "user", content: m.text })),
      });
      const content = d.message?.content ?? d.reply ?? d.response ?? d.text ?? "";
      let image: string | undefined = d.image ?? d.images?.[0];
      if (image && !image.startsWith("http") && !image.startsWith("data:")) image = `data:image/png;base64,${image}`;
      reply = { id: uid(), role: "ai", text: content || (image ? "" : "…"), image, time: now(), secs: (performance.now() - start) / 1000 };
    } catch {
      reply = { id: uid(), role: "ai", time: now(), text: `تعذّر الوصول إلى الجسر ${s.bridge}. تأكد أن هاتفك على نفس شبكة الخادم.` };
    }
    setS((o) => ({ ...o, msgs: [...o.msgs, reply] }));
    setBusy(false);
  };

  const Logo = ({ size = 44 }: { size?: number }) => (
    <img src={logoAsset.url} alt="شعار نواة" width={size} height={size} className="rounded-full object-cover" style={{ width: size, height: size }} />
  );
  const Toggle = ({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) => (
    <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      className="relative h-7 w-12 shrink-0 rounded-full transition-colors"
      style={{ background: on ? "var(--m-accent)" : "var(--m-line)" }}>
      <span className="absolute top-0.5 h-6 w-6 rounded-full bg-[var(--m-text)] transition-all" style={{ insetInlineStart: on ? 2 : 22 }} />
    </button>
  );
  const Chip = ({ on, icon: I, label, onClick }: { on?: boolean; icon: typeof Globe; label: string; onClick: () => void }) => (
    <button onClick={onClick} className="flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm"
      style={{ background: on ? "var(--m-accent)" : "var(--m-card)", color: on ? "var(--m-accent-fg)" : "var(--m-text)", borderColor: "var(--m-line)" }}>
      <I className="h-4 w-4" />{label}
    </button>
  );

  return (
    <div className="nawat-mobile flex min-h-[100dvh] justify-center">
      <div className="relative flex h-[100dvh] w-full max-w-md flex-col overflow-hidden">
        {tab === "chat" && (
          <>
            <header className="flex items-center gap-2 border-b px-3 py-2" style={{ borderColor: "var(--m-line)" }}>
              <button aria-label="القائمة" className="grid h-11 w-11 place-items-center rounded-2xl border" style={{ borderColor: "var(--m-line)", background: "var(--m-card)" }}><Menu className="h-5 w-5" /></button>
              <Logo />
              <div className="min-w-0 leading-tight">
                <div className="text-base font-bold" style={{ color: "var(--m-accent)" }}>nawat-chat</div>
                <div className="text-[10px]" style={{ color: "var(--m-muted)" }}>نواة الذكاء للمجموعة</div>
              </div>
              <div className="flex items-center gap-1 rounded-xl border px-2 py-1 text-[11px]" style={{ borderColor: online ? "var(--m-ok)" : "var(--m-danger)", color: online ? "var(--m-ok)" : "var(--m-danger)" }}>
                <span className="h-2 w-2 rounded-full" style={{ background: online ? "var(--m-ok)" : "var(--m-danger)" }} />
                {online === null ? "…" : online ? "متصل" : "غير متصل"}
              </div>
              <button onClick={() => setSheet("models")} className="ms-auto flex items-center gap-1 rounded-2xl border px-3 py-2 text-sm font-semibold" style={{ borderColor: "var(--m-line)", background: "var(--m-card)" }}>
                {s.model}<ChevronDown className="h-4 w-4" />
              </button>
              <button aria-label="إعدادات سريعة" onClick={() => setSheet("quick")} className="grid h-11 w-11 place-items-center rounded-2xl border" style={{ borderColor: "var(--m-line)", background: "var(--m-card)" }}><Settings className="h-5 w-5" /></button>
            </header>

            <main className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
              {s.msgs.length === 0 && (
                <div className="mt-16 flex flex-col items-center gap-3 text-center">
                  <Logo size={84} />
                  <p className="text-lg font-semibold">مرحبًا! كيف يمكنني مساعدتك اليوم؟</p>
                  <p className="text-sm" style={{ color: "var(--m-muted)" }}>جرّب: «ارسم لي وردة» أو «أشهر 10 مواقع عالمية»</p>
                </div>
              )}
              {s.msgs.map((m) => m.role === "user" ? (
                <div key={m.id} className="flex items-start gap-2">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full" style={{ background: "var(--m-user)" }}><User className="h-6 w-6" /></div>
                  <div className="max-w-[75%] rounded-2xl px-4 py-3" style={{ background: "var(--m-user)" }}>
                    <p className="whitespace-pre-wrap">{m.text}</p>
                    <p className="mt-1 text-xs opacity-75">{m.time} ✓✓</p>
                  </div>
                </div>
              ) : (
                <div key={m.id} className="space-y-2">
                  <div className="flex flex-row-reverse items-center justify-end gap-2">
                    <span className="text-xs" style={{ color: "var(--m-muted)" }}>{m.secs ? `${m.secs.toFixed(1)}s  ` : ""}{m.time}</span>
                    <span className="rounded-md px-1.5 text-xs font-bold" style={{ background: "var(--m-accent)", color: "var(--m-accent-fg)" }}>AI</span>
                    <span className="font-bold">nawat-chat</span>
                    <Logo size={40} />
                  </div>
                  <div className="ms-12 rounded-2xl border px-4 py-3" style={{ background: "var(--m-card)", borderColor: "var(--m-line)" }}>
                    {m.text && <p className="whitespace-pre-wrap leading-7">{m.text}</p>}
                    {m.image && <img src={m.image} alt="صورة مولّدة" className="mt-3 w-full rounded-lg" />}
                  </div>
                  {m.image && (
                    <div className="ms-12 flex gap-2">
                      {["🔍 ×1.5", "🔍 ×2", "🎨 حوّر"].map((l) => (
                        <button key={l} onClick={() => send(`${l.includes("حوّر") ? "حوّر الصورة" : `كبّر الصورة ${l.replace("🔍 ", "")}`}`)}
                          className="rounded-full border px-3 py-1.5 text-sm" style={{ borderColor: "var(--m-line)", background: "var(--m-card)" }}>{l}</button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {busy && <p className="ms-12 animate-pulse text-sm" style={{ color: "var(--m-muted)" }}>{s.think ? "يفكّر خطوة بخطوة…" : "يكتب…"}</p>}
              <div ref={endRef} />
            </main>

            <div className="flex gap-2 overflow-x-auto border-t px-3 py-2" style={{ borderColor: "var(--m-line)" }}>
              <Chip on={s.web} icon={Globe} label="بحث · ويب" onClick={() => up({ web: !s.web })} />
              <Chip on={s.think} icon={Sparkles} label="تفكير" onClick={() => up({ think: !s.think })} />
              <Chip icon={Clock} label="السجل" onClick={() => setTab("files")} />
              <Chip icon={SquareTerminal} label="أمر" onClick={() => setInput("/")} />
              <Chip icon={Eye} label="رؤية" onClick={() => up({ model: "nawat-vision" })} />
            </div>
            <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex items-center gap-2 px-3 pb-3 pt-1">
              <button type="button" aria-label="إرفاق" className="grid h-12 w-12 place-items-center rounded-2xl border" style={{ borderColor: "var(--m-line)", background: "var(--m-card)" }}><Plus className="h-5 w-5" /></button>
              <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="اكتب رسالتك هنا…"
                className="h-12 min-w-0 flex-1 rounded-2xl border px-4 outline-none" style={{ borderColor: "var(--m-line)", background: "var(--m-card)", color: "var(--m-text)" }} />
              <button type="button" aria-label="إدخال صوتي" className="grid h-12 w-12 place-items-center rounded-2xl border" style={{ borderColor: "var(--m-line)", background: "var(--m-card)" }}><Mic className="h-5 w-5" /></button>
              <button type="submit" aria-label="إرسال" disabled={busy} className="grid h-12 w-14 place-items-center rounded-2xl disabled:opacity-50" style={{ background: "var(--m-user)" }}><Send className="h-5 w-5 -scale-x-100" /></button>
            </form>
          </>
        )}

        {tab === "settings" && (
          <main className="flex-1 space-y-4 overflow-y-auto p-4">
            <div className="flex items-center justify-end gap-3"><h1 className="text-2xl font-bold">الإعدادات</h1><Logo size={56} /></div>
            <Card icon={Languages} title="اللغة">
              <div className="grid grid-cols-3 gap-2">
                {([["ar", "العربية", "من اليمين"], ["en", "English", "من اليسار"], ["fr", "Français", "من اليسار"]] as const).map(([k, l, d]) => (
                  <button key={k} onClick={() => up({ lang: k })} className="rounded-2xl border p-3"
                    style={{ background: s.lang === k ? "var(--m-accent)" : "var(--m-bg)", color: s.lang === k ? "var(--m-accent-fg)" : "var(--m-text)", borderColor: "var(--m-line)" }}>
                    <div className="font-bold">{l}</div><div className="text-xs opacity-75">{d}</div>
                  </button>
                ))}
              </div>
            </Card>
            <Card icon={Zap} title="المحرك (أجوبة محلية فورية)">
              <Row title="المحرك المحلي أولاً" desc="يجيب فورًا على الهاتف ويرفع للموديل فقط الأسئلة الصعبة."><Toggle label="المحرك المحلي" on={s.localFirst} onChange={(v) => up({ localFirst: v })} /></Row>
              <Row title="البحث المفعّل" desc="الوضع الحالي: ويب"><Toggle label="البحث" on={s.web} onChange={(v) => up({ web: v })} /></Row>
            </Card>
            <Card icon={Search} title="الاتصال">
              <label className="block text-sm">الجسر (نماذج الخادم)
                <input value={s.bridge} onChange={(e) => up({ bridge: e.target.value })} dir="ltr" className="mt-1 h-10 w-full rounded-xl border px-3" style={{ borderColor: "var(--m-line)", background: "var(--m-bg)", color: "var(--m-text)" }} />
              </label>
              <div className="flex gap-2 text-xs">
                <button onClick={() => up({ bridge: "http://192.168.100.66:8788" })} className="rounded-lg border px-2 py-1" style={{ borderColor: "var(--m-line)" }}>محلي</button>
                <button onClick={() => up({ bridge: CLOUD_BRIDGE })} className="rounded-lg border px-2 py-1" style={{ borderColor: "var(--m-line)" }}>سحابي (من أي مكان)</button>
              </div>
              {isCloud(s.bridge) && (
                <label className="block text-sm">كلمة سر الجسر السحابي
                  <input type="password" value={s.relayToken} onChange={(e) => up({ relayToken: e.target.value })} dir="ltr" className="mt-1 h-10 w-full rounded-xl border px-3" style={{ borderColor: "var(--m-line)", background: "var(--m-bg)", color: "var(--m-text)" }} />
                </label>
              )}
              <label className="block text-sm">مولّد الصور ComfyUI
                <input value={s.comfy} onChange={(e) => up({ comfy: e.target.value })} dir="ltr" className="mt-1 h-10 w-full rounded-xl border px-3" style={{ borderColor: "var(--m-line)", background: "var(--m-bg)", color: "var(--m-text)" }} />
              </label>
            </Card>
            <Card icon={SlidersHorizontal} title="الأدوات">
              {TOOLS.map(([k, t, d]) => (
                <Row key={k} title={t} desc={d}><Toggle label={t} on={!!s.tools[k]} onChange={(v) => up({ tools: { ...s.tools, [k]: v } })} /></Row>
              ))}
            </Card>
          </main>
        )}

        {(tab === "files" || tab === "projects") && (
          <main className="flex-1 space-y-3 overflow-y-auto p-4">
            <h1 className="text-2xl font-bold">{tab === "files" ? "السجل والملفات" : "المشاريع"}</h1>
            {tab === "files" && s.msgs.filter((m) => m.role === "user").length === 0 && <p style={{ color: "var(--m-muted)" }}>لا توجد رسائل بعد.</p>}
            {tab === "files" && s.msgs.filter((m) => m.role === "user").map((m) => (
              <button key={m.id} onClick={() => setTab("chat")} className="block w-full rounded-2xl border p-3 text-start" style={{ borderColor: "var(--m-line)", background: "var(--m-card)" }}>
                <div>{m.text}</div><div className="text-xs" style={{ color: "var(--m-muted)" }}>{m.time}</div>
              </button>
            ))}
            {tab === "projects" && <p style={{ color: "var(--m-muted)" }}>المشاريع تُعرض هنا عند ربطها بالخادم.</p>}
          </main>
        )}

        {tab === "models" && (
          <main className="flex-1 overflow-y-auto p-4">
            <h1 className="mb-3 text-2xl font-bold">النماذج</h1>
            <ModelList models={models} current={s.model} q={q} setQ={setQ} onPick={(n) => { up({ model: n }); setTab("chat"); }} />
          </main>
        )}

        <nav className="grid grid-cols-5 border-t py-2 text-[11px]" style={{ borderColor: "var(--m-line)", background: "var(--m-card)" }}>
          {([["chat", MessageCircle, "محادثة"], ["files", Folder, "ملفات"], ["projects", Layers, "مشاريع"], ["models", Brain, "النماذج"], ["settings", Settings, "الإعدادات"]] as const).map(([k, I, l]) => (
            <button key={k} onClick={() => setTab(k)} className="flex flex-col items-center gap-1" style={{ color: tab === k ? "var(--m-accent)" : "var(--m-muted)" }}>
              <I className="h-5 w-5" />{l}
            </button>
          ))}
        </nav>

        {sheet && <div className="absolute inset-0 z-10 bg-[var(--m-bg)]/70" onClick={() => setSheet(null)} />}
        {sheet === "quick" && (
          <div className="absolute inset-x-3 bottom-3 z-20 rounded-3xl border p-5" style={{ background: "var(--m-card)", borderColor: "var(--m-line)" }}>
            <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold">إعدادات سريعة</h2><button aria-label="إغلاق" onClick={() => setSheet(null)}><X className="h-5 w-5" /></button></div>
            <Row title="بحث الويب" desc="نتائج بحث حديثة تُحقن في السياق"><Toggle label="بحث الويب" on={s.web} onChange={(v) => up({ web: v })} /></Row>
            <Row title="تفكير ممتد" desc="خطوة بخطوة قبل الإجابة النهائية"><Toggle label="تفكير ممتد" on={s.think} onChange={(v) => up({ think: v })} /></Row>
            <button className="w-full" onClick={() => setSheet("models")}>
              <Row title="النموذج" desc="اختيار نموذج المحادثة"><span className="flex items-center gap-1 font-semibold" style={{ color: "var(--m-accent)" }}><ChevronLeft className="h-4 w-4" />{s.model}</span></Row>
            </button>
            <button className="w-full" onClick={() => { up({ msgs: [] }); setSheet(null); }}>
              <Row title={<span style={{ color: "var(--m-danger)" }}>مسح المحادثة</span>} desc="حذف كل الرسائل"><Trash2 className="h-5 w-5" style={{ color: "var(--m-danger)" }} /></Row>
            </button>
            <p className="mt-3 border-t pt-3 text-xs" style={{ borderColor: "var(--m-line)", color: "var(--m-muted)" }}>الجسر: <span dir="ltr">{s.bridge}</span><br />تصميم مجموعة أنس — مولاي إسماعيل الحسني</p>
          </div>
        )}
        {sheet === "models" && (
          <div className="absolute inset-x-0 bottom-0 z-20 flex max-h-[80%] flex-col rounded-t-3xl border p-4" style={{ background: "var(--m-card)", borderColor: "var(--m-line)" }}>
            <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold">اختر النموذج</h2><button aria-label="إغلاق" onClick={() => setSheet(null)}><X className="h-5 w-5" /></button></div>
            <div className="min-h-0 flex-1 overflow-y-auto"><ModelList models={models} current={s.model} q={q} setQ={setQ} onPick={(n) => { up({ model: n }); setSheet(null); }} /></div>
            <button onClick={loadModels} className="mt-3 h-11 rounded-full border text-sm" style={{ borderColor: "var(--m-line)", color: "var(--m-accent)" }}>تحديث القائمة</button>
          </div>
        )}
      </div>
    </div>
  );
}

function Card({ icon: I, title, children }: { icon: typeof Globe; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-3xl border p-4" style={{ background: "var(--m-card)", borderColor: "var(--m-line)" }}>
      <h2 className="flex items-center gap-2 text-lg font-bold"><I className="h-5 w-5" style={{ color: "var(--m-accent)" }} />{title}</h2>
      {children}
    </section>
  );
}
function Row({ title, desc, children }: { title: React.ReactNode; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 text-start">
      <div><div className="font-bold">{title}</div><div className="text-sm" style={{ color: "var(--m-muted)" }}>{desc}</div></div>
      {children}
    </div>
  );
}
function ModelList({ models, current, q, setQ, onPick }: { models: Model[]; current: string; q: string; setQ: (v: string) => void; onPick: (n: string) => void }) {
  return (
    <>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث…" className="mb-2 h-12 w-full rounded-2xl border px-4" style={{ borderColor: "var(--m-line)", background: "var(--m-bg)", color: "var(--m-text)" }} />
      {models.filter((m) => m.name.toLowerCase().includes(q.toLowerCase())).map((m) => (
        <button key={m.name} onClick={() => onPick(m.name)} className="block w-full border-b px-3 py-3 text-start" style={{ borderColor: "var(--m-line)", background: m.name === current ? "var(--m-line)" : "transparent" }}>
          <div className="text-lg">{m.name}</div>{m.port && <div className="text-sm" style={{ color: "var(--m-muted)" }}>:{m.port}</div>}
        </button>
      ))}
    </>
  );
}
