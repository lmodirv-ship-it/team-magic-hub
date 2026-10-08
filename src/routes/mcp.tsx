import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Copy, Terminal } from "lucide-react";
import { toast } from "sonner";
import { Page, Panel } from "@/components/nawat/StudioUI";
import { DevTools } from "@/components/nawat/DevToolsPanel";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/mcp")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "MCP + CLI — NAWAT Studio" },
      { name: "description", content: "اربط Claude Desktop وCursor وOpenCode بمنظومة NAWAT، وتحكّم بها من سطر الأوامر." },
      { property: "og:title", content: "MCP + CLI — NAWAT Studio" },
      { property: "og:description", content: "العقل واللسان: خادم MCP وأداة nawat لسطر الأوامر." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: McpPage,
});

const KEY = "nawat.mcp.settings.v1";
type S = { path: string; bridge: string; factory: string; ollama: string };
const DEF: S = {
  path: "C:/nawat",
  bridge: "http://192.168.100.67:8788",
  factory: "http://192.168.100.67:8789",
  ollama: "http://192.168.100.67:11434",
};

const COMMANDS: [string, string][] = [
  ["nawat status", "حالة الجسر والمصنع وOllama"],
  ["nawat system", "مقاييس السيرفر"],
  ["nawat models", "النماذج وأحجامها"],
  ["nawat chat qwen3:4b \"مرحبا\"", "سؤال نموذج"],
  ["nawat compare r16 r17", "مقارنة نموذجين"],
  ["nawat queue", "طابور المصنع"],
  ["nawat train --teacher nawat-think:v17-anon --version v18", "بدء التدريب"],
  ["nawat deploy v18", "النشر"],
  ["nawat worker start", "تشغيل عامل المصنع"],
  ["nawat logs", "السجلات"],
  ["nawat serve mcp", "تشغيل خادم MCP"],
];

const TOOLS = ["nawat_status", "nawat_system", "nawat_models", "nawat_chat", "nawat_factory_queue", "nawat_factory_add"];

function copy(t: string) {
  void navigator.clipboard.writeText(t);
  toast.success("تم النسخ");
}

function McpPage() {
  const [s, setS] = useState<S>(DEF);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const v = localStorage.getItem(KEY);
      if (v) setS({ ...DEF, ...(JSON.parse(v) as S) });
    } catch { /* ignore */ }
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) localStorage.setItem(KEY, JSON.stringify(s));
  }, [ready, s]);

  const env = { NAWAT_BRIDGE: s.bridge, NAWAT_FACTORY: s.factory, NAWAT_OLLAMA: s.ollama };
  const server = { command: "node", args: [`${s.path.replace(/\/$/, "")}/cli/mcp-server.mjs`], env };
  const claude = JSON.stringify({ mcpServers: { nawat: server } }, null, 2);
  const cursor = JSON.stringify({ mcpServers: { nawat: server } }, null, 2);
  const opencode = JSON.stringify({ mcp: { nawat: { type: "local", command: ["node", server.args[0]], environment: env } } }, null, 2);
  const install = `cd ${s.path}\nnpm link        # يضيف الأمر nawat\nnawat status`;

  return (
    <Page eyebrow="MCP + CLI" title="العقل واللسان" description="اربط مساعدات الذكاء الاصطناعي بمنظومة NAWAT، وتحكّم بكل شيء بأمر واحد. تُحفظ الإعدادات تلقائيًا.">
      <div className="grid gap-4">
        <Panel title="الإعدادات">
          <div className="grid gap-2 md:grid-cols-2">
            {(["path", "bridge", "factory", "ollama"] as const).map((k) => (
              <label key={k} className="grid gap-1 text-xs">
                {{ path: "مجلد NAWAT على جهازك", bridge: "الجسر", factory: "المصنع", ollama: "Ollama" }[k]}
                <input dir="ltr" value={s[k]} onChange={(e) => setS({ ...s, [k]: e.target.value })} className="control font-mono" />
              </label>
            ))}
          </div>
        </Panel>

        <div className="grid gap-4 xl:grid-cols-3">
          {([["Claude Desktop", claude, "claude_desktop_config.json"], ["Cursor", cursor, ".cursor/mcp.json"], ["OpenCode", opencode, "opencode.json"]] as const).map(([t, c, f]) => (
            <Panel key={t} title={t} note={f}>
              <pre dir="ltr" className="max-h-64 overflow-auto rounded bg-muted p-2 text-xs">{c}</pre>
              <Button className="mt-2" variant="outline" size="sm" onClick={() => copy(c)}><Copy />نسخ</Button>
            </Panel>
          ))}
        </div>

        <Panel title="أدوات MCP" note={`${TOOLS.length} أدوات`}>
          <div className="flex flex-wrap gap-2">
            {TOOLS.map((t) => <code key={t} className="rounded border border-border px-2 py-1 text-xs">{t}</code>)}
          </div>
        </Panel>

        <Panel title="nawat CLI" note="سطر الأوامر">
          <pre dir="ltr" className="rounded bg-muted p-2 text-xs">{install}</pre>
          <Button className="my-2" variant="outline" size="sm" onClick={() => copy(install)}><Terminal />نسخ التثبيت</Button>
          <ul className="grid gap-1 md:grid-cols-2">
            {COMMANDS.map(([c, d]) => (
              <li key={c} className="flex items-center justify-between gap-2 rounded border border-border p-2 text-xs">
                <code dir="ltr">{c}</code>
                <span className="flex items-center gap-1 text-muted-foreground">
                  {d}
                  <Button size="icon" variant="ghost" aria-label="نسخ" onClick={() => copy(c)}><Copy /></Button>
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        <DevTools s={s} />
      </div>
    </Page>
  );
}
