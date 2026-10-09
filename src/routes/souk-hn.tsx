import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { EMBEDDED_MODELS } from "@/lib/nawat/embedded-models";
import { modelChatStream } from "@/lib/nawat/providers";
import {
  configBridgeUrl,
  restoreFromServer,
  saveToServer,
  setConfigBridgeUrl,
} from "@/lib/nawat/server-config-sync";

export const Route = createFileRoute("/souk-hn")({
  head: () => ({
    meta: [
      { title: "SOUK-HN — عائلات النماذج المحلية | NAWAT" },
      { name: "description", content: "تصفح نماذجك المحلية في خمس عائلات، افحصها بنقرة وعيّن الافتراضي لكل بيئة." },
      { property: "og:title", content: "SOUK-HN — عائلات النماذج المحلية" },
      { property: "og:description", content: "فحص النماذج المحلية بنقرة وتعيين الافتراضي وحفظ الإعدادات على السيرفر." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  staticData: { sitemap: true },
  component: SoukHn,
});

const FAMILIES = [
  { id: "think", label: "🧠 التفكير والتخطيط", test: /think|qwen3|nemotron|orion|max/i },
  { id: "code", label: "💻 البرمجة", test: /code|coder|gold|build|flash/i },
  { id: "agent", label: "🤖 الوكلاء والأوامر", test: /agent|shell|tools|data|mm/i },
  { id: "special", label: "🎯 المتخصصة", test: /phone|vps|darija|business|study|chat|mini|embed/i },
  { id: "vision", label: "👁️ الرؤية", test: /vl|vision|minicpm|gemma/i },
] as const;
type Fam = (typeof FAMILIES)[number]["id"];

function familyOf(name: string): Fam {
  const order: Fam[] = ["vision", "code", "think", "agent", "special"];
  for (const id of order) if (FAMILIES.find((f) => f.id === id)!.test.test(name)) return id;
  return "special";
}

const ENVS = ["الدردشة", "البرمجة", "Speed Build", "التخطيط", "الطرفية"];
const DEF_KEY = "nawat.soukhn.defaults";
type Test = { ok: boolean; ms: number; note: string };

function SoukHn() {
  const [q, setQ] = useState("");
  const [tests, setTests] = useState<Record<string, Test | "run">>({});
  const [defs, setDefs] = useState<Record<string, string>>({});
  const [bridge, setBridge] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    setDefs(JSON.parse(localStorage.getItem(DEF_KEY) || "{}"));
    setBridge(configBridgeUrl());
  }, []);

  const grouped = useMemo(() => {
    const g: Record<Fam, string[]> = { think: [], code: [], agent: [], special: [], vision: [] };
    EMBEDDED_MODELS.filter((m) => m.name.toLowerCase().includes(q.toLowerCase())).forEach((m) =>
      g[familyOf(m.name)].push(m.name),
    );
    return g;
  }, [q]);

  const test = async (model: string) => {
    setTests((t) => ({ ...t, [model]: "run" }));
    const t0 = performance.now();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 60_000);
    let out = "";
    try {
      for await (const c of modelChatStream(model, [{ role: "user", content: "قل: مرحبا" }], ctrl.signal)) {
        out += c;
        if (out.length > 40) break;
      }
      setTests((t) => ({ ...t, [model]: { ok: !!out, ms: Math.round(performance.now() - t0), note: out.slice(0, 40) } }));
    } catch (e) {
      setTests((t) => ({ ...t, [model]: { ok: false, ms: Math.round(performance.now() - t0), note: String((e as Error).message).slice(0, 60) } }));
    } finally {
      clearTimeout(timer);
    }
  };

  const setDef = (env: string, model: string) => {
    const next = { ...defs, [env]: model };
    setDefs(next);
    localStorage.setItem(DEF_KEY, JSON.stringify(next));
  };

  const doSave = async () => {
    setConfigBridgeUrl(bridge);
    try { setMsg(`✅ حُفظت على السيرفر ${await saveToServer()}`); } catch { setMsg("⏸ السيرفر غير متاح الآن — الإعدادات محفوظة على هذا الجهاز."); }
  };
  const doRestore = async () => {
    setConfigBridgeUrl(bridge);
    try { setMsg(`✅ استُرجع ${await restoreFromServer()} إعدادًا ناقصًا (دون حذف أي شيء)`); setDefs(JSON.parse(localStorage.getItem(DEF_KEY) || "{}")); } catch { setMsg("⏸ السيرفر غير متاح الآن."); }
  };

  return (
    <main dir="rtl" className="min-w-0 flex-1 overflow-auto p-6">
      <h1 className="text-xl font-semibold">SOUK-HN — نماذجك المحلية</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        {EMBEDDED_MODELS.length} نموذجًا في خمس عائلات. افحص أي نموذج بنقرة، وللمقارنة على نفس المهمة استعمل{" "}
        <Link to="/tasks" className="text-nawat underline">مختبر المهام</Link>.
      </p>

      <section className="mb-5 rounded-lg border border-border bg-card p-4">
        <h2 className="mb-2 font-medium">الحفظ المزدوج (الجهاز + السيرفر)</h2>
        <div className="flex flex-wrap items-center gap-2">
          <input value={bridge} onChange={(e) => setBridge(e.target.value)} className="w-72 rounded-md border border-border bg-background px-2 py-1 text-sm" dir="ltr" />
          <button onClick={doSave} className="rounded-md bg-primary px-3 py-1 text-sm text-primary-foreground">💾 حفظ على السيرفر</button>
          <button onClick={doRestore} className="rounded-md border border-border px-3 py-1 text-sm">⤵️ استرجاع من السيرفر</button>
          <span className="text-xs text-muted-foreground">{msg}</span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">يُحفظ في /data/nawat-config.json — المفاتيح وكلمات السر لا تُرسل أبدًا.</p>
      </section>

      <section className="mb-5 rounded-lg border border-border bg-card p-4">
        <h2 className="mb-2 font-medium">النموذج الافتراضي لكل بيئة</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {ENVS.map((env) => (
            <label key={env} className="flex items-center gap-2 text-sm">
              <span className="w-24 shrink-0">{env}</span>
              <select value={defs[env] ?? ""} onChange={(e) => setDef(env, e.target.value)} className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1" dir="ltr">
                <option value="">—</option>
                {EMBEDDED_MODELS.map((m) => <option key={m.name}>{m.name}</option>)}
              </select>
            </label>
          ))}
        </div>
      </section>

      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث عن نموذج…" className="mb-4 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />

      <div className="grid gap-4 lg:grid-cols-2">
        {FAMILIES.map((f) => (
          <section key={f.id} className="rounded-lg border border-border bg-card p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-medium">{f.label} ({grouped[f.id].length})</h2>
              <button onClick={() => grouped[f.id].forEach((m) => void test(m))} className="rounded-md border border-border px-2 py-0.5 text-xs">فحص العائلة</button>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {grouped[f.id].map((m) => {
                  const t = tests[m];
                  return (
                    <tr key={m} className="border-t border-border">
                      <td className="py-1 font-mono text-xs" dir="ltr">{m}</td>
                      <td className="py-1 text-xs">
                        {t === "run" ? "⏳" : t ? `${t.ok ? "✅" : "⚠️"} ${t.ms}ms` : ""}
                        {t && t !== "run" && <div className="max-w-48 truncate text-muted-foreground">{t.note}</div>}
                      </td>
                      <td className="py-1 text-left">
                        <button onClick={() => void test(m)} className="rounded border border-border px-2 text-xs">فحص</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        ))}
      </div>
    </main>
  );
}
