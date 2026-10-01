import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, Trash2 } from "lucide-react";
import type { Terminal } from "@xterm/xterm";
import type { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { bridgePing, sshBridgeUrl, sshExec, sshHosts, type SshHost } from "@/lib/nawat/bridge";
import { Button } from "@/components/ui/button";

const TARGET_KEY = "nawat.terminal.target";
const DANGEROUS = /(^|[;&|\s])(?:rm\s+-[^\n]*r|rmdir\b|del\s+\/|format\b|Remove-Item\b|mkfs\b|dd\s+if=)/i;

/** The bridge exposes one-shot SSH exec, not a PTY stream. Never simulate a local shell. */
export function TerminalPanel() {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const targetRef = useRef("");
  const readyRef = useRef(false);
  const busyRef = useRef(false);
  const lineRef = useRef("");
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(0);
  const [target, setTarget] = useState("");
  const [hosts, setHosts] = useState<SshHost[]>([]);
  const [bridgeOk, setBridgeOk] = useState<boolean | null>(null);

  const prompt = useCallback(() => {
    const term = terminalRef.current;
    if (!term) return;
    term.write(`\r\n\x1b[32m${targetRef.current || "bridge"}>\x1b[0m `);
  }, []);

  const probe = useCallback(async () => {
    try {
      await bridgePing();
      const available = await sshHosts();
      setHosts(available);
      setBridgeOk(true);
      const stored = window.localStorage.getItem(TARGET_KEY);
      const next = available.some((host) => host.host === targetRef.current)
        ? targetRef.current
        : available.some((host) => host.host === stored)
          ? stored ?? ""
          : available[0]?.host ?? "";
      if (targetRef.current !== next) {
        targetRef.current = next;
        setTarget(next);
        if (next) terminalRef.current?.writeln(`\r\nاتصلت بالجسر ${sshBridgeUrl()} — الهدف ${next}`);
        prompt();
      }
      readyRef.current = !!next && available.some((host) => host.host === next && host.online !== false);
      if (!available.length) terminalRef.current?.writeln("\r\nلا يوجد مضيف SSH في الجسر. أضف مضيفًا ثم أعد الاتصال.");
    } catch {
      readyRef.current = false;
      setBridgeOk(false);
      setHosts([]);
      terminalRef.current?.writeln(`\r\nتعذر الوصول إلى الجسر ${sshBridgeUrl()}. شغّل الجسر على 8787 ثم أعد الاتصال.`);
    }
  }, [prompt]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;
    let observer: ResizeObserver | undefined;
    let terminal: Terminal | undefined;

    void Promise.all([import("@xterm/xterm"), import("@xterm/addon-fit")]).then(([{ Terminal }, { FitAddon }]) => {
      if (disposed) return;
      const styles = getComputedStyle(container);
      terminal = new Terminal({
        cursorBlink: true,
        convertEol: true,
        scrollback: 3000,
        fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
        fontSize: 12,
        theme: { background: styles.backgroundColor, foreground: styles.color },
      });
      const fit = new FitAddon();
      terminal.loadAddon(fit);
      terminal.open(container);
      terminalRef.current = terminal;
      fitRef.current = fit;
      requestAnimationFrame(() => { if (!disposed) fit.fit(); });
      observer = new ResizeObserver(() => fit.fit());
      observer.observe(container);
      terminal.writeln("NAWAT · SSH عبر الجسر :8787");
      terminal.writeln("الأوامر تُنفّذ على المضيف المختار؛ لا توجد جلسة PTY مستمرة.");
      terminal.write("\x1b[32mbridge>\x1b[0m ");

      const replaceLine = (next: string) => {
        terminal?.write("\x1b[2K\r\x1b[32m" + (targetRef.current || "bridge") + ">\x1b[0m " + next);
        lineRef.current = next;
      };

      terminal.onData((data) => {
        if (!terminal || busyRef.current) return;
        if (data === "\r") {
          const cmd = lineRef.current.trim();
          terminal.write("\r\n");
          lineRef.current = "";
          if (!cmd) { prompt(); return; }
          if (cmd === "clear") { terminal.clear(); prompt(); return; }
          if (!readyRef.current || !targetRef.current) {
            terminal.writeln("لا يوجد مضيف SSH متصل. تحقق من الجسر والمضيف المختار.");
            prompt();
            return;
          }
          if (DANGEROUS.test(cmd) && !window.confirm(`قد يغيّر هذا الأمر الملفات أو يحذفها. هل تريد المتابعة؟\n${cmd}`)) {
            terminal.writeln("أُلغي الأمر."); prompt(); return;
          }
          historyRef.current.push(cmd);
          historyIndexRef.current = historyRef.current.length;
          busyRef.current = true;
          const host = targetRef.current;
          void sshExec(host, cmd).then(
            (output) => terminal?.writeln(output.replace(/\r?\n/g, "\r\n") || "(لا يوجد خرج)"),
            (error: unknown) => terminal?.writeln(`خطأ: ${error instanceof Error ? error.message : String(error)}`),
          ).finally(() => { busyRef.current = false; prompt(); });
        } else if (data === "\u007f") {
          if (lineRef.current) { lineRef.current = lineRef.current.slice(0, -1); terminal.write("\b \b"); }
        } else if (data === "\u001b[A") {
          historyIndexRef.current = Math.max(0, historyIndexRef.current - 1);
          replaceLine(historyRef.current[historyIndexRef.current] ?? "");
        } else if (data === "\u001b[B") {
          historyIndexRef.current = Math.min(historyRef.current.length, historyIndexRef.current + 1);
          replaceLine(historyRef.current[historyIndexRef.current] ?? "");
        } else if (data === "\u0003") {
          replaceLine("");
          terminal.write("^C"); prompt();
        } else if (data === "\u0015") {
          replaceLine("");
        } else if (!data.startsWith("\u001b")) {
          const clean = data.replace(/[\x00-\x1f\x7f]/g, "");
          if (clean) { lineRef.current += clean; terminal.write(clean); }
        }
      });
      void probe();
    });
    return () => {
      disposed = true;
      observer?.disconnect();
      terminal?.dispose();
      terminalRef.current = null;
      fitRef.current = null;
    };
  }, [probe, prompt]);

  useEffect(() => {
    const timer = window.setInterval(() => { void probe(); }, 15000);
    return () => window.clearInterval(timer);
  }, [probe]);

  const selectHost = (host: string) => {
    targetRef.current = host;
    setTarget(host);
    readyRef.current = bridgeOk === true && hosts.some((item) => item.host === host && item.online !== false);
    window.localStorage.setItem(TARGET_KEY, host);
    terminalRef.current?.writeln(`\r\nالهدف: ${host}`);
    prompt();
    terminalRef.current?.focus();
  };

  return (
    <div data-nawat-terminal className="flex h-full min-h-0 flex-col bg-panel" dir="ltr">
      <header className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-1.5" dir="rtl">
        <span className="text-xs font-semibold text-foreground">الطرفية · SSH</span>
        <select value={target} onChange={(event) => selectHost(event.target.value)} aria-label="مضيف الطرفية"
          className="min-w-0 max-w-48 rounded border border-border bg-background px-1.5 py-0.5 text-xs">
          {!target && <option value="">اختر مضيفًا</option>}
          {hosts.map((host) => <option key={host.host} value={host.host}>{host.user ? `${host.user}@` : ""}{host.host}:{host.port ?? 22}{host.online === false ? " · غير متصل" : ""}</option>)}
        </select>
        <span className="flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground" title={sshBridgeUrl()}>
          <span className={`size-2 shrink-0 rounded-full ${bridgeOk === null ? "bg-muted-foreground" : bridgeOk ? "bg-success" : "bg-destructive"}`} />
          {bridgeOk === null ? "جار الاتصال" : bridgeOk ? "الجسر متصل" : "الجسر غير متصل"}
        </span>
        <div className="flex-1" />
        <Button variant="ghost" size="icon-sm" title="إعادة الاتصال" aria-label="إعادة الاتصال بالجسر" onClick={() => { void probe(); }}><RefreshCw className="size-3.5" /></Button>
        <Button variant="ghost" size="icon-sm" title="مسح الشاشة" aria-label="مسح الطرفية" onClick={() => { terminalRef.current?.clear(); terminalRef.current?.focus(); }}><Trash2 className="size-3.5" /></Button>
      </header>
      <div ref={containerRef} className="min-h-0 flex-1 overflow-hidden bg-background p-2 text-foreground" aria-label="طرفية SSH" />
    </div>
  );
}