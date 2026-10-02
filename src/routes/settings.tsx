import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  DatabaseBackup,
  Download,
  Factory,
  Globe2,
  KeyRound,
  MonitorCog,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Page, Panel } from "@/components/nawat/StudioUI";
import { RegistryTable } from "@/components/nawat/RegistryTable";
import { ConfigTable } from "@/components/nawat/ConfigTable";
import { testEngine } from "@/lib/nawat/engines";
import { ThemeGallery } from "@/components/nawat/ThemeGallery";
import { DepthGallery } from "@/components/nawat/DepthGallery";
import { PlatformGallery } from "@/components/nawat/PlatformGallery";
import { PageHead } from "@/components/nawat/StudioViews";
import {
  isDesktop,
  modelPrefix,
  ollamaHost,
  setModelPrefix,
  setOllamaHost,
} from "@/lib/nawat/bridge";
import { useWorkspace } from "@/lib/nawat/workspace";
import { useModels } from "@/lib/nawat/useModels";
import { officialModels } from "@/lib/nawat/providers";
import {
  getDevelopmentModels,
  removeDevelopmentModel,
  saveDevelopmentModel,
  type DevelopmentModel,
} from "@/lib/nawat/providers";
import { logSettingChange } from "@/lib/nawat/server-settings";
import { ServerModelSettings } from "@/components/nawat/ServerModelSettings";
import { ModelDiscovery } from "@/components/nawat/ModelDiscovery";
import { ServerDiagnosis } from "@/components/nawat/ServerDiagnosis";

