import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Code2,
  Files,
  Hammer,
  Keyboard,
  MessageSquareText,
  PanelBottom,
  PanelLeft,
  PanelRight,
  PanelTop,
  X,
} from "lucide-react";
import { ChatPanel } from "@/components/nawat/ChatPanel";
import { SiteBuildTracker } from "@/components/nawat/SiteBuildTracker";
import { FloatingCodeBox } from "@/components/nawat/FloatingCodeBox";
import { LiveCodeStream } from "@/components/nawat/LiveCodeStream";
import { Button } from "@/components/ui/button";
import { EditorPane } from "@/components/nawat/EditorPane";
import { FileExplorer } from "@/components/nawat/FileExplorer";
import { Resizer } from "@/components/nawat/Resizer";
import { TerminalPanel } from "@/components/nawat/TerminalPanel";
import {
  DEFAULT_PANELS,
  PANELS_KEY,
  focusMode,
  parsePanels,
  serializePanels,
  togglePanel,
  type PanelKey,
  type PanelState,
} from "@/lib/nawat/panels";

export const Route = createFileRoute("/workspace")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "مساحة العمل — NAWAT Studio" },
      {
        name: "description",
        content:
          "محرر أكواد متعدد الملفات، مستكشف مشاريع، طرفية مدمجة، ومحادثة مع نماذج NAWAT المحلية.",
      },
      { property: "og:title", content: "مساحة العمل — NAWAT Studio" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      {
        property: "og:description",
        content:
          "محرر أكواد متعدد الملفات، مستكشف مشاريع، طرفية مدمجة، ومحادثة مع نماذج NAWAT المحلية.",
      },
    ],
  }),
  component: Workspace,
});

const SIZE_KEY = "nawat.workspace.size.v1";
type Sizes = { explorerW: number; chatW: number; termH: number };
const DEFAULT_SIZES: Sizes = { explorerW: 256, chatW: 384, termH: 256 };

function readSizes(): Sizes {
  try {
    const raw = window.localStorage.getItem(SIZE_KEY);
    if (!raw) return DEFAULT_SIZES;
    const stored = JSON.parse(raw) as Partial<Sizes>;
    const next = { ...DEFAULT_SIZES };
    for (const key of ["explorerW", "chatW", "termH"] as const) {
      if (typeof stored?.[key] === "number" && Number.isFinite(stored[key])) next[key] = stored[key] as number;
    }
    return next;
  } catch {
    return DEFAULT_SIZES;
  }
}

const SHORTCUTS = [
  { keys: "Ctrl + B", what: "إخفاء أو إظهار مستكشف الملفات" },
  { keys: "Ctrl + J", what: "إخفاء أو إظهار لوحة المحادثة" },
  { keys: "Ctrl + `", what: "إخفاء أو إظهار الطرفية" },
  { keys: "Ctrl + Alt + F", what: "وضع التركيز: المحرر وحده على كامل الشاشة" },
  { keys: "Ctrl + S", what: "حفظ الملف المفتوح فورًا" },
  { keys: "Ctrl + N", what: "ملف جديد بمسار كامل" },
  { keys: "Ctrl + Shift + F", what: "بحث داخل كل ملفات المشروع" },
  { keys: "Ctrl + P", what: "بحث شامل في النواة" },
];

