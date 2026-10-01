import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Smartphone, Globe, Wifi, Cable, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import apkAsset from "@/assets/nawat-apk.asset.json";
import srcAsset from "@/assets/nawat-mobile-source-v2.zip.asset.json";

const PRESETS = [
  {
    id: "cloud",
    name: "الموقع المنشور",
    url: "https://studio-nawat.lovable.app",
    hint: "يعمل من أي مكان بالإنترنت",
    icon: Globe,
  },
  {
    id: "lan",
    name: "الشبكة المحلية",
    url: "http://192.168.100.66:5173",
    hint: "الهاتف والخادم على نفس الشبكة",
    icon: Wifi,
  },
  {
    id: "bridge",
    name: "الجسر (Bridge)",
    url: "http://192.168.100.66:8787",
    hint: "عنوان الجسر الذي يتصل به تطبيق الهاتف",
    icon: Cable,
  },
] as const;

/** خدمات تطبيق الهاتف (المنافذ — الربط بالخدمات) */
const PHONE_SERVICES = [
  { id: "app", name: "التطبيق المنشور — الرابط بين الخدمات", url: "https://studio-nawat.lovable.app", test: "/", btn: "اختبار الرابط", hint: "يجمع الخدمات معًا: الجسر، المولّد، البوابة — ويفتح من أي مكان بالإنترنت." },
  { id: "models", name: "الجسر — نماذج الخادم (منفذ 8788)", url: "http://192.168.100.66:8788", test: "/api/ping", btn: "اختبار الجسر", hint: "يُستخدم للمهام الصعبة: برمجة، رؤية، استدلال طويل." },
  { id: "comfy", name: "مولّد الصور — ComfyUI (منفذ 8188)", url: "http://192.168.2.4:8188", test: "/system_stats", btn: "اختبار المولّد", hint: "يغذّي «ارسم…» وأزرار التكبير والتوسيع والتعبئة تحت كل صورة." },
  { id: "search", name: "بوابة البحث السحابية", url: "https://ntapi.hn-dbpro.com", test: "/", btn: "اختبار البوابة", hint: "تدعم: ويب · أخبار · صور · فيديو · ويكيبيديا · أسئلة." },
] as const;

type Status = "idle" | "wait" | "ok" | "fail";

function PhoneServices() {
  const [urls, setUrls] = useState<Record<string, string>>(() => Object.fromEntries(PHONE_SERVICES.map((s) => [s.id, s.url])));
  const [st, setSt] = useState<Record<string, Status>>({});
  useEffect(() => {
    try { const raw = localStorage.getItem("nawat.phone.services.v1"); if (raw) setUrls((u) => ({ ...u, ...JSON.parse(raw) })); } catch { /* ignore */ }
  }, []);
  const save = (next: Record<string, string>) => { setUrls(next); try { localStorage.setItem("nawat.phone.services.v1", JSON.stringify(next)); } catch { /* ignore */ } };
  const test = async (id: string, path: string) => {
    setSt((s) => ({ ...s, [id]: "wait" }));
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 5000);
      await fetch((urls[id] ?? "").replace(/\/$/, "") + path, { mode: "no-cors", signal: ctl.signal });
      clearTimeout(t); setSt((s) => ({ ...s, [id]: "ok" }));
    } catch { setSt((s) => ({ ...s, [id]: "fail" })); }
  };
  const label: Record<Status, string> = { idle: "", wait: "جارٍ الفحص…", ok: "متصل ✓", fail: "لا يستجيب ✗" };
  return (
    <div className="flex flex-col gap-3 border-t border-border pt-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold">خدمات تطبيق الهاتف</h3>
        <Button size="sm" className="h-7 text-xs" onClick={() => PHONE_SERVICES.forEach((s) => test(s.id, s.test))}>فحص الكل</Button>
      </div>
      {PHONE_SERVICES.map((s, i) => (
        <div key={s.id} className="flex flex-col gap-1.5">
          <span className="text-xs font-medium">{i + 1}. {s.name}</span>
          <div className="flex flex-wrap items-center gap-2">
            <Input value={urls[s.id]} dir="ltr" className="h-8 min-w-60 flex-1 font-mono text-xs" aria-label={s.name} onChange={(e) => save({ ...urls, [s.id]: e.target.value })} />
            <Button size="sm" className="h-8 text-xs" onClick={() => test(s.id, s.test)}>{s.btn}</Button>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => save({ ...urls, [s.id]: s.url })}>إعادة الضبط</Button>
            <span className="text-[11px] text-muted-foreground">{label[st[s.id] ?? "idle"]}</span>
          </div>
          <p className="text-[11px] text-muted-foreground">{s.hint}</p>
        </div>
      ))}
    </div>
  );
}

