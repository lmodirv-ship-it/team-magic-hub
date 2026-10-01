import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "@/lib/nawat/workspace";
import { clearJournal, hasInterruptedWrite, readJournal, type JournalEntry } from "@/lib/nawat/safety";

const KEY = "nawat.workspace.v1";

/** Safety Pack: سجل التعافي + استرجاع النسخ + كشف التعارض مع تبويب آخر. */
export function SafetyPanel() {
  const { vfs, writeFile, saveNow, saveState } = useWorkspace();
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [filter, setFilter] = useState("");
  const [conflict, setConflict] = useState<string[]>([]);
  const [interrupted, setInterrupted] = useState(false);

  const refresh = () => { setJournal(readJournal()); setInterrupted(hasInterruptedWrite()); };
  useEffect(() => { refresh(); }, [saveState]);

  // conflict.detect(): تغيير خارجي من تبويب آخر
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== KEY || !e.newValue) return;
      try {
        const ext = JSON.parse(e.newValue) as Record<string, string>;
        const diff = Object.keys(ext).filter((p) => vfs[p] !== undefined && ext[p] !== vfs[p]);
        if (diff.length) { setConflict(diff); toast.warning(`تغيّر ${diff.length} ملف من تبويب آخر`); }
      } catch { /* تجاهل */ }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [vfs]);

  const shown = useMemo(() => journal.filter((j) => j.path.includes(filter)).slice(0, 100), [journal, filter]);

  const restore = (j: JournalEntry) => {
    if (!confirm(`استرجاع نسخة ${j.path} من ${j.at.slice(0, 19).replace("T", " ")}؟`)) return;
    writeFile(j.path, j.content);
    saveNow();
    toast.success("استُرجعت النسخة (النسخة الحالية حُفظت في السجل)");
  };

  return (
    <div className="space-y-3 text-sm">
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-md border border-border p-2"><div className="text-lg font-bold text-nawat">{journal.length}</div>نسخة في السجل</div>
        <div className="rounded-md border border-border p-2"><div className="text-lg font-bold">{saveState === "saved" ? "✓" : "…"}</div>حفظ موثّق</div>
        <div className="rounded-md border border-border p-2"><div className="text-lg font-bold">{conflict.length}</div>تعارض</div>
      </div>

      {interrupted && <p className="rounded-md border border-destructive p-2 text-xs text-destructive">وُجدت كتابة لم تكتمل من جلسة سابقة — ملفاتك المحفوظة سليمة، واحفظ الآن للتأكيد.</p>}
      {conflict.length > 0 && (
        <div className="rounded-md border border-destructive p-2 text-xs">
          <div className="mb-1 font-semibold">ملفات عُدّلت في تبويب آخر:</div>
          <div dir="ltr">{conflict.slice(0, 8).join(", ")}</div>
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={() => { saveNow(); setConflict([]); }}>احتفظ بنسختي</Button>
            <Button size="sm" variant="outline" onClick={() => location.reload()}>حمّل النسخة الخارجية</Button>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="تصفية حسب المسار" className="h-8 text-xs" />
        <Button size="sm" variant="ghost" onClick={() => { if (confirm("مسح سجل التعافي؟")) { clearJournal(); refresh(); } }}>مسح</Button>
      </div>
      <ul className="max-h-72 space-y-1 overflow-auto text-xs">
        {shown.length === 0 && <li className="text-muted-foreground">لا نسخ بعد — تُسجَّل النسخة السابقة لكل ملف عند كل حفظ.</li>}
        {shown.map((j, i) => (
          <li key={i} className="flex items-center justify-between gap-2 rounded border border-border px-2 py-1">
            <span className="truncate" dir="ltr" title={j.path}>{j.path}</span>
            <span className="flex shrink-0 items-center gap-2 text-muted-foreground">
              <span dir="ltr">{j.at.slice(5, 19).replace("T", " ")}</span>
              <span>{j.size}B</span>
              <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => restore(j)}>استرجاع</Button>
            </span>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-muted-foreground">الحفظ يُكتب أولًا في نسخة مؤقتة ويُتحقق منه ثم يستبدل الأصل. هذا داخل تخزين المتصفح وليس كتابة ذرّية على القرص.</p>
    </div>
  );
}
