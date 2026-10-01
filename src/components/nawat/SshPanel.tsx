import { useCallback, useEffect, useRef, useState } from "react";
import { Plug, RefreshCw, RotateCcw, Send } from "lucide-react";
import {
  bridgePing,
  setSshBridgeUrl,
  sshAudit,
  sshBridgeUrl,
  sshExec,
  sshHosts,
  sshRevive,
  type SshHost,
} from "@/lib/nawat/bridge";

type Line = { kind: "cmd" | "out" | "err"; text: string };

export function SshPanel() {
  const [bridgeUrl, setBridgeUrl] = useState("http://127.0.0.1:8787");
  const [alive, setAlive] = useState<boolean | null>(null);
  const [hosts, setHosts] = useState<SshHost[]>([]);
  const [host, setHost] = useState("");
  const [cmd, setCmd] = useState("");
  const [service, setService] = useState("");
  const [busy, setBusy] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [audit, setAudit] = useState<unknown[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  const log = (kind: Line["kind"], text: string) => setLines((l) => [...l, { kind, text }]);

  const load = useCallback(async () => {
    try {
      await bridgePing();
      setAlive(true);
    } catch (e) {
      setAlive(false);
      log("err", (e as Error).message);
      return;
    }
    try {
      const h = await sshHosts();
      setHosts(h);
      setHost((cur) => cur || h[0]?.host || "");
    } catch (e) {
      log("err", (e as Error).message);
    }
    try {
      setAudit(await sshAudit(30));
    } catch (e) {
      log("err", (e as Error).message);
    }
  }, []);

  useEffect(() => {
    setBridgeUrl(sshBridgeUrl());
    void load();
  }, [load]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [lines]);

  const run = async () => {
    if (!host || !cmd.trim()) return;
    const c = cmd;
    setCmd("");
    log("cmd", c);
    setBusy(true);
    try {
      log("out", (await sshExec(host, c)) || "(لا مخرجات)");
    } catch (e) {
      log("err", (e as Error).message);
    }
    setBusy(false);
    setAudit(await sshAudit(30).catch(() => audit));
  };

  const revive = async () => {
    if (!host || !service.trim()) return;
    setBusy(true);
    log("cmd", `revive ${service}`);
    try {
      log("out", await sshRevive(host, service));
    } catch (e) {
      log("err", (e as Error).message);
    }
    setBusy(false);
    setAudit(await sshAudit(30).catch(() => audit));
  };

  const field = "rounded border border-border bg-background px-2 py-1 text-xs";

  return (
    <section className="glass-panel rounded-xl p-4" dir="rtl">
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <Plug className={`size-4 ${alive ? "text-nawat" : "text-muted-foreground"}`} />
        <h2 className="text-sm font-semibold">SSH عبر الجسر</h2>
        <span className={`size-2 rounded-full ${alive == null ? "bg-muted-foreground" : alive ? "bg-nawat" : "bg-destructive"}`} />
        <input
          className={`${field} w-56`}
          dir="ltr"
          value={bridgeUrl}
          onChange={(e) => setBridgeUrl(e.target.value)}
          onBlur={() => {
            setSshBridgeUrl(bridgeUrl);
            void load();
          }}
        />
        <button onClick={() => void load()} className="rounded border border-border p-1" aria-label="تحديث">
          <RefreshCw className="size-3.5" />
        </button>
      </header>

      <div className="mb-3 flex flex-wrap gap-2" dir="ltr">
        {hosts.length === 0 && <span className="text-xs text-muted-foreground">لا مضيفين (GET /api/ssh/hosts)</span>}
        {hosts.map((h) => (
          <button
            key={h.host}
            onClick={() => setHost(h.host)}
            className={`flex items-center gap-1.5 rounded border px-2 py-1 text-xs ${host === h.host ? "border-primary text-primary" : "border-border"}`}
          >
            <span className={`size-2 rounded-full ${h.online ? "bg-nawat" : "bg-destructive"}`} />
            {h.user ? `${h.user}@` : ""}
            {h.host}
            {h.port ? `:${h.port}` : ""}
          </button>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_280px]">
        <div className="flex h-72 flex-col rounded border border-border bg-background" dir="ltr">
          <div className="min-h-0 flex-1 overflow-auto p-2 font-mono text-xs">
            {lines.map((l, i) => (
              <pre key={i} className={`whitespace-pre-wrap ${l.kind === "cmd" ? "text-nawat" : l.kind === "err" ? "text-destructive" : ""}`}>
                {l.kind === "cmd" ? `${host}$ ${l.text}` : l.text}
              </pre>
            ))}
            <div ref={endRef} />
          </div>
          <form onSubmit={(e) => { e.preventDefault(); void run(); }} className="flex gap-2 border-t border-border p-2">
            <input value={cmd} onChange={(e) => setCmd(e.target.value)} disabled={!host || busy} spellCheck={false}
              className="flex-1 bg-transparent font-mono text-xs outline-none" placeholder={host ? "command (whitelist)…" : "اختر مضيفًا"} />
            <button disabled={!host || busy} aria-label="تنفيذ"><Send className="size-3.5" /></button>
          </form>
        </div>

        <div className="flex h-72 flex-col gap-2">
          <form onSubmit={(e) => { e.preventDefault(); void revive(); }} className="flex gap-2" dir="ltr">
            <input className={`${field} flex-1`} value={service} onChange={(e) => setService(e.target.value)} placeholder="service" disabled={!host || busy} />
            <button disabled={!host || busy || !service} className="flex items-center gap-1 rounded bg-primary px-2 py-1 text-xs text-primary-foreground disabled:opacity-50">
              <RotateCcw className="size-3" /> إحياء
            </button>
          </form>
          <div className="min-h-0 flex-1 overflow-auto rounded border border-border bg-background p-2 font-mono text-[11px]" dir="ltr">
            <div className="mb-1 text-muted-foreground">audit (n=30)</div>
            {audit.map((a, i) => (
              <pre key={i} className="whitespace-pre-wrap border-b border-border/50 py-0.5">
                {typeof a === "string" ? a : JSON.stringify(a)}
              </pre>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
