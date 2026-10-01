import { useEffect, useState } from "react";
import { Plus, Save, Trash2, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/lib/nawat/workspace";
import { useTableMouse } from "@/components/nawat/DataTable";

export type ConfigRow = { id: string; name: string; value: string; enabled: boolean };

/** Editable table: add / enable / delete / save. Saved to this device and to the workspace (models/config/<file>.json). */
export function ConfigTable({
  storageKey,
  file,
  defaults,
  nameLabel = "الاسم",
  valueLabel = "القيمة",
  namePlaceholder = "",
  valuePlaceholder = "",
  onTest,
}: {
  storageKey: string;
  file: string;
  defaults: ConfigRow[];
  nameLabel?: string;
  valueLabel?: string;
  namePlaceholder?: string;
  valuePlaceholder?: string;
  onTest?: (row: ConfigRow) => Promise<string>;
}) {
  const [tests, setTests] = useState<Record<string, { ok: boolean; msg: string } | "…">>({});
  const runTest = async (r: ConfigRow) => {
    if (!onTest) return;
    setTests((t) => ({ ...t, [r.id]: "…" }));
    try {
      const msg = await onTest(r);
      setTests((t) => ({ ...t, [r.id]: { ok: true, msg } }));
    } catch (e) {
      setTests((t) => ({ ...t, [r.id]: { ok: false, msg: (e as Error).name === "AbortError" ? "مهلة 5 ث" : "لا يجيب" } }));
    }
  };
  const { writeFile } = useWorkspace();
  const [rows, setRows] = useState<ConfigRow[]>(defaults);
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const tm = useTableMouse(storageKey);

  const defaultsSig = JSON.stringify(defaults);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      const stored = raw ? (JSON.parse(raw) as ConfigRow[]) : null;
      setRows(stored ?? defaults);
    } catch {
      setRows(defaults);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, defaultsSig]);

  const update = (next: ConfigRow[]) => {
    setRows(next);
    setDirty(true);
  };
  const add = () => {
    if (!name.trim()) return;
    update([...rows, { id: crypto.randomUUID(), name: name.trim(), value: value.trim(), enabled: true }]);
    setName("");
    setValue("");
  };
  const save = () => {
    localStorage.setItem(storageKey, JSON.stringify(rows));
    writeFile(`models/config/${file}.json`, JSON.stringify(rows, null, 2), { source: "manuel" } as never);
    window.dispatchEvent(new CustomEvent("nawat:config", { detail: { key: storageKey, rows } }));
    setDirty(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  return (
    <div className="mt-2 space-y-2">
      <div className="flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={namePlaceholder || nameLabel} className="control flex-1 font-mono" />
        <input value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder={valuePlaceholder || valueLabel} className="control flex-1 font-mono" />
        <Button size="icon" title="إضافة" onClick={add} disabled={!name.trim()}>
          <Plus />
        </Button>
      </div>
      <div className="overflow-hidden rounded-md border border-border">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              {[nameLabel, valueLabel, "تفعيل", ""].map((h, i) => (
                <th key={i} {...tm.thProps(i, i !== 3)} className={`p-2 text-start ${tm.thProps(i, i !== 3).className}`}>
                  {h}
                  {tm.sortMark(i)}
                  {i > 0 && tm.resizeHandle(i)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tm.sortRows(rows, (r, col) => (col === 0 ? r.name : col === 1 ? r.value : col === 2 ? r.enabled : "")).map((r) => (
              <tr key={r.id} {...tm.trProps(r.id)} className={`border-t border-border ${r.enabled ? "" : "opacity-50"} ${tm.trProps(r.id).className}`}>
                <td className="p-2 font-mono">{r.name}</td>
                <td className="max-w-0 truncate p-2 font-mono" dir="ltr">
                  {r.value}
                  {onTest && tests[r.id] && (
                    <span className={`ms-2 text-[10px] ${tests[r.id] === "…" ? "text-muted-foreground" : (tests[r.id] as { ok: boolean }).ok ? "text-nawat" : "text-destructive"}`}>
                      {tests[r.id] === "…" ? "…" : `${(tests[r.id] as { ok: boolean }).ok ? "✓" : "✗"} ${(tests[r.id] as { msg: string }).msg}`}
                    </span>
                  )}
                </td>
                <td className="p-2 text-center">
                  <input type="checkbox" className="size-4" checked={r.enabled} onChange={() => update(rows.map((x) => (x.id === r.id ? { ...x, enabled: !x.enabled } : x)))} />
                </td>
                <td className="whitespace-nowrap p-1">
                  {onTest && (
                    <Button variant="ghost" size="icon-sm" title="اختبار" aria-label="اختبار" onClick={() => runTest(r)}>
                      <Activity />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon-sm" title="حذف" onClick={() => update(rows.filter((x) => x.id !== r.id))}>
                    <Trash2 />
                  </Button>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={4} className="p-3 text-center text-muted-foreground">لا توجد عناصر.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-muted-foreground" dir="ltr">my-app → models/config/{file}.json</span>
        <Button size="sm" variant={dirty ? "default" : "outline"} onClick={save}>
          <Save />
          {saved ? "تم الحفظ" : "حفظ وربط بمساحة العمل"}
        </Button>
      </div>
    </div>
  );
}