/** نقاط اتصال الجسر الموثقة — يستخدمها تطبيق الهاتف */
const BRIDGE_ENDPOINTS = [
  { method: "GET", path: "/api/ping", desc: "فحص الاتصال" },
  { method: "GET", path: "/api/ssh/hosts", desc: "قائمة المضيفين" },
  { method: "POST", path: "/api/ssh/exec", desc: "تنفيذ أمر — {host, cmd}" },
  { method: "POST", path: "/api/ssh/revive", desc: "إحياء خدمة — {host, service}" },
  { method: "GET", path: "/api/ssh/audit?n=30", desc: "سجل التدقيق" },
] as const;

/** قسم الربط الهاتفي: رمز QR لفتح التطبيق على الهاتف + عنوان الجسر */
export function PhoneLink() {
  const [url, setUrl] = useState<string>(PRESETS[0].url);
  const [qr, setQr] = useState<string>("");

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(url, { width: 220, margin: 1, color: { dark: "#0b1220", light: "#e2e8f0" } })
      .then((data) => { if (alive) setQr(data); })
      .catch(() => { if (alive) setQr(""); });
    return () => { alive = false; };
  }, [url]);

  const isBridge = url.includes(":8787");

  return (
    <section className="glass-panel flex flex-col gap-3 p-4" aria-label="الربط الهاتفي">
      <div className="flex items-center gap-2">
        <Smartphone className="h-4 w-4 text-nawat" />
        <h2 className="text-sm font-semibold">الربط الهاتفي</h2>
        <a href={apkAsset.url} download="NAWAT-v1.0.apk" className="ms-auto">
          <Button size="sm" className="h-8 gap-1.5 text-xs">
            <Download className="h-3.5 w-3.5" />
            تحميل تطبيق الهاتف (APK — 107 MB)
          </Button>
        </a>
        <a href="/mobile" target="_blank" rel="noreferrer">
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
            <Smartphone className="h-3.5 w-3.5" />
            فتح نسخة الهاتف
          </Button>
        </a>
        <a href={srcAsset.url} download="nawat-mobile-source.zip">
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
            <Download className="h-3.5 w-3.5" />
            كود تطبيق الهاتف الجديد (ZIP)
          </Button>
        </a>
      </div>
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex flex-col items-center gap-2">
          {qr ? (
            <img src={qr} alt={`رمز QR لفتح ${url}`} className="h-40 w-40 rounded-md border border-border" />
          ) : (
            <div className="grid h-40 w-40 place-items-center rounded-md border border-border text-xs text-muted-foreground">…</div>
          )}
          <span className="max-w-44 break-all text-center font-mono text-[11px] text-muted-foreground" dir="ltr">{url}</span>
        </div>
        <div className="flex min-w-60 flex-1 flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <Button
                key={p.id}
                size="sm"
                variant={url === p.url ? "default" : "outline"}
                className="h-8 gap-1.5 text-xs"
                title={p.hint}
                onClick={() => setUrl(p.url)}
              >
                <p.icon className="h-3.5 w-3.5" />
                {p.name}
              </Button>
            ))}
          </div>
          <Input
            value={url}
            dir="ltr"
            className="h-8 font-mono text-xs"
            aria-label="عنوان فتح التطبيق على الهاتف"
            onChange={(e) => setUrl(e.target.value)}
          />
          {isBridge ? (
            <div className="flex flex-col gap-1.5">
              <p className="text-[11px] leading-5 text-muted-foreground">
                ضع هذا العنوان في إعدادات تطبيق هاتفك. نقاط الاتصال المتاحة على الجسر:
              </p>
              <table className="w-full border-collapse text-[11px]" dir="ltr">
                <tbody>
                  {BRIDGE_ENDPOINTS.map((e) => (
                    <tr key={e.path} className="border-t border-border">
                      <td className="px-1 py-1 font-mono text-nawat">{e.method}</td>
                      <td className="px-1 py-1 font-mono">{e.path}</td>
                      <td className="px-1 py-1 text-muted-foreground" dir="rtl">{e.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[11px] text-muted-foreground">
                يجب أن يكون الهاتف على نفس شبكة الخادم، وأن يكون الجسر يستمع على 0.0.0.0:8787 وليس 127.0.0.1 فقط.
              </p>
            </div>
          ) : (
            <ol className="list-decimal space-y-1 pr-4 text-[11px] leading-5 text-muted-foreground">
              <li>افتح كاميرا هاتفك ووجّهها نحو الرمز.</li>
              <li>افتح الرابط الذي يظهر.</li>
              <li>من قائمة المتصفح اختر «إضافة إلى الشاشة الرئيسية» ليصبح تطبيقًا بأيقونة.</li>
              <li>للوصول إلى خادمك المحلي، اختر «الشبكة المحلية» وتأكد أن الهاتف على نفس الـWi-Fi.</li>
            </ol>
          )}
        </div>
      </div>
      <PhoneServices />
    </section>
  );
}
