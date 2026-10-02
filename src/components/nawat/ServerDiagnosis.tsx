import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Activity, Copy, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { diagnoseServer } from "@/lib/nawat/diagnostics.functions";
import { callConfiguredBridge } from "@/lib/nawat/bridge-config";

const DRAFT = "nawat.diagnosis.draft.v1";

/** يدخل المسؤول السجلات والمقاييس، ويحصل على تشخيص وخطوات إصلاح. */
export function ServerDiagnosis() {
  const run = useServerFn(diagnoseServer);
  const [logs, setLogs] = useState("");
  const [metrics, setMetrics] = useState("");
  const [report, setReport] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try { const d = JSON.parse(localStorage.getItem(DRAFT) ?? "{}") as { logs?: string; metrics?: string; report?: string }; setLogs(d.logs ?? ""); setMetrics(d.metrics ?? ""); setReport(d.report ?? ""); } catch { /* none */ }
  }, []);
  useEffect(() => { localStorage.setItem(DRAFT, JSON.stringify({ logs, metrics, report })); }, [logs, metrics, report]);

  const fetchMetrics = async () => {
    try {
      const r = await callConfiguredBridge("system");
      setMetrics(JSON.stringify(r, null, 2).slice(0, 20000));
      toast.success("جُلبت المقاييس من السيرفر");
    } catch { toast.error("تعذّر الوصول إلى السيرفر — ألصق المقاييس يدويًا"); }
  };

  const diagnose = async () => {
    if (!logs.trim() && !metrics.trim()) return toast.error("أدخل السجلات أو المقاييس أولًا");
    setBusy(true);
    try {
      const r = await run({ data: { logs, metrics } });
      if (r.ok) setReport(r.report); else toast.error(r.error);
    } catch { toast.error("تعذّر التشخيص"); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-2 text-xs">
      <textarea value={logs} onChange={(e) => setLogs(e.target.value)} rows={6} placeholder="ألصق السجلات: pm2 logs / journalctl / nginx error.log ..." className="control w-full font-mono" dir="ltr" />
      <textarea value={metrics} onChange={(e) => setMetrics(e.target.value)} rows={4} placeholder="المقاييس: free -h / df -h / top ..." className="control w-full font-mono" dir="ltr" />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={fetchMetrics}><Activity />جلب المقاييس من السيرفر</Button>
        <Button size="sm" onClick={diagnose} disabled={busy}><Stethoscope />{busy ? "جارٍ التشخيص..." : "شخّص واقترح الإصلاح"}</Button>
        {report && <Button size="sm" variant="ghost" onClick={() => { void navigator.clipboard.writeText(report); toast.success("نُسخ التقرير"); }}><Copy />نسخ</Button>}
      </div>
      {report && <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-3 leading-relaxed">{report}</pre>}
    </div>
  );
}
