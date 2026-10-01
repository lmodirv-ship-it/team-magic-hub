import { Box, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { depthStyles, useDepth, type DepthStyle } from "@/lib/nawat/depth";

export function DepthGallery() {
  const { depth: active, setDepth } = useDepth();

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[620px] text-sm">
          <thead className="bg-muted/60 text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-3 py-2 text-start font-medium">المعاينة</th>
              <th className="px-3 py-2 text-start font-medium">اسم النمط</th>
              <th className="px-3 py-2 text-start font-medium">الوصف</th>
              <th className="px-3 py-2 text-end font-medium">التفعيل</th>
            </tr>
          </thead>
          <tbody>
            {depthStyles.map((style) => {
              const selected = style.id === active;
              return (
                <tr key={style.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2.5">
                    <DepthSwatch depth={style.id} />
                  </td>
                  <td className="px-3 py-2.5 font-semibold">
                    <span className="flex items-center gap-2">
                      {style.name}
                      {style.id === "default" && (
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                          الافتراضي
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {style.description}
                  </td>
                  <td className="px-3 py-2.5 text-end">
                    <Button
                      size="sm"
                      variant={selected ? "default" : "outline"}
                      onClick={() => setDepth(style.id)}
                      aria-pressed={selected}
                    >
                      {selected ? <Check /> : <Box />}
                      {selected ? "مفعّل" : "تفعيل"}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground">
        يُطبّق نمط العمق على كل صفحات التطبيق فورًا ويُحفظ على هذا الجهاز، ويمكن
        دمجه مع أي ستايل لوني من الجدول أعلاه.
      </p>
    </div>
  );
}

function DepthSwatch({ depth }: { depth: DepthStyle }) {
  return (
    <div
      data-depth-preview={depth}
      className="depth-preview"
      aria-hidden="true"
    >
      <span className="dp-bar" />
      <span className="dp-panel" />
      <span className="dp-dot" />
    </div>
  );
}
