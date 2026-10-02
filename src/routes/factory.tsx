import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  Cloud,
  Cpu,
  Factory,
  Fingerprint,
  Play,
  Plus,
  RefreshCw,
  Smartphone,
  Square,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Page, Panel } from "@/components/nawat/StudioUI";
import { Button } from "@/components/ui/button";
import { ollamaHost } from "@/lib/nawat/bridge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/factory")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "مصنع NAWAT — تدريب وإنتاج النماذج" },
      { name: "description", content: "مصنع نماذج سيادي: الهوية والبصمة، توليد البيانات، التدريب، التكميم، المقارنة والنشر." },
      { property: "og:title", content: "مصنع NAWAT — تدريب وإنتاج النماذج" },
      { property: "og:description", content: "من التوثيق إلى الإنتاج: نماذج محلية وسحابية وللهاتف." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FactoryPage,
});

const URL_KEY = "nawat.factory.url";
const ID_KEY = "nawat.factory.identity.v1";
const DEFAULT_URL = "http://192.168.100.67:8789";

type Tab = "identity" | "dashboard" | "models" | "tasks" | "compare" | "deploy";
type Task = { task_id: string; version: string; teacher: string; type: string; status: string; created: string; error?: string };
type Identity = { name: string; owner: string; city: string; principle: string; fingerprint: string; system: string };

const DEFAULT_ID: Identity = {
  name: "NAWAT",
  owner: "مولاي إسماعيل الحسني — Groupe-HN",
  city: "طنجة، المغرب",
  principle: "بياناتك لا تغادر جهازك.",
  fingerprint: "",
  system:
    "أنت NAWAT، نموذج ذكاء اصطناعي سيادي من Groupe-HN، طوّره مولاي إسماعيل الحسني في طنجة. تعمل محليًا ولا ترسل بيانات المستخدم إلى أي جهة خارجية. أجب بالعربية بوضوح ودقة.",
};

const STAGES = [
  ["التوثيق", "الهوية والبصمة"],
  ["توليد البيانات", "المعلّم ينتج الأمثلة"],
  ["فحص الجودة", "رفض الضعيف والمكرر"],
  ["التدريب", "QLoRA للطالب"],
  ["الدمج والتحويل", "LoRA + GGUF"],
  ["التكميم", "Q4_K_M / Q8 للهاتف"],
  ["المقارنة", "الطالب ضد المعلّم"],
  ["الإنتاج", "Ollama و .66 و .67"],
];

