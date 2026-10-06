import { useEffect, useState } from "react";
import { Copy, KeyRound, Sparkles } from "lucide-react";
import { Panel } from "@/components/nawat/StudioUI";
import { Button } from "@/components/ui/button";
import { GHN_PLATFORM, setGhnKey, useGhn } from "@/lib/nawat/groupe-hn-platform";
import { saveProvider } from "@/lib/nawat/providers";

export function GroupeHnPlatform() {
  const s = useGhn();
  const [key, setKey] = useState("");
  const [copied, setCopied] = useState("");
  useEffect(() => setKey(s.key), [s.key]);

  const save = () => {
    setGhnKey(key);
    if (key.trim().startsWith("ghn_")) {
      saveProvider(
        {
          id: "groupe-hn-platform",
          name: GHN_PLATFORM.name,
          kind: "openai-compatible",
          baseUrl: GHN_PLATFORM.baseUrl,
          models: [GHN_PLATFORM.model],
          connected: true,
          updatedAt: new Date().toISOString(),
        },
        key.trim(),
      );
    }
  };
  const copy = (v: string) => {
    void navigator.clipboard.writeText(v);
    setCopied(v);
    setTimeout(() => setCopied(""), 1200);
  };
  const rows: [string, string][] = [
    ["اسم المزود", GHN_PLATFORM.name],
    ["Base URL", GHN_PLATFORM.baseUrl],
    ["النموذج", GHN_PLATFORM.model],
    ["Endpoint", GHN_PLATFORM.endpoint],
  ];

  return (
    <Panel
      title="الربط مع منصة Groupe-HN"
      note={s.key.startsWith("ghn_") ? "مفعّل بالمفتاح · المنصة تتابع الاستعمال" : "مفعّل — فترة مفتوحة"}
    >
      {s.freeOpen && (
        <p className="mb-3 flex items-start gap-2 rounded-md border border-nawat/30 bg-nawat/10 p-3 text-xs leading-5">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-nawat" />
          البرنامج ونماذج المجموعة مفتوحة ومجانية لكل الشباب حتى {s.freeUntil} — بمفتاح أو بدونه. ابرمج، جرّب، وابنِ أحلامك 🚀
        </p>
      )}
      <div className="divide-y divide-border">
        {rows.map(([label, v]) => (
          <div key={label} className="flex items-center gap-3 py-2 text-xs">
            <span className="w-24 shrink-0 text-muted-foreground">{label}</span>
            <code dir="ltr" className="min-w-0 flex-1 truncate font-mono text-nawat">{v}</code>
            <button aria-label={`نسخ ${label}`} onClick={() => copy(v)} className="text-muted-foreground hover:text-foreground">
              <Copy className="size-3.5" />
            </button>
            {copied === v && <span className="text-[10px] text-success">نُسخ</span>}
          </div>
        ))}
      </div>
      <label className="mt-3 block text-xs text-muted-foreground">مفتاح Groupe-HN (اختياري)</label>
      <div className="mt-1 flex gap-2">
        <div className="relative flex-1">
          <KeyRound className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="password"
            dir="ltr"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="control ps-10 font-mono"
            placeholder="ghn_..."
            autoComplete="off"
          />
        </div>
        <Button onClick={save}>حفظ</Button>
      </div>
      <p className="mt-2 text-[10px] leading-5 text-muted-foreground">
        المفتاح يبقى على هذا الجهاز فقط. عند إدخاله تتابع المنصة استعمالك لتطوّر النماذج معك.
      </p>
    </Panel>
  );
}
