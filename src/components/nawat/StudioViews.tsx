import { Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowLeft,
  Bot,
  Box,
  CheckCircle2,
  CircleDot,
  CloudCog,
  Code2,
  Cpu,
  Database,
  Eye,
  FileCode2,
  Gauge,
  Globe2,
  HardDrive,
  KeyRound,
  Network,
  Play,
  Power,
  RefreshCw,
  Server,
  ShieldCheck,
  SquareTerminal,
  Upload,
  Users,
  Wrench,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Metric, Page, Panel, ProgressBar, RuntimeBadge } from "./StudioUI";
import { bridgeTools, demoModels, toolConnections, useStudioRuntime } from "@/lib/nawat/studio";

export const PageHead = (title: string, description: string) => () => ({
  meta: [
    { title: `${title} — NAWAT Studio` },
    { name: "description", content: description },
    { property: "og:title", content: `${title} — NAWAT Studio` },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ],
});

const iconMap = {
  SSH: Server,
  SFTP: Upload,
  "Monaco Editor": Code2,
  PowerShell: SquareTerminal,
  "File Watcher": Eye,
  "ZIP Engine": Box,
};

export function OverviewView() {
  const runtime = useStudioRuntime();
  return (
    <Page
      eyebrow="Command Center / 01"
      title="مركز قيادة NAWAT"
      description="مراقبة النماذج والوكلاء والأدوات والبنية المحلية من مساحة تشغيل واحدة."
      actions={<RuntimeBadge connected={runtime.connected} />}
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="النماذج المحلية" value="9" change="3 محمّلة في الذاكرة" tone="success" />
        <Metric label="الوكلاء" value="18" change="منسق + 17 متخصصاً" tone="success" />
        <Metric label="المواقع المتصلة" value="294" change="من أصل 304" tone="warning" />
        <Metric label="أحداث اليوم" value="1,680" change="آخر حدث منذ 4 ثوانٍ" />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[1.35fr_.85fr]">
        <Panel title="نبض النظام" note="بيانات مباشرة من ws://192.168.100.66:5001 أو محاكاة محلية">
          <div className="grid gap-5 sm:grid-cols-2">
            {Object.entries(runtime.telemetry).map(([k, v]) => (
              <div key={k}>
                <div className="mb-2 flex justify-between font-mono text-xs">
                  <span className="uppercase text-muted-foreground">{k}</span>
                  <span>{v}%</span>
                </div>
                <ProgressBar
                  value={v}
                  tone={v > 80 ? "warning" : k === "gpu" ? "success" : "primary"}
                />
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="مسار التنفيذ" note="التنسيق الحالي بين الوكلاء">
          <div className="flex items-center gap-3">
            <AgentNode name="R1" role="Reason" active />
            <div className="h-px flex-1 bg-primary/40" />
            <AgentNode name="Termine" role="Execute" />
            <div className="h-px flex-1 bg-success/40" />
            <AgentNode name="Output" role="Verify" />
          </div>
        </Panel>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel
          title="نشاط الوكلاء"
          actions={
            <Button asChild variant="ghost" size="sm">
              <Link to="/agents">
                عرض الكل <ArrowLeft />
              </Link>
            </Button>
          }
        >
          <AgentRows />
        </Panel>
        <Panel
          title="الأحداث الأخيرة"
          actions={
            <Button asChild variant="ghost" size="sm">
              <Link to="/spy">
                فتح SPY <ArrowLeft />
              </Link>
            </Button>
          }
        >
          <EventRows events={runtime.events.slice(0, 5)} />
        </Panel>
      </div>
    </Page>
  );
}

function AgentNode({ name, role, active }: { name: string; role: string; active?: boolean }) {
  return (
    <div className="min-w-20 text-center">
      <div
        className={`mx-auto grid size-11 place-items-center rounded-md border ${active ? "border-nawat/50 bg-nawat/10 text-nawat" : "border-border bg-muted text-muted-foreground"}`}
      >
        <Bot className="size-5" />
      </div>
      <strong className="mt-2 block font-mono text-xs">{name}</strong>
      <span className="text-[10px] text-muted-foreground">{role}</span>
    </div>
  );
}
function AgentRows() {
  const { agents } = useStudioRuntime();
  return (
    <div className="space-y-4">
      {agents.map((a) => (
        <div key={a.id}>
          <div className="mb-2 flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-md bg-muted text-nawat">
              <Bot className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex justify-between gap-2">
                <strong className="text-sm">
                  {a.name} <span className="font-normal text-muted-foreground">/ {a.role}</span>
                </strong>
                <span className="font-mono text-[11px] text-muted-foreground">{a.progress}%</span>
              </div>
              <p className="truncate text-xs text-muted-foreground">{a.task}</p>
            </div>
          </div>
          <ProgressBar value={a.progress} tone={a.state === "running" ? "success" : "primary"} />
        </div>
      ))}
    </div>
  );
}
export function EventRows({ events }: { events: ReturnType<typeof useStudioRuntime>["events"] }) {
  return (
    <div className="nawat-table space-y-0">
      {events.map((e, i) => (
        <div
          key={e.id}
          className={`nawat-row grid grid-cols-[58px_70px_1fr] gap-2 py-2 text-xs ${i ? "border-t border-border/60" : ""}`}
        >
          <span className="font-mono text-muted-foreground">{e.time}</span>
          <span
            className={
              e.level === "success"
                ? "text-success"
                : e.level === "warning"
                  ? "text-warning"
                  : e.level === "error"
                    ? "text-destructive"
                    : "text-primary"
            }
          >
            {e.source}
          </span>
          <span className="truncate">{e.message}</span>
        </div>
      ))}
    </div>
  );
}

export function AgentsView() {
  const runtime = useStudioRuntime();
  return (
    <Page
      eyebrow="Agents / Runtime"
      title="الوكلاء المتعاونون"
      description="منسق واحد و17 وكيلاً متخصصاً — لكل وكيل profile.json وplan() وlearn() وحدث *.learned."
      actions={<RuntimeBadge connected={runtime.connected} />}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        {runtime.agents.map((a, i) => (
          <Panel
            key={a.id}
            title={a.name}
            note={a.role}
            actions={
              <span
                className={`rounded-full px-2 py-1 text-[10px] ${a.state === "running" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}
              >
                {a.state === "running" ? "يعمل" : "خامل"}
              </span>
            }
          >
            <div className="grid gap-5">
              <div className="flex items-center gap-4">
                <div className="grid size-16 place-items-center rounded-lg border border-nawat/30 bg-nawat/10 text-nawat">
                  <Bot className="size-7" />
                </div>
                <div>
                  <p className="font-mono text-sm">{a.model}</p>
                  <p className="mt-1 text-xs text-muted-foreground">ذاكرة الجلسة {a.memory} GB</p>
                </div>
              </div>
              <div>
                <div className="mb-2 flex justify-between text-xs">
                  <span>{a.task}</span>
                  <span>{a.progress}%</span>
                </div>
                <ProgressBar value={a.progress} tone={i ? "primary" : "success"} />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <Stat value={i ? "18" : "24"} label="أداة" />
                <Stat value={i ? "42" : "12"} label="عملية" />
                <Stat value={i ? "1.8s" : "3.2s"} label="استجابة" />
              </div>
              <div className="flex gap-2">
                <Button size="sm">
                  <Play /> تشغيل مهمة
                </Button>
                <Button size="sm" variant="outline">
                  <RefreshCw /> إعادة التشغيل
                </Button>
              </div>
            </div>
          </Panel>
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.5fr]">
        <Panel title="قناة التواصل">
          <div className="flex items-center gap-3">
            <AgentNode name="R1" role="plan" active />
            <div className="flex-1">
              <div className="mb-2 flex items-center gap-2 text-xs text-success">
                <Zap className="size-3" /> قناة مشفرة نشطة
              </div>
              <div className="h-px bg-success/50" />
            </div>
            <AgentNode name="Termine" role="act" />
          </div>
        </Panel>
        <Panel title="ذاكرة الوكلاء">
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat value="128" label="سياق محفوظ" />
            <Stat value="36.4K" label="رمز مستخدم" />
            <Stat value="92%" label="دقة الاسترجاع" />
          </div>
        </Panel>
      </div>
    </Page>
  );
}
function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-md border border-border bg-background/40 p-3">
      <strong className="block font-mono text-lg">{value}</strong>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}

export function ToolsView() {
  return (
    <Page
      eyebrow="Tools / Connections"
      title="شبكة الأدوات المحلية"
      description="نقاط الوصول إلى النظام والملفات والخوادم جاهزة للعمل عبر طبقة Electron الآمنة."
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {toolConnections.map((t) => {
          const Icon = iconMap[t.name as keyof typeof iconMap] ?? Wrench;
          return (
            <Panel key={t.name}>
              <div className="flex items-start gap-3">
                <div className="grid size-10 place-items-center rounded-md bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h2 className="font-semibold">{t.name}</h2>
                    <span className="flex items-center gap-1 text-[10px] text-success">
                      <span className="size-1.5 rounded-full bg-success" />
                      {t.state}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t.detail} · {t.latency}
                  </p>
                </div>
              </div>
              <div className="mt-5 flex gap-2">
                <Button size="sm" variant="outline">
                  فحص الاتصال
                </Button>
                <Button size="sm" variant="ghost">
                  إعداد
                </Button>
              </div>
            </Panel>
          );
        })}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="أدوات الجسر" note="16 أداة عبر :8787">
          <div className="grid gap-2 sm:grid-cols-2">
            {bridgeTools.map((t) => (
              <div
                key={t.name}
                className="rounded-md border border-border p-2.5"
              >
                <p className="font-mono text-xs font-semibold">{t.name}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">{t.desc}</p>
              </div>
            ))}
          </div>
        </Panel>
        <div className="grid gap-4">
          <Panel title="خوادم SSH">
            <div className="nawat-table space-y-2">
              {["production-eu", "staging-01", "gpu-worker"].map((x, i) => (
                <div
                  key={x}
                  className="nawat-row nawat-row-card flex items-center gap-3 rounded-md border border-border p-3"
                >
                  <Server className="size-4 text-primary" />
                  <span className="font-mono text-xs">{x}</span>
                  <span className="flex-1" />
                  <span className={i === 2 ? "text-warning" : "text-success"}>
                    {i === 2 ? "58 ms" : "متصل"}
                  </span>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="الأمان والصلاحيات">
            <div className="space-y-3 text-sm">
              <CheckLine icon={ShieldCheck} text="أسرار الاتصالات محفوظة محليًا" />
              <CheckLine icon={KeyRound} text="مفاتيح SSH لا تمر إلى الواجهة" />
              <CheckLine icon={HardDrive} text="كل العمليات مسجلة في سجل التدقيق" />
            </div>
          </Panel>
        </div>
      </div>
    </Page>
  );
}
function CheckLine({ icon: Icon, text }: { icon: typeof ShieldCheck; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="size-4 text-success" />
      <span>{text}</span>
    </div>
  );
}

export function SpyView() {
  const runtime = useStudioRuntime();
  return (
    <Page
      eyebrow="Spy / Observability"
      title="المراقبة والتحقيق"
      description="تتبّع المواقع والموارد ومكالمات النماذج والأحداث الأمنية لحظة بلحظة."
      actions={<RuntimeBadge connected={runtime.connected} />}
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="متصل" value="294" tone="success" />
        <Metric label="معطل" value="10" tone="warning" />
        <Metric label="قيد الانتظار" value="0" />
        <Metric label="معدل الأحداث" value="18/s" />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[1.45fr_.55fr]">
        <Panel title="سجل الأحداث الحي" note="1,680 حدثاً في جلسة التشغيل">
          <EventRows events={runtime.events} />
        </Panel>
        <div className="grid gap-4">
          <Panel title="موارد الجهاز">
            <div className="space-y-4">
              {Object.entries(runtime.telemetry).map(([k, v]) => (
                <div key={k}>
                  <div className="mb-1 flex justify-between font-mono text-xs uppercase">
                    <span>{k}</span>
                    <span>{v}%</span>
                  </div>
                  <ProgressBar value={v} tone={v > 80 ? "warning" : "success"} />
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="حالة المواقع">
            <div className="mx-auto grid aspect-square max-w-56 place-items-center rounded-full border-[18px] border-success/70">
              <div className="text-center">
                <strong className="font-mono text-3xl">96.7%</strong>
                <span className="block text-xs text-muted-foreground">متاح</span>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </Page>
  );
}

export function ArchitectureView() {
  const nodes = [
    { icon: Users, title: "NAWAT Studio", sub: "React + Electron" },
    { icon: Network, title: "Orchestrator", sub: "WebSocket :5001" },
    { icon: Bot, title: "Agent Runtime", sub: "Rust / R1 + Termine" },
    { icon: Cpu, title: "Ollama Engine", sub: "Local inference" },
    { icon: Database, title: "Local Storage", sub: "FS + JSON Registry" },
  ];
  return (
    <Page
      eyebrow="System / Architecture"
      title="بنية النظام"
      description="مسار محلي بالكامل يفصل الواجهة والتنسيق والوكلاء ومحرك النماذج والتخزين."
    >
      <Panel>
        <div className="grid gap-3 lg:grid-cols-5">
          {nodes.map(({ icon: Icon, title, sub }, i) => (
            <div key={title} className="relative">
              <div className="flex min-h-40 flex-col items-center justify-center rounded-md border border-border bg-background/40 p-4 text-center">
                <div className="grid size-12 place-items-center rounded-md bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </div>
                <strong className="mt-3 text-sm">{title}</strong>
                <span className="mt-1 font-mono text-[10px] text-muted-foreground">{sub}</span>
              </div>
              {i < nodes.length - 1 && (
                <ArrowLeft className="absolute top-1/2 -left-5 z-10 hidden size-4 text-nawat lg:block" />
              )}
            </div>
          ))}
        </div>
      </Panel>
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Panel title="واجهة التطبيق">
          <p className="text-xs leading-6 text-muted-foreground">
            لوحات React، Monaco، xterm.js، وإدارة الجلسات المتعددة.
          </p>
        </Panel>
        <Panel title="طبقة التنسيق">
          <p className="text-xs leading-6 text-muted-foreground">
            توزيع المهام ومراقبة الحالة وإعادة الاتصال تلقائيًا.
          </p>
        </Panel>
        <Panel title="طبقة التنفيذ">
          <p className="text-xs leading-6 text-muted-foreground">
            وكلاء Rust بأدوات وذاكرة معزولة لكل دور.
          </p>
        </Panel>
        <Panel title="طبقة الجهاز">
          <p className="text-xs leading-6 text-muted-foreground">
            ملفات، PowerShell، SSH، SFTP وOllama دون خادم خارجي.
          </p>
        </Panel>
      </div>
    </Page>
  );
}

export function ModelsSnapshot() {
  return (
    <div className="nawat-table space-y-2">
      {demoModels.map((m) => (
        <div
          key={m.name}
          className="nawat-row nawat-row-card grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-md border border-border p-3"
        >
          <div className="min-w-0">
            <p className="truncate font-mono text-xs">{m.name}</p>
            <p className="text-[10px] text-muted-foreground">{m.size}</p>
          </div>
          <span className="font-mono text-[10px] text-muted-foreground">{m.vram}</span>
          <span
            className={`size-2 rounded-full ${m.state === "running" ? "signal-pulse bg-success" : "bg-muted-foreground"}`}
          />
        </div>
      ))}
    </div>
  );
}