async function sha(text: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

function FactoryPage() {
  const [tab, setTab] = useState<Tab>("identity");
  const [url, setUrl] = useState(DEFAULT_URL);
  const [online, setOnline] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState({ total_generated: 0, total_failed: 0, total_deployed: 0 });
  const [models, setModels] = useState<{ name: string; size: number }[]>([]);
  const [identity, setIdentity] = useState<Identity>(DEFAULT_ID);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setUrl(localStorage.getItem(URL_KEY) ?? DEFAULT_URL);
    try {
      const s = localStorage.getItem(ID_KEY);
      if (s) setIdentity({ ...DEFAULT_ID, ...(JSON.parse(s) as Identity) });
    } catch { /* ignore */ }
    setReady(true);
  }, []);

  // حفظ تلقائي للهوية والعنوان
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      localStorage.setItem(URL_KEY, url);
      localStorage.setItem(ID_KEY, JSON.stringify(identity));
    }, 600);
    return () => clearTimeout(t);
  }, [ready, url, identity]);

  const api = useCallback(
    async (path: string, init?: RequestInit) => {
      const r = await fetch(`${url.replace(/\/$/, "")}${path}`, {
        ...init,
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    },
    [url],
  );

  const refresh = useCallback(async () => {
    try {
      const q = await api("/api/queue");
      setTasks([...(q.tasks ?? []), ...(q.completed ?? []), ...(q.failed ?? [])]);
      setStats({ ...stats, ...(await api("/api/stats")) });
      setOnline(true);
    } catch {
      setOnline(false);
    }
    try {
      const r = await fetch(`${ollamaHost()}/api/tags`, { signal: AbortSignal.timeout(5000) });
      const d = await r.json();
      setModels(d.models ?? []);
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api]);

  useEffect(() => {
    if (!ready) return;
    void refresh();
    const i = setInterval(refresh, 8000);
    return () => clearInterval(i);
  }, [ready, refresh]);

  const action = async (path: string, body?: unknown, method = "POST") => {
    try {
      await api(path, { method, body: body ? JSON.stringify(body) : null });
      toast.success("تم");
      void refresh();
    } catch {
      toast.error("خادم المصنع غير متاح");
    }
  };

  const tabs: [Tab, string][] = [
    ["identity", "الهوية والبصمة"],
    ["dashboard", "لوحة القيادة"],
    ["models", "النماذج"],
    ["tasks", "المهام"],
    ["compare", "المقارنة"],
    ["deploy", "النشر"],
  ];

  return (
    <Page
      eyebrow="Factory / Pipeline"
      title="مصنع NAWAT"
      description="تدريب النماذج الحالية وتطوير نماذج محلية وسحابية وللهاتف — من التوثيق حتى الإنتاج."
      actions={
        <div className="flex items-center gap-2">
          <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", online ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive")}>
            {online ? "المصنع متصل" : "المصنع غير متصل"}
          </span>
          <Button variant="outline" size="icon" onClick={() => void refresh()} aria-label="تحديث">
            <RefreshCw />
          </Button>
        </div>
      }
    >
      <Panel title="مراحل القطار" note="من التوثيق إلى الإنتاج">
        <ol className="grid gap-2 sm:grid-cols-4 xl:grid-cols-8">
          {STAGES.map(([t, d], i) => (
            <li key={t} className="rounded-md border border-border p-2 text-xs">
              <div className="font-semibold">{i + 1}. {t}</div>
              <div className="text-muted-foreground">{d}</div>
            </li>
          ))}
        </ol>
      </Panel>

      <nav className="my-4 flex gap-1 overflow-x-auto border-b border-border">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn("whitespace-nowrap border-b-2 px-4 py-2 text-sm", tab === id ? "border-primary text-primary" : "border-transparent text-muted-foreground")}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "identity" && <IdentityTab identity={identity} setIdentity={setIdentity} />}
      {tab === "dashboard" && (
        <div className="grid gap-4">
          <Panel title="عنوان خادم المصنع" note="يُحفظ تلقائيًا">
            <input value={url} onChange={(e) => setUrl(e.target.value)} className="control font-mono" />
            <p className="mt-2 text-xs text-muted-foreground">من الموقع الآمن قد يمنع المتصفح الوصول المباشر؛ استخدمه من داخل الشبكة المحلية.</p>
          </Panel>
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat label="بيانات مولّدة" value={stats.total_generated} />
            <Stat label="فشل" value={stats.total_failed} />
            <Stat label="منشور" value={stats.total_deployed} />
            <Stat label="مهام" value={tasks.length} />
          </div>
          <div className="flex gap-2">
            <Button onClick={() => action("/api/worker/start")}><Play />تشغيل العامل</Button>
            <Button variant="outline" onClick={() => action("/api/worker/stop")}><Square />إيقاف</Button>
          </div>
        </div>
      )}
      {tab === "models" && <ModelsTab models={models} />}
      {tab === "tasks" && <TasksTab tasks={tasks} identity={identity} action={action} />}
      {tab === "compare" && <CompareTab models={models} api={api} />}
      {tab === "deploy" && <DeployTab />}
    </Page>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border p-4 text-center">
      <div className="text-2xl font-bold text-primary">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function IdentityTab({ identity, setIdentity }: { identity: Identity; setIdentity: (i: Identity) => void }) {
  const set = (k: keyof Identity, v: string) => setIdentity({ ...identity, [k]: v });
  const sign = async () => {
    const fp = await sha(`${identity.name}|${identity.owner}|${identity.principle}|${identity.system}`);
    setIdentity({ ...identity, fingerprint: `NWT-${fp}` });
    toast.success("تم توليد البصمة");
  };
  return (
    <Panel title="الهوية والبصمة" note="تُحقن في كل نموذج يخرج من المصنع">
      <div className="grid gap-3 md:grid-cols-2">
        {(["name", "owner", "city", "principle"] as const).map((k) => (
          <label key={k} className="grid gap-1 text-xs">
            {{ name: "اسم النموذج", owner: "المالك", city: "المدينة", principle: "المبدأ السيادي" }[k]}
            <input value={identity[k]} onChange={(e) => set(k, e.target.value)} className="control" />
          </label>
        ))}
      </div>
      <label className="mt-3 grid gap-1 text-xs">
        رسالة النظام (الهوية)
        <textarea value={identity.system} onChange={(e) => set("system", e.target.value)} rows={5} className="control" />
      </label>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button onClick={sign}><Fingerprint />توليد البصمة</Button>
        <code className="rounded bg-muted px-2 py-1 text-xs">{identity.fingerprint || "لا توجد بصمة بعد"}</code>
      </div>
    </Panel>
  );
}

function ModelsTab({ models }: { models: { name: string; size: number }[] }) {
  const groups: [string, typeof Cpu, { name: string; size: number }[]][] = [
    ["محلي", Cpu, models],
    ["سحابي", Cloud, []],
    ["هاتف (مكمّم)", Smartphone, models.filter((m) => m.size && m.size < 3e9)],
  ];
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {groups.map(([t, Icon, list]) => (
        <Panel key={t} title={t} note={`${list.length} نموذج`}>
          <Icon className="mb-2 size-5 text-primary" />
          <ul className="grid gap-1 text-xs font-mono">
            {list.map((m) => (
              <li key={m.name} className="flex justify-between rounded border border-border p-1.5">
                <span>{m.name}</span>
                <span className="text-muted-foreground">{(m.size / 1e9).toFixed(1)} GB</span>
              </li>
            ))}
            {!list.length && <li className="text-muted-foreground">لا يوجد</li>}
          </ul>
        </Panel>
      ))}
    </div>
  );
}

