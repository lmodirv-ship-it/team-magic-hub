import { DiffEditor } from "@monaco-editor/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { languageOf, useWorkspace } from "@/lib/nawat/workspace";
import { useTheme } from "@/lib/nawat/theme";

type Proposal = { path: string; content: string; source?: string };
const SNAP_KEY = "nawat.rollback.v1";

/** Any AI edit must go through this dialog: window.dispatchEvent(new CustomEvent("nawat:propose-edit", { detail })) */
export function proposeEdit(p: Proposal) {
  window.dispatchEvent(new CustomEvent("nawat:propose-edit", { detail: p }));
}

export function DiffReview() {
  const { vfs, writeFile, openFile } = useWorkspace();
  const { isDark } = useTheme();
  const [queue, setQueue] = useState<Proposal[]>([]);
  const cur = queue[0];

  useEffect(() => {
    const on = (e: Event) => setQueue((q) => [...q, (e as CustomEvent<Proposal>).detail]);
    window.addEventListener("nawat:propose-edit", on);
    return () => window.removeEventListener("nawat:propose-edit", on);
  }, []);

  if (!cur) return null;
  const original = vfs[cur.path] ?? "";
  const next = () => setQueue((q) => q.slice(1));

  const accept = () => {
    localStorage.setItem(SNAP_KEY, JSON.stringify({ path: cur.path, content: original, at: Date.now() }));
    writeFile(cur.path, cur.content);
    openFile(cur.path);
    toast.success("طُبّق التعديل", {
      action: {
        label: "تراجع",
        onClick: () => writeFile(cur.path, original),
      },
    });
    next();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4" role="dialog" aria-label="مراجعة التعديل">
      <div className="glass-panel flex h-[80vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-border">
        <div className="flex items-center gap-3 border-b border-border px-4 py-2 text-sm">
          <strong>مراجعة تعديل مقترح</strong>
          <span className="truncate text-muted-foreground" dir="ltr">{cur.path}</span>
          {cur.source && <span className="text-xs text-muted-foreground">من {cur.source}</span>}
          <div className="flex-1" />
          {queue.length > 1 && <span className="text-xs text-muted-foreground">+{queue.length - 1} بالانتظار</span>}
          <Button variant="outline" size="sm" onClick={next}>رفض</Button>
          <Button size="sm" onClick={accept}>قبول وتطبيق</Button>
        </div>
        <div className="grid grid-cols-2 border-b border-border text-xs text-muted-foreground">
          <span className="px-4 py-1">الحالي</span><span className="px-4 py-1">المقترح</span>
        </div>
        <div dir="ltr" className="min-h-0 flex-1">
          <DiffEditor
            height="100%"
            theme={isDark ? "vs-dark" : "vs"}
            language={languageOf(cur.path)}
            original={original}
            modified={cur.content}
            options={{ readOnly: true, automaticLayout: true, renderSideBySide: true }}
          />
        </div>
      </div>
    </div>
  );
}
