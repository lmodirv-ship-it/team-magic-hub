import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { APP_PAGES, PORT_TYPES, portsApi, usePorts, type PortEntry, type PortType } from "@/lib/nawat/ports";
import { useTableMouse } from "@/components/nawat/DataTable";
import { PhoneLink } from "@/components/nawat/PhoneLink";
import { ServerStatusCard } from "@/components/nawat/ServerStatusCard";

export const Route = createFileRoute("/ports")({
  head: () => ({
    meta: [
      { title: "المنافذ — NAWAT Studio" },
      { name: "description", content: "كل منافذ الخادم والتطبيق: تفعيل وتعديل وإضافة، مع علاقاتها بالخدمات وصفحات التطبيق." },
      { property: "og:title", content: "المنافذ — NAWAT Studio" },
      { property: "og:description", content: "إدارة المنافذ وعلاقاتها بالخدمات وصفحات NAWAT Studio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PortsPage,
});

const pageLabel = (to: string) => APP_PAGES.find((p) => p.to === to)?.label ?? to;

function MultiPick({ label, options, value, onChange }: { label: string; options: { id: string; label: string }[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 px-2 text-xs">{label} ({value.length})</Button>
      </PopoverTrigger>
      <PopoverContent className="max-h-72 w-56 overflow-auto p-2 text-xs">
        {options.map((o) => (
          <label key={o.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-muted">
            <Checkbox aria-label={o.label} checked={value.includes(o.id)} onCheckedChange={(c) => onChange(c ? [...value, o.id] : value.filter((x) => x !== o.id))} />
            <span className="truncate">{o.label}</span>
          </label>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function PortsPage() {
  const ports = usePorts();
  const [q, setQ] = useState("");
  const [type, setType] = useState<"all" | PortType>("all");
  const [draft, setDraft] = useState({ addr: "192.168.100.66:5004", service: "", type: "svc" as PortType });
  const tm = useTableMouse("ports");

  const filtered = ports.filter((p) => (type === "all" || p.type === type) &&
    `${p.port} ${p.service} ${p.description} ${p.manager} ${p.host}`.toLowerCase().includes(q.toLowerCase()));
  const shown = tm.sortRows(filtered, (p, col) =>
    col === 0 ? (p.code ?? "") : col === 1 ? `${p.host}:${p.port}` : col === 2 ? p.service : col === 4 ? p.enabled : "");
  const portOpts = ports.map((p) => ({ id: p.id, label: `${p.host}:${p.port} ${p.service}` }));
  const pageOpts = APP_PAGES.map((p) => ({ id: p.to, label: p.label }));
  const byId = useMemo(() => Object.fromEntries(ports.map((p) => [p.id, p])), [ports]);
  const dupes = useMemo(() => {
    const c: Record<string, number> = {};
    ports.forEach((p) => { if (p.enabled) c[`${p.host}:${p.port}`] = (c[`${p.host}:${p.port}`] ?? 0) + 1; });
    return c;
  }, [ports]);

  const add = () => {
    const m = draft.addr.trim().match(/^(.+?):(\d{1,5}(-\d{1,5})?)$/);
    if (!m) { toast.error("اكتب العنوان بصيغة 192.168.100.66:5004"); return; }
    const host = m[1]!;
    const port = m[2]!;
    portsApi.add({ port, host, service: draft.service, bind: host.startsWith("127.") || host === "localhost" ? "local" : "public", type: draft.type, manager: "local", description: "", enabled: true, pages: [], links: [] });
    setDraft({ ...draft, service: "" });
    toast.success("أُضيف المنفذ");
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4 p-4" dir="rtl">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">المنافذ</h1>
          <p className="text-xs text-muted-foreground">{ports.length} منفذًا · {ports.filter((p) => p.enabled).length} مفعّل — التغييرات محفوظة في هذا المتصفح</p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => { portsApi.reset(); toast.info("أُعيدت القائمة الأصلية"); }}>استعادة القائمة الأصلية</Button>
      </header>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث: منفذ / خدمة / وصف…" className="h-8 w-60 text-xs" />
        <select value={type} onChange={(e) => setType(e.target.value as "all" | PortType)} className="h-8 rounded-md border border-input bg-background px-2 text-xs">
          <option value="all">كل الأنواع</option>
          {Object.entries(PORT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <span className="mx-2 h-6 w-px bg-border" />
        <Input value={draft.addr} onChange={(e) => setDraft({ ...draft, addr: e.target.value })} placeholder="192.168.100.66:5004" dir="ltr" className="h-8 w-52 font-mono text-xs" />
        <Input value={draft.service} onChange={(e) => setDraft({ ...draft, service: e.target.value })} placeholder="الخدمة" className="h-8 w-36 text-xs" />
        <Button size="sm" onClick={add}>إضافة منفذ</Button>
      </div>

      <div className="overflow-auto rounded-lg border border-border">
        <table className="w-full text-xs">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              {["المعرّف", "المنفذ", "الخدمة", "يعتمد على", "تفعيل", ""].map((h, i) => (
                <th key={i} {...tm.thProps(i, i !== 3 && i !== 5)} className={`px-2 py-2 text-start font-medium ${tm.thProps(i, i !== 3 && i !== 5).className}`}>
                  {h}
                  {tm.sortMark(i)}
                  {i > 0 && tm.resizeHandle(i)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && <tr><td colSpan={6} className="px-2 py-4 text-center text-muted-foreground">لا نتائج مطابقة</td></tr>}
            {shown.map((p) => (
              <tr key={p.id} {...tm.trProps(p.id)} className={`border-t border-border align-top ${p.enabled ? "" : "opacity-50"} ${tm.trProps(p.id).className}`}>
                <td className="px-2 py-1.5 font-mono text-muted-foreground" dir="ltr">{p.code ?? "—"}</td>
                <td className="px-2 py-1">
                  <Input key={`${p.host}:${p.port}`} defaultValue={`${p.host}:${p.port}`} dir="ltr" className={`h-7 w-48 font-mono text-xs ${(dupes[`${p.host}:${p.port}`] ?? 0) > 1 ? "border-destructive" : ""}`}
                    onBlur={(e) => {
                      const m = e.target.value.trim().match(/^(.+?):(\d{1,5}(-\d{1,5})?)$/);
                      if (!m) { toast.error("اكتب العنوان بصيغة 192.168.100.66:5004"); e.target.value = `${p.host}:${p.port}`; return; }
                      const host = m[1]!;
                      const port = m[2]!;
                      if (host !== p.host || port !== p.port) portsApi.update(p.id, { host, port, bind: host.startsWith("127.") || host === "localhost" ? "local" : "public" });
                    }} />
                </td>
                <td className="px-2 py-1"><Input defaultValue={p.service} className="h-7 w-44 text-xs" onBlur={(e) => portsApi.update(p.id, { service: e.target.value })} /></td>
                <td className="px-2 py-1">
                  <div className="flex flex-col items-start gap-1">
                    {p.links.map((l) => byId[l] ? (
                      <span key={l} className="flex items-center gap-2" dir="ltr">
                        <span className="font-mono text-[11px] text-muted-foreground">{byId[l].code}</span>
                        <span className="font-mono text-nawat">{byId[l].host}:{byId[l].port}</span>
                      </span>
                    ) : null)}
                    <MultiPick label="تعديل" options={portOpts.filter((o) => o.id !== p.id)} value={p.links} onChange={(v) => portsApi.update(p.id, { links: v })} />
                  </div>
                </td>
                <td className="px-2 py-1.5"><Switch aria-label={`تفعيل المنفذ ${p.host}:${p.port}`} title={p.enabled ? "مفعّل — اضغط للإيقاف" : "متوقف — اضغط للتفعيل"} checked={p.enabled} onCheckedChange={(v) => portsApi.update(p.id, { enabled: v })} /></td>
                <td className="px-2 py-1"><Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => portsApi.remove(p.id)}>حذف</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground">تعديل المنفذ هنا يغيّر سجل التطبيق فقط؛ لا يغيّر إعدادات الخادم نفسه. <Link to="/settings" className="underline">الإعدادات</Link></p>
      <ServerStatusCard />
      <PhoneLink />
    </div>
  );
}
