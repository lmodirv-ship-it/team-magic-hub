import type { ReactNode } from "react";
import { WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

export function Page({
  title,
  eyebrow,
  description,
  actions,
  children,
}: {
  title: string;
  eyebrow: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="min-w-0 flex-1 overflow-auto bg-background">
      <div className="mx-auto w-full max-w-[1540px] p-4 sm:p-6 lg:p-8">
        <header className="mb-7 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 sm:flex sm:flex-wrap sm:justify-between">
          <div className="min-w-0">
            <p className="mb-2 font-mono text-[11px] font-semibold tracking-[0.18em] text-nawat uppercase">
              {eyebrow}
            </p>
            <h1 className="truncate text-2xl font-semibold sm:text-3xl">{title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
          </div>
          {actions}
        </header>
        {children}
      </div>
    </main>
  );
}

export function Panel({
  title,
  note,
  className,
  actions,
  children,
}: {
  title?: string;
  note?: string;
  className?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={cn("glass-panel overflow-hidden rounded-lg", className)}>
      {(title || actions) && (
        <header className="flex items-center gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">{title}</h2>
            {note && <p className="mt-0.5 text-[11px] text-muted-foreground">{note}</p>}
          </div>
          <div className="flex-1" />
          {actions}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Metric({
  label,
  value,
  change,
  tone = "default",
}: {
  label: string;
  value: string;
  change?: string;
  tone?: "default" | "success" | "warning";
}) {
  return (
    <div className="glass-panel rounded-lg p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span
          className={cn(
            "size-2 rounded-full",
            tone === "success" ? "bg-success" : tone === "warning" ? "bg-warning" : "bg-primary",
          )}
        />
      </div>
      <strong className="mt-3 block font-mono text-2xl font-medium">{value}</strong>
      {change && <span className="mt-1 block text-[11px] text-muted-foreground">{change}</span>}
    </div>
  );
}

export function RuntimeBadge({ connected }: { connected: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border px-3 py-2 text-xs",
        connected
          ? "border-success/30 bg-success/10 text-success"
          : "border-warning/30 bg-warning/10 text-warning",
      )}
    >
      <span
        className={cn("size-2 rounded-full", connected ? "animate-pulse bg-success" : "bg-warning")}
      />
      {connected ? (
        "WebSocket مباشر"
      ) : (
        <>
          <WifiOff className="size-3.5" /> بيانات تجريبية
        </>
      )}
    </div>
  );
}

export function ProgressBar({
  value,
  tone = "primary",
}: {
  value: number;
  tone?: "primary" | "success" | "warning";
}) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-700",
          tone === "success" ? "bg-success" : tone === "warning" ? "bg-warning" : "bg-primary",
        )}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}
