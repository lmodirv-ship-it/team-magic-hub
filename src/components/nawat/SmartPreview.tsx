import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, FileArchive } from "lucide-react";
import Editor from "@monaco-editor/react";
import { useTheme } from "@/lib/nawat/theme";
import { MessageResponse } from "@/components/ai-elements/message";
import { languageOf, previewKindOf } from "@/lib/nawat/workspace";
import { bytesFromBase64, formatBytesShort, listZipEntries } from "@/lib/nawat/zip";

const LOG_RULES: { re: RegExp; cls: string }[] = [
  { re: /\b(error|erreur|fatal|fail(ed)?|exception|خطأ)\b/i, cls: "text-destructive" },
  { re: /\b(warn(ing)?|attention|تحذير)\b/i, cls: "text-warning" },
  { re: /\b(ok|success|done|succès|نجاح)\b/i, cls: "text-success" },
  { re: /\b(info|debug|trace)\b/i, cls: "text-nawat" },
];

function logLineClass(line: string) {
  return LOG_RULES.find((r) => r.re.test(line))?.cls ?? "text-muted-foreground";
}

function mediaSrc(path: string, content: string) {
  const trimmed = content.trim();
  if (/^(data:|https?:\/\/|blob:)/i.test(trimmed)) return trimmed;
  if (path.toLowerCase().endsWith(".svg")) {
    return `data:image/svg+xml;utf8,${encodeURIComponent(content)}`;
  }
  return null;
}

function JsonNode({ name, value, depth }: { name: string; value: unknown; depth: number }) {
  const [open, setOpen] = useState(depth < 2);
  const isObject = value !== null && typeof value === "object";
  const pad = { paddingInlineStart: `${depth * 14}px` };

  if (!isObject) {
    return (
      <div style={pad} className="py-0.5 font-mono text-xs">
        <span className="text-nawat">{name}</span>
        <span className="text-muted-foreground">: </span>
        <span className={typeof value === "string" ? "text-success" : "text-warning"}>
          {JSON.stringify(value)}
        </span>
      </div>
    );
  }

  const entries = Array.isArray(value)
    ? value.map((v, i) => [String(i), v] as const)
    : Object.entries(value as Record<string, unknown>);

  return (
    <div>
      <button
        style={pad}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1 py-0.5 text-start font-mono text-xs hover:text-foreground"
      >
        {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        <span className="text-nawat">{name}</span>
        <span className="text-muted-foreground">
          {Array.isArray(value) ? `[${entries.length}]` : `{${entries.length}}`}
        </span>
      </button>
      {open && entries.map(([k, v]) => <JsonNode key={k} name={k} value={v} depth={depth + 1} />)}
    </div>
  );
}

export function SmartPreview({
  path,
  content,
  className = "",
}: {
  path: string;
  content: string;
  className?: string;
}) {
  const { isDark } = useTheme();
  const kind = previewKindOf(path);
  const parsed = useMemo(() => {
    if (kind !== "json") return null;
    try {
      return { ok: true as const, value: JSON.parse(content || "null") as unknown };
    } catch (error) {
      return { ok: false as const, message: (error as Error).message };
    }
  }, [kind, content]);

  const wrapper = `size-full min-h-0 overflow-auto ${className}`;

  if (kind === "html") {
    return (
      <iframe
        title={`معاينة ${path}`}
        srcDoc={content}
        className={`size-full border-0 bg-card ${className}`}
        sandbox="allow-scripts"
      />
    );
  }

  if (kind === "markdown") {
    return (
      <div className={`${wrapper} bg-background p-5`}>
        <div className="prose-nawat mx-auto max-w-3xl text-sm leading-7">
          <MessageResponse>{content}</MessageResponse>
        </div>
      </div>
    );
  }

  if (kind === "json") {
    return (
      <div className={`${wrapper} bg-background p-4`}>
        {parsed?.ok ? (
          <JsonNode name="root" value={parsed.value} depth={0} />
        ) : (
          <p className="text-xs text-destructive">JSON غير صالح: {parsed?.message}</p>
        )}
      </div>
    );
  }

  if (kind === "image") {
    const src = mediaSrc(path, content);
    return (
      <div className={`${wrapper} grid place-items-center bg-card p-4`}>
        {src ? (
          <img src={src} alt={path} className="max-h-full max-w-full object-contain" />
        ) : (
          <p className="text-xs text-muted-foreground">
            لا توجد بيانات صورة قابلة للعرض (استخدم رابطًا أو data URL).
          </p>
        )}
      </div>
    );
  }

  if (kind === "video" || kind === "audio") {
    const src = mediaSrc(path, content);
    if (!src) {
      return (
        <div className={`${wrapper} grid place-items-center bg-card`}>
          <p className="text-xs text-muted-foreground">لا يوجد مسار وسائط قابل للتشغيل.</p>
        </div>
      );
    }
    return (
      <div className={`${wrapper} grid place-items-center bg-card p-4`}>
        {kind === "video" ? (
          <video src={src} controls className="max-h-full max-w-full rounded-md" />
        ) : (
          <audio src={src} controls className="w-full max-w-lg" />
        )}
      </div>
    );
  }

  if (kind === "pdf") {
    const src = mediaSrc(path, content) ?? (content.trim().startsWith("%PDF") ? null : null);
    return src ? (
      <iframe title={`معاينة ${path}`} src={src} className={`size-full border-0 bg-card`} />
    ) : (
      <div className={`${wrapper} grid place-items-center bg-card p-4`}>
        <p className="text-xs text-muted-foreground">
          لا يمكن عرض هذا الملف PDF (استخدم رابطًا أو data URL).
        </p>
      </div>
    );
  }

  if (kind === "log") {
    const lines = content.split("\n");
    return (
      <div className={`${wrapper} bg-background p-3`} dir="ltr">
        <pre className="font-mono text-xs leading-5">
          {lines.map((line, i) => (
            <div key={i} className={`whitespace-pre-wrap ${logLineClass(line)}`}>
              <span className="me-3 select-none opacity-30">{String(i + 1).padStart(4, " ")}</span>
              {line}
            </div>
          ))}
        </pre>
      </div>
    );
  }

  if (kind === "zip") {
    const bytes = bytesFromBase64(content);
    const listing = bytes ? listZipEntries(bytes) : null;
    return (
      <div className={`${wrapper} bg-background p-4`}>
        {listing?.length ? (
          <table className="w-full text-start font-mono text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-1 text-start font-normal">الملف</th>
                <th className="py-1 text-start font-normal">الحجم</th>
                <th className="py-1 text-start font-normal">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {listing.map((e) => (
                <tr key={e.path} className="border-t border-border/50">
                  <td className="py-1 pe-3">
                    <span className="inline-flex items-center gap-1.5">
                      <FileArchive className="size-3 text-nawat" />
                      {e.path}
                    </span>
                  </td>
                  <td className="py-1 pe-3 text-muted-foreground">{formatBytesShort(e.size)}</td>
                  <td className="py-1 text-muted-foreground">
                    {e.date ? e.date.toLocaleString("fr-FR") : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-xs text-muted-foreground">
            لا يمكن قراءة محتوى الأرشيف (يجب أن يكون بصيغة base64 أو data URL).
          </p>
        )}
      </div>
    );
  }

  return (
    <Editor
      height="100%"
      theme={isDark ? "vs-dark" : "vs"}
      path={`preview:${path}`}
      language={languageOf(path)}
      value={content}
      options={{
        readOnly: true,
        minimap: { enabled: false },
        fontSize: 13,
        scrollBeyondLastLine: false,
        wordWrap: "on",
      }}
    />
  );
}