function TasksTab({ tasks, identity, action }: { tasks: Task[]; identity: Identity; action: (p: string, b?: unknown, m?: string) => Promise<void> }) {
  const [version, setVersion] = useState("v18");
  const [teacher, setTeacher] = useState("nawat-think:v17-anon");
  const [type, setType] = useState("generate_data");
  const [prompts, setPrompts] = useState("");
  return (
    <div className="grid gap-4">
      <Panel title="مهمة جديدة">
        <div className="grid gap-2 md:grid-cols-3">
          <input value={version} onChange={(e) => setVersion(e.target.value)} className="control" placeholder="الإصدار" />
          <input value={teacher} onChange={(e) => setTeacher(e.target.value)} className="control font-mono" placeholder="المعلّم" />
          <select value={type} onChange={(e) => setType(e.target.value)} className="control">
            <option value="generate_data">توليد البيانات</option>
            <option value="train">التدريب</option>
            <option value="quantize">التكميم</option>
            <option value="deploy">النشر</option>
          </select>
        </div>
        <textarea value={prompts} onChange={(e) => setPrompts(e.target.value)} rows={4} className="control mt-2" placeholder="مطالبة في كل سطر" />
        <Button
          className="mt-2"
          onClick={() =>
            action("/api/queue/add", {
              version,
              teacher,
              type,
              prompts: prompts.split("\n").map((s) => s.trim()).filter(Boolean),
              identity: { system: identity.system, fingerprint: identity.fingerprint },
            })
          }
        >
          <Plus />إضافة للطابور
        </Button>
      </Panel>
      <Panel title="الطابور" note={`${tasks.length} مهمة`}>
        <table className="w-full text-xs">
          <thead><tr className="text-muted-foreground"><th className="p-2 text-right">المعرف</th><th className="text-right">النوع</th><th className="text-right">المعلم</th><th className="text-right">الحالة</th><th /></tr></thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.task_id} className="border-t border-border">
                <td className="p-2 font-mono">{t.task_id}</td>
                <td>{t.type}</td>
                <td className="font-mono">{t.teacher}</td>
                <td>{t.status}{t.error ? ` — ${t.error}` : ""}</td>
                <td>
                  <Button size="icon" variant="ghost" aria-label="حذف" onClick={() => action(`/api/queue/task/${t.task_id}`, undefined, "DELETE")}><Trash2 /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

function CompareTab({ models, api }: { models: { name: string }[]; api: (p: string, i?: RequestInit) => Promise<{ answer?: string }> }) {
  const [prompt, setPrompt] = useState("من أنت ومن طوّرك؟");
  const [picked, setPicked] = useState<string[]>([]);
  const [out, setOut] = useState<Record<string, string>>({});
  const run = () =>
    picked.forEach(async (m) => {
      const t0 = performance.now();
      setOut((o) => ({ ...o, [m]: "…" }));
      try {
        const d = await api("/api/test", { method: "POST", body: JSON.stringify({ teacher: m, prompt }) });
        setOut((o) => ({ ...o, [m]: `${d.answer ?? ""}\n\n⏱ ${Math.round(performance.now() - t0)}ms` }));
      } catch {
        setOut((o) => ({ ...o, [m]: "فشل" }));
      }
    });
  return (
    <Panel title="مقارنة حية" note="يختبر ثبات الهوية والبصمة">
      <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={2} className="control" />
      <div className="my-2 flex flex-wrap gap-2">
        {models.map((m) => (
          <button key={m.name} onClick={() => setPicked((p) => (p.includes(m.name) ? p.filter((x) => x !== m.name) : [...p, m.name]))}
            className={cn("rounded border px-2 py-1 font-mono text-xs", picked.includes(m.name) ? "border-primary text-primary" : "border-border")}>
            {m.name}
          </button>
        ))}
      </div>
      <Button onClick={run} disabled={!picked.length}><Play />قارن</Button>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {Object.entries(out).map(([m, a]) => (
          <div key={m} className="rounded border border-border p-2 text-xs"><div className="mb-1 font-mono font-semibold">{m}</div><pre className="whitespace-pre-wrap">{a}</pre></div>
        ))}
      </div>
    </Panel>
  );
}

function DeployTab() {
  const cmds = `cd /workspace
pm2 start factory_server.py --interpreter python3 --name nawat-factory
python3 generate_data.py --teacher nawat-think:v17-anon --prompts prompts.txt
python3 train_student.py --data datasets/v18.jsonl
ollama create nawat-think:v18 -f Modelfile`;
  return (
    <Panel title="النشر للإنتاج" note="الملفات في deploy/factory">
      <Factory className="mb-2 size-5 text-primary" />
      <pre className="overflow-x-auto rounded bg-muted p-3 text-xs" dir="ltr">{cmds}</pre>
      <Button className="mt-2" variant="outline" onClick={() => { void navigator.clipboard.writeText(cmds); toast.success("تم النسخ"); }}>نسخ الأوامر</Button>
    </Panel>
  );
}
