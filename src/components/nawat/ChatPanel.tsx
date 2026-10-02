import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Paperclip, Send, Square, Trash2, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import type { ChatMessage } from "@/lib/nawat/bridge";
import { getProviderForModel, modelChatStream } from "@/lib/nawat/providers";
import { enabledEngines, modelEngine, setModelEngine, type Engine } from "@/lib/nawat/engines";
import { useModels } from "@/lib/nawat/useModels";
import { useVoiceInput, useVoiceReply } from "@/lib/nawat/voice";
import { useWorkspace } from "@/lib/nawat/workspace";
import { PackButton } from "@/components/nawat/PackButton";

const KEY = (m: string) => `nawat.chat.${m}`;

export function ChatPanel() {
  const { models } = useModels();
  const { vfs, active, createFile, writeFile } = useWorkspace();
  const [model, setModel] = useState<string>("");
  const [engines, setEngines] = useState<Engine[]>([]);
  const [engine, setEngine] = useState("");
  useEffect(() => {
    const load = () => setEngines(enabledEngines());
    load();
    window.addEventListener("nawat:config", load);
    return () => window.removeEventListener("nawat:config", load);
  }, []);
  useEffect(() => {
    if (model) setEngine(modelEngine(model) ?? "");
  }, [model]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!model && models[0]) setModel(models[0].name);
  }, [models, model]);

  useEffect(() => {
    if (!model) return;
    try {
      const raw = localStorage.getItem(KEY(model));
      setMessages(raw ? (JSON.parse(raw) as ChatMessage[]) : []);
    } catch {
      setMessages([]);
    }
  }, [model]);

  useEffect(() => {
    if (model) localStorage.setItem(KEY(model), JSON.stringify(messages));
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, model]);

  useEffect(() => () => abort.current?.abort(), []);

  const voice = useVoiceReply();
  const mic = useVoiceInput((text) => {
    void send(text);
  });

  useEffect(() => {
    if (mic.error) toast.error(mic.error);
  }, [mic.error]);

  const send = async (text: string) => {
    if (!text.trim() || !model || streaming) return;
    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages([...next, { role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);
    abort.current = new AbortController();
    try {
      let acc = "";
      const started = Date.now();
      const emit = (done: boolean) =>
        window.dispatchEvent(new CustomEvent("nawat:stream", { detail: { text: acc, model, started, done } }));
      emit(false);
      for await (const chunk of modelChatStream(model, next, abort.current.signal)) {
        acc += chunk;
        setMessages([...next, { role: "assistant", content: acc }]);
        emit(false);
      }
      emit(true);
      if (voice.enabled) voice.speak(acc);
    } catch (e) {
      setMessages([...next, { role: "assistant", content: `⚠️ ${(e as Error).message}` }]);
    }
    setStreaming(false);
  };

  const attachActive = () => {
    if (!active) return;
    setInput(
      (i) => `${i}\n\n--- ${active} ---\n\`\`\`\n${(vfs[active] ?? "").slice(0, 6000)}\n\`\`\`\n`,
    );
  };

  const saveLastToFile = () => {
    const last = [...messages].reverse().find((m) => m.role === "assistant");
    if (!last) return;
    const path = prompt("Save model output to file", "my-app/src/generated.md");
    if (!path) return;
    const code = last.content.match(/```[a-z]*\n([\s\S]*?)```/)?.[1] ?? last.content;
    createFile(path);
    writeFile(path, code);
  };

  return (
    <div className="flex h-full min-h-0 flex-col border-s border-border bg-panel">
      <header className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span className="text-xs font-semibold tracking-wide text-nawat uppercase">NAWAT Chat</span>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="min-w-0 flex-1 truncate rounded border border-border bg-background px-2 py-1 text-xs"
        >
          {models.length === 0 && <option value="">no nawat models</option>}
          {models.map((m) => (
            <option key={m.name} value={m.name}>
              {m.name}
            </option>
          ))}
        </select>
        {model && !getProviderForModel(model) && (
          <select
            value={engine}
            onChange={(e) => {
              setEngine(e.target.value);
              setModelEngine(model, e.target.value || null);
            }}
            title="المحرك الذي يجيب هذا النموذج"
            aria-label="اختيار المحرك"
            className="max-w-28 truncate rounded border border-border bg-background px-1 py-1 text-[11px]"
          >
            <option value="">تلقائي</option>
            {engines.map((e) => (
              <option key={e.url} value={e.url}>{e.name}</option>
            ))}
          </select>
        )}
        <button
          onClick={() => {
            if (voice.speaking) voice.stop();
            voice.toggle();
          }}
          title={voice.enabled ? "إيقاف الرد الصوتي" : "تفعيل الرد الصوتي"}
          aria-label={voice.enabled ? "إيقاف الرد الصوتي" : "تفعيل الرد الصوتي"}
          disabled={!voice.supported}
          className="disabled:opacity-40"
        >
          {voice.enabled ? (
            <Volume2 className={`size-4 text-nawat ${voice.speaking ? "animate-pulse" : ""}`} />
          ) : (
            <VolumeX className="size-4 text-muted-foreground hover:text-foreground" />
          )}
        </button>
        <button onClick={() => setMessages([])} title="Clear conversation">
          <Trash2 className="size-4 text-muted-foreground hover:text-foreground" />
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-auto px-3 py-3 text-sm">
        {messages.length === 0 && (
          <p className="text-xs text-muted-foreground">
            محادثة مستقلة مع النموذج المحدد. أرسل مهامًا، تعليمات، أو أرفق الملف المفتوح.
          </p>
        )}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] rounded-lg bg-primary px-3 py-2 whitespace-pre-wrap text-primary-foreground">
                {m.content}
              </div>
            </div>
          ) : (
            <div key={i} className="whitespace-pre-wrap text-foreground">
              {m.content || (streaming ? "…" : "")}
            </div>
          ),
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t border-border p-2">
        <div className="mb-1 flex items-center gap-2">
          <button
            onClick={attachActive}
            className="flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <Paperclip className="size-3" /> Attach open file
          </button>
          <button
            onClick={saveLastToFile}
            className="rounded border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
          >
            Save output to file
          </button>
          <div className="flex-1" />
          <PackButton onAttach={(t) => setInput((v) => (v ? v + "\n\n" : "") + t)} />
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
          className="flex items-end gap-2"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            rows={3}
            placeholder="اكتب مهمة أو سؤالًا للنموذج…"
            className="min-h-16 flex-1 resize-none rounded-md border border-border bg-background p-2 text-sm outline-none focus:border-nawat"
          />
          <button
            type="button"
            onClick={mic.toggle}
            disabled={!mic.supported || streaming}
            title={mic.listening ? "إيقاف التسجيل" : "رسالة صوتية"}
            aria-label={mic.listening ? "إيقاف التسجيل" : "رسالة صوتية"}
            className={`grid size-9 place-items-center rounded-md border border-border disabled:opacity-40 ${
              mic.listening ? "animate-pulse bg-destructive text-destructive-foreground" : ""
            }`}
          >
            {mic.listening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
          </button>
          {streaming ? (
            <button
              type="button"
              onClick={() => abort.current?.abort()}
              className="grid size-9 place-items-center rounded-md bg-destructive text-destructive-foreground"
            >
              <Square className="size-4" />
            </button>
          ) : (
            <button
              type="submit"
              className="grid size-9 place-items-center rounded-md bg-nawat text-nawat-foreground disabled:opacity-40"
              disabled={!model}
            >
              <Send className="size-4" />
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
