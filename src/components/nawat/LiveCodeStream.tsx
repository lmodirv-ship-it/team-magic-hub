import { useEffect, useRef, useState } from "react";
import { Code2, Copy, Trash2 } from "lucide-react";

export type StreamDetail = { text: string; model?: string; started: number; done: boolean };

/** Subscribes to live model output broadcast by ChatPanel. */
export function useModelStream() {
  const [s, setS] = useState<StreamDetail | null>(null);
  useEffect(() => {
    const on = (e: Event) => setS((e as CustomEvent<StreamDetail>).detail);
    window.addEventListener("nawat:stream", on);
    return () => window.removeEventListener("nawat:stream", on);
  }, []);
  return [s, setS] as const;
}

export function extractCode(text: string) {
  const blocks = [...text.matchAll(/```[\w-]*\n?([\s\S]*?)(```|$)/g)].map((m) => m[1]);
  return blocks.length ? blocks.join("\n\n") : text;
}

export function LiveCodeStream() {
  const [s, setS] = useModelStream();
  const ref = useRef<HTMLPreElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [s?.text]);
  const code = s ? extractCode(s.text) : "";
  const secs = s ? Math.max(0.1, (Date.now() - s.started) / 1000) : 0;
  const tps = s ? Math.round(s.text.length / 4 / secs) : 0;
  return (
    <div className="flex h-full flex-col border-s border-border bg-panel">
      <div className="flex items-center gap-2 border-b border-border px-2 py-1.5 text-xs">
        <Code2 className="size-3.5 text-success" />
        <span className="font-semibold text-success">الكود المباشر</span>
        {s && !s.done && <span className="size-1.5 animate-pulse rounded-full bg-success" />}
        <span className="ms-auto font-mono text-[10px] text-muted-foreground" dir="ltr">
          {s ? `${tps} tok/s · ${code.split("\n").length} lines` : "idle"}
        </span>
        <button title="نسخ" aria-label="نسخ الكود" onClick={() => code && navigator.clipboard.writeText(code)}>
          <Copy className="size-3.5 text-muted-foreground hover:text-foreground" />
        </button>
        <button title="مسح" aria-label="مسح" onClick={() => setS(null)}>
          <Trash2 className="size-3.5 text-muted-foreground hover:text-foreground" />
        </button>
      </div>
      <pre
        ref={ref}
        dir="ltr"
        className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap p-3 text-start font-mono text-[12px] leading-5 text-foreground"
      >
        {code || <span className="text-muted-foreground">// اسأل النموذج في المحادثة وسيظهر الكود هنا لحظيًا</span>}
      </pre>
    </div>
  );
}