export const Route = createFileRoute("/settings")({
  staticData: { sitemap: true },
  head: PageHead(
    "الإعدادات",
    "إعدادات NAWAT Studio المتقدمة للنماذج والوكلاء والأمان والنسخ الاحتياطي.",
  ),
  component: SettingsPage,
});
const HELPERS_KEY = "nawat.helperModels";
function SettingsPage() {
  const { reset } = useWorkspace();
  const { models: all } = useModels();
  const [host, setHost] = useState("");
  const [prefix, setPrefix] = useState("");
  const [helpers, setHelpers] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [language, setLanguage] = useState("العربية");
  const [developmentModels, setDevelopmentModels] = useState<DevelopmentModel[]>([]);
  const [developmentName, setDevelopmentName] = useState("");
  const [developmentSize, setDevelopmentSize] = useState("");
  const [developmentDigest, setDevelopmentDigest] = useState("");
  useEffect(() => {
    setHost(ollamaHost());
    setPrefix(modelPrefix());
    try {
      setHelpers(JSON.parse(localStorage.getItem(HELPERS_KEY) ?? "[]") as string[]);
    } catch {
      setHelpers([]);
    }
    setDevelopmentModels(getDevelopmentModels());
    setLanguage(localStorage.getItem("nawat.language") ?? "العربية");
    setReady(true);
  }, []);
  const [ready, setReady] = useState(false);
  const save = () => {
    setOllamaHost(host);
    setModelPrefix(prefix.trim());
    localStorage.setItem(HELPERS_KEY, JSON.stringify(helpers));
    localStorage.setItem("nawat.language", language);
    setHost(ollamaHost());
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };
  // حفظ تلقائي وتسجيل لكل تغيير
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      setOllamaHost(host);
      setModelPrefix(prefix.trim());
      localStorage.setItem(HELPERS_KEY, JSON.stringify(helpers));
      localStorage.setItem("nawat.language", language);
      logSettingChange("settings.general", { host, prefix, helpers, language });
      setSaved(true);
      setTimeout(() => setSaved(false), 1200);
    }, 700);
    return () => clearTimeout(t);
  }, [ready, host, prefix, helpers, language]);
  const addDevelopmentModel = () => {
    if (!developmentName.trim()) return;
    saveDevelopmentModel({
      name: developmentName.trim(),
      size: Math.max(0, Number(developmentSize) || 0) * 1_000_000_000,
      digest: developmentDigest.trim() || "development",
      modifiedAt: new Date().toISOString(),
    });
    setDevelopmentModels(getDevelopmentModels());
    setDevelopmentName("");
    setDevelopmentSize("");
    setDevelopmentDigest("");
  };
  return (
    <Page
      eyebrow="Settings / Advanced"
      title="الإعدادات المتقدمة"
      description={`تشغيل ${isDesktop() ? "سطح المكتب الكامل" : "المتصفح المحدود"} — تُحفظ الإعدادات والبيانات على هذا الجهاز.`}
      actions={
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/factory">
              <Factory />
              المصنع
            </Link>
          </Button>
          <Button onClick={save}>
            <Save />
            {saved ? "تم الحفظ" : "حفظ التغييرات"}
          </Button>
        </div>
      }
    >
      <div className="mb-4">
        <Panel
          title="جدول إدارة البرنامج"
          note="معرّف فريد (حرف + ٦ أرقام) لكل عنصر — قابل للتوسع"
        >
          <RegistryTable />
        </Panel>
      </div>
      <div className="mb-4">
        <Panel title="النماذج الرسمية المفعّلة" note={`${officialModels.length} نماذج Groupe-HN — مفعّلة في جميع الصفحات`}>
          <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {officialModels.map((m) => (
              <li key={m.name} className="flex items-start gap-2 rounded-md border border-border p-2 text-xs">
                <span className="mt-1 size-2 shrink-0 rounded-full bg-success" />
                <div className="min-w-0">
                  <div className="font-mono font-semibold">{m.name} <span className="text-success">✓ مفعّل</span></div>
                  <div className="text-muted-foreground">{m.description}</div>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="محرك Ollama" note="اتصال محلي مباشر">
          <Field label="عنوان المحرك">
            <input
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="http://127.0.0.1:11434"
              className="control font-mono"
            />
          </Field>
          <Field label="بادئة اكتشاف النماذج">
            <input
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              className="control font-mono"
            />
          </Field>
          <p className="text-xs font-semibold">محركات إضافية</p>
          <ConfigTable
            storageKey="nawat.cfg.engines"
            file="engines"
            nameLabel="المحرك"
            valueLabel="العنوان"
            namePlaceholder="Ollama VPS"
            valuePlaceholder="http://192.168.100.66:11434"
            onTest={(r) => testEngine(r.value)}
            defaults={[
              { id: "o1", name: "Ollama محلي", value: "http://127.0.0.1:11434", enabled: true },
              { id: "o2", name: "Ollama VPS", value: "http://192.168.100.66:11434", enabled: true },
            ]}
          />
        </Panel>
        <Panel title="المظهر واللغة" note="الستايل الرسمي هو الافتراضي ويمكن تغييره في أي وقت">
          <div className="grid gap-4">
            <Field label="لغة الواجهة">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="control"
              >
                <option>العربية</option>
                <option>English</option>
                <option>Français</option>
              </select>
            </Field>
            <ThemeGallery />
            <p className="text-xs font-semibold">النمط الثلاثي الأبعاد</p>
            <DepthGallery />
            <p className="text-xs font-semibold">ستايل المنصة (يشمل جميع الصفحات)</p>
            <PlatformGallery />
          </div>
          <div className="mt-4 flex items-center gap-3 rounded-md border border-border p-3 text-xs text-muted-foreground">
            <Globe2 className="size-4 text-primary" />
            العربية تعمل باتجاه RTL، وتتحول اللغات اللاتينية تلقائيًا إلى LTR.
          </div>
        </Panel>
        <Panel title="نماذج الوكلاء" note="اختر أي نموذج متاح دون افتراض نوعه مسبقًا">
          <div className="grid gap-2 sm:grid-cols-2">
            {all.length ? (
              all.map((m) => (
                <label
                  key={m.name}
                  className="flex items-center gap-2 rounded-md border border-border p-2 text-xs"
                >
                  <input
                    type="checkbox"
                    checked={helpers.includes(m.name)}
                    onChange={() =>
                      setHelpers((h) =>
                        h.includes(m.name) ? h.filter((x) => x !== m.name) : [...h, m.name],
                      )
                    }
                  />
                  <span className="truncate font-mono">{m.name}</span>
                </label>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">
                أضف نموذجًا تطويريًا أو اربط مزوّدًا لعرضه هنا.
              </p>
            )}
          </div>
        </Panel>
        <Panel title="نماذج Groupe-HN التطويرية" note="إضافة نماذج أخرى نطوّرها داخليًا">
          <div className="grid gap-3 sm:grid-cols-[1.4fr_.6fr_1fr_auto]">
            <Field label="اسم النموذج">
              <input
                value={developmentName}
                onChange={(e) => setDevelopmentName(e.target.value)}
                className="control font-mono"
                placeholder="nawat-new:latest"
              />
            </Field>
            <Field label="الحجم GB">
              <input
                type="number"
                min="0"
                step="0.1"
                value={developmentSize}
                onChange={(e) => setDevelopmentSize(e.target.value)}
                className="control font-mono"
                placeholder="4.7"
              />
            </Field>
            <Field label="البصمة">
              <input
                value={developmentDigest}
                onChange={(e) => setDevelopmentDigest(e.target.value)}
                className="control font-mono"
                placeholder="SHA256"
              />
            </Field>
            <div className="flex items-end pb-4">
              <Button
                size="icon"
                title="إضافة النموذج"
                onClick={addDevelopmentModel}
                disabled={!developmentName.trim()}
              >
                <Plus />
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            {developmentModels.map((model) => (
              <div
                key={model.name}
                className="flex items-center gap-3 rounded-md border border-border p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-xs font-semibold">{model.name}</p>
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                    {(model.size / 1_000_000_000).toFixed(1)} GB · {model.digest}
                  </p>
                </div>
                <span className="rounded-md bg-primary/10 px-2 py-1 text-[10px] text-primary">
                  تطويري
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title="حذف النموذج"
                  onClick={() => {
                    removeDevelopmentModel(model.name);
                    setDevelopmentModels(getDevelopmentModels());
                  }}
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
            {!developmentModels.length && (
              <p className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                لا توجد نماذج تطويرية مضافة بعد.
              </p>
            )}
          </div>
          <p className="mt-4 text-xs font-semibold">تفعيل النماذج التطويرية</p>
          <ConfigTable
            storageKey="nawat.cfg.devmodels"
            file="dev-models"
            nameLabel="النموذج"
            valueLabel="الملاحظة"
            namePlaceholder="nawat-new:latest"
            defaults={developmentModels.map((m) => ({ id: m.name, name: m.name, value: m.digest, enabled: true }))}
          />
        </Panel>
        <Panel title="الأمان والصلاحيات" note="أضف صلاحية، فعّلها، ثم احفظ">
          <ConfigTable
            storageKey="nawat.cfg.security"
            file="security"
            nameLabel="الصلاحية"
            valueLabel="الوصف"
            defaults={[
              { id: "s1", name: "سجل التدقيق", value: "audit-log", enabled: true },
              { id: "s2", name: "عزل أدوات الوكلاء", value: "sandbox-tools", enabled: true },
              { id: "s3", name: "السماح بتنفيذ PowerShell", value: "powershell", enabled: isDesktop() },
            ]}
          />
        </Panel>
        <Panel title="API وWebSocket" note="أضف نقطة اتصال، فعّلها، ثم احفظ">
          <ConfigTable
            storageKey="nawat.cfg.endpoints"
            file="endpoints"
            nameLabel="الخدمة"
            valueLabel="العنوان"
            valuePlaceholder="ws://… أو http://…"
            defaults={[
              { id: "e1", name: "Orchestrator WS", value: "ws://192.168.100.66:5001", enabled: true },
              { id: "e2", name: "Factory API", value: "http://192.168.100.66:5001/api", enabled: true },
              { id: "e3", name: "Engine", value: "http://localhost:3000/api", enabled: true },
              { id: "e4", name: "Bridge", value: "http://localhost:8787/api", enabled: true },
            ]}
          />
        </Panel>
        <Panel title="النسخ الاحتياطي والاستعادة">
          <p className="mb-4 text-xs leading-6 text-muted-foreground">
            تصدير السجل والمحادثات والمهام والملفات والإعدادات في ملف محلي واحد.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => {
                const blob = new Blob([JSON.stringify({ ...localStorage }, null, 2)], {
                  type: "application/json",
                });
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = "nawat-studio-backup.json";
                a.click();
              }}
            >
              <Download />
              تصدير نسخة
            </Button>
            <Button
              variant="outline"
              onClick={() => confirm("إعادة مساحة العمل إلى الحالة الأولية؟") && reset()}
            >
              <DatabaseBackup />
              إعادة ضبط مساحة العمل
            </Button>
          </div>
        </Panel>
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel title="خوادم النماذج وComfyUI ومجلد النماذج" note="يُحفظ تلقائيًا عند كل تغيير">
          <ServerModelSettings />
        </Panel>
        <Panel title="البحث التلقائي عن النماذج" note="لكل نموذج منفذ مخصص يُضاف إلى صفحة المنافذ">
          <ModelDiscovery />
        </Panel>
        <Panel title="تشخيص أعطال الخادم بالذكاء الاصطناعي" note="للمسؤول: سجلات + مقاييس ← تشخيص وخطوات إصلاح">
          <ServerDiagnosis />
        </Panel>
      </div>
    </Page>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-4 block text-xs text-muted-foreground">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}
function Toggle({
  icon: Icon,
  label,
  checked,
}: {
  icon: typeof ShieldCheck;
  label: string;
  checked: boolean;
}) {
  return (
    <label className="flex items-center gap-3 rounded-md border border-border p-3">
      <Icon className="size-4 text-primary" />
      <span className="flex-1 text-sm">{label}</span>
      <input type="checkbox" defaultChecked={checked} className="size-4" />
    </label>
  );
}
