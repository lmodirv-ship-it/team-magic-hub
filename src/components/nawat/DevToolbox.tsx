import { useState } from "react";
import { discoverLocalModels, DEFAULT_LOCAL_HOSTS } from "@/lib/nawat/local-discovery";

type Tool = { id: string; title: string; run: (input: string) => string | Promise<string> };

const b64e = (s: string) => btoa(unescape(encodeURIComponent(s)));
const b64d = (s: string) => decodeURIComponent(escape(atob(s.trim())));

export const DEV_TOOLS: Tool[] = [
  { id: "json", title: "تنسيق JSON", run: (s) => JSON.stringify(JSON.parse(s), null, 2) },
  { id: "jsonmin", title: "ضغط JSON", run: (s) => JSON.stringify(JSON.parse(s)) },
  { id: "b64e", title: "ترميز Base64", run: b64e },
  { id: "b64d", title: "فك Base64", run: b64d },
  { id: "urle", title: "ترميز رابط URL", run: (s) => encodeURIComponent(s) },
  { id: "urld", title: "فك رابط URL", run: (s) => decodeURIComponent(s) },
  { id: "jwt", title: "قراءة JWT", run: (s) => s.split(".").slice(0, 2).map((p) => JSON.stringify(JSON.parse(b64d(p.replace(/-/g, "+").replace(/_/g, "/"))), null, 2)).join("\n\n") },
  { id: "sha", title: "بصمة SHA-256", run: async (s) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, "0")).join("") },
  { id: "uuid", title: "توليد UUID", run: () => Array.from({ length: 5 }, () => crypto.randomUUID()).join("\n") },
  { id: "pass", title: "كلمة سر قوية", run: () => [...crypto.getRandomValues(new Uint8Array(20))].map((b) => "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%"[b % 61]).join("") },
  { id: "slug", title: "رابط مختصر (slug)", run: (s) => s.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") },
  { id: "case", title: "أحرف كبيرة / صغيرة", run: (s) => `${s.toUpperCase()}\n${s.toLowerCase()}` },
  { id: "count", title: "عدّ الكلمات والأسطر", run: (s) => `أحرف: ${s.length}\nكلمات: ${s.trim() ? s.trim().split(/\s+/).length : 0}\nأسطر: ${s.split("\n").length}` },
  { id: "time", title: "تحويل الوقت (Unix)", run: (s) => { const n = Number(s.trim()); const d = s.trim() ? new Date(n < 1e12 ? n * 1000 : n) : new Date(); return `${d.toISOString()}\nUnix: ${Math.floor(d.getTime() / 1000)}`; } },
  { id: "esc", title: "ترميز HTML", run: (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;") },
  { id: "css", title: "ضغط CSS", run: (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ").replace(/\s*([{};:,])\s*/g, "$1").trim() },
  { id: "sort", title: "ترتيب الأسطر وحذف المكرر", run: (s) => [...new Set(s.split("\n"))].sort().join("\n") },
  { id: "color", title: "تحويل لون HEX إلى RGB", run: (s) => { const h = s.trim().replace("#", ""); const n = parseInt(h.length === 3 ? [...h].map((c) => c + c).join("") : h, 16); return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`; } },
  { id: "regex", title: "اختبار تعبير نمطي (سطر1 = النمط)", run: (s) => { const [p = "", ...rest] = s.split("\n"); return (rest.join("\n").match(new RegExp(p, "g")) ?? []).join("\n") || "لا تطابق"; } },
  { id: "models", title: "اكتشاف النماذج المحلية الآن", run: async () => { const m = await discoverLocalModels(); return `فُحص: ${DEFAULT_LOCAL_HOSTS.join("، ")}\nالنماذج المكتشفة: ${m.length}\n${m.map((x) => `${x.name}  ←  ${x.host}`).join("\n")}`; } },
];

export function DevToolbox() {
  const [tool, setTool] = useState(DEV_TOOLS[0]!.id);
  const [input, setInput] = useState("");
  const [out, setOut] = useState("");
  const current = DEV_TOOLS.find((t) => t.id === tool)!;
  const run = async () => {
    try { setOut(await current.run(input)); } catch (e) { setOut(`تحقّق من المدخل: ${(e as Error).message}`); }
  };
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-1 text-sm font-semibold">صندوق الأدوات — 20 أداة للمبرمج</h2>
      <p className="mb-3 text-xs text-muted-foreground">كلها تعمل داخل جهازك دون إنترنت.</p>
      <div className="mb-3 flex flex-wrap gap-1">
        {DEV_TOOLS.map((t) => (
          <button key={t.id} onClick={() => { setTool(t.id); setOut(""); }}
            className={`rounded px-2 py-1 text-[11px] ${tool === t.id ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:text-foreground"}`}>
            {t.title}
          </button>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={8} dir="ltr" aria-label="المدخل"
          className="w-full rounded-md border border-border bg-background p-2 font-mono text-xs" placeholder="المدخل…" />
        <pre dir="ltr" className="max-h-60 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-background p-2 font-mono text-xs">{out || "النتيجة تظهر هنا"}</pre>
      </div>
      <div className="mt-2 flex gap-2">
        <button onClick={() => void run()} className="rounded bg-primary px-3 py-1.5 text-xs text-primary-foreground">تشغيل: {current.title}</button>
        <button onClick={() => void navigator.clipboard?.writeText(out)} className="rounded border border-border px-3 py-1.5 text-xs">نسخ النتيجة</button>
      </div>
    </section>
  );
}
