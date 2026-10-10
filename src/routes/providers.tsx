import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, KeyRound, Plus, RefreshCw, Server, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Page, Panel } from "@/components/nawat/StudioUI";
import { PageHead } from "@/components/nawat/StudioViews";
import { GroupeHnPlatform } from "@/components/nawat/GroupeHnPlatform";
import {
  activeProviderModels,
  discoverProviderModels,
  getProviders,
  officialModels,
  PROVIDER_PRESETS,
  removeProvider,
  saveProvider,
  setProviderModelEnabled,
  subscribeProviders,
  type ProviderConfig,
} from "@/lib/nawat/providers";

export const Route = createFileRoute("/providers")({
  staticData: { sitemap: true },
  head: PageHead(
    "المزوّدون — NAWAT Studio",
    "إدارة Groupe-HN الرسمي ومزوّدي النماذج الخارجية ومفاتيح الاتصال.",
  ),
  component: ProvidersPage,
});

function ProvidersPage() {
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("https://api.openai.com/v1");
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const refresh = () => setProviders(getProviders());
    refresh();
    return subscribeProviders(refresh);
  }, []);

  const connect = async () => {
    if (!name.trim() || !baseUrl.trim() || !apiKey.trim()) {
      setNotice("أدخل اسم المزوّد والعنوان ومفتاح API.");
      return;
    }
    setBusy(true);
    setNotice("");
    try {
      const models = await discoverProviderModels(baseUrl, apiKey);
      if (!models.length) throw new Error("لم يُرجع المزوّد أي نماذج.");
      saveProvider(
        {
          id: crypto.randomUUID(),
          name: name.trim(),
          kind: "openai-compatible",
          baseUrl: baseUrl.trim(),
          models,
          connected: true,
          updatedAt: new Date().toISOString(),
        },
        apiKey,
      );
      setName("");
      setApiKey("");
      setNotice(`تم الاتصال وإضافة ${models.length} نموذج.`);
    } catch (error) {
      setNotice((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page
      eyebrow="AI / Providers"
      title="المزوّدون"
      description="نماذج Groupe-HN الرسمية تعمل عبر جسر Ollama، ويمكنك ربط مزوّدات أخرى بمفتاح API."
    >
      <div className="grid gap-4 xl:grid-cols-[1.25fr_1fr]">
        <Panel
          title="Ollama — Groupe-HN"
          note="المزوّد الرسمي · لا يحتاج API"
          actions={
            <span className="flex items-center gap-2 rounded-md border border-success/30 bg-success/10 px-2.5 py-1 text-xs text-success">
              <span className="signal-pulse size-2 rounded-full bg-success" /> متصل ويعمل
            </span>
          }
        >
          <div className="space-y-2">
            {officialModels.map((model) => (
              <div
                key={model.name}
                className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-md border border-border bg-background/40 p-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-mono text-sm font-semibold">{model.name}</p>
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                    {model.digest} · {model.modified_at}
                  </p>
                  {model.description && (
                    <p className="mt-1 text-xs text-foreground/80">{model.description}</p>
                  )}
                </div>
                <div className="text-end">
                  <p className="font-mono text-xs">{(model.size / 1_000_000_000).toFixed(1)} GB</p>
                  <p className="mt-1 flex items-center gap-1 text-[10px] text-success">
                    <CheckCircle2 className="size-3" /> رسمي
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="إضافة مزوّد" note="OpenAI-compatible API">
          <div className="space-y-3">
            <p className="rounded-md border border-success/30 bg-success/10 p-2 text-xs">نماذج المزوّد تظهر تلقائيًا في: مساحة العمل · Speed Build · المحادثة · المهام والمقارنة.</p>
            <div className="flex flex-wrap gap-1.5">
              {PROVIDER_PRESETS.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => { setName(p.name); setBaseUrl(p.baseUrl); }}
                  className={`rounded-md border px-2 py-1 text-[11px] ${baseUrl === p.baseUrl ? "border-primary bg-primary/10" : "border-border"}`}
                >
                  {p.name}
                </button>
              ))}
            </div>
            <Field label="اسم المزوّد">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="control"
                placeholder="اسم المزوّد"
              />
            </Field>
            <Field label="عنوان API">
              <input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                className="control font-mono"
                dir="ltr"
              />
            </Field>
            <Field label="مفتاح API">
              <div className="relative">
                <KeyRound className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="control ps-10 font-mono"
                  placeholder="••••••••••••"
                  autoComplete="off"
                />
              </div>
            </Field>
            <Button className="w-full" disabled={busy} onClick={() => void connect()}>
              {busy ? <RefreshCw className="animate-spin" /> : <Plus />}
              {busy ? "جارٍ قراءة النماذج…" : "اتصال وقراءة النماذج"}
            </Button>
            {notice && <p className="text-xs text-muted-foreground">{notice}</p>}
            <p className="text-[10px] leading-5 text-muted-foreground">
              المفتاح يبقى في ذاكرة الجلسة فقط، ولا يُحفظ ضمن بيانات التطبيق الدائمة.
            </p>
          </div>
        </Panel>
      </div>

      <div className="mt-4">
        <GroupeHnPlatform />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {providers.map((provider) => (
          <Panel
            key={provider.id}
            title={provider.name}
            note={`${provider.models.length} نموذج · ${provider.baseUrl}`}
            actions={
              <Button
                variant="ghost"
                size="icon-sm"
                title="حذف المزوّد"
                onClick={() => removeProvider(provider.id)}
              >
                <Trash2 />
              </Button>
            }
          >
            <div className="mb-3 flex items-center gap-2 text-xs text-success">
              <Server className="size-4" /> متصل · {activeProviderModels(provider).length} مفعّل
            </div>
            <p className="mb-2 text-[11px] text-muted-foreground">اضغط على نموذج لتفعيله أو إيقافه. المفعّل فقط يظهر في مساحة العمل.</p>
            <div className="flex max-h-64 flex-wrap gap-2 overflow-auto">
              {provider.models.map((model) => {
                const on = activeProviderModels(provider).includes(model);
                return (
                  <button
                    type="button"
                    key={model}
                    aria-pressed={on}
                    onClick={() => setProviderModelEnabled(provider.id, model, !on)}
                    className={`rounded-md border px-2 py-1 font-mono text-[11px] ${on ? "border-success/40 bg-success/10 text-success" : "border-border bg-background text-muted-foreground"}`}
                  >
                    {on ? "✓ " : ""}{model}
                  </button>
                );
              })}
            </div>
          </Panel>
        ))}
        {!providers.length && (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground xl:col-span-2">
            لم تُضف مزوّدات خارجية بعد. نماذج Groupe-HN الرسمية جاهزة دائمًا.
          </div>
        )}
      </div>
    </Page>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs text-muted-foreground">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}
