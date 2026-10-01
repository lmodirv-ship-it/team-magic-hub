import { Link } from "@tanstack/react-router";
import {
  Bot,
  CheckCircle2,
  Code2,
  Cpu,
  Eye,
  Globe2,
  HardDrive,
  Languages,
  MonitorCog,
  ClipboardList,
  Server,
  ShieldCheck,
  SquareTerminal,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Metric, Page, Panel, ProgressBar, RuntimeBadge } from "./StudioUI";
import { EventRows } from "./StudioViews";
import {
  deployPipeline,
  demoModels,
  infraNodes,
  siteStats,
  toolConnections,
  useStudioRuntime,
} from "@/lib/nawat/studio";

const toolIcons: Record<string, typeof Server> = {
  SSH: Server,
  SFTP: Upload,
  "Monaco Editor": Code2,
  PowerShell: SquareTerminal,
  "File Watcher": Eye,
  "ZIP Engine": HardDrive,
};

const statusTone = {
  online: "bg-success",
  degraded: "bg-warning",
  offline: "bg-destructive",
} as const;

export function MissionControlView() {
  const runtime = useStudioRuntime();
  const uptime = ((siteStats.online / siteStats.total) * 100).toFixed(1);

  return (
    <Page
      eyebrow="Mission Control / NAWAT Studio"
      title="مركز القيادة الموزّع"
      description="عقدتان، تسعة نماذج محلية، ثمانية عشر وكيلاً متعاوناً، ومراقبة حية — كل شيء دون سحابة."
      actions={<RuntimeBadge connected={runtime.connected} />}
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="العقد النشطة" value="2" change="محلي · VPS (66)" tone="success" />
        <Metric label="النماذج المحلية" value="9" change="~22 GB إجمالي" tone="success" />
        <Metric
          label="المواقع المتصلة"
          value={`${siteStats.online}`}
          change={`من ${siteStats.total} · ${uptime}%`}
          tone="warning"
        />
        <Metric label="الأحداث المسجّلة" value="1,680" change="بث حي عبر :5001" />
      </div>
      <div className="mt-4 flex items-center gap-3 rounded-lg border border-nawat/30 bg-nawat/5 px-4 py-3">
        <ClipboardList className="size-5 text-nawat" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">خطة إضافات هذا الأسبوع</p>
          <p className="truncate text-xs text-muted-foreground">
            5 نماذج · 5 وكلاء · 3 خدمات · تفعيل عند الجاهزية
          </p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link to="/plan">فتح الخطة</Link>
        </Button>
      </div>

      {/* Nodes */}
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {infraNodes.map((n) => (
          <Panel
            key={n.id}
            title={n.label}
            note={`${n.role} · ${n.host}`}
            actions={
              <span className={`size-2 rounded-full signal-pulse ${statusTone[n.status]}`} />
            }
          >
            <div className="space-y-3">
              {[
                ["CPU", n.cpu],
                ["RAM", n.ram],
                ["GPU", n.gpu],
              ].map(([k, v]) => (
                <div key={k as string}>
                  <div className="mb-1 flex justify-between font-mono text-[11px] text-muted-foreground">
                    <span>{k}</span>
                    <span>{v}%</span>
                  </div>
                  <ProgressBar
                    value={v as number}
                    tone={(v as number) > 80 ? "warning" : "success"}
                  />
                </div>
              ))}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {n.models.map((m) => (
                  <span
                    key={m}
                    className="rounded border border-border bg-background/50 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>
          </Panel>
        ))}
      </div>

      {/* Agents + Toolchain */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel
          title="الوكلاء"
          note="منسق واحد + 17 متخصصاً"
          actions={
            <Button asChild variant="ghost" size="sm">
              <Link to="/agents">تفاصيل</Link>
            </Button>
          }
        >
          <div className="space-y-4">
            {runtime.agents.map((a) => (
              <div key={a.id} className="rounded-md border border-border p-3">
                <div className="flex items-center gap-3">
                  <div className="grid size-9 place-items-center rounded-md bg-nawat/10 text-nawat">
                    <Bot className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between gap-2">
                      <strong className="text-sm">{a.name}</strong>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {a.memory} GB
                      </span>
                    </div>
                    <p className="truncate font-mono text-[10px] text-muted-foreground">
                      {a.model}
                    </p>
                  </div>
                </div>
                <p className="mt-2 truncate text-xs text-muted-foreground">{a.task}</p>
                <div className="mt-2">
                  <ProgressBar
                    value={a.progress}
                    tone={a.state === "running" ? "success" : "primary"}
                  />
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          title="سلسلة الأدوات"
          note="SSH · SFTP · Terminal · Monaco"
          actions={
            <Button asChild variant="ghost" size="sm">
              <Link to="/tools">فتح</Link>
            </Button>
          }
        >
          <div className="grid gap-2 sm:grid-cols-2">
            {toolConnections.map((t) => {
              const Icon = toolIcons[t.name] ?? Cpu;
              return (
                <div
                  key={t.name}
                  className="flex items-center gap-3 rounded-md border border-border p-3"
                >
                  <Icon className="size-4 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold">{t.name}</p>
                    <p className="truncate text-[10px] text-muted-foreground">{t.detail}</p>
                  </div>
                  <span className="size-1.5 rounded-full bg-success" />
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      {/* Model x Node matrix + pipeline */}
      <div className="mt-4 grid gap-4 xl:grid-cols-[1.3fr_.7fr]">
        <Panel title="مصفوفة النماذج × العقد" note="توزيع ملفات GGUF على البنية">
          <div className="nawat-table overflow-x-auto">
            <table className="w-full min-w-[520px] text-xs">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="p-2 text-start font-normal">النموذج</th>
                  <th className="p-2 text-start font-normal">الحجم</th>
                  {infraNodes.map((n) => (
                    <th key={n.id} className="p-2 text-center font-normal">
                      {n.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {demoModels.map((m) => (
                  <tr key={m.name} className="border-t border-border/60">
                    <td className="p-2 font-mono">{m.name}</td>
                    <td className="p-2 text-muted-foreground">{m.size}</td>
                    {infraNodes.map((n) => (
                      <td key={n.id} className="p-2 text-center">
                        {n.models.includes(m.name) ? (
                          <span className="nawat-dot inline-block rounded-full bg-success" />
                        ) : (
                          <span className="nawat-dot inline-block rounded-full bg-muted" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel title="خط النشر" note="تقسيم · SFTP · SHA256 · ollama create">
          <div className="space-y-2">
            {deployPipeline.map((p) => (
              <div key={p.step} className="flex items-center gap-2 text-xs">
                <CheckCircle2 className="size-4 shrink-0 text-success" />
                <span className="min-w-0 flex-1 truncate">{p.step}</span>
                <span className="font-mono text-[10px] text-muted-foreground">{p.detail}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Spy + Settings */}
      <div className="mt-4 grid gap-4 xl:grid-cols-[1.3fr_.7fr]">
        <Panel
          title="المراقبة الحية"
          note={`${siteStats.online} متصل · ${siteStats.offline} معطل · ${siteStats.pending} قيد الانتظار`}
          actions={
            <Button asChild variant="ghost" size="sm">
              <Link to="/spy">السجل الكامل</Link>
            </Button>
          }
        >
          <div className="mb-3 grid gap-2 sm:grid-cols-3">
            <MiniStat
              icon={Globe2}
              label="متصل"
              value={`${siteStats.online}`}
              tone="text-success"
            />
            <MiniStat
              icon={Globe2}
              label="معطل"
              value={`${siteStats.offline}`}
              tone="text-warning"
            />
            <MiniStat
              icon={Cpu}
              label="VRAM"
              value={`${runtime.telemetry.vram}%`}
              tone="text-primary"
            />
          </div>
          <EventRows events={runtime.events.slice(0, 7)} />
        </Panel>

        <Panel
          title="الإعدادات"
          actions={
            <Button asChild variant="ghost" size="sm">
              <Link to="/settings">تعديل</Link>
            </Button>
          }
        >
          <div className="space-y-3 text-xs">
            <SettingLine icon={Bot} label="نموذج لكل وكيل" value="حسب الدور" />
            <SettingLine icon={ShieldCheck} label="صلاحيات الوكلاء" value="مقيدة" />
            <SettingLine icon={MonitorCog} label="نقاط API" value="192.168.100.66:5001" />
            <SettingLine icon={Languages} label="اللغة والسمة" value="عربي RTL · داكن" />
            <SettingLine icon={HardDrive} label="النسخ الاحتياطي" value="محلي" />
          </div>
        </Panel>
      </div>
    </Page>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Globe2;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border p-2.5">
      <Icon className={`size-4 ${tone}`} />
      <div>
        <strong className="block font-mono text-sm">{value}</strong>
        <span className="text-[10px] text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}

function SettingLine({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Bot;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="size-4 text-primary" />
      <span className="flex-1">{label}</span>
      <span className="font-mono text-[10px] text-muted-foreground">{value}</span>
    </div>
  );
}
