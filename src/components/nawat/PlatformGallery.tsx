import { Check, LayoutTemplate } from "lucide-react";
import { Button } from "@/components/ui/button";
import { platformStyles, usePlatform } from "@/lib/nawat/platform";

export function PlatformGallery() {
  const { style, setPlatform } = usePlatform();
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {platformStyles.map((s) => {
        const on = s.id === style;
        return (
          <div key={s.id} className={`rounded-md border p-3 ${on ? "border-primary" : "border-border"}`}>
            <div className="text-sm font-semibold">{s.name}</div>
            <p className="mt-1 min-h-8 text-[11px] text-muted-foreground">{s.description}</p>
            <Button className="mt-2" size="sm" variant={on ? "default" : "outline"} aria-pressed={on} onClick={() => setPlatform(s.id)}>
              {on ? <Check /> : <LayoutTemplate />} {on ? "مفعّل" : "تفعيل"}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
