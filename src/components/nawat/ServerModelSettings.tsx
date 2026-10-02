import { useEffect, useState } from "react";
import { Copy, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getSettingsLog, serverEnvSnippet, updateServerSettings, useServerSettings } from "@/lib/nawat/server-settings";

/** خادم النماذج الاحتياطي + ComfyUI + مجلد النماذج — حفظ تلقائي عند كل تغيير. */
export function ServerModelSettings() {
  const s = useServerSettings();
  const [newHost, setNewHost] = useState("");
  const [comfy, setComfy] = useState(s.comfyUrl);
  const [path, setPath] = useState(s.modelStoragePath);
  const [logCount, setLogCount] = useState(0);
  useEffect(() => { setComfy(s.comfyUrl); setPath(s.modelStoragePath); setLogCount(getSettingsLog().length); }, [s]);

  // حفظ تلقائي بعد توقف الكتابة
  useEffect(() => {
    if (comfy === s.comfyUrl && path === s.modelStoragePath) return;
    const t = setTimeout(() => updateServerSettings({ comfyUrl: comfy.trim(), modelStoragePath: path.trim() }), 600);
    return () => clearTimeout(t);
  }, [comfy, path, s.comfyUrl, s.modelStoragePath]);

  const addHost = () => {
    const h = newHost.trim().replace(/\/+$/, "");
    if (!/^https?:\/\//.test(h) || s.ollamaFallbacks.includes(h)) return;
    updateServerSettings({ ollamaFallbacks: [...s.ollamaFallbacks, h] });
    setNewHost("");
  };

  return (
    <div className="space-y-3 text-xs">
      <div>
        <p className="mb-1 font-semibold">خوادم النماذج الاحتياطية (بالترتيب)</p>
        <ul className="space-y-1">
          {s.ollamaFallbacks.map((h) => (
            <li key={h} className="flex items-center gap-2 rounded-md border border-border px-2 py-1 font-mono">
              <span className="flex-1 truncate">{h}</span>
              <Button size="icon" variant="ghost" aria-label="حذف" onClick={() => updateServerSettings({ ollamaFallbacks: s.ollamaFallbacks.filter((x) => x !== h) })}><Trash2 /></Button>
            </li>
          ))}
        </ul>
        <div className="mt-1 flex gap-2">
          <input value={newHost} onChange={(e) => setNewHost(e.target.value)} placeholder="http://192.168.2.4:11434" className="control flex-1 font-mono" />
          <Button size="sm" onClick={addHost}><Plus />إضافة</Button>
        </div>
      </div>
      <label className="block"><span className="mb-1 block font-semibold">عنوان ComfyUI</span>
        <input value={comfy} onChange={(e) => setComfy(e.target.value)} className="control w-full font-mono" /></label>
      <label className="block"><span className="mb-1 block font-semibold">مجلد النماذج على السيرفر</span>
        <input value={path} onChange={(e) => setPath(e.target.value)} className="control w-full font-mono" /></label>
      <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
        <span>✓ يُحفظ تلقائيًا{s.updatedAt ? ` — آخر حفظ ${new Date(s.updatedAt).toLocaleString("ar")}` : ""} · {logCount} تغيير مسجّل</span>
        <Button size="sm" variant="outline" onClick={() => { void navigator.clipboard.writeText(serverEnvSnippet(s)); toast.success("نُسخت إعدادات السيرفر — ألصقها في ملف .env ثم أعد تشغيل الجسر"); }}><Copy />نسخ إعدادات السيرفر</Button>
      </div>
    </div>
  );
}
