import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Copy, ExternalLink, Link2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Page, Panel } from "@/components/nawat/StudioUI";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/connect")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "الربط السريع — NAWAT Studio" },
      { name: "description", content: "اربط مواقعك ومنصاتك مثل HN Code وHN Studio وtvcc بنواة بنقرة واحدة." },
      { property: "og:title", content: "الربط السريع — NAWAT Studio" },
      { property: "og:description", content: "مركز الموصلات: مواقع، دردشة، وخوادم MCP." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConnectPage,
});

type Kind = "site" | "chat" | "mcp";
type Connector = { id: string; name: string; url: string; kind: Kind; note?: string; builtin?: boolean };
const KEY = "nawat.connectors.v1";
const KIND_LABEL: Record<Kind, string> = { site: "موقع", chat: "دردشة", mcp: "MCP" };

export const BUILTIN_CONNECTORS: Connector[] = [
  { id: "nawat", name: "NAWAT Studio", url: "https://nawat.groupe-hn.com", kind: "site", builtin: true, note: "المنظومة الرسمية" },
  { id: "hn-ai-site", name: "NAWAT — hn-ai.site", url: "https://hn-ai.site", kind: "site", builtin: true, note: "نسخة السيرفر 213.156.133.94" },
  { id: "nawat-group", name: "NAWAT — nawat-group.com", url: "https://www.nawat-group.com", kind: "site", builtin: true, note: "نسخة nawat-group.com للمزامنة" },
  { id: "comfy-hn", name: "ComfyUI — السيرفر العام", url: "http://213.156.132.166/comfy/ui/1/", kind: "site", builtin: true, note: "مولّد الصور على السيرفر" },
  { id: "comfy-local", name: "ComfyUI حاسوبي — المنفذ السريع", url: "http://127.0.0.1:8188", kind: "site", builtin: true, note: "إنتاج سريع" },
  { id: "comfy-hn-secure", name: "ComfyUI محمي — hn-ai.site", url: "https://hn-ai.site/comfy-hn", kind: "site", builtin: true, note: "عبر HTTPS" },
  ...[1, 2, 3, 4, 5].map((n): Connector => ({ id: `comfy-lan-${n}`, name: `ComfyUI ${n}`, url: `http://192.168.2.4:${8187 + n}`, kind: "site", builtin: true, note: "الشبكة المحلية" })),
  { id: "hn-ai-bridge", name: "جسر hn-ai.site", url: "https://hn-ai.site/bridge", kind: "mcp", builtin: true, note: "الجسر عبر الإنترنت" },
  { id: "hncode", name: "HN Code", url: "https://hncode.hnchat.net", kind: "site", builtin: true, note: "محرر الأكواد" },
  { id: "hnstudio", name: "HN Studio", url: "https://studio.hnchat.net/", kind: "chat", builtin: true, note: "استوديو الدردشة" },
  { id: "tvcc", name: "tvcc", url: "", kind: "chat", builtin: true, note: "موصل دردشة خاص — أضف عنوانه" },
];

function load(): Connector[] {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "[]") as Connector[];
    const merged = BUILTIN_CONNECTORS.map((b) => ({ ...b, ...(saved.find((s) => s.id === b.id) ?? {}), builtin: true }));
    return [...merged, ...saved.filter((s) => !BUILTIN_CONNECTORS.some((b) => b.id === s.id))];
  } catch { return BUILTIN_CONNECTORS; }
}

function ConnectPage() {
  const [list, setList] = useState<Connector[]>(BUILTIN_CONNECTORS);
  const [ready, setReady] = useState(false);
  const [draft, setDraft] = useState({ name: "", url: "", kind: "chat" as Kind });
  const [status, setStatus] = useState<Record<string, string>>({});

  useEffect(() => { setList(load()); setReady(true); }, []);
  useEffect(() => { if (ready) localStorage.setItem(KEY, JSON.stringify(list)); }, [ready, list]);

  const patch = (id: string, p: Partial<Connector>) => setList((l) => l.map((c) => (c.id === id ? { ...c, ...p } : c)));
  const test = async (c: Connector) => {
    if (!c.url) { toast.error("أضف العنوان أولًا"); return; }
    const t = performance.now();
    try {
      await fetch(c.url, { mode: "no-cors", signal: AbortSignal.timeout(8000) });
      setStatus((s) => ({ ...s, [c.id]: `متاح · ${Math.round(performance.now() - t)}ms` }));
    } catch { setStatus((s) => ({ ...s, [c.id]: "غير متاح" })); }
  };
  const mcpConfig = (c: Connector) =>
    JSON.stringify({ mcpServers: { [c.id]: { url: c.url, transport: "http" }, nawat: { command: "node", args: ["cli/mcp-server.mjs"] } } }, null, 2);

  return (
    <Page eyebrow="Connectors / Quick Link" title="الربط السريع" description="كل مواقعك ومنصاتك في مكان واحد — افتح، اختبر، وانسخ إعدادات الربط.">
      <Panel title="إضافة موصل" note="يُحفظ تلقائيًا">
        <div className="grid gap-2 md:grid-cols-[1fr_2fr_auto_auto]">
          <input className="control" placeholder="الاسم (مثل tvcc)" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <input className="control font-mono" dir="ltr" placeholder="https://..." value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} />
          <select className="control" value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as Kind })}>
            {Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <Button onClick={() => {
            if (!draft.name.trim()) { toast.error("اكتب الاسم"); return; }
            setList((l) => [...l, { id: `c-${Date.now()}`, ...draft, name: draft.name.trim() }]);
            setDraft({ name: "", url: "", kind: "chat" });
            toast.success("أُضيف الموصل");
          }}><Plus />إضافة</Button>
        </div>
      </Panel>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {list.map((c) => (
          <div key={c.id} className="rounded-xl border border-border bg-card p-4 shadow-sm transition hover:border-primary/50">
            <div className="mb-2 flex items-center gap-2">
              <span className="grid size-9 place-items-center rounded-lg bg-primary/15 text-primary"><Link2 className="size-4" /></span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{c.name}</div>
                <div className="text-[11px] text-muted-foreground">{KIND_LABEL[c.kind]} · {c.note ?? ""}</div>
              </div>
              {status[c.id] && <span className="text-[10px] text-muted-foreground">{status[c.id]}</span>}
            </div>
            <input className="control font-mono text-xs" dir="ltr" value={c.url} placeholder="https://..." onChange={(e) => patch(c.id, { url: e.target.value })} />
            <div className="mt-2 flex flex-wrap gap-1">
              <Button size="sm" disabled={!c.url} onClick={() => window.open(c.url, "_blank", "noopener")}><ExternalLink />فتح</Button>
              <Button size="sm" variant="outline" onClick={() => void test(c)}>اختبار</Button>
              <Button size="sm" variant="outline" onClick={() => { void navigator.clipboard.writeText(mcpConfig(c)); toast.success("نُسخت إعدادات الربط"); }}><Copy />إعدادات</Button>
              {!c.builtin && <Button size="icon" variant="ghost" aria-label="حذف" onClick={() => setList((l) => l.filter((x) => x.id !== c.id))}><Trash2 /></Button>}
            </div>
          </div>
        ))}
      </div>
    </Page>
  );
}
