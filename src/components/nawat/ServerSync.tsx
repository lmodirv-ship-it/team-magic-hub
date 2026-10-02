import { useEffect, useState } from "react";
import { GitBranch, RefreshCw, CloudDownload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { callConfiguredBridge } from "@/lib/nawat/bridge-config";

type Version = { local: string; remote: string; branch: string; localDate: string; behind: number; latest: string; updating: boolean; log: string };

/** يقارن نسخة السيرفر المحلي بآخر التعديلات المنشورة ويسحبها عبر الجسر. */
export function ServerSync() {
  const [v, setV] = useState<Version | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const check = async () => {
    setBusy(true); setMsg("");
    try { setV((await callConfiguredBridge("version")) as Version); }
    catch (e) { setMsg(`تعذّر الوصول إلى السيرفر: ${(e as Error).message}`); }
    finally { setBusy(false); }
  };
  const update = async () => {
    setBusy(true);
    try {
      const r = (await callConfiguredBridge("update")) as { message?: string };
      setMsg(r.message ?? "بدأ التحديث");
      setTimeout(check, 60000);
    } catch (e) { setMsg(`فشل التحديث: ${(e as Error).message}`); }
    finally { setBusy(false); }
  };
  useEffect(() => { void check(); }, []);

  const synced = v && v.behind === 0 && v.local && v.local === v.remote;
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <GitBranch className="size-5 text-nawat" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold">مزامنة السيرفر المحلي مع آخر التعديلات</h3>
          <p className="text-xs text-muted-foreground">كل تعديل هنا يصل إلى GitHub، ثم يسحبه السيرفر تلقائيًا كل 5 دقائق أو فورًا من هنا.</p>
        </div>
        <Button variant="outline" size="sm" disabled={busy} onClick={check}><RefreshCw /> فحص</Button>
        <Button size="sm" disabled={busy || !v || v.updating} onClick={update}><CloudDownload /> تحديث السيرفر الآن</Button>
      </div>
      {v && (
        <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
          <div className="rounded border border-border p-2"><div className="text-muted-foreground">نسخة السيرفر</div><div className="font-mono" dir="ltr">{v.local || "—"}</div></div>
          <div className="rounded border border-border p-2"><div className="text-muted-foreground">آخر نسخة ({v.branch})</div><div className="font-mono" dir="ltr">{v.remote || "—"}</div><div className="truncate">{v.latest}</div></div>
          <div className="rounded border border-border p-2"><div className="text-muted-foreground">الحالة</div>
            <div className={synced ? "text-success" : "text-warning"}>{v.updating ? "جارٍ التحديث…" : synced ? "متزامن ✓" : `متأخر بـ ${v.behind} تعديل`}</div></div>
        </div>
      )}
      {v?.log && <pre className="mt-2 max-h-32 overflow-auto rounded bg-muted p-2 text-[10px]" dir="ltr">{v.log}</pre>}
      {msg && <p className="mt-2 text-xs text-muted-foreground">{msg}</p>}
    </div>
  );
}
