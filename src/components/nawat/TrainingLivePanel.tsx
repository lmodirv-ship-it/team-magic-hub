import { useEffect, useRef, useState } from "react";

type Task = { task_id: string; version?: string; teacher?: string; type?: string; status: string; created?: string };
type Snap = { online: boolean; worker?: { running?: boolean; current?: string | null }; queue: Task[]; lines: string[]; at: number };

const URL_KEY = "nawat.factory.url";
const DEFAULT_URL = "http://192.168.100.67:8789";

/** Rate from the log itself: count "N/M" or "N examples" progress between two polls. Never invented. */
function progressCount(lines: string[]): number | null {
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = lines[i]!.match(/(\d+)\s*\/\s*\d+/) ?? lines[i]!.match(/(\d+)\s+(?:exemples|examples|أمثلة)/i);
    if (m) return Number(m[1]);
  }
  return null;
}

/** Live training board fed by the LAN factory server (queue + log); empty values stay "—". */
export function TrainingLivePanel() {
  const [snap, setSnap] = useState<Snap | null>(null);
  const [rate, setRate] = useState<number | null>(null);
  const prev = useRef<{ n: number; at: number } | null>(null);

  useEffect(() => {
    const base = (localStorage.getItem(URL_KEY) || DEFAULT_URL).replace(/\/$/, "");
    let busy = false;
    const tick = async () => {
      if (busy) return;
      busy = true;
      try {
        const [st, q, lg] = await Promise.all(
          ["/api/status", "/api/queue", "/api/logs"].map((p) => fetch(base + p, { signal: AbortSignal.timeout(4000) }).then((r) => r.json())),
        );
        const queue: Task[] = Array.isArray(q) ? q : (q?.tasks ?? q?.queue ?? []);
        const lines: string[] = (lg?.lines ?? []).slice(-12);
        const now = Date.now();
        const n = progressCount(lg?.lines ?? []);
        if (n !== null && prev.current && n > prev.current.n) setRate((n - prev.current.n) / ((now - prev.current.at) / 1000));
        if (n !== null) prev.current = { n, at: now };
        setSnap({ online: true, worker: st?.worker, queue, lines, at: now });
      } catch {
        setSnap((s) => ({ online: false, queue: s?.queue ?? [], lines: s?.lines ?? [], at: Date.now() }));
      } finally { busy = false; }
    };
    void tick();
    const t = setInterval(tick, 5000);
    return () => clearInterval(t);
  }, []);

  const active = snap?.queue.filter((t) => t.status !== "done" && t.status !== "completed") ?? [];
  return (
    <section className="mt-6 rounded-lg border border-border bg-card p-4">
      <header className="mb-2 flex items-center gap-2">
        <h2 className="text-sm font-semibold">Entraînement en direct</h2>
        <span className={`size-2 rounded-full ${snap?.online ? "bg-success" : "bg-muted-foreground"}`} />
        <span className="text-[11px] text-muted-foreground">{snap?.online ? (snap.worker?.running ? "Worker actif" : "Usine en ligne") : "Usine hors ligne (port 8789)"}</span>
        <div className="flex-1" />
        <span className="text-[11px] text-muted-foreground">Entrée : {rate !== null ? `${rate.toFixed(2)} ex/s` : "—"} · Sortie : —</span>
      </header>
      <div className="overflow-auto">
        <table className="w-full text-xs">
          <thead className="text-muted-foreground"><tr><th className="p-1 text-start">#</th><th className="p-1 text-start">Modèle</th><th className="p-1 text-start">Enseignant</th><th className="p-1 text-start">Étape</th><th className="p-1 text-start">Statut</th></tr></thead>
          <tbody>
            {active.map((t, i) => (
              <tr key={t.task_id} className="border-t border-border">
                <td className="p-1">{i + 1}</td><td className="p-1 font-mono">{t.version ?? "—"}</td><td className="p-1 font-mono">{t.teacher ?? "—"}</td><td className="p-1">{t.type ?? "—"}</td><td className="p-1">{t.status}</td>
              </tr>
            ))}
            {active.length === 0 && <tr><td colSpan={5} className="p-1 text-muted-foreground">Aucun entraînement en cours.</td></tr>}
          </tbody>
        </table>
      </div>
      {!!snap?.lines.length && <pre className="mt-2 max-h-40 overflow-auto rounded bg-muted/40 p-2 font-mono text-[10px] whitespace-pre-wrap">{snap.lines.join("\n")}</pre>}
    </section>
  );
}
