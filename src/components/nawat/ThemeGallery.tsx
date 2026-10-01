import { Check, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { themes, useTheme, type ThemeId } from "@/lib/nawat/theme";

export function ThemeGallery() {
  const { theme: activeTheme, setTheme } = useTheme();

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[620px] text-sm">
          <thead className="bg-muted/60 text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-3 py-2 text-start font-medium">المعاينة</th>
              <th className="px-3 py-2 text-start font-medium">اسم الستايل</th>
              <th className="px-3 py-2 text-start font-medium">الوصف</th>
              <th className="px-3 py-2 text-end font-medium">الاختيار</th>
            </tr>
          </thead>
          <tbody>
            {themes.map((item) => {
              const selected = item.id === activeTheme;
              return (
                <tr key={item.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2.5">
                    <ThemeSwatch theme={item.id} />
                  </td>
                  <td className="px-3 py-2.5 font-semibold">
                    <span className="flex items-center gap-2">
                      {item.name}
                      {item.id === "official" && (
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                          الرسمي
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{item.description}</td>
                  <td className="px-3 py-2.5 text-end">
                    <Button
                      size="sm"
                      variant={selected ? "default" : "outline"}
                      onClick={() => setTheme(item.id)}
                      aria-pressed={selected}
                    >
                      {selected ? <Check /> : <Palette />}
                      {selected ? "مفعّل" : "اختيار"}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground">
        يُطبّق الستايل مباشرة ويُحفظ تلقائيًا على هذا الجهاز.
      </p>
    </div>
  );
}

function ThemeSwatch({ theme }: { theme: ThemeId }) {
  return (
    <div
      data-theme-preview={theme}
      className={cn(
        "theme-preview flex h-8 w-20 items-center gap-1 rounded border p-1",
        "border-[var(--preview-border)] bg-[var(--preview-background)]",
      )}
      aria-hidden="true"
    >
      <span className="h-full w-3 rounded-sm bg-[var(--preview-primary)]" />
      <span className="h-full flex-1 rounded-sm bg-[var(--preview-panel)]" />
      <span className="size-2 rounded-full bg-[var(--preview-accent)]" />
    </div>
  );
}