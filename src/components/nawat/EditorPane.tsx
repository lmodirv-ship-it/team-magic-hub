import Editor, { type Monaco } from "@monaco-editor/react";
import { AlertTriangle, Eye, RefreshCw, Save, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { editor as MonacoEditor } from "monaco-editor";
import { previewKindOf, languageOf, useWorkspace } from "@/lib/nawat/workspace";
import { SmartPreview } from "@/components/nawat/SmartPreview";
import { AnalyzeProjectButton } from "@/components/nawat/AnalyzeProjectButton";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/lib/nawat/theme";
import { record } from "@/lib/nawat/metrics";

const LARGE = 1024 * 1024;
type Problem = { path: string; line: number; col: number; message: string; severity: number };

let snippetsRegistered = false;
function registerSnippets(monaco: Monaco) {
  if (snippetsRegistered) return;
  snippetsRegistered = true;
  const S = monaco.languages.CompletionItemKind.Snippet;
  const R = monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet;
  const defs: Record<string, [string, string][]> = {
    typescript: [["fn", "function ${1:name}(${2}) {\n\t$0\n}"], ["log", "console.log($0);"], ["afn", "const ${1:name} = async (${2}) => {\n\t$0\n};"], ["imp", "import { $2 } from \"$1\";"]],
    javascript: [["fn", "function ${1:name}(${2}) {\n\t$0\n}"], ["log", "console.log($0);"]],
    python: [["def", "def ${1:name}(${2}):\n\t$0"], ["main", "if __name__ == \"__main__\":\n\t$0"]],
    html: [["html5", "<!doctype html>\n<html lang=\"ar\" dir=\"rtl\">\n<head><meta charset=\"utf-8\"><title>$1</title></head>\n<body>\n\t$0\n</body>\n</html>"]],
  };
  for (const [lang, items] of Object.entries(defs)) {
    monaco.languages.registerCompletionItemProvider(lang, {
      provideCompletionItems: (model: MonacoEditor.ITextModel, pos: { lineNumber: number; column: number }) => {
        const w = model.getWordUntilPosition(pos);
        const range = { startLineNumber: pos.lineNumber, endLineNumber: pos.lineNumber, startColumn: w.startColumn, endColumn: w.endColumn };
        return { suggestions: items.map(([label, insertText]) => ({ label, kind: S, insertText, insertTextRules: R, range, detail: "NAWAT" })) };
      },
    });
  }
}

export function EditorPane() {
  const { tabs, active, setActive, closeFile, vfs, writeFile, saveState, saveError, saveNow, openFile } = useWorkspace();
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState({ line: 1, column: 1 });
  const [problems, setProblems] = useState<Problem[]>([]);
  const [showProblems, setShowProblems] = useState(false);
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const switchStart = useRef(0);
  const { isDark } = useTheme();
  const [preview, setPreview] = useState(false);
  const [nonce, setNonce] = useState(0);
  useEffect(() => { void import("@/lib/nawat/monaco-local").then(() => setMounted(true)); }, []);
  useEffect(() => {
    const reveal = (event: Event) => {
      const detail = (event as CustomEvent<{ path: string; line: number }>).detail;
      if (detail.path !== active) return;
      window.setTimeout(() => { editorRef.current?.revealLineInCenter(detail.line); editorRef.current?.setPosition({ lineNumber: detail.line, column: 1 }); editorRef.current?.focus(); }, 80);
    };
    window.addEventListener("nawat:reveal-line", reveal);
    return () => window.removeEventListener("nawat:reveal-line", reveal);
  }, [active]);
  useEffect(() => {
    if (!active) return;
    const t0 = switchStart.current || performance.now();
    requestAnimationFrame(() => record("فتح ملف / تبديل تبويب", performance.now() - t0));
    switchStart.current = 0;
  }, [active]);

  const canPreview = !!active;
  const kind = active ? previewKindOf(active) : "code";
  const content = active ? (vfs[active] ?? "") : "";
  const large = content.length > LARGE;
  const errors = problems.filter((p) => p.severity >= 8).length;
  const warnings = problems.length - errors;

  const onMount = (instance: MonacoEditor.IStandaloneCodeEditor, monaco: Monaco) => {
    editorRef.current = instance;
    registerSnippets(monaco);
    instance.onDidChangeCursorPosition((e) => setPosition({ line: e.position.lineNumber, column: e.position.column }));
    const sync = () => {
      const list = monaco.editor.getModelMarkers({}).map((m: MonacoEditor.IMarker) => ({
        path: m.resource.path.replace(/^\//, ""),
        line: m.startLineNumber,
        col: m.startColumn,
        message: m.message,
        severity: m.severity,
      }));
      setProblems(list);
    };
    monaco.editor.onDidChangeMarkers(sync);
    sync();
  };

  const goTo = (p: Problem) => {
    openFile(p.path);
    window.setTimeout(() => window.dispatchEvent(new CustomEvent("nawat:reveal-line", { detail: { path: p.path, line: p.line } })), 60);
  };

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
      <div className="flex items-center border-b border-border bg-panel">
        <div className="flex min-w-0 flex-1 overflow-x-auto">
          {tabs.map((t) => (
            <div
              key={t}
              className={`group flex items-center gap-2 border-e border-border px-3 py-2 text-xs ${
                active === t ? "bg-background text-foreground" : "text-muted-foreground"
              }`}
            >
              <Button variant="ghost" size="sm"
                onClick={() => { switchStart.current = performance.now(); setActive(t); }}
                className="flex max-w-60 items-baseline gap-1 truncate"
                title={t}
                aria-label={`فتح ${t}`}
              >
                <span className="truncate">{t.split("/").pop()}</span>
                {t.split("/").length > 1 && (
                  <span className="truncate text-[10px] opacity-60">{t.split("/").at(-2)}</span>
                )}
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={() => closeFile(t)} aria-label={`Close ${t}`}>
                <X className="size-3.5 opacity-50 group-hover:opacity-100" />
              </Button>
            </div>
          ))}
          {tabs.length === 0 && (
            <span className="px-3 py-2 text-xs text-muted-foreground">لا توجد ملفات مفتوحة</span>
          )}
        </div>
        <div className="flex items-center gap-1 px-2">
          <AnalyzeProjectButton />
          {canPreview && (
            <Button variant="ghost" size="sm"
              onClick={() => setPreview((p) => !p)}
              className={`flex items-center gap-1.5 rounded px-2 py-1 text-xs ${
                preview ? "bg-nawat text-nawat-foreground" : "text-muted-foreground hover:bg-accent"
              }`}
            >
              <Eye className="size-3.5" /> {preview ? "الكود" : `معاينة (${kind})`}
            </Button>
          )}
          <Button variant="ghost" size="sm"
            onClick={() => setNonce((n) => n + 1)}
            title="تحديث المعاينة"
            aria-label="تحديث المعاينة"
            className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
          >
            <RefreshCw className="size-3.5" /> تحديث
          </Button>
          <Button variant="ghost" size="sm" onClick={saveNow} title={saveError ?? "حفظ الآن"} className={saveState === "error" ? "text-destructive" : "text-muted-foreground"}>
            <Save className="size-3.5" /> {saveState === "saved" ? "محفوظ" : saveState === "saving" ? "جارٍ الحفظ" : "فشل الحفظ"}
          </Button>
        </div>
      </div>

      {large && active && !preview && (
        <div className="border-b border-border bg-warning/10 px-3 py-1 text-xs text-warning">
          ملف كبير (أكثر من 1MB): وضع القراءة فقط وبدون تلوين للحفاظ على السرعة.
        </div>
      )}

      <div dir="ltr" className="relative min-h-0 flex-1 overflow-hidden">
        {!active ? (
          <div className="grid h-full place-items-center text-sm text-muted-foreground nawat-grid">
            افتح ملفًا من المستكشف للبدء
          </div>
        ) : preview && canPreview ? (
          <SmartPreview key={`${active}:${nonce}`} path={active} content={content} />
        ) : mounted ? (
          <Editor
            height="100%"
            theme={isDark ? "vs-dark" : "vs"}
            path={active}
            onMount={onMount}
            language={large ? "plaintext" : languageOf(active)}
            value={content}
            onChange={(v) => { if (!large) writeFile(active, v ?? ""); }}
            options={{
              fontSize: 13,
              fontFamily: "JetBrains Mono, ui-monospace, monospace",
              minimap: { enabled: !large },
              smoothScrolling: true,
              scrollBeyondLastLine: false,
              tabSize: 2,
              automaticLayout: true,
              readOnly: large,
              wordBasedSuggestions: "allDocuments",
              quickSuggestions: !large,
              folding: !large,
            }}
          />
        ) : (
          <div className="grid h-full place-items-center text-sm text-muted-foreground">
            جارٍ تحميل المحرر…
          </div>
        )}
      </div>

      {showProblems && (
        <div className="max-h-40 shrink-0 overflow-auto border-t border-border bg-panel text-xs" dir="ltr">
          {problems.length === 0 ? (
            <p className="p-2 text-muted-foreground" dir="rtl">لا توجد مشاكل.</p>
          ) : problems.map((p, i) => (
            <button key={i} type="button" onClick={() => goTo(p)} className="flex w-full gap-2 px-3 py-1 text-start hover:bg-accent">
              <span className={p.severity >= 8 ? "text-destructive" : "text-warning"}>●</span>
              <span className="truncate text-muted-foreground">{p.path}:{p.line}:{p.col}</span>
              <span className="truncate">{p.message}</span>
            </button>
          ))}
        </div>
      )}

      {active && (
        <div className="flex h-6 shrink-0 items-center gap-4 border-t border-border bg-panel px-3 text-[11px] text-muted-foreground" dir="ltr">
          <button type="button" onClick={() => setShowProblems((s) => !s)} className="flex items-center gap-1 hover:text-foreground" title="المشاكل">
            <AlertTriangle className="size-3" />
            <span className={errors ? "text-destructive" : ""}>{errors}</span>
            <span className={warnings ? "text-warning" : ""}>{warnings}</span>
          </button>
          <span>{position.line}:{position.column}</span>
          <span>{large ? "plaintext" : languageOf(active)}</span>
          <span>UTF-8</span>
          <span>{content.includes("\r\n") ? "CRLF" : "LF"}</span>
          {saveError && <span className="truncate text-destructive" title={saveError}>{saveError}</span>}
        </div>
      )}
    </section>
  );
}
