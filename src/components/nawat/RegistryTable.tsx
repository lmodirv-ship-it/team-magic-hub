import { useMemo, useState } from "react";
import { Check, Plus, RotateCcw, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  REGISTRY_CATEGORIES,
  useRegistry,
  type RegistryCategory,
  type RegistryEntry,
} from "@/lib/nawat/registry";
import { useTableMouse } from "@/components/nawat/DataTable";

const ALL = "الكل" as const;

export function RegistryTable() {
  const { entries, add, update, toggle, remove, resetAll, setAll } = useRegistry();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<RegistryCategory | typeof ALL>(ALL);
  const [draft, setDraft] = useState({
    name: "",
    role: "",
    task: "",
    category: "أدوات" as RegistryCategory,
  });

  const tm = useTableMouse("registry");
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = entries.filter((e) => {
      if (tab !== ALL && e.category !== tab) return false;
      if (!q) return true;
      return `${e.id} ${e.name} ${e.role} ${e.task}`.toLowerCase().includes(q);
    });
    return tm.sortRows(filtered, (e, col) =>
      col === 0 ? e.id : col === 1 ? e.name : col === 2 ? e.role : col === 3 ? e.task : col === 4 ? e.category : col === 5 ? e.enabled : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, query, tab, tm.sortRows]);

  const activeCount = entries.filter((e) => e.enabled).length;

  const submit = () => {
    if (!draft.name.trim()) return;
    add({
      name: draft.name.trim(),
      role: draft.role.trim() || "غير محدد",
      task: draft.task.trim() || "غير محدد",
      category: draft.category,
      enabled: true,
    });
    setDraft({ name: "", role: "", task: "", category: draft.category });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-md border border-border p-1">
          {[ALL, ...REGISTRY_CATEGORIES].map((c) => (
            <button
              key={c}
              onClick={() => setTab(c)}
              className={`rounded px-2 py-1 text-xs transition ${
                tab === c ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute end-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="بحث بالمعرّف أو الاسم أو المهمة…"
            className="control w-full pe-7"
          />
        </div>
        <span className="rounded-md bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground">
          {activeCount}/{entries.length} مفعّل
        </span>
        <Button variant="outline" size="sm" onClick={() => setAll(true, tab === ALL ? undefined : tab)}>
          <Check />
          تفعيل الكل
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setAll(false, tab === ALL ? undefined : tab)}
        >
          <X />
          تعطيل الكل
        </Button>
        <Button variant="ghost" size="sm" onClick={() => confirm("استعادة الجدول الافتراضي؟") && resetAll()}>
          <RotateCcw />
          استعادة
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[820px] text-xs">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              {["المعرّف", "الاسم", "الدور", "المهمة", "الفئة", "الحالة", "حذف"].map((h, i) => (
                <th key={i} {...tm.thProps(i, i !== 6)} className={`p-2 text-start font-medium ${tm.thProps(i, i !== 6).className}`}>
                  {h}
                  {tm.sortMark(i)}
                  {i > 0 && tm.resizeHandle(i)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <Row key={row.id} row={row} update={update} toggle={toggle} remove={remove} trProps={tm.trProps(row.id)} />
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground">
                  لا توجد عناصر مطابقة.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t border-border bg-muted/30">
              <td className="p-2 font-mono text-[11px] text-muted-foreground">تلقائي</td>
              <td className="p-2">
                <input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="اسم العنصر"
                  className="control w-full"
                />
              </td>
              <td className="p-2">
                <input
                  value={draft.role}
                  onChange={(e) => setDraft({ ...draft, role: e.target.value })}
                  placeholder="الدور"
                  className="control w-full"
                />
              </td>
              <td className="p-2">
                <input
                  value={draft.task}
                  onChange={(e) => setDraft({ ...draft, task: e.target.value })}
                  placeholder="المهمة"
                  className="control w-full"
                />
              </td>
              <td className="p-2">
                <select
                  value={draft.category}
                  onChange={(e) =>
                    setDraft({ ...draft, category: e.target.value as RegistryCategory })
                  }
                  className="control w-full"
                >
                  {REGISTRY_CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </td>
              <td className="p-2" colSpan={2}>
                <Button size="sm" onClick={submit} disabled={!draft.name.trim()}>
                  <Plus />
                  إضافة
                </Button>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function Row({
  row,
  update,
  toggle,
  remove,
  trProps,
}: {
  row: RegistryEntry;
  update: (id: string, patch: Partial<Omit<RegistryEntry, "id">>) => void;
  toggle: (id: string) => void;
  remove: (id: string) => void;
  trProps: { onClick: (e: React.MouseEvent) => void; className: string };
}) {
  return (
    <tr {...trProps} className={`border-t border-border ${trProps.className}`}>
      <td className="p-2 font-mono text-[11px] text-primary">{row.id}</td>
      <td className="p-2">
        <input
          value={row.name}
          onChange={(e) => update(row.id, { name: e.target.value })}
          className="w-full bg-transparent outline-none"
        />
      </td>
      <td className="p-2 text-muted-foreground">
        <input
          value={row.role}
          onChange={(e) => update(row.id, { role: e.target.value })}
          className="w-full bg-transparent outline-none"
        />
      </td>
      <td className="p-2 text-muted-foreground">
        <input
          value={row.task}
          onChange={(e) => update(row.id, { task: e.target.value })}
          className="w-full bg-transparent outline-none"
        />
      </td>
      <td className="p-2">
        <select
          value={row.category}
          onChange={(e) => update(row.id, { category: e.target.value as RegistryCategory })}
          className="bg-transparent text-xs outline-none"
        >
          {REGISTRY_CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </td>
      <td className="p-2">
        <button
          onClick={() => toggle(row.id)}
          className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
            row.enabled
              ? "bg-success/15 text-success"
              : "bg-destructive/10 text-destructive"
          }`}
        >
          {row.enabled ? "مفعّل" : "معطّل"}
        </button>
      </td>
      <td className="p-2">
        <Button
          variant="ghost"
          size="icon-sm"
          title="حذف"
          onClick={() => remove(row.id)}
        >
          <Trash2 />
        </Button>
      </td>
    </tr>
  );
}
