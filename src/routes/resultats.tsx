import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Columns2, Download, ExternalLink, FileArchive, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Page, Panel } from "@/components/nawat/StudioUI";
import { SmartPreview } from "@/components/nawat/SmartPreview";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LIBRARY_ROOT, previewKindOf, useWorkspace } from "@/lib/nawat/workspace";
import { createZip, downloadBlob, downloadText } from "@/lib/nawat/zip";

export const Route = createFileRoute("/resultats")({
  validateSearch: (search: Record<string, unknown>) => ({
    status: search["status"] === "fixed" ? ("fixed" as const) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "النتائج — NAWAT Studio" },
      {
        name: "description",
        content: "كل الملفات التي ولّدتها النماذج، مع الفلاتر والمعاينة والمقارنة والتصدير.",
      },
      { property: "og:title", content: "النتائج — NAWAT Studio" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      {
        property: "og:description",
        content:
          "تصفية حسب النموذج والنوع والتاريخ، معاينة ذكية، مقارنة جنبًا إلى جنب، وتصدير ZIP.",
      },
    ],
  }),
  component: ResultsPage,
});

const PERIODS = [
  { id: "all", label: "كل الفترات" },
  { id: "1", label: "آخر 24 ساعة" },
  { id: "7", label: "آخر 7 أيام" },
  { id: "30", label: "آخر 30 يومًا" },
];

function extOf(path: string) {
  return path.split(".").pop()?.toLowerCase() ?? "—";
}

