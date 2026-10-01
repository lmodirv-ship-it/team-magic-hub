import { record } from "@/lib/nawat/metrics";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "@/lib/nawat/workspace";

export function ProjectSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query.trim().toLocaleLowerCase());
  const { vfs, openFile } = useWorkspace();
  const navigate = useNavigate();

  const results = useMemo(() => {
    if (!deferred) return [];
    const t0 = performance.now();
    const hits: { path: string; line: number; excerpt: string }[] = [];
    for (const [path, content] of Object.entries(vfs)) {
      if (path.toLocaleLowerCase().includes(deferred)) hits.push({ path, line: 1, excerpt: path });
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (lines[i]?.toLocaleLowerCase().includes(deferred)) {
          hits.push({ path, line: i + 1, excerpt: (lines[i] ?? "").trim().slice(0, 180) });
        }
        if (hits.length >= 500) record("بحث في المشروع", performance.now() - t0);
    return hits;
      }
    }
    return hits;
  }, [deferred, vfs]);

  return <ProjectSearchDialog open={open} setOpen={setOpen} query={query} setQuery={setQuery} results={results} openResult={(path, line) => {
    openFile(path);
    void navigate({ to: "/workspace" });
    window.setTimeout(() => window.dispatchEvent(new CustomEvent("nawat:reveal-line", { detail: { path, line } })), 200);
    setOpen(false);
  }} />;
}

function ProjectSearchDialog({ open, setOpen, query, setQuery, results, openResult }: {
  open: boolean; setOpen: (v: boolean) => void; query: string; setQuery: (v: string) => void;
  results: { path: string; line: number; excerpt: string }[];
  openResult: (path: string, line: number) => void;
}) {
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("nawat:project-search", onOpen);
    return () => window.removeEventListener("nawat:project-search", onOpen);
  }, [setOpen]);
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogContent dir="rtl" className="flex max-h-[80vh] max-w-2xl flex-col">
      <DialogHeader><DialogTitle>البحث في المشروع</DialogTitle></DialogHeader>
      <div className="relative"><Search className="absolute end-3 top-2.5 size-4 text-muted-foreground" /><Input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="اسم ملف أو نص داخل الملفات" className="pe-9" /></div>
      <p className="text-xs text-muted-foreground">{query ? `${results.length}${results.length === 500 ? "+" : ""} نتيجة` : ""}</p>
      <div className="min-h-0 overflow-auto space-y-1" dir="ltr">
        {results.map((result, index) => <Button key={`${result.path}:${result.line}:${index}`} variant="ghost" className="h-auto w-full justify-start whitespace-normal text-start" onClick={() => openResult(result.path, result.line)}>
          <span className="min-w-0"><span className="block truncate text-xs text-primary">{result.path}:{result.line}</span><span className="block truncate font-mono text-xs text-muted-foreground">{result.excerpt}</span></span>
        </Button>)}
      </div>
    </DialogContent>
  </Dialog>;
}