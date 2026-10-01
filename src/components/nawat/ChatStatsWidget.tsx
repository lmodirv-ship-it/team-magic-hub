import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Activity, Bot, CheckCircle2, FolderOpen, RefreshCw, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useLive } from "@/lib/nawat/live";
import { useModels } from "@/lib/nawat/useModels";
import { LIBRARY_ROOT, useWorkspace } from "@/lib/nawat/workspace";
import { cn } from "@/lib/utils";

type StatKey = "activeModels" | "filesGenerated" | "filesFixed" | "analysesDone";
type StatValues = Record<StatKey, number>;
type StatHistory = Record<StatKey, number[]>;
type StatTrends = Record<StatKey, string>;

type StatsPayload = StatValues & {
  type?: "stats.update";
  history?: Partial<StatHistory>;
  trends?: Partial<StatTrends>;
};

const STAT_KEYS: StatKey[] = ["activeModels", "filesGenerated", "filesFixed", "analysesDone"];
const EMPTY_STATS: StatValues = {
  activeModels: 0,
  filesGenerated: 0,
  filesFixed: 0,
  analysesDone: 0,
};
const EMPTY_TRENDS: StatTrends = {
  activeModels: "+0%",
  filesGenerated: "+0%",
  filesFixed: "+0%",
  analysesDone: "+0%",
};

function isStatsPayload(value: unknown): value is StatsPayload {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<StatsPayload>;
  return STAT_KEYS.every((key) => typeof item[key] === "number");
}

function normalizedHistory(payload: StatsPayload): StatHistory {
  return Object.fromEntries(
    STAT_KEYS.map((key) => {
      const values = payload.history?.[key]?.filter(Number.isFinite).slice(-10) ?? [];
      return [key, values.length ? values : Array(10).fill(payload[key])];
    }),
  ) as StatHistory;
}

function Sparkline({ values }: { values: number[] }) {
  const points = useMemo(() => {
    const safe = values.length > 1 ? values.slice(-10) : [values[0] ?? 0, values[0] ?? 0];
    const min = Math.min(...safe);
    const max = Math.max(...safe);
    const range = max - min || 1;
    return safe
      .map(
        (value, index) =>
          `${(index / (safe.length - 1)) * 38 + 1},${15 - ((value - min) / range) * 12}`,
      )
      .join(" ");
  }, [values]);

  return (
    <svg
      width="40"
      height="16"
      viewBox="0 0 40 16"
      aria-hidden="true"
      className="shrink-0 overflow-visible"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        className="text-nawat transition-all duration-300"
      />
    </svg>
  );
}

