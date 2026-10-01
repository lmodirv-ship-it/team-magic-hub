import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "@/lib/nawat/workspace";
import { downloadBlob } from "@/lib/nawat/zip";
import {
  applyModels, applySettings, buildPack, getRecent, loadPack, packSummary, pushRecent, readUndo, saveUndo,
  type LoadedPack, type PackModel, type RecentPack,
} from "@/lib/nawat/pack";
import { buildPackSystemFiles, buildSetupBat, buildSetupSh } from "@/lib/nawat/pack-system";
import { officialModels, getDevelopmentModels } from "@/lib/nawat/providers";
import { PackEditor } from "./PackEditor";
import { SafetyPanel } from "./SafetyPanel";

export function PackButton({ onAttach }: { onAttach: (text: string) => void }) {
  const { vfs, importFiles } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"editor" | "safety" | "tools">("editor");
  const [name, setName] = useState("my-project");
  const [withSettings, setWithSettings] = useState(true);
  const roots = useMemo(() => [...new Set(Object.keys(vfs).map((p) => p.split("/")[0] ?? p))].sort(), [vfs]);
  const [picked, setPicked] = useState<string[] | null>(null);
  const [loaded, setLoaded] = useState<LoadedPack | null>(null);
  const [recent, setRecent] = useState<RecentPack[]>([]);
  const [pickedModels, setPickedModels] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const selected = picked ?? roots;
  const availableModels = useMemo<PackModel[]>(() => [
    ...officialModels.map((m) => ({ name: m.name, size: m.size, digest: m.digest, modifiedAt: "official", role: m.description })),
    ...getDevelopmentModels(),
  ], [open]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
  useEffect(() => { if (open) setRecent(getRecent()); }, [open]);

  const create = async () => {
    const files = Object.fromEntries(Object.entries(vfs).filter(([p]) => selected.includes(p.split("/")[0] ?? p)));
    const models = availableModels.filter((m) => pickedModels.includes(m.name));
    const { blob, manifest } = await buildPack(name.trim() || "pack", files, withSettings, models);
    downloadBlob(blob, `${manifest.name}.pack`);
    toast.success(`أُنشئت الحزمة (${manifest.files.length} ملفًا، ${models.length} نموذجًا)`);
    setRecent(getRecent());
  };

  const pick = async (f: File | undefined) => {
    if (!f) return;
    try { setLoaded(await loadPack(f)); } catch (e) { toast.error((e as Error).message); }
  };

  const apply = () => {
    if (!loaded?.valid) return;
    saveUndo(vfs);
    importFiles(loaded.files);
    applySettings(loaded.manifest.settings);
    const added = applyModels(loaded.manifest.models ?? []);
    pushRecent({ name: loaded.manifest.name, at: new Date().toISOString(), files: loaded.manifest.files.length, kind: "فتح" });
    toast.success(`طُبّقت الحزمة${added ? ` — سُجّل ${added} نموذجًا` : ""}`, {
      action: { label: "تراجع", onClick: () => { const u = readUndo(); if (u) { importFiles(u.vfs); applySettings(u.settings); } } },
    });
    setLoaded(null);
    setRecent(getRecent());
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="الحزم .pack (Ctrl+Shift+K)"
        aria-label="الحزم"
        className={`grid size-9 shrink-0 place-items-center rounded-md border border-nawat bg-nawat/15 text-base font-black text-nawat transition-shadow hover:shadow-[0_0_18px_var(--nawat)] ${open ? "animate-pack-glow" : "shadow-[0_0_8px_var(--nawat)]"}`}
      >
        P
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl" className={view === "editor" ? "max-w-5xl" : "max-w-lg"}>
          <DialogHeader><DialogTitle>{view === "editor" ? "Editor Pack — محرر الحزم" : "الحزم .pack"}</DialogTitle></DialogHeader>
          <div className="flex gap-1">
            <Button size="sm" variant={view === "editor" ? "default" : "outline"} onClick={() => setView("editor")}>المحرر</Button>
            <Button size="sm" variant={view === "safety" ? "default" : "outline"} onClick={() => setView("safety")}>الأمان</Button>
            <Button size="sm" variant={view === "tools" ? "default" : "outline"} onClick={() => setView("tools")}>أدوات الحزم</Button>
          </div>
          {view === "editor" ? <PackEditor /> : view === "safety" ? <SafetyPanel /> : <>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-nawat">معمارية Pack System</h3>
            <p className="text-xs text-muted-foreground">توليد هيكل forge/ الكامل (8 packs + manifest + ملفات التشغيل) في مساحة العمل.</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => {
                const files = buildPackSystemFiles();
                importFiles(files);
                toast.success(`وُلّدت معمارية Pack System (${Object.keys(files).length} ملفًا) — انظر forge/ في EXPLORER`);
              }}>توليد forge/ في مساحة العمل</Button>
              <Button size="sm" variant="outline" onClick={() => void (async () => {
                const files = buildPackSystemFiles();
                const { blob, manifest } = await buildPack("nawat-pack-system", files, false);
                downloadBlob(blob, `${manifest.name}.pack`);
                toast.success(`نُزّلت حزمة المعمارية (${manifest.files.length} ملفًا)`);
              })()}>تنزيل كحزمة .pack</Button>
              <Button size="sm" variant="outline" onClick={() => {
                downloadBlob(new Blob([buildSetupBat()], { type: "text/plain" }), "setup-forge.bat");
                toast.success("نُزّل setup-forge.bat — شغّله على جهازك لينشئ forge/ كاملة دفعة واحدة");
              }}>سكربت الإنشاء الشامل (.bat)</Button>
              <Button size="sm" variant="ghost" onClick={() => {
                downloadBlob(new Blob([buildSetupSh()], { type: "text/plain" }), "setup-forge.sh");
                toast.success("نُزّل setup-forge.sh");
              }}>.sh</Button>
            </div>
          </section>

          <section className="space-y-2 border-t border-border pt-3">
            <h3 className="text-sm font-semibold text-nawat">إنشاء حزمة</h3>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم الحزمة" />
            <div className="flex flex-wrap gap-2 text-xs">
              {roots.map((r) => (
                <label key={r} className="flex items-center gap-1">
                  <input type="checkbox" checked={selected.includes(r)}
                    onChange={(e) => setPicked(e.target.checked ? [...selected, r] : selected.filter((x) => x !== r))} />
                  {r}/
                </label>
              ))}
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={withSettings} onChange={(e) => setWithSettings(e.target.checked)} />
              تضمين إعدادات الاستوديو (المحركات، الأمان، نقاط الاتصال، النماذج)
            </label>
            <div className="rounded border border-border p-2">
              <div className="mb-1 flex items-center justify-between text-xs font-semibold">
                <span>نماذج الحزمة ({pickedModels.length})</span>
                <button type="button" className="text-[10px] text-primary hover:underline"
                  onClick={() => setPickedModels(pickedModels.length ? [] : availableModels.map((m) => m.name))}>
                  {pickedModels.length ? "إلغاء الكل" : "تحديد الكل"}
                </button>
              </div>
              <div className="max-h-28 space-y-0.5 overflow-auto text-xs">
                {availableModels.map((m) => (
                  <label key={m.name} className="flex items-center gap-2 text-muted-foreground" title={m.role}>
                    <input type="checkbox" checked={pickedModels.includes(m.name)}
                      onChange={(e) => setPickedModels(e.target.checked ? [...pickedModels, m.name] : pickedModels.filter((x) => x !== m.name))} />
                    <span className="truncate" dir="ltr">{m.name}</span>
                  </label>
                ))}
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">تُخزَّن النماذج المحددة داخل الحزمة، وتُسجَّل عند تطبيقها فتُستدعى عند الطلب.</p>
            </div>
            <Button size="sm" onClick={() => void create()} disabled={!selected.length}>إنشاء وتنزيل</Button>
          </section>

          <section className="space-y-2 border-t border-border pt-3">
            <h3 className="text-sm font-semibold text-nawat">فتح حزمة</h3>
            <input ref={fileRef} type="file" accept=".pack,.zip" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} />
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>اختيار ملف .pack</Button>
            {loaded && (
              <div className="space-y-2 rounded border border-border p-2 text-xs">
                <div><strong>{loaded.manifest.name}</strong> · {loaded.manifest.files.length} ملفًا · {loaded.manifest.createdAt.slice(0, 10)}</div>
                {!loaded.valid && <div className="text-destructive">البصمة غير مطابقة — الملف تالف أو معدّل، ولن يُطبَّق.</div>}
                {(loaded.manifest.models?.length ?? 0) > 0 && (
                  <div className="text-muted-foreground">النماذج ({loaded.manifest.models.length}): <span dir="ltr">{loaded.manifest.models.map((m) => m.name).join(", ")}</span></div>
                )}
                <ul className="max-h-28 overflow-auto text-muted-foreground" dir="ltr">
                  {loaded.manifest.files.map((f) => <li key={f}>{f}</li>)}
                </ul>
                <div>الإعدادات: {Object.keys(loaded.manifest.settings).length || "لا شيء"}</div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={apply} disabled={!loaded.valid}>تطبيق</Button>
                  <Button size="sm" variant="outline" onClick={() => { onAttach(packSummary(loaded.manifest)); setOpen(false); }}>إرفاق بالمحادثة</Button>
                  <Button size="sm" variant="ghost" onClick={() => setLoaded(null)}>إلغاء</Button>
                </div>
              </div>
            )}
          </section>

          {recent.length > 0 && (
            <section className="border-t border-border pt-3 text-xs">
              <h3 className="mb-1 text-sm font-semibold text-nawat">الحزم الأخيرة</h3>
              {recent.map((r, i) => (
                <div key={i} className="flex justify-between text-muted-foreground">
                  <span>{r.kind}: {r.name} ({r.files} ملفًا)</span><span dir="ltr">{r.at.slice(0, 16).replace("T", " ")}</span>
                </div>
              ))}
            </section>
          )}
          </>}
        </DialogContent>
      </Dialog>
    </>
  );
}
