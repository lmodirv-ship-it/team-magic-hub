import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import type { editor as MonacoEditor } from "monaco-editor";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWorkspace, languageOf } from "@/lib/nawat/workspace";
import { buildPackSystemFiles } from "@/lib/nawat/pack-system";

type Hit = { path: string; lineStart: number | null; score: number; preview: string };
const SEARCH_URL = "http://127.0.0.1:8792";

type Cmd = { id: string; label: string; keys?: string; run: () => void };

/** Editor Pack: محرر Monaco محلي + شريط حالة + سجل أوامر لملفات forge/ */
export function PackEditor() {
  const { vfs, writeFile, saveNow, importFiles, saveState, openFile } = useWorkspace();
  const [mounted, setMounted] = useState(false);
  const [path, setPath] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [cursor, setCursor] = useState({ line: 1, col: 1 });
  const [tab, setTab] = useState<"files" | "search">("files");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [searching, setSearching] = useState(false);
  const [source, setSource] = useState<"pack" | "local" | null>(null);
  const pendingLine = useRef<number | null>(null);
  const edRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");

  useEffect(() => { void import("@/lib/nawat/monaco-local").then(() => setMounted(true)); }, []);

  const files = useMemo(() => Object.keys(vfs).filter((p) => p.startsWith("forge/")).sort(), [vfs]);
  const shown = files.filter((f) => f.toLowerCase().includes(filter.toLowerCase())).slice(0, 300);

  useEffect(() => {
    if (!path && files.length) setPath(files.find((f) => f.endsWith("manifest.json")) ?? files[0] ?? null);
  }, [files, path]);

  const resolve = useCallback((p: string) => {
    const n = p.replace(/\\/g, "/").replace(/^\.?\//, "");
    return files.find((f) => f === n || f.endsWith("/" + n) || n.endsWith(f.replace(/^forge\//, ""))) ?? null;
  }, [files]);

  const runSearch = useCallback(async () => {
    const query = q.trim();
    if (query.length < 2) { toast.info("اكتب حرفين على الأقل"); return; }
    setSearching(true);
    try {
      const r = await fetch(`${SEARCH_URL}/search/hybrid`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, limit: 20 }), signal: AbortSignal.timeout(8000),
      });
      const j = await r.json() as { ok?: boolean; error?: string; results?: Hit[] };
      if (!r.ok || j.ok === false) throw new Error(j.error || `HTTP ${r.status}`);
      setHits(j.results ?? []); setSource("pack");
    } catch {
      const lq = query.toLowerCase(); const out: Hit[] = [];
      for (const f of files) {
        const lines = (vfs[f] ?? "").split("\n");
        for (let i = 0; i < lines.length && out.length < 200; i++)
          if ((lines[i] ?? "").toLowerCase().includes(lq)) out.push({ path: f, lineStart: i + 1, score: 0, preview: (lines[i] ?? "").trim().slice(0, 200) });
      }
      setHits(out); setSource("local");
    } finally { setSearching(false); }
  }, [q, files, vfs]);

  const openHit = (h: Hit) => {
    const f = resolve(h.path);
    if (!f) { toast.info(`الملف ليس ضمن forge/ في مساحة العمل: ${h.path}`); return; }
    pendingLine.current = h.lineStart;
    if (f === path) jump(); else setPath(f);
  };
  const jump = () => {
    const ln = pendingLine.current; const ed = edRef.current;
    if (!ln || !ed) return;
    pendingLine.current = null;
    ed.revealLineInCenter(ln); ed.setPosition({ lineNumber: ln, column: 1 }); ed.focus();
  };
  useEffect(() => { const t = setTimeout(jump, 300); return () => clearTimeout(t); }, [path]);

  const content = path ? vfs[path] ?? "" : "";

  const save = useCallback(() => { saveNow(); toast.success("حُفظ الملف"); }, [saveNow]);
  const validate = useCallback(() => {
    if (!path?.endsWith(".json")) { toast.info("التحقق متاح لملفات JSON فقط"); return; }
    try {
      const j = JSON.parse(content) as Record<string, unknown>;
      if (path.endsWith("pack.json")) {
        const missing = ["name", "version", "ports", "depends_on", "provides"].filter((k) => !(k in j));
        if (missing.length) { toast.error(`حقول ناقصة: ${missing.join("، ")}`); return; }
      }
      toast.success("الملف سليم ✓");
    } catch (e) { toast.error(`JSON غير صالح: ${(e as Error).message}`); }
  }, [path, content]);
  const format = useCallback(() => {
    if (!path?.endsWith(".json")) { toast.info("التنسيق متاح لملفات JSON فقط"); return; }
    try { writeFile(path, JSON.stringify(JSON.parse(content), null, 2) + "\n"); } catch { toast.error("تعذّر التنسيق: JSON غير صالح"); }
  }, [path, content, writeFile]);

  const commands: Cmd[] = [
    { id: "editor.saveCurrent", label: "حفظ", keys: "Ctrl+S", run: save },
    { id: "editor.format", label: "تنسيق JSON", run: format },
    { id: "pack.validate", label: "تحقق من الملف", run: validate },
    { id: "editor.openInWorkspace", label: "افتح في الورشة", run: () => path && openFile(path) },
  ];

  if (!files.length) {
    return (
      <div className="space-y-3 py-6 text-center text-sm">
        <p className="text-muted-foreground">لا توجد ملفات forge/ بعد في مساحة العمل.</p>
        <Button size="sm" onClick={() => { importFiles(buildPackSystemFiles()); toast.success("وُلّدت forge/"); }}>
          توليد forge/ وبدء التحرير
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-[65vh] flex-col overflow-hidden rounded-md border border-border">
      <div className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/40 p-1">
        {commands.map((c) => (
          <Button key={c.id} size="sm" variant="ghost" className="h-7 text-xs" title={c.id} onClick={c.run}>
            {c.label}{c.keys && <span className="ms-1 text-muted-foreground" dir="ltr">{c.keys}</span>}
          </Button>
        ))}
      </div>
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-56 shrink-0 flex-col border-e border-border">
          <div className="flex border-b border-border text-xs">
            {(["files", "search"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`flex-1 py-1 ${tab === t ? "bg-nawat/15 text-nawat" : "hover:bg-muted"}`}>
                {t === "files" ? "الملفات" : "بحث دلالي"}
              </button>
            ))}
          </div>
          {tab === "search" ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <form className="flex gap-1 p-1" onSubmit={(e) => { e.preventDefault(); void runSearch(); }}>
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="اسأل بالمعنى…" className="h-7 text-xs" />
                <Button type="submit" size="sm" className="h-7 px-2 text-xs" disabled={searching}>{searching ? "…" : "ابحث"}</Button>
              </form>
              {source && (
                <p className="px-2 pb-1 text-[10px] text-muted-foreground">
                  {source === "pack" ? `حزمة البحث :8792 — ${hits.length} نتيجة` : `حزمة البحث غير متصلة — بحث نصي محلي (${hits.length})`}
                </p>
              )}
              <ul className="min-h-0 flex-1 overflow-auto text-xs">
                {hits.map((h, i) => (
                  <li key={i}>
                    <button onClick={() => openHit(h)} className="block w-full border-b border-border/50 px-2 py-1 text-start hover:bg-muted">
                      <span dir="ltr" className="block truncate font-mono text-[11px] text-nawat">{h.path}{h.lineStart ? `:${h.lineStart}` : ""}{h.score ? ` · ${h.score}` : ""}</span>
                      <span dir="auto" className="line-clamp-2 text-muted-foreground">{h.preview}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (<>
          <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="بحث في forge/" className="m-1 h-7 w-auto text-xs" />
          <ul className="min-h-0 flex-1 overflow-auto text-xs" dir="ltr">
            {shown.map((f) => (
              <li key={f}>
                <button onClick={() => setPath(f)} title={f}
                  className={`block w-full truncate px-2 py-0.5 text-start hover:bg-muted ${f === path ? "bg-nawat/15 text-nawat" : ""}`}>
                  {f.replace(/^forge\//, "")}
                </button>
              </li>
            ))}
          </ul>
          </>)}
        </aside>
        <div className="min-w-0 flex-1" dir="ltr">
          {mounted && path ? (
            <Editor
              height="100%"
              theme={isDark ? "vs-dark" : "vs"}
              path={`pack-editor/${path}`}
              language={languageOf(path)}
              value={content}
              onChange={(v) => writeFile(path, v ?? "")}
              onMount={(ed, monaco) => {
                edRef.current = ed;
                setTimeout(jump, 300);
                ed.onDidChangeCursorPosition((e) => setCursor({ line: e.position.lineNumber, col: e.position.column }));
                ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => save());
              }}
              options={{ fontSize: 13, minimap: { enabled: false }, automaticLayout: true, tabSize: 2, scrollBeyondLastLine: false }}
            />
          ) : <div className="grid h-full place-items-center text-xs text-muted-foreground">جارٍ تحميل المحرر…</div>}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground">
        <span dir="ltr" className="truncate">{path}</span>
        <span className="flex gap-3">
          <span>{path ? languageOf(path) : ""}</span>
          <span dir="ltr">Ln {cursor.line}, Col {cursor.col}</span>
          <span>{saveState === "saved" ? "محفوظ" : saveState === "error" ? "خطأ في الحفظ" : "غير محفوظ"}</span>
        </span>
      </div>
    </div>
  );
}