function AnimatedNumber({ value }: { value: number }) {
  const [displayed, setDisplayed] = useState(value);
  const displayedRef = useRef(value);

  useEffect(() => {
    const start = displayedRef.current;
    const startedAt = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min((now - startedAt) / 300, 1);
      const eased = 1 - (1 - progress) ** 3;
      const next = Math.round(start + (value - start) * eased);
      displayedRef.current = next;
      setDisplayed(next);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <span className="inline-block min-w-7 text-end tabular-nums">{displayed}</span>;
}

function relativeUpdate(timestamp: number | null, now: number) {
  if (!timestamp) return "لم يتم التحديث بعد";
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 2) return "الآن";
  if (seconds < 60) return `منذ ${seconds} ث`;
  return `منذ ${Math.floor(seconds / 60)} د`;
}

export function ChatStatsWidget({ variant = "panel" }: { variant?: "panel" | "header" }) {
  const navigate = useNavigate();
  const { running } = useModels(5000);
  const { vfs, meta, openFile } = useWorkspace();
  const [remote, setRemote] = useState<StatValues | null>(null);
  const [history, setHistory] = useState<StatHistory | null>(null);
  const [trends, setTrends] = useState<StatTrends>(EMPTY_TRENDS);
  const { connected, lastStats } = useLive();
  const [refreshing, setRefreshing] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [modelsOpen, setModelsOpen] = useState(false);
  const previous = useRef<StatValues | null>(null);
  const audioContext = useRef<AudioContext | null>(null);

  const local = useMemo(() => {
    const generated = Object.keys(vfs).filter(
      (path) => path.startsWith(`${LIBRARY_ROOT}/`) || meta[path]?.source === "atelier",
    );
    return {
      activeModels: running.length,
      filesGenerated: generated.length,
      filesFixed: generated.filter((path) =>
        /corrig[ée]|corrected|fixed/i.test(`${path}\n${vfs[path] ?? ""}`),
      ).length,
      analysesDone: generated.filter((path) => meta[path]?.source === "atelier").length,
    };
  }, [meta, running.length, vfs]);

  const stats = useMemo(
    () =>
      Object.fromEntries(STAT_KEYS.map((key) => [key, remote?.[key] || local[key]])) as StatValues,
    [local, remote],
  );
  const visibleHistory = useMemo(
    () =>
      history ??
      (Object.fromEntries(
        STAT_KEYS.map((key) => [key, Array(10).fill(stats[key])]),
      ) as StatHistory),
    [history, stats],
  );

  const acceptPayload = useCallback((payload: StatsPayload) => {
    setRemote(Object.fromEntries(STAT_KEYS.map((key) => [key, payload[key]])) as StatValues);
    setHistory(normalizedHistory(payload));
    setTrends({ ...EMPTY_TRENDS, ...payload.trends });
    setLastUpdated(Date.now());
  }, []);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await fetch("/api/stats", { cache: "no-store" });
      if (!response.ok) return;
      const payload: unknown = await response.json();
      if (isStatsPayload(payload)) acceptPayload(payload);
    } catch {
      // Keep local workspace values visible while the companion server is offline.
    } finally {
      setRefreshing(false);
    }
  }, [acceptPayload]);

  useEffect(() => {
    void load();
    const poll = window.setInterval(load, 5000);
    return () => window.clearInterval(poll);
  }, [load]);

  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(clock);
  }, []);

  useEffect(() => {
    if (lastStats && isStatsPayload(lastStats)) acceptPayload(lastStats);
  }, [acceptPayload, lastStats]);

  useEffect(() => {
    if (!previous.current) {
      previous.current = stats;
      return;
    }
    const changed = STAT_KEYS.some((key) => previous.current?.[key] !== stats[key]);
    previous.current = stats;
    if (!changed || !soundEnabled) return;
    try {
      const AudioContextClass = window.AudioContext;
      const context = audioContext.current ?? new AudioContextClass();
      audioContext.current = context;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = 620;
      gain.gain.setValueAtTime(0.025, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.09);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.09);
    } catch {
      // Audio can be blocked until the first user gesture.
    }
  }, [soundEnabled, stats]);

  useEffect(
    () => () => {
      if (audioContext.current) void audioContext.current.close();
    },
    [],
  );

  const rows: { key: StatKey; label: string; icon: typeof Bot; action: () => void }[] = [
    { key: "activeModels", label: "النماذج النشطة", icon: Bot, action: () => setModelsOpen(true) },
    {
      key: "filesGenerated",
      label: "الملفات المولّدة",
      icon: FolderOpen,
      action: () => {
        const first = Object.keys(vfs).find((path) => path.startsWith(`${LIBRARY_ROOT}/`));
        if (first) openFile(first);
        void navigate({ to: "/workspace" });
      },
    },
    {
      key: "filesFixed",
      label: "الملفات المصححة",
      icon: CheckCircle2,
      action: () => void navigate({ to: "/resultats", search: { status: "fixed" } }),
    },
    {
      key: "analysesDone",
      label: "التحليلات المنجزة",
      icon: Activity,
      action: () => void navigate({ to: "/atelier" }),
    },
  ];

  if (variant === "header") {
    return (
      <TooltipProvider delayDuration={200}>
        <div
          className="flex h-8 shrink-0 items-center gap-0.5 rounded-md border border-nawat/30 bg-background px-1"
          aria-label="إحصائيات NAWAT"
        >
          <span
            className={cn(
              "mx-1 size-1.5 shrink-0 rounded-full",
              connected ? "bg-success" : "bg-destructive",
            )}
            title={connected ? "متصل بالخادم" : "غير متصل بالخادم"}
          />
          {rows.map(({ key, label, icon: Icon, action }) => {
            const values = visibleHistory[key];
            const hourAgo = values[Math.max(0, values.length - 2)] ?? stats[key];
            const dayAgo = values[0] ?? stats[key];
            return (
              <Tooltip key={key}>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={action}
                    className="h-6 gap-1 rounded px-1.5 text-[12px] font-normal"
                    aria-label={label}
                  >
                    <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                    <strong className="font-mono text-[12px] text-nawat">
                      <AnimatedNumber value={stats[key]} />
                    </strong>
                  </Button>
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  align="center"
                  collisionPadding={8}
                  className="max-w-48 border border-border bg-popover p-2 text-popover-foreground shadow-lg"
                >
                  <div className="mb-1 text-[11px] font-semibold">{label}</div>
                  <div className="grid grid-cols-[auto_auto] gap-x-4 gap-y-1 whitespace-nowrap text-[11px]">
                    <span>القيمة الحالية</span>
                    <strong className="text-nawat">{stats[key]}</strong>
                    <span>قبل ساعة</span>
                    <span>{hourAgo}</span>
                    <span>قبل 24 ساعة</span>
                    <span>{dayAgo}</span>
                    <span>الاتجاه</span>
                    <strong
                      className={trends[key].startsWith("-") ? "text-destructive" : "text-success"}
                    >
                      {trends[key]}
                    </strong>
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        <Dialog open={modelsOpen} onOpenChange={setModelsOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>النماذج النشطة</DialogTitle>
              <DialogDescription>النماذج المحمّلة حاليًا في NAWAT Studio.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              {running.length ? (
                running.map((model) => (
                  <div
                    key={model.name}
                    className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2"
                  >
                    <span className="size-2 rounded-full bg-success" />
                    <span className="min-w-0 flex-1 truncate font-mono text-xs">{model.name}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">لا توجد نماذج نشطة حاليًا.</p>
              )}
            </div>
            <Button onClick={() => void navigate({ to: "/models" })}>إدارة النماذج</Button>
          </DialogContent>
        </Dialog>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider delayDuration={250}>
      <section className="shrink-0 border-t border-border bg-card p-2" aria-label="إحصائيات NAWAT">
        <div className="overflow-hidden rounded-lg border border-nawat/30 bg-background">
          <div className="flex h-8 items-center gap-2 border-b border-border px-2.5 text-[11px] text-muted-foreground">
            <span
              className={cn(
                "size-2 shrink-0 rounded-full",
                connected ? "bg-success" : "bg-destructive",
              )}
            />
            <span className="min-w-0 flex-1 truncate">
              {connected ? "متصل بالخادم" : "غير متصل بالخادم"}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-6"
              title={soundEnabled ? "إيقاف الصوت" : "تشغيل الصوت"}
              aria-label={soundEnabled ? "إيقاف الصوت" : "تشغيل الصوت"}
              aria-pressed={soundEnabled}
              onClick={() => setSoundEnabled((enabled) => !enabled)}
            >
              {soundEnabled ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-6"
              title="تحديث الآن"
              aria-label="تحديث الآن"
              onClick={() => void load()}
            >
              <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
            </Button>
          </div>

          <div className="p-1.5">
            {rows.map(({ key, label, icon: Icon, action }) => {
              const values = visibleHistory[key];
              const hourAgo = values[Math.max(0, values.length - 2)] ?? stats[key];
              const dayAgo = values[0] ?? stats[key];
              return (
                <Tooltip key={key}>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={action}
                      className="h-7 w-full justify-start gap-1.5 rounded px-1.5 text-[12px] font-normal"
                    >
                      <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate text-start text-muted-foreground">
                        {label}
                      </span>
                      <strong className="font-mono text-[13px] text-nawat">
                        <AnimatedNumber value={stats[key]} />
                      </strong>
                      <Sparkline values={values} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    align="end"
                    collisionPadding={8}
                    className="max-w-48 border border-border bg-popover p-2 text-popover-foreground shadow-lg"
                  >
                    <div className="grid grid-cols-[auto_auto] gap-x-4 gap-y-1 whitespace-nowrap text-[11px]">
                      <span>القيمة الحالية</span>
                      <strong className="text-nawat">{stats[key]}</strong>
                      <span>قبل ساعة</span>
                      <span>{hourAgo}</span>
                      <span>قبل 24 ساعة</span>
                      <span>{dayAgo}</span>
                      <span>الاتجاه</span>
                      <strong
                        className={
                          trends[key].startsWith("-") ? "text-destructive" : "text-success"
                        }
                      >
                        {trends[key]}
                      </strong>
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>

          <div className="border-t border-border px-2.5 py-1.5 text-[10px] text-muted-foreground">
            آخر تحديث: {relativeUpdate(lastUpdated, now)}
          </div>
        </div>
      </section>

      <Dialog open={modelsOpen} onOpenChange={setModelsOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>النماذج النشطة</DialogTitle>
            <DialogDescription>النماذج المحمّلة حاليًا في NAWAT Studio.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {running.length ? (
              running.map((model) => (
                <div
                  key={model.name}
                  className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2"
                >
                  <span className="size-2 rounded-full bg-success" />
                  <span className="min-w-0 flex-1 truncate font-mono text-xs">{model.name}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">لا توجد نماذج نشطة حاليًا.</p>
            )}
          </div>
          <Button onClick={() => void navigate({ to: "/models" })}>إدارة النماذج</Button>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
