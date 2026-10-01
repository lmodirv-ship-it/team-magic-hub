import { Cpu, HardDrive, Power, Gauge, FolderTree, Package } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { formatBytes, isDesktop } from "@/lib/nawat/bridge";
import { useModels } from "@/lib/nawat/useModels";
import { useWorkspace } from "@/lib/nawat/workspace";
import { DensityControl } from "@/components/nawat/DensityControl";
import { useLive } from "@/lib/nawat/live";
import { useAiEnabled } from "@/lib/nawat/ai-control";

export function StatusBar() {
  const { models, running } = useModels(10000);
  const { vfs, active } = useWorkspace();
  const { connected } = useLive();
  const [ai, setAi] = useAiEnabled();
  const vram = running.reduce((s, r) => s + (r.size_vram ?? 0), 0);

  return (
    <footer className="flex h-7 shrink-0 items-center gap-4 overflow-x-auto border-t border-border bg-rail px-3 text-[11px] whitespace-nowrap text-muted-foreground">
      <span className="flex items-center gap-1">
        <FolderTree className="size-3" /> NAWAT
      </span>
      <span>{Object.keys(vfs).length} files</span>
      {active && <span className="truncate">{active}</span>}
      <div className="flex-1" />
      <button
        type="button"
        onClick={() => setAi(!ai)}
        className={`flex items-center gap-1 rounded px-1.5 ${ai ? "text-success" : "bg-destructive/20 text-destructive"}`}
        title="إيقاف/تشغيل كل طلبات النماذج"
      >
        <Power className="size-3" /> {ai ? "الذكاء الاصطناعي يعمل" : "الذكاء الاصطناعي موقوف"}
      </button>
      <Link to="/metrics" className="flex items-center gap-1 hover:text-foreground"><Gauge className="size-3" /> السرعة</Link>
      <Link to="/packs" className="flex items-center gap-1 hover:text-foreground"><Package className="size-3" /> Packs</Link>
      <DensityControl className="me-2 scale-90" />
      <span className="flex items-center gap-1">
        <Cpu className="size-3" /> {models.length} nawat models
      </span>
      <span className="flex items-center gap-1">
        <HardDrive className="size-3" /> VRAM {formatBytes(vram)}
      </span>
      <span className="flex items-center gap-1" title="ws://localhost:5001">
        <span
          className={`size-2 rounded-full ${connected ? "bg-success" : "bg-destructive"}`}
          aria-hidden
        />
        {connected ? "WebSocket متصل" : "WebSocket غير متصل"}
      </span>
      <span>{isDesktop() ? "Desktop (Electron)" : "Browser mode"}</span>
      <span className="border-s border-border ps-3 text-foreground">
        Groupe-HN · Mouylay Ismail El Hassani
      </span>
    </footer>
  );
}
