// ============= Density switch: أصغر · عادي · أكبر =============

import { Minus, Plus, Scaling } from "lucide-react";
import { cn } from "@/lib/utils";
import { setTableDensity, useTableDensity, type TableDensity } from "@/lib/nawat/density";

const options: { value: TableDensity; label: string; icon: typeof Plus }[] = [
  { value: "compact", label: "أصغر", icon: Minus },
  { value: "default", label: "عادي", icon: Scaling },
  { value: "large", label: "أكبر", icon: Plus },
];

export function DensityControl({ className }: { className?: string }) {
  const density = useTableDensity();

  return (
    <div
      className={cn(
        "flex items-center rounded-md border border-border bg-background/60",
        className,
      )}
      role="group"
      aria-label="حجم الجداول"
    >
      {options.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => setTableDensity(value)}
          aria-pressed={density === value}
          title={`حجم الجداول: ${label}`}
          className={cn(
            "flex items-center gap-1 px-2 py-1 text-[11px] transition-colors first:rounded-s-md last:rounded-e-md",
            density === value
              ? "bg-nawat/15 text-nawat"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon className="size-3" />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}
