import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Copy, KeyRound, PlugZap, Trash2, Activity, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { PageHead } from "@/components/nawat/StudioViews";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  clearUsage,
  createKey,
  deleteKey,
  setActiveKey,
  setupGroupeHnProvider,
  updateKey,
  usedThisMonth,
  useApiKeys,
} from "@/lib/nawat/api-keys";

export const Route = createFileRoute("/api-keys")({
  staticData: { sitemap: false },
  head: PageHead("مفاتيح API والاستهلاك", "إدارة مفاتيح Groupe-HN وتتبع استهلاك نماذج نواة في NAWAT Studio."),
  component: ApiKeysPage,
});

const fmt = (n: number) => n.toLocaleString("ar-MA");
const mask = (k: string) => k.slice(0, 8) + "••••••••" + k.slice(-4);

function ApiKeysPage() {
  const { keys, usage, active, ready } = useApiKeys();
  const [name, setName] = useState("");
  const [limit, setLimit] = useState("");

  const byModel = useMemo(() => {
    const m = new Map<string, { calls: number; prompt: number; output: number; ms: number }>();
    for (const u of usage) {
      const r = m.get(u.model) ?? { calls: 0, prompt: 0, output: 0, ms: 0 };
      r.calls++;
      r.prompt += u.promptTokens;
      r.output += u.outputTokens;
      r.ms += u.ms;
      m.set(u.model, r);
    }
    return [...m.entries()].sort((a, b) => b[1].prompt + b[1].output - (a[1].prompt + a[1].output));
  }, [usage]);

  const total = usage.reduce((s, u) => s + u.promptTokens + u.outputTokens, 0);
  const today = new Date().toISOString().slice(0, 10);
  const todayTokens = usage.filter((u) => u.at.startsWith(today)).reduce((s, u) => s + u.promptTokens + u.outputTokens, 0);
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(Date.now() - (13 - i) * 864e5).toISOString().slice(0, 10);
    return { d, v: usage.filter((u) => u.at.startsWith(d)).reduce((s, u) => s + u.promptTokens + u.outputTokens, 0) };
  });
  const peak = Math.max(1, ...days.map((d) => d.v));

  return (
    <main className="min-w-0 flex-1 overflow-y-auto p-5">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-wrap items-center gap-3">
          <KeyRound className="size-6 text-nawat" />
          <div className="flex-1">
            <h1 className="text-xl font-semibold">مفاتيح API والاستهلاك</h1>
            <p className="text-xs text-muted-foreground">مزود Groupe-HN لنماذج نواة — محفوظ على هذا الجهاز فقط</p>
          </div>
          <Button variant={ready ? "outline" : "default"} onClick={() => { setupGroupeHnProvider(); toast.success("تمت تهيئة Groupe-HN وربطه بـ NAWAT Studio"); }}>
            {ready ? <CheckCircle2 /> : <PlugZap />}
            {ready ? "Groupe-HN مربوط — إعادة التهيئة" : "تهيئة Groupe-HN كمزود"}
          </Button>
        </header>

        <section className="grid gap-3 sm:grid-cols-4">
          {[
            ["المفاتيح", fmt(keys.length)],
            ["الطلبات", fmt(usage.length)],
            ["رموز اليوم", fmt(todayTokens)],
            ["إجمالي الرموز", fmt(total)],
          ].map(([l, v]) => (
            <div key={l} className="rounded-md border border-border bg-card p-3">
              <div className="text-[11px] text-muted-foreground">{l}</div>
              <div className="mt-1 font-mono text-xl font-semibold">{v}</div>
            </div>
          ))}
        </section>

        <section className="rounded-md border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">إنشاء مفتاح</h2>
          <div className="flex flex-wrap gap-2">
            <Input className="max-w-xs" placeholder="اسم المفتاح (مثلا: تطبيق الهاتف)" value={name} onChange={(e) => setName(e.target.value)} />
            <Input className="max-w-[180px]" type="number" min={0} placeholder="حد شهري للرموز (0 = بلا حد)" value={limit} onChange={(e) => setLimit(e.target.value)} />
            <Button onClick={() => { const k = createKey(name.trim(), Number(limit) || 0); navigator.clipboard?.writeText(k.key); toast.success("أُنشئ المفتاح ونُسخ"); setName(""); setLimit(""); }}>
              <KeyRound /> إنشاء
            </Button>
          </div>
        </section>

        <section className="overflow-x-auto rounded-md border border-border bg-card">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted/60 text-muted-foreground">
              <tr className="border-b border-border">
                {["الاسم", "المفتاح", "المزود", "استهلاك الشهر", "آخر استعمال", "الحالة", ""].map((h) => (
                  <th key={h} className="px-3 py-2 text-start font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {keys.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-xs text-muted-foreground">لا توجد مفاتيح بعد</td></tr>
              )}
              {keys.map((k) => {
                const used = usedThisMonth(k.id, usage);
                const pct = k.monthlyLimit ? Math.min(100, (used / k.monthlyLimit) * 100) : 0;
                return (
                  <tr key={k.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 font-medium">
                      {k.name}
                      {active === k.id && <span className="ms-2 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">نشط</span>}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs" dir="ltr">{mask(k.key)}</td>
                    <td className="px-3 py-2 text-xs">Groupe-HN</td>
                    <td className="px-3 py-2 text-xs">
                      {fmt(used)}{k.monthlyLimit ? ` / ${fmt(k.monthlyLimit)}` : ""}
                      {k.monthlyLimit > 0 && (
                        <div className="mt-1 h-1 w-24 rounded bg-muted"><div className={`h-1 rounded ${pct > 90 ? "bg-destructive" : "bg-nawat"}`} style={{ width: `${pct}%` }} /></div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString("ar-MA") : "—"}</td>
                    <td className="px-3 py-2">
                      <Button size="sm" variant="outline" onClick={() => updateKey(k.id, { enabled: !k.enabled })}>
                        {k.enabled ? "مفعّل" : "موقوف"}
                      </Button>
                    </td>
                    <td className="px-3 py-2 text-end whitespace-nowrap">
                      <Button size="icon-sm" variant="ghost" title="تعيين كنشط" aria-label="تعيين كنشط" onClick={() => setActiveKey(k.id)}><Activity /></Button>
                      <Button size="icon-sm" variant="ghost" title="نسخ" aria-label="نسخ المفتاح" onClick={() => { navigator.clipboard?.writeText(k.key); toast.success("نُسخ"); }}><Copy /></Button>
                      <Button size="icon-sm" variant="ghost" title="حذف" aria-label="حذف المفتاح" onClick={() => deleteKey(k.id)}><Trash2 /></Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-md border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold">الاستهلاك — آخر 14 يومًا</h2>
            <div className="flex h-32 items-end gap-1">
              {days.map((d) => (
                <div key={d.d} title={`${d.d}: ${fmt(d.v)}`} className="flex-1 rounded-t bg-nawat/70" style={{ height: `${Math.max(2, (d.v / peak) * 100)}%` }} />
              ))}
            </div>
          </div>
          <div className="overflow-x-auto rounded-md border border-border bg-card">
            <div className="flex items-center justify-between p-3">
              <h2 className="text-sm font-semibold">الاستهلاك حسب نموذج نواة</h2>
              <Button size="sm" variant="ghost" onClick={clearUsage}>مسح السجل</Button>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-muted-foreground">
                <tr>{["النموذج", "طلبات", "مدخلات", "مخرجات", "متوسط الزمن"].map((h) => <th key={h} className="px-3 py-2 text-start font-medium">{h}</th>)}</tr>
              </thead>
              <tbody>
                {byModel.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-xs text-muted-foreground">لم تُسجّل أي محادثة بعد</td></tr>}
                {byModel.map(([m, r]) => (
                  <tr key={m} className="border-t border-border">
                    <td className="px-3 py-2 font-mono text-xs" dir="ltr">{m}</td>
                    <td className="px-3 py-2">{fmt(r.calls)}</td>
                    <td className="px-3 py-2">{fmt(r.prompt)}</td>
                    <td className="px-3 py-2">{fmt(r.output)}</td>
                    <td className="px-3 py-2">{(r.ms / r.calls / 1000).toFixed(1)} ث</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
