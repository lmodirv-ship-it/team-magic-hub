import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { CloudDownload, CloudUpload, Database, Power, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { PageHead } from "@/components/nawat/StudioViews";
import { Button } from "@/components/ui/button";
import {
  enableAll, getDbOverview, pullStore, pushStore, setPermission, syncApiKeys, toggleRow,
} from "@/lib/nawat/db.functions";
import { getKeys, getUsage } from "@/lib/nawat/api-keys";

export const Route = createFileRoute("/database")({
  head: PageHead("قواعد البيانات", "جداول قاعدة بيانات NAWAT Studio: الصفحات والأدوار والصلاحيات والمزامنة."),
  component: DatabasePage,
});

const ROLE_KEY = "nawat.activeRole";
const SYNC_SINCE = "nawat.db.usageSince";

function DatabasePage() {
  const qc = useQueryClient();
  const fetchOverview = useServerFn(getDbOverview);
  const q = useQuery({ queryKey: ["db-overview"], queryFn: () => fetchOverview() });
  const setPerm = useServerFn(setPermission);
  const toggle = useServerFn(toggleRow);
  const all = useServerFn(enableAll);
  const push = useServerFn(pushStore);
  const pull = useServerFn(pullStore);
  const syncKeys = useServerFn(syncApiKeys);
  const [role, setRole] = useState("admin");
  const [busy, setBusy] = useState(false);
  useEffect(() => setRole(localStorage.getItem(ROLE_KEY) ?? "admin"), []);
  const refresh = () => qc.invalidateQueries({ queryKey: ["db-overview"] });

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(true);
    try { await fn(); toast.success(label); refresh(); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  const syncUp = () => run("تمت مزامنة كل بيانات التطبيق", async () => {
    const items = Object.keys(localStorage)
      .filter((k) => k.startsWith("nawat."))
      .map((k) => { const raw = localStorage.getItem(k); try { return { key: k, value: JSON.parse(raw ?? "null") }; } catch { return { key: k, value: raw }; } });
    for (let i = 0; i < items.length; i += 400) await push({ data: { device: navigator.userAgent.slice(0, 80), items: items.slice(i, i + 400) } });
    const since = localStorage.getItem(SYNC_SINCE);
    const usage = getUsage();
    await syncKeys({ data: {
      keys: getKeys().map((k) => ({ id: k.id, name: k.name, key_prefix: k.key.slice(0, 8), enabled: k.enabled, monthly_limit: k.monthlyLimit, created_at: k.createdAt, last_used_at: k.lastUsedAt ?? null })),
      usage: usage.map((u) => ({ at: u.at, model: u.model, key_id: u.keyId ?? null, prompt_tokens: u.promptTokens, output_tokens: u.outputTokens, ms: u.ms })),
      since,
    } });
    if (usage.length) localStorage.setItem(SYNC_SINCE, usage[usage.length - 1]!.at);
  });

  const restore = () => run("تمت الاستعادة — أعد تحميل الصفحة", async () => {
    const rows = await pull();
    for (const r of rows) localStorage.setItem(r.key, typeof r.value === "string" ? r.value : JSON.stringify(r.value));
  });

  const d = q.data;
  return (
    <main className="min-w-0 flex-1 overflow-y-auto p-5">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-wrap items-center gap-3">
          <Database className="size-6 text-nawat" />
          <div className="flex-1">
            <h1 className="text-xl font-semibold">قواعد البيانات</h1>
            <p className="text-xs text-muted-foreground">وضع التطوير — بدون تسجيل دخول. الدور النشط يُختار من هنا.</p>
          </div>
          <select className="control w-auto" value={role} onChange={(e) => { setRole(e.target.value); localStorage.setItem(ROLE_KEY, e.target.value); }} aria-label="الدور النشط">
            {(d?.roles ?? []).map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}
          </select>
          <Button variant="outline" disabled={busy} onClick={refresh}><RefreshCw /> تحديث</Button>
          <Button disabled={busy} onClick={() => run("تم تفعيل كل الأدوار والصفحات", () => all())}><Power /> تفعيل الكل</Button>
        </header>

        {q.isError && <p className="rounded-md border border-destructive p-3 text-sm text-destructive">{(q.error as Error).message}</p>}

        <section className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {(d?.counts ?? []).map((c) => (
            <div key={c.table} className="rounded-md border border-border bg-card p-3">
              <div className="font-mono text-[11px] text-muted-foreground" dir="ltr">{c.table}</div>
              <div className="mt-1 font-mono text-xl font-semibold">{c.rows}</div>
              <div className={`text-[10px] ${c.ok ? "text-success" : "text-destructive"}`}>{c.ok ? "متصل" : "خطأ"}</div>
            </div>
          ))}
        </section>

        <section className="flex flex-wrap gap-2 rounded-md border border-border bg-card p-4">
          <div className="flex-1 text-sm">
            <div className="font-semibold">مزامنة بيانات التطبيق</div>
            <p className="text-xs text-muted-foreground">يرفع كل الإعدادات والمحادثات والمنافذ والمهام ومفاتيح API (بدون المفتاح الكامل) والاستهلاك.</p>
          </div>
          <Button disabled={busy} onClick={syncUp}><CloudUpload /> مزامنة الآن</Button>
          <Button variant="outline" disabled={busy} onClick={restore}><CloudDownload /> استعادة</Button>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_2fr]">
          <div className="overflow-x-auto rounded-md border border-border bg-card">
            <h2 className="p-3 text-sm font-semibold">الأدوار</h2>
            <table className="w-full text-sm"><tbody>
              {(d?.roles ?? []).map((r) => (
                <tr key={r.key} className="border-t border-border">
                  <td className="px-3 py-2"><div className="font-medium">{r.name}</div><div className="text-[11px] text-muted-foreground">{r.description}</div></td>
                  <td className="px-3 py-2 text-end"><Button size="sm" variant={r.enabled ? "default" : "outline"} onClick={() => run("تم", () => toggle({ data: { table: "app_roles", id: r.key, enabled: !r.enabled } }))}>{r.enabled ? "مفعّل" : "موقوف"}</Button></td>
                </tr>
              ))}
            </tbody></table>
          </div>
          <div className="overflow-x-auto rounded-md border border-border bg-card">
            <h2 className="p-3 text-sm font-semibold">الصفحات والصلاحيات</h2>
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-muted/60 text-muted-foreground"><tr>
                <th className="px-3 py-2 text-start font-medium">الصفحة</th>
                <th className="px-3 py-2 text-start font-medium">الحالة</th>
                {(d?.roles ?? []).map((r) => <th key={r.key} className="px-3 py-2 text-start font-medium">{r.name}<div className="text-[10px] font-normal">عرض · تعديل · حذف</div></th>)}
              </tr></thead>
              <tbody>
                {(d?.pages ?? []).map((p) => (
                  <tr key={p.path} className="border-t border-border">
                    <td className="px-3 py-2"><div>{p.name}</div><div className="font-mono text-[10px] text-muted-foreground" dir="ltr">{p.path}</div></td>
                    <td className="px-3 py-2"><Button size="sm" variant={p.enabled ? "default" : "outline"} onClick={() => run("تم", () => toggle({ data: { table: "app_pages", id: p.path, enabled: !p.enabled } }))}>{p.enabled ? "مفعّلة" : "موقوفة"}</Button></td>
                    {(d?.roles ?? []).map((r) => {
                      const perm = d?.perms.find((x) => x.role_key === r.key && x.page_path === p.path);
                      return (
                        <td key={r.key} className="px-3 py-2">
                          <div className="flex gap-2">
                            {(["can_view", "can_edit", "can_delete"] as const).map((f) => (
                              <input key={f} type="checkbox" className="size-4" aria-label={`${r.name} ${p.name} ${f}`}
                                checked={!!perm?.[f]}
                                onChange={(e) => run("حُفظت الصلاحية", () => setPerm({ data: { role_key: r.key, page_path: p.path, field: f, value: e.target.checked } }))} />
                            ))}
                          </div>
                        </td>
                      );
                    })}
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
