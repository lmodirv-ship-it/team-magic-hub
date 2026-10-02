import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Download, MessageSquarePlus, Paperclip, Trash2 } from "lucide-react";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputButton,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { ChatMessage } from "@/lib/nawat/bridge";
import { modelChatStream } from "@/lib/nawat/providers";
import { createThread, useThreads, type ConversationThread } from "@/lib/nawat/conversations";
import { useModels } from "@/lib/nawat/useModels";
import { PageHead } from "@/components/nawat/StudioViews";

export const Route = createFileRoute("/chat/$threadId")({
  staticData: { sitemap: false },
  head: PageHead("NAWAT Chat", "محادثات مستقلة متعددة محفوظة محليًا مع نماذج NAWAT."),
  component: ChatPage,
});

function ChatPage() {
  const { threadId } = Route.useParams();
  const navigate = useNavigate();
  const { threads, save, remove } = useThreads();
  const { models } = useModels();
  const fallbackModel = models[0]?.name ?? "nawat-chat:latest";
  const existing = threads.find((t) => t.id === threadId);
  const [thread, setThread] = useState<ConversationThread>(
    () => existing ?? createThread(fallbackModel),
  );
  const [status, setStatus] = useState<"ready" | "submitted" | "streaming" | "error">("ready");
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    const found = threads.find((t) => t.id === threadId);
    if (found) setThread(found);
  }, [threadId, threads]);
  useEffect(() => () => abort.current?.abort(), []);
  const createNew = () => {
    const next = createThread(fallbackModel);
    void navigate({ to: "/chat/$threadId", params: { threadId: next.id } });
    setThread(next);
  };
  const send = async ({ text, files }: PromptInputMessage) => {
    if (!text.trim() || status === "streaming") return;
    let prompt = text.trim();
    if (files.length)
      prompt += `\n\nالملفات المرفقة: ${files.map((f) => f.filename ?? "file").join(", ")}`;
    const base: ChatMessage[] = [...thread.messages, { role: "user", content: prompt }];
    const activeThread = {
      ...thread,
      id: threadId === "new" ? crypto.randomUUID() : thread.id,
      title: thread.messages.length ? thread.title : text.slice(0, 42),
      updatedAt: new Date().toISOString(),
      messages: base,
    };
    if (threadId === "new")
      void navigate({
        to: "/chat/$threadId",
        params: { threadId: activeThread.id },
        replace: true,
      });
    const pendingThread = {
      ...activeThread,
      messages: [...base, { role: "assistant" as const, content: "" }],
    };
    setThread(pendingThread);
    save(pendingThread);
    setStatus("submitted");
    abort.current = new AbortController();
    try {
      let output = "";
      setStatus("streaming");
      for await (const chunk of modelChatStream(activeThread.model, base, abort.current.signal)) {
        output += chunk;
        setThread({ ...activeThread, messages: [...base, { role: "assistant", content: output }] });
      }
      const completedThread = {
        ...activeThread,
        messages: [...base, { role: "assistant" as const, content: output }],
      };
      setThread(completedThread);
      save(completedThread);
      setStatus("ready");
    } catch (e) {
      const failedThread = {
        ...activeThread,
        messages: [
          ...base,
          {
            role: "assistant" as const,
            content: `تعذّر التنفيذ: ${(e as Error).message}`,
          },
        ],
      };
      setThread(failedThread);
      save(failedThread);
      setStatus("error");
    }
  };
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(thread, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${thread.title || "nawat-chat"}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <TooltipProvider>
      <main className="flex min-w-0 flex-1 overflow-hidden bg-background">
        <aside className="hidden w-64 shrink-0 border-e border-border bg-panel p-3 md:flex md:flex-col">
          <Button className="w-full" onClick={createNew}>
            <MessageSquarePlus /> محادثة جديدة
          </Button>
          <p className="mb-2 mt-5 px-2 text-[10px] font-semibold text-muted-foreground uppercase">
            المحادثات المحلية
          </p>
          <div className="min-h-0 flex-1 space-y-1 overflow-auto">
            {threads.map((t) => (
              <Link
                key={t.id}
                to="/chat/$threadId"
                params={{ threadId: t.id }}
                className={`block rounded-md px-3 py-2 ${t.id === thread.id ? "bg-accent" : "hover:bg-accent/50"}`}
              >
                <p className="truncate text-xs font-medium">{t.title}</p>
                <p className="mt-1 truncate font-mono text-[9px] text-muted-foreground">
                  {t.model}
                </p>
              </Link>
            ))}
          </div>
        </aside>
        <section className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 items-center gap-3 border-b border-border px-4">
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold">{thread.title}</h1>
              <p className="font-mono text-[10px] text-muted-foreground">
                محفوظ محليًا · {thread.messages.length} رسالة
              </p>
            </div>
            <div className="flex-1" />
            <select
              value={thread.model}
              onChange={(e) => {
                const next = { ...thread, model: e.target.value };
                setThread(next);
                if (threadId !== "new") save(next);
              }}
              className="max-w-52 rounded-md border border-border bg-background px-2 py-1.5 font-mono text-xs"
            >
              <option value={thread.model}>{thread.model}</option>
              {models
                .filter((m) => m.name !== thread.model)
                .map((m) => (
                  <option key={m.name}>{m.name}</option>
                ))}
            </select>
            <Button variant="ghost" size="icon-sm" title="تصدير JSON" onClick={exportJson}>
              <Download />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              title="حذف المحادثة"
              onClick={() => {
                remove(thread.id);
                createNew();
              }}
            >
              <Trash2 />
            </Button>
          </header>
          <Conversation className="min-h-0">
            <ConversationContent className="mx-auto w-full max-w-4xl gap-6 px-4 py-8">
              {thread.messages.length === 0 ? (
                <ConversationEmptyState
                  icon={
                    <img
                      src="/__l5e/assets-v1/b27d7498-76ab-4414-8e77-b2003fc9d7d2/nawat-logo-reference.png"
                      alt="NAWAT"
                      className="size-16 rounded-lg object-cover"
                    />
                  }
                  title="ابدأ مهمة جديدة"
                  description="اطلب تحليلًا أو كودًا أو أرفق ملفات المشروع."
                />
              ) : (
                thread.messages.map((m, i) => (
                  <Message from={m.role} key={`${i}-${m.role}`}>
                    <MessageContent>
                      {m.role === "assistant" ? (
                        <>
                          {!m.content && status !== "ready" ? (
                            <Shimmer>يفكر NAWAT...</Shimmer>
                          ) : (
                            <MessageResponse>{m.content}</MessageResponse>
                          )}
                          {m.content && (
                            <MessageActions>
                              <MessageAction
                                tooltip="نسخ"
                                onClick={() => void navigator.clipboard.writeText(m.content)}
                              >
                                <Copy />
                              </MessageAction>
                            </MessageActions>
                          )}
                        </>
                      ) : (
                        <span className="whitespace-pre-wrap">{m.content}</span>
                      )}
                    </MessageContent>
                  </Message>
                ))
              )}
              <ConversationScrollButton />
            </ConversationContent>
          </Conversation>
          <div className="mx-auto w-full max-w-4xl px-4 pb-4">
            <PromptInput onSubmit={send} multiple maxFiles={5}>
              <PromptInputTextarea placeholder="أرسل مهمة إلى NAWAT…" />
              <PromptInputFooter>
                <PromptInputTools>
                  <PromptInputButton
                    tooltip="إرفاق ملفات"
                    onClick={() =>
                      document
                        .querySelector<HTMLInputElement>('input[aria-label="Upload files"]')
                        ?.click()
                    }
                  >
                    <Paperclip />
                  </PromptInputButton>
                  <span className="hidden text-[10px] text-muted-foreground sm:inline">
                    Enter للإرسال · Shift+Enter لسطر جديد
                  </span>
                </PromptInputTools>
                <PromptInputSubmit
                  status={status}
                  onStop={() => {
                    abort.current?.abort();
                    setStatus("ready");
                  }}
                  disabled={!thread.model}
                />
              </PromptInputFooter>
            </PromptInput>
          </div>
        </section>
      </main>
    </TooltipProvider>
  );
}
