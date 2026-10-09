import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export const SYNC_PEERS_KEY = "nawat.sync.peers.v1";
const DEFAULTS = ["http://192.168.100.67:8788", "https://hn-ai.site/bridge"];

export function loadSyncPeers(): string[] {
  try { const v = JSON.parse(localStorage.getItem(SYNC_PEERS_KEY) ?? "null"); return Array.isArray(v) ? v : DEFAULTS; } catch { return DEFAULTS; }
}

/** قائمة الجسور المرتبطة للمزامنة — تُحفظ تلقائيًا وتُرسل مع كل مزامنة. */
export function SyncPeersSettings() {
  const [peers, setPeers] = useState<string[]>(DEFAULTS);
  const [draft, setDraft] = useState("");
  useEffect(() => setPeers(loadSyncPeers()), []);
  const save = (p: string[]) => { setPeers(p); localStorage.setItem(SYNC_PEERS_KEY, JSON.stringify(p)); };
  const cmd = `SYNC_PEERS=${peers.join(",")}`;
  return (
    <div className="space-y-3 text-sm">
      <ul className="space-y-1">
        {peers.map((p, i) => (
          <li key={p} className="flex items-center gap-2">
            <code dir="ltr" className="flex-1 rounded bg-muted px-2 py-1 text-xs">{p}</code>
            <Button size="sm" variant="ghost" onClick={() => save(peers.filter((_, j) => j !== i))}>إخفاء</Button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <input dir="ltr" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="http://192.168.x.x:8788"
          className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs" />
        <Button size="sm" onClick={() => { const v = draft.trim().replace(/\/$/, ""); if (/^https?:\/\//.test(v) && !peers.includes(v)) save([...peers, v]); setDraft(""); }}>إضافة</Button>
      </div>
      <p className="text-xs text-muted-foreground">الأمر المحفوظ (يُرسل تلقائيًا مع «مزامنة الكل»، ويمكن وضعه في ملف بيئة الجسر):</p>
      <div className="flex gap-2">
        <code dir="ltr" className="flex-1 break-all rounded bg-muted px-2 py-1 text-[11px]">{cmd}</code>
        <Button size="sm" variant="outline" onClick={() => void navigator.clipboard.writeText(cmd)}>نسخ</Button>
      </div>
    </div>
  );
}
