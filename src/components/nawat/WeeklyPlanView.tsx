import { useEffect, useState } from "react";
import { Bot, Boxes, Check, Cpu, Rocket, Route as RouteIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Metric, Page, Panel } from "./StudioUI";
import {
  activateModel,
  getPlanStates,
  proposedAgents,
  proposedModels,
  proposedServices,
  setPlanState,
  subscribeWeeklyPlan,
  type PlanState,
} from "@/lib/nawat/weekly-plan";

const stateLabel: Record<PlanState, string> = {
  planned: "قيد التطوير",
  ready: "جاهز للتفعيل",
  active: "مفعّل",
};

export function WeeklyPlanView() {
  const [states, setStates] = useState<Record<string, PlanState>>({});
  useEffect(() => {
    const refresh = () => setStates(getPlanStates());
    refresh();
    return subscribeWeeklyPlan(refresh);
  }, []);
  const stateOf = (id: string) => states[id] ?? "planned";
  const activeCount = Object.values(states).filter((state) => state === "active").length;

  return (
    <Page
      eyebrow="Roadmap / This Week"
      title="إضافات هذا الأسبوع"
      description="نماذج ووكلاء وخدمات مرتبة حسب الأولوية، مع تفعيل آمن بعد اكتمال الجاهزية."
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="نماذج مقترحة" value="5" change="2 بأولوية قصوى" tone="success" />
        <Metric label="وكلاء متخصصون" value="5" change="امتداد لفريق الـ15" />
        <Metric label="خدمات ناقصة" value="3" change="واجهتان + مهمة تشغيل" tone="warning" />
        <Metric
          label="تم تفعيلها"
          value={`${activeCount}`}
          change="تظهر مباشرة في البرنامج"
          tone={activeCount ? "success" : "default"}
        />
      </div>

      <section className="mt-5">
        <SectionHeading icon={Cpu} title="نماذج جديدة" count={proposedModels.length} />
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {proposedModels.map((model) => {
            const key = `model:${model.id}`;
            const state = stateOf(key);
            return (
              <Panel
                key={model.id}
                title={model.name}
                note={model.role}
                actions={<Priority value={model.priority} />}
              >
                <p className="min-h-12 text-xs leading-6 text-muted-foreground">{model.reason}</p>
                <ActivationActions
                  state={state}
                  onReady={() => setPlanState(key, "ready")}
                  onActivate={() => activateModel(model)}
                />
              </Panel>
            );
          })}
        </div>
      </section>

      <section className="mt-6">
        <SectionHeading icon={Bot} title="وكلاء متخصصون" count={proposedAgents.length} />
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {proposedAgents.map((agent) => {
            const key = `agent:${agent.id}`;
            const state = stateOf(key);
            return (
              <Panel key={agent.id} title={agent.name} note={agent.specialty}>
                <div className="space-y-2 text-xs">
                  <p>
                    <span className="text-muted-foreground">أول مهمة:</span> {agent.firstTask}
                  </p>
                  <p className="font-mono text-[11px] text-muted-foreground">{agent.model}</p>
                </div>
                <ActivationActions
                  state={state}
                  onReady={() => setPlanState(key, "ready")}
                  onActivate={() => setPlanState(key, "active")}
                />
              </Panel>
            );
          })}
        </div>
      </section>

      <section className="mt-6">
        <SectionHeading icon={Boxes} title="خدمات البنية" count={proposedServices.length} />
        <div className="grid gap-3 lg:grid-cols-3">
          {proposedServices.map((service) => (
            <Panel key={service.id} title={service.name} note="مقترح للتنفيذ">
              <p className="text-xs leading-6 text-muted-foreground">{service.purpose}</p>
              <div className="mt-4 flex items-center gap-2 rounded-md border border-border bg-background/40 px-3 py-2 font-mono text-[11px] text-foreground">
                <RouteIcon className="size-3.5 text-primary" />{" "}
                {service.endpoint ?? "server:start-all"}
              </div>
            </Panel>
          ))}
        </div>
      </section>
    </Page>
  );
}

function SectionHeading({
  icon: Icon,
  title,
  count,
}: {
  icon: typeof Cpu;
  title: string;
  count: number;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <Icon className="size-4 text-nawat" />
      <h2 className="text-sm font-semibold">{title}</h2>
      <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
        {count}
      </span>
    </div>
  );
}

function Priority({ value }: { value: number }) {
  return (
    <span className="text-xs text-warning" aria-label={`الأولوية ${value} من 3`}>
      {"★".repeat(value)}
      {"☆".repeat(3 - value)}
    </span>
  );
}

function ActivationActions({
  state,
  onReady,
  onActivate,
}: {
  state: PlanState;
  onReady: () => void;
  onActivate: () => void;
}) {
  return (
    <div className="mt-4 flex items-center gap-2 border-t border-border pt-3">
      <span
        className={`me-auto text-[11px] ${state === "active" ? "text-success" : state === "ready" ? "text-warning" : "text-muted-foreground"}`}
      >
        {stateLabel[state]}
      </span>
      {state === "planned" && (
        <Button size="sm" variant="outline" onClick={onReady}>
          <Check /> تحديد كجاهز
        </Button>
      )}
      {state === "ready" && (
        <Button size="sm" onClick={onActivate}>
          <Rocket /> تفعيل في البرنامج
        </Button>
      )}
      {state === "active" && (
        <span className="flex items-center gap-1 text-xs text-success">
          <Check className="size-3.5" /> نشط
        </span>
      )}
    </div>
  );
}
