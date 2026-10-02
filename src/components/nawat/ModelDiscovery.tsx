import { useState } from "react";
import { Radar } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ollamaHost } from "@/lib/nawat/bridge";
import { getServerSettings } from "@/lib/nawat/server-settings";
import { portsApi, usePorts } from "@/lib/nawat/ports";

type Found = { model: string; host: string; port: string; added: boolean };

/** يبحث تلقائيًا عن النماذج في كل الخوادم ويضيف لكل نموذج منفذًا مخصصًا (دون حذف أي منفذ). */
export function ModelDiscovery() {
  const ports = usePorts();
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<Found[]>([]);

  const scan = async () => {
    setBusy(true);
    const hosts = Array.from(new Set([ollamaHost(), ...getServerSettings().ollamaFallbacks, ...ports.filter((p) => p.type === "ai" && /^\d+$/.test(p.port)).map((p) => `http://${p.host}:${p.port}`)]));
    const results: Found[] = [];
    await Promise.all(hosts.map(async (h) => {
      try {
        const ctrl = AbortSignal.timeout(4000);
        const r = await fetch(`${h.replace(/\/+$/, "")}/api/tags`, { signal: ctrl });
        if (!r.ok) return;
        const j = (await r.json()) as { models?: { name: string }[] };
        const u = new URL(h);
        const port = u.port || (u.protocol === "https:" ? "443" : "80");
        for (const m of j.models ?? []) {
          const id = `model-${u.hostname}-${port}-${m.name}`.replace(/[^\w.-]/g, "_");
          const exists = ports.some((p) => p.id === id || (p.service === m.name && p.host === u.hostname));
          if (!exists) portsApi.add({ port, host: u.hostname, bind: "public", type: "ai", service: m.name, manager: "ollama", description: `نموذج مكتشف تلقائيًا على ${h}`, enabled: true, pages: ["/models", "/chat/new"], links: [] });
          results.push({ model: m.name, host: u.hostname, port, added: !exists });
        }
      } catch { /* host unreachable */ }
    }));
    setFound(results);
    setBusy(false);
    const n = results.filter((x) => x.added).length;
    toast[results.length ? "success" : "error"](results.length ? `وُجد ${results.length} نموذجًا — أُضيف ${n} جديد إلى المنافذ` : `لم يُعثر على نماذج في ${hosts.length} خادم`);
  };

  return (
    <div className="space-y-2 text-xs">
      <Button size="sm" onClick={scan} disabled={busy}><Radar />{busy ? "جارٍ البحث..." : "بحث تلقائي عن النماذج والمنافذ"}</Button>
      {found.length > 0 && (
        <ul className="grid gap-1 md:grid-cols-2">
          {found.map((f) => <li key={`${f.host}:${f.port}:${f.model}`} className="rounded border border-border px-2 py-1 font-mono">{f.model} → {f.host}:{f.port} {f.added && <span className="text-success">جديد</span>}</li>)}
        </ul>
      )}
    </div>
  );
}