function ShortcutSheet({ onClose }: { onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-background/70 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-lg border border-border bg-panel p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">اختصارات لوحة المفاتيح</h2>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="إغلاق">
            <X />
          </Button>
        </div>
        <ul className="space-y-1">
          {SHORTCUTS.map((s) => (
            <li key={s.keys} className="flex items-center justify-between gap-3 text-xs">
              <span className="text-muted-foreground">{s.what}</span>
              <kbd className="shrink-0 rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px]">
                {s.keys}
              </kbd>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[10px] text-muted-foreground">
          كل الأزرار والاختصارات مضافة دون حذف أي ميزة سابقة.
        </p>
      </div>
    </div>
  );
}

function Workspace() {
  const [panels, setPanels] = useState<PanelState>(DEFAULT_PANELS);
  const [sizes, setSizes] = useState<Sizes>(DEFAULT_SIZES);
  const [hydrated, setHydrated] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"files" | "chat" | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [floatOpen, setFloatOpen] = useState(false);
  const [liveOpen, setLiveOpen] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Read the saved layout after mount so SSR markup and the client never disagree.
  useEffect(() => {
    try {
      setPanels(parsePanels(window.localStorage.getItem(PANELS_KEY)));
      setSizes(readSizes());
    } catch {
      // keep defaults
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(PANELS_KEY, serializePanels(panels));
    } catch {
      // storage full: the layout simply won't be remembered
    }
  }, [panels, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(SIZE_KEY, JSON.stringify(sizes));
    } catch {
      // ignore
    }
  }, [sizes, hydrated]);

  // The shortcuts live in the global ShortcutLayer; it only announces what was pressed.
  useEffect(() => {
    const onToggle = (event: Event) => {
      const key = (event as CustomEvent<PanelKey>).detail;
      if (key === "explorer" || key === "chat" || key === "term") {
        setPanels((state) => togglePanel(state, key));
      }
    };
    const onFocus = () => setPanels((state) => focusMode(state));
    const onEscape = () => setSheetOpen(false);
    window.addEventListener("nawat:toggle-panel", onToggle);
    window.addEventListener("nawat:focus-mode", onFocus);
    window.addEventListener("nawat:escape", onEscape);
    return () => {
      window.removeEventListener("nawat:toggle-panel", onToggle);
      window.removeEventListener("nawat:focus-mode", onFocus);
      window.removeEventListener("nawat:escape", onEscape);
    };
  }, []);

  const showExplorer = panels.explorer;
  const showChat = panels.chat;
  const showTerm = panels.term;

  return (
    <main className="relative flex min-w-0 flex-1">
      <h1 className="sr-only">مساحة العمل</h1>
      <div className="hidden lg:contents">
        {showExplorer ? (
          <>
            <FileExplorer width={sizes.explorerW} />
            <Resizer
              axis="x"
              target="before"
              onResize={(w) => setSizes((s) => ({ ...s, explorerW: w }))}
              label="تغيير عرض مستكشف الملفات"
              min={160}
              max={520}
            />
          </>
        ) : (
          <button
            onClick={() => setPanels((p) => togglePanel(p, "explorer"))}
            className="hidden w-6 shrink-0 items-center justify-center border-e border-border bg-rail text-muted-foreground hover:text-foreground lg:flex"
            title="إظهار مستكشف الملفات (Ctrl+B)"
            aria-label="إظهار مستكشف الملفات"
          >
            <PanelLeft className="size-3.5" />
          </button>
        )}
      </div>
      <div className="absolute start-2 top-1.5 z-20 flex gap-1 lg:hidden">
        <Button
          variant="secondary"
          size="icon-sm"
          onClick={() => setMobilePanel((panel) => (panel === "files" ? null : "files"))}
          aria-label="فتح مستكشف الملفات"
          title="الملفات"
        >
          <Files />
        </Button>
        <Button
          variant="secondary"
          size="icon-sm"
          onClick={() => setMobilePanel((panel) => (panel === "chat" ? null : "chat"))}
          aria-label="فتح محادثة NAWAT"
          title="المحادثة"
        >
          <MessageSquareText />
        </Button>
      </div>
      {mobilePanel && (
        <>
          <button
            className="absolute inset-0 z-30 bg-background/70 lg:hidden"
            onClick={() => setMobilePanel(null)}
            aria-label="إغلاق اللوحة"
          />
          <aside className="absolute inset-y-0 start-0 z-40 w-[min(84vw,340px)] overflow-hidden border-e border-border bg-panel shadow-2xl lg:hidden">
            <Button
              variant="ghost"
              size="icon-sm"
              className="absolute end-2 top-1 z-50"
              onClick={() => setMobilePanel(null)}
              aria-label="إغلاق اللوحة"
            >
              <X />
            </Button>
            {mobilePanel === "files" ? <FileExplorer width={340} /> : <ChatPanel />}
          </aside>
        </>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 flex-wrap justify-end gap-1 border-b border-border px-2 py-1">
          <Button
            size="sm"
            variant={showExplorer ? "default" : "outline"}
            className="h-7 gap-1 text-xs"
            onClick={() => setPanels((p) => togglePanel(p, "explorer"))}
            title="Ctrl+B — إخفاء أو إظهار مستكشف الملفات"
          >
            <PanelLeft className="size-3" /> الملفات
          </Button>
          <Button
            size="sm"
            variant={showChat ? "default" : "outline"}
            className="h-7 gap-1 text-xs"
            onClick={() => setPanels((p) => togglePanel(p, "chat"))}
            title="Ctrl+J — إخفاء أو إظهار لوحة المحادثة"
          >
            <PanelRight className="size-3" /> المحادثة
          </Button>
          <Button
            size="sm"
            variant={showTerm ? "default" : "outline"}
            className="h-7 gap-1 text-xs"
            onClick={() => setPanels((p) => togglePanel(p, "term"))}
            title="Ctrl+` — إخفاء أو إظهار الطرفية"
          >
            <PanelBottom className="size-3" /> الطرفية
          </Button>
          <Button
            size="sm"
            variant={panels.focus ? "default" : "outline"}
            className="h-7 gap-1 text-xs"
            onClick={() => setPanels((p) => focusMode(p))}
            title="Ctrl+Alt+F — المحرر على كامل الشاشة"
          >
            <PanelTop className="size-3" /> تركيز
          </Button>
          <div className="flex-1" />
          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setSheetOpen(true)}>
            <Keyboard className="size-3" /> الاختصارات
          </Button>
          <Button size="sm" variant={floatOpen ? "default" : "outline"} className="h-7 gap-1 text-xs" onClick={() => setFloatOpen((v) => !v)}>
            <PanelTop className="size-3" /> الكود أثناء الكتابة
          </Button>
          <Button size="sm" variant={liveOpen ? "default" : "outline"} className="h-7 gap-1 text-xs" onClick={() => setLiveOpen((v) => !v)}>
            <Code2 className="size-3" /> الكود المباشر
          </Button>
          <Button size="sm" variant={builderOpen ? "default" : "outline"} className="h-7 gap-1 text-xs" onClick={() => setBuilderOpen((v) => !v)}>
            <Hammer className="size-3" /> {builderOpen ? "العودة للمحرر" : "تتبع بناء الموقع"}
          </Button>
        </div>
        <div className="flex min-h-0 flex-1">
          <div className="flex min-w-0 flex-1">{builderOpen ? <SiteBuildTracker /> : <EditorPane />}</div>
          {liveOpen && <div className="hidden w-80 shrink-0 md:block"><LiveCodeStream /></div>}
        </div>
        {floatOpen && <FloatingCodeBox onClose={() => setFloatOpen(false)} />}
        {showTerm && (
          <Resizer
            axis="y"
            target="after"
            onResize={(h) => setSizes((s) => ({ ...s, termH: h }))}
            label="تغيير ارتفاع الطرفية"
            min={120}
            max={640}
          />
        )}
        <div
          style={showTerm ? { height: sizes.termH } : undefined}
          className={`${showTerm ? "" : "h-8"} shrink-0 border-t border-border transition-[height]`}
        >
          {showTerm ? (
            <div className="relative h-full">
              <button
                onClick={() => setPanels((p) => togglePanel(p, "term"))}
                className="absolute end-2 top-1.5 z-10 text-muted-foreground hover:text-foreground"
                aria-label="Collapse terminal"
              >
                <ChevronDown className="size-4" />
              </button>
              <TerminalPanel />
            </div>
          ) : (
            <button
              onClick={() => setPanels((p) => togglePanel(p, "term"))}
              className="flex h-full w-full items-center gap-2 bg-panel px-3 text-xs text-muted-foreground hover:text-foreground"
            >
              <ChevronUp className="size-4" /> Terminal
            </button>
          )}
        </div>
      </div>
      <div className="hidden lg:contents">
        {showChat && (
          <Resizer
            axis="x"
            target="after"
            onResize={(w) => setSizes((s) => ({ ...s, chatW: w }))}
            label="تغيير عرض لوحة المحادثة"
            min={240}
            max={640}
          />
        )}
      </div>
      {showChat ? (
        <div style={{ width: sizes.chatW }} className="hidden min-w-0 shrink-0 lg:block">
          <ChatPanel />
        </div>
      ) : (
        <button
          onClick={() => setPanels((p) => togglePanel(p, "chat"))}
          className="hidden w-6 shrink-0 items-center justify-center border-s border-border bg-rail text-muted-foreground hover:text-foreground lg:flex"
          title="إظهار لوحة المحادثة (Ctrl+J)"
          aria-label="إظهار لوحة المحادثة"
        >
          <PanelRight className="size-3.5" />
        </button>
      )}
      {sheetOpen && <ShortcutSheet onClose={() => setSheetOpen(false)} />}
    </main>
  );
}
