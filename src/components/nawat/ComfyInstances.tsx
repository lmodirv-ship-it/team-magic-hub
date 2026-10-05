import { useState } from "react";
import { Check, Copy, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/nawat/StudioUI";
import { Button } from "@/components/ui/button";
import { updateServerSettings, useServerSettings, type ComfyInstance } from "@/lib/nawat/server-settings";
import { cn } from "@/lib/utils";

const CTL = "/opt/nawat-comfy/bin/comfy-ctl";
const COMMANDS: [string, string][] = [
  [`${CTL} status`, "حالة النسخ الخمس + الذاكرة"],
  [`${CTL} map`, "جدول المهمة ← المنفذ"],
  [`${CTL} doctor`, "فحص شامل (موديلات، منافذ، إقلاع)"],
  [`${CTL} queue`, "ما الذي يعمل الآن"],
  [`${CTL} start 3`, "تشغيل نسخة واحدة"],
  [`${CTL} stop 3`, "إيقاف نسخة واحدة"],
  [`${CTL} restart 3`, "إعادة تشغيل نسخة واحدة"],
  [`${CTL} start all`, "تشغيل الخمس"],
  [`${CTL} stop all`, "إيقاف الخمس"],
  [`${CTL} restart all`, "إعادة تشغيل الخمس"],
  [`${CTL} enable all`, "دائم بعد إعادة التشغيل"],
  [`${CTL} disable all`, "إلغاء التشغيل الدائم"],
  [`${CTL} logs 3 -f`, "سجل نسخة (متابعة حيّة)"],
];
const PACKS: [string, string][] = [
  ["ComfyUI-Impact-Pack", "أقنعة، تجزئة، كشف الأجسام"],
  ["ComfyUI-Inspire-Pack", "تكبير داخل المسار"],
  ["ComfyUI-Advanced-ControlNet", "تحكم بـ ControlNet"],
  ["ComfyUI_essentials", "عقد مفيدة"],
  ["comfyui-reactor", "تبديل الوجوه"],
  ["ComfyUI-VideoHelperSuite", "تجميع إطارات الفيديو (ffmpeg)"],
  ["ComfyUI-Frame-Interpolation", "إطارات وسطية بين إطارين"],
  ["ComfyUI_IPAdapter_plus", "نقل الأسلوب"],
];

const copy = (t: string) => void navigator.clipboard.writeText(t).then(() => toast.success("نُسخ"));

export function ComfyInstances() {
  const s = useServerSettings();
  const [status, setStatus] = useState<Record<string, boolean | null>>({});
  const list = s.comfyInstances;
  const save = (next: ComfyInstance[]) => updateServerSettings({ comfyInstances: next });
  const patch = (id: string, p: Partial<ComfyInstance>) => save(list.map((i) => (i.id === id ? { ...i, ...p } : i)));

  const testAll = async () => {
    for (const i of list) {
      setStatus((st) => ({ ...st, [i.id]: null }));
      try {
        const r = await fetch(`${i.url.replace(/\/$/, "")}/system_stats`, { signal: AbortSignal.timeout(4000) });
        setStatus((st) => ({ ...st, [i.id]: r.ok }));
      } catch {
        setStatus((st) => ({ ...st, [i.id]: false }));
      }
    }
  };

  const addFive = () => {
    const host = (list[0]?.url.match(/^https?:\/\/[^:/]+/)?.[0]) ?? "http://192.168.2.4";
    const extra: ComfyInstance[] = [1, 2, 3, 4, 5]
      .map((n) => ({ id: `c${Date.now()}-${n}`, name: `ComfyUI ${n}`, url: `${host}:${8187 + n}`, task: "" }))
      .filter((n) => !list.some((i) => i.url === n.url));
    save([...list, ...extra]);
  };

  return (
    <div className="grid gap-4">
      <Panel title="النسخ والمنافذ" note={`${list.length}`}>
        <div className="grid gap-2">
          {list.map((i) => (
            <div key={i.id} className="flex flex-wrap items-center gap-1">
              <span className={cn("size-2 rounded-full", status[i.id] === true ? "bg-success" : status[i.id] === false ? "bg-destructive" : "bg-muted")} />
              <input className="control w-28 text-xs" value={i.name} onChange={(e) => patch(i.id, { name: e.target.value })} aria-label="الاسم" />
              <input className="control w-44 font-mono text-xs" dir="ltr" value={i.url} onChange={(e) => patch(i.id, { url: e.target.value })} aria-label="الرابط" />
              <input className="control w-24 text-xs" placeholder="المهمة" value={i.task} onChange={(e) => patch(i.id, { task: e.target.value })} aria-label="المهمة" />
              <Button size="icon" variant={s.comfyUrl === i.url ? "default" : "ghost"} aria-label="اجعلها النشطة" title="اجعلها النشطة" onClick={() => updateServerSettings({ comfyUrl: i.url })}><Check /></Button>
              {list.length > 1 && <Button size="icon" variant="ghost" aria-label="حذف" onClick={() => save(list.filter((x) => x.id !== i.id))}><Trash2 /></Button>}
            </div>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          <Button size="sm" variant="outline" onClick={() => save([...list, { id: `c${Date.now()}`, name: `ComfyUI ${list.length + 1}`, url: "http://192.168.2.4:8189", task: "" }])}><Plus />رابط/منفذ</Button>
          <Button size="sm" variant="outline" onClick={addFive}><Plus />الخمس (8188-8192)</Button>
          <Button size="sm" variant="ghost" onClick={() => void testAll()}><RefreshCw />فحص الكل</Button>
        </div>
      </Panel>
      <Panel title="أوامر comfy-ctl" note="انسخ والصق في طرفية السيرفر">
        <div className="grid gap-1">
          {COMMANDS.map(([c, d]) => (
            <button key={c} onClick={() => copy(c)} className="flex items-center gap-2 rounded px-2 py-1 text-start hover:bg-muted">
              <Copy className="size-3 shrink-0 text-muted-foreground" />
              <code dir="ltr" className="font-mono text-[11px]">{c.replace(`${CTL} `, "comfy-ctl ")}</code>
              <span className="text-[11px] text-muted-foreground">— {d}</span>
            </button>
          ))}
        </div>
      </Panel>
      <Panel title="الإضافات المثبتة" note={`${PACKS.length}`}>
        <ul className="grid gap-1 text-xs">
          {PACKS.map(([n, d]) => (
            <li key={n}><code dir="ltr" className="font-mono">{n}</code> <span className="text-muted-foreground">— {d}</span></li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
