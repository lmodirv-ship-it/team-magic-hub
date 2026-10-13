import { Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

/** روابط الخوادم من دليل Groupe-HN v2.2 — فتح ونسخ مباشر. */
const LINKS: [string, string, string][] = [
  ["http://192.168.100.67:8084/", "الاستوديو الكامل", ".67"],
  ["http://192.168.100.67:8788/api/health", "صحة الجسر", ".67"],
  ["http://192.168.100.67:8788/api/models", "نماذج السيرفر", ".67"],
  ["http://192.168.100.67:11434", "Ollama مباشرة", ".67"],
  ["http://192.168.100.67:8789", "المصنع", ".67"],
  ["http://192.168.100.66:8085/", "الاستوديو (نسخة .66)", ".66"],
  ["http://192.168.100.66:8788/api/health", "صحة جسر .66", ".66"],
  ["http://192.168.100.66:8795/api/models", "جسر المنصة: النماذج", ".66"],
  ["http://192.168.100.66:8795/api/stats", "جسر المنصة: الإحصائيات", ".66"],
  ["http://192.168.100.66:11434", "Ollama .66", ".66"],
  ["http://127.0.0.1:8188", "ComfyUI حاسوبي", "محلي"],
  ["https://nawat.groupe-hn.com", "المنصة الرسمية", "عام"],
  ["https://platform.groupe-hn.com", "منصة Groupe-HN (النماذج والمفاتيح)", "عام"],
  ["https://platform.groupe-hn.com/api/public/v1/models", "منصة Groupe-HN: النماذج الحية", "عام"],
  ["https://hn-ai.site", "نسخة hn-ai.site", "عام"],
  ["https://hn-ai.site/comfy-hn", "ComfyUI السيرفر المحمي", "عام"],
  ["https://www.nawat-group.com/bridge", "جسر nawat-group.com", "عام"],
  ["https://bridge.nawat.pro", "الجسر العام", "عام"],
];

export function ServerLinksSettings() {
  return (
    <ul className="grid gap-1 text-xs">
      {LINKS.map(([u, d, s]) => (
        <li key={u} className="flex items-center gap-2 rounded border border-border px-2 py-1">
          <span className="w-10 shrink-0 text-muted-foreground">{s}</span>
          <span className="w-40 shrink-0">{d}</span>
          <code dir="ltr" className="min-w-0 flex-1 truncate">{u}</code>
          <Button size="icon" variant="ghost" aria-label="نسخ" onClick={() => void navigator.clipboard.writeText(u)}><Copy /></Button>
          <Button size="icon" variant="ghost" aria-label="فتح" asChild><a href={u} target="_blank" rel="noreferrer"><ExternalLink /></a></Button>
        </li>
      ))}
    </ul>
  );
}
