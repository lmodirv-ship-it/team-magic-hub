import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown, ChevronUp, Files, MessageSquareText, X } from "lucide-react";
import { ChatPanel } from "@/components/nawat/ChatPanel";
import { Button } from "@/components/ui/button";
import { EditorPane } from "@/components/nawat/EditorPane";
import { FileExplorer } from "@/components/nawat/FileExplorer";
import { Resizer } from "@/components/nawat/Resizer";
import { TerminalPanel } from "@/components/nawat/TerminalPanel";

export const Route = createFileRoute("/workspace")({
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

function Workspace() {
  const [termOpen, setTermOpen] = useState(true);
  const [explorerW, setExplorerW] = useState(256);
  const [chatW, setChatW] = useState(384);
  const [termH, setTermH] = useState(256);
  const [mobilePanel, setMobilePanel] = useState<"files" | "chat" | null>(null);

  return (
    <main className="relative flex min-w-0 flex-1">
      <div className="hidden lg:contents">
        <FileExplorer width={explorerW} />
        <Resizer
          axis="x"
          target="before"
          onResize={setExplorerW}
          label="تغيير عرض مستكشف الملفات"
          min={160}
          max={520}
        />
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
        <div className="flex min-h-0 flex-1">
          <EditorPane />
        </div>
        {termOpen && (
          <Resizer
            axis="y"
            target="after"
            onResize={setTermH}
            label="تغيير ارتفاع الطرفية"
            min={120}
            max={640}
          />
        )}
        <div
          style={termOpen ? { height: termH } : undefined}
          className={`${termOpen ? "" : "h-8"} shrink-0 border-t border-border transition-[height]`}
        >
          {termOpen ? (
            <div className="relative h-full">
              <button
                onClick={() => setTermOpen(false)}
                className="absolute end-2 top-1.5 z-10 text-muted-foreground hover:text-foreground"
                aria-label="Collapse terminal"
              >
                <ChevronDown className="size-4" />
              </button>
              <TerminalPanel />
            </div>
          ) : (
            <button
              onClick={() => setTermOpen(true)}
              className="flex h-full w-full items-center gap-2 bg-panel px-3 text-xs text-muted-foreground hover:text-foreground"
            >
              <ChevronUp className="size-4" /> Terminal
            </button>
          )}
        </div>
      </div>
      <div className="hidden lg:contents">
        <Resizer
          axis="x"
          target="after"
          onResize={setChatW}
          label="تغيير عرض لوحة المحادثة"
          min={240}
          max={640}
        />
      </div>
      <div style={{ width: chatW }} className="hidden min-w-0 shrink-0 lg:block">
        <ChatPanel />
      </div>
    </main>
  );
}