function ResultsPage() {
  const { vfs, meta, openFile, deleteFile } = useWorkspace();
  const navigate = useNavigate();
  const { status } = Route.useSearch();
  const [query, setQuery] = useState("");
  const [model, setModel] = useState("all");
  const [type, setType] = useState("all");
  const [period, setPeriod] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [compare, setCompare] = useState(false);
  const [focus, setFocus] = useState<string | null>(null);

  const generated = useMemo(
    () =>
      Object.keys(vfs)
        .filter((p) => p.startsWith(`${LIBRARY_ROOT}/`) || meta[p]?.source === "atelier")
        .sort((a, b) => (meta[b]?.createdAt ?? "").localeCompare(meta[a]?.createdAt ?? "")),
    [vfs, meta],
  );

  const modelOptions = useMemo(
    () => [...new Set(generated.map((p) => meta[p]?.model).filter(Boolean) as string[])],
    [generated, meta],
  );
  const typeOptions = useMemo(() => [...new Set(generated.map(extOf))], [generated]);

  const filtered = useMemo(() => {
    const limit = period === "all" ? 0 : Date.now() - Number(period) * 24 * 60 * 60 * 1000;
    return generated.filter((p) => {
      if (status === "fixed" && !/corrig[ée]|corrected|fixed/i.test(`${p}\n${vfs[p] ?? ""}`)) {
        return false;
      }
      if (model !== "all" && meta[p]?.model !== model) return false;
      if (type !== "all" && extOf(p) !== type) return false;
      if (limit) {
        const t = Date.parse(meta[p]?.createdAt ?? "");
        if (!t || t < limit) return false;
      }
      if (query.trim()) {
        const q = query.toLowerCase();
        if (!p.toLowerCase().includes(q) && !(vfs[p] ?? "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [generated, model, type, period, query, status, meta, vfs]);

  const toggle = (p: string) =>
    setSelected((s) => (s.includes(p) ? s.filter((x) => x !== p) : [...s, p]));

  const exportZip = (paths: string[]) => {
    if (paths.length === 0) {
      toast.error("لا توجد ملفات للتصدير.");
      return;
    }
    const blob = createZip(paths.map((p) => ({ path: p, content: vfs[p] ?? "" })));
    downloadBlob(blob, `nawat-resultats-${new Date().toISOString().slice(0, 10)}.zip`);
    toast.success(`تم تصدير ${paths.length} ملف.`);
  };

  const comparePaths = selected.slice(0, 4);
  const previewPath = focus ?? filtered[0] ?? null;

  return (
    <Page
      eyebrow="Résultats"
      title="النتائج"
      description="كل ما ولّدته النماذج في مكان واحد: فلترة، معاينة، مقارنة، وتصدير."
      actions={
        <div className="flex gap-2">
          <Button
            variant={compare ? "default" : "outline"}
            onClick={() => setCompare((c) => !c)}
            disabled={selected.length < 2}
          >
            <Columns2 className="size-4" /> مقارنة ({selected.length})
          </Button>
          <Button
            variant="outline"
            onClick={() => exportZip(selected.length ? selected : filtered)}
          >
            <FileArchive className="size-4" /> تصدير ZIP
          </Button>
        </div>
      }
    >
      <div className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {status === "fixed" && (
          <div className="flex h-9 items-center justify-between rounded-md border border-nawat/30 bg-nawat/10 px-3 text-xs text-nawat sm:col-span-2 xl:col-span-4">
            <span>عرض الملفات المصححة فقط</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void navigate({ to: "/resultats", search: { status: undefined } })}
            >
              إلغاء الفلتر
            </Button>
          </div>
        )}
        <div className="relative">
          <Search className="absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="بحث في الأسماء والمحتوى…"
            className="ps-9"
          />
        </div>
        <Select value={model} onValueChange={setModel}>
          <SelectTrigger>
            <SelectValue placeholder="النموذج" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل النماذج</SelectItem>
            {modelOptions.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger>
            <SelectValue placeholder="النوع" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الأنواع</SelectItem>
            {typeOptions.map((t) => (
              <SelectItem key={t} value={t}>
                .{t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger>
            <SelectValue placeholder="الفترة" />
          </SelectTrigger>
          <SelectContent>
            {PERIODS.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {compare && comparePaths.length >= 2 ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {comparePaths.map((p) => (
            <section
              key={p}
              className="glass-panel flex h-[520px] flex-col overflow-hidden rounded-lg"
            >
              <header className="flex items-center gap-2 border-b border-border px-3 py-2">
                <span className="min-w-0 flex-1 truncate font-mono text-xs">{p}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {meta[p]?.model ?? "—"}
                </span>
              </header>
              <div className="min-h-0 flex-1">
                <SmartPreview path={p} content={vfs[p] ?? ""} />
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
          <Panel title="الملفات المولَّدة" note={`${filtered.length} ملف`}>
            {filtered.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                لا توجد نتائج بعد. شغّل الورشة متعددة النماذج.
              </p>
            ) : (
              <ul className="max-h-[520px] space-y-1 overflow-auto">
                {filtered.map((p) => (
                  <li
                    key={p}
                    className={`flex items-center gap-2 rounded px-2 py-1.5 ${
                      previewPath === p ? "bg-accent" : "hover:bg-accent/50"
                    }`}
                  >
                    <Checkbox checked={selected.includes(p)} onCheckedChange={() => toggle(p)} />
                    <button onClick={() => setFocus(p)} className="min-w-0 flex-1 text-start">
                      <span className="block truncate font-mono text-xs">{p.split("/").pop()}</span>
                      <span className="block truncate text-[10px] text-muted-foreground">
                        {meta[p]?.model ?? "—"} ·{" "}
                        {meta[p]?.createdAt
                          ? new Date(meta[p]!.createdAt).toLocaleString("fr-FR")
                          : "—"}{" "}
                        · {(vfs[p] ?? "").length} حرف · {previewKindOf(p)}
                      </span>
                    </button>
                    <button title="فتح في المحرر" onClick={() => openFile(p)}>
                      <ExternalLink className="size-3.5 text-muted-foreground hover:text-foreground" />
                    </button>
                    <button title="تنزيل" onClick={() => downloadText(p, vfs[p] ?? "")}>
                      <Download className="size-3.5 text-muted-foreground hover:text-foreground" />
                    </button>
                    <button
                      title="حذف"
                      onClick={() => {
                        deleteFile(p);
                        setSelected((s) => s.filter((x) => x !== p));
                        if (focus === p) setFocus(null);
                      }}
                    >
                      <Trash2 className="size-3.5 text-muted-foreground hover:text-destructive" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <section className="glass-panel flex h-[560px] min-w-0 flex-col overflow-hidden rounded-lg">
            <header className="flex items-center gap-2 border-b border-border px-4 py-2.5">
              <span className="min-w-0 flex-1 truncate font-mono text-xs">
                {previewPath ?? "لا يوجد ملف محدد"}
              </span>
              {previewPath && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => downloadText(previewPath, vfs[previewPath] ?? "")}
                >
                  <Download className="size-3.5" /> تنزيل
                </Button>
              )}
            </header>
            <div className="min-h-0 flex-1">
              {previewPath ? (
                <SmartPreview path={previewPath} content={vfs[previewPath] ?? ""} />
              ) : (
                <div className="grid h-full place-items-center text-sm text-muted-foreground">
                  اختر ملفًا لعرضه.
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </Page>
  );
}
