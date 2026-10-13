/**
 * NAWAT local bridge.
 *
 * All capabilities the browser cannot do natively (real filesystem, PowerShell,
 * SSH, spawning Ollama) are routed through `window.nawat`, injected by the
 * Electron preload script. When running in a plain browser we fall back to a
 * virtual workspace + direct Ollama HTTP calls on the local machine.
 */

export type NawatFileEntry = { path: string; type: "file" | "dir" };

export type OllamaModel = {
  name: string;
  model?: string;
  size: number;
  digest: string;
  modified_at: string;
  description?: string;
  details?: { parameter_size?: string; quantization_level?: string; family?: string };
  providerId?: string;
  official?: boolean;
};

export type RunningModel = {
  name: string;
  size_vram?: number;
  size?: number;
  expires_at?: string;
};

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

declare global {
  interface Window {
    nawat?: {
      platform: string;
      fs: {
        readDir(path: string): Promise<NawatFileEntry[]>;
        readFile(path: string): Promise<string>;
        writeFile(path: string, content: string): Promise<void>;
        mkdir(path: string): Promise<void>;
        rename(from: string, to: string): Promise<void>;
        remove(path: string): Promise<void>;
      };
      shell: {
        exec(cmd: string, opts?: { cwd?: string; shell?: "powershell" | "bash" }): Promise<string>;
      };
      ssh?: {
        connect(cfg: SshConfig): Promise<string>;
        exec(id: string, cmd: string): Promise<string>;
        list(id: string, dir: string): Promise<SshFile[]>;
        disconnect(id: string): Promise<void>;
      };
      ollama: { host(): Promise<string> };
    };
  }
}

export const isDesktop = () => typeof window !== "undefined" && !!window.nawat;

const DEFAULT_HOST = "http://127.0.0.1:11434";

/** Normalize a user-entered host: add scheme, strip slashes/spaces. */
export function normalizeHost(raw: string): string {
  let h = raw.trim();
  if (!h) return DEFAULT_HOST;
  if (!/^https?:\/\//i.test(h)) h = `http://${h}`;
  return h.replace(/\/+$/, "");
}

export function ollamaHost(): string {
  if (typeof window === "undefined") return DEFAULT_HOST;
  const stored = localStorage.getItem("nawat.ollamaHost");
  return stored ? normalizeHost(stored) : DEFAULT_HOST;
}

export function setOllamaHost(host: string) {
  localStorage.setItem("nawat.ollamaHost", normalizeHost(host));
}

export function modelPrefix(): string {
  if (typeof window === "undefined") return "nawat";
  return localStorage.getItem("nawat.modelPrefix") ?? "nawat";
}

export function setModelPrefix(p: string) {
  localStorage.setItem("nawat.modelPrefix", p);
}

/** Shorten an Ollama error body: strip HTML and cap the length. */
function shortBody(text: string): string {
  const stripped = text
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return stripped.length > 140 ? `${stripped.slice(0, 140)}…` : stripped;
}

async function j<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(ollamaHost() + path, init);
  } catch {
    throw new Error(
      `لا يمكن الوصول إلى Ollama على ${ollamaHost()} — تأكد أنه يعمل محليًا (ollama serve).`,
    );
  }
  if (!res.ok) throw new Error(`Ollama ${res.status}: ${shortBody(await res.text())}`);
  return (await res.json()) as T;
}

async function tagsOrEmbedded(): Promise<{ models: OllamaModel[] }> {
  const { EMBEDDED_MODELS } = await import("./embedded-models");
  const embedded = EMBEDDED_MODELS.map((m) => ({ name: m.name, official: true } as OllamaModel));
  let live: OllamaModel[] = [];
  try {
    live = (await j<{ models: OllamaModel[] }>("/api/tags")).models ?? [];
  } catch {
    // Try the user's own LAN engines directly — no bridge needed.
    for (const h of ["http://192.168.100.67:11434", "http://192.168.2.4:11434"]) {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 2500);
        const r = await fetch(h + "/api/tags", { signal: ctrl.signal });
        clearTimeout(t);
        if (r.ok) { live = ((await r.json()) as { models?: OllamaModel[] }).models ?? []; break; }
      } catch { /* next host */ }
    }
  }
  // NAWAT models are always built in; live models are added on top.
  const names = new Set(live.map((m) => m.name));
  return { models: [...live, ...embedded.filter((m) => !names.has(m.name))] };
}

export async function listModels(): Promise<OllamaModel[]> {
  const data = await tagsOrEmbedded();
  const prefix = modelPrefix().toLowerCase();
  const all = data.models ?? [];
  return prefix ? all.filter((m) => m.name.toLowerCase().startsWith(prefix)) : all;
}

export async function listAllModels(): Promise<OllamaModel[]> {
  const data = await tagsOrEmbedded();
  return data.models ?? [];
}

export async function listRunning(): Promise<RunningModel[]> {
  const data = await j<{ models: RunningModel[] }>("/api/ps");
  return data.models ?? [];
}

/** Load a model into memory (start). */
export async function startModel(name: string) {
  await fetch(ollamaHost() + "/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: name, prompt: "", keep_alive: "30m" }),
  });
}

/** Unload a model from memory (stop). */
export async function stopModel(name: string) {
  await fetch(ollamaHost() + "/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: name, prompt: "", keep_alive: 0 }),
  });
}

export async function restartModel(name: string) {
  await stopModel(name);
  await startModel(name);
}

export async function showModel(name: string): Promise<Record<string, unknown>> {
  return j("/api/show", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: name }),
  });
}

export class EngineUnreachable extends Error {
  constructor(public host: string) {
    super(`لا يمكن الوصول إلى Ollama على ${host} — تأكد أنه يعمل (ollama serve).`);
  }
}

/** Streaming chat against a local model. */
export async function* chatStream(
  model: string,
  messages: ChatMessage[],
  signal?: AbortSignal,
  host: string = ollamaHost(),
): AsyncGenerator<string> {
  const { assertAi } = await import("./ai-control");
  assertAi();
  // Groupe-HN bridge first (user choice); local Ollama stays available as option/fallback.
  const engine = typeof window !== "undefined" ? localStorage.getItem("nawat.chatEngine") ?? "ghn" : "ghn";
  let ghnError = "";
  if (engine === "ghn" && host === ollamaHost()) {
    let produced = false;
    try {
      const { ghnChatStream } = await import("./groupe-hn-platform");
      for await (const piece of ghnChatStream(model, messages, signal)) { produced = true; yield piece; }
      return;
    } catch (e) {
      if (signal?.aborted || produced) throw e;
      ghnError = e instanceof Error ? e.message : String(e);
      // Groupe-HN unreachable: continue with local Ollama below.
    }
  }
  const { record } = await import("./metrics");
  const t0 = performance.now();
  let res: Response;
  // Fast mode: no thinking, keep the model loaded in memory.
  const send = (fast: boolean) =>
    fetch(host + "/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fast ? { model, messages, stream: true, think: false, keep_alive: "30m" } : { model, messages, stream: true }),
      ...(signal ? { signal } : {}),
    });
  try {
    res = await send(true);
    if (res.status === 400) res = await send(false); // older Ollama / model without think support
  } catch (e) {
    if (signal?.aborted) throw e;
    if (ghnError) throw new Error(`Groupe-HN: ${ghnError}. Local Ollama is not reachable either.`);
    throw new EngineUnreachable(host);
  }
  if (!res.ok || !res.body) {
    const body = shortBody(await res.text());
    if (ghnError) {
      const local = /llama-server/i.test(body) ? "local Ollama is installed incompletely (llama-server missing) — reinstall Ollama or choose a Groupe-HN model" : `local Ollama ${res.status}`;
      throw new Error(`Groupe-HN: ${ghnError}. Fallback failed: ${local}.`);
    }
    throw new Error(`Ollama ${res.status}: ${body}`);
  }
  record("رد النموذج (أول استجابة)", performance.now() - t0);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let out = "";
  let promptTokens = 0;
  let outputTokens = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const obj = JSON.parse(line) as {
            message?: { content?: string };
            prompt_eval_count?: number;
            eval_count?: number;
          };
          if (obj.prompt_eval_count) promptTokens = obj.prompt_eval_count;
          if (obj.eval_count) outputTokens = obj.eval_count;
          if (obj.message?.content) {
            out += obj.message.content;
            yield obj.message.content;
          }
        } catch {
          /* partial line */
        }
      }
    }
  } finally {
    const { recordUsage, estimateTokens } = await import("./api-keys");
    recordUsage({
      model,
      promptTokens: promptTokens || estimateTokens(messages.map((m) => m.content).join("\n")),
      outputTokens: outputTokens || estimateTokens(out),
      ms: performance.now() - t0,
    });
  }
}

export function formatBytes(n?: number): string {
  if (!n) return "—";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(1)} ${u[i]}`;
}

/** Run a shell command — real PowerShell/bash on desktop, simulated in browser. */
export async function execCommand(
  cmd: string,
  ctx: { cwd: string; shell: "powershell" | "bash"; vfs: Record<string, string> },
): Promise<string> {
  if (isDesktop()) {
    const { isPermitted } = await import("./engines");
    if (ctx.shell === "powershell" && !isPermitted("powershell", true))
      return "⛔ تنفيذ PowerShell معطّل في الإعدادات → الأمان والصلاحيات.";
    return window.nawat!.shell.exec(cmd, { cwd: ctx.cwd, shell: ctx.shell });
  }
  const [bin, ...args] = cmd.trim().split(/\s+/);
  const paths = Object.keys(ctx.vfs).sort();
  switch (bin) {
    case "":
      return "";
    case "help":
      return "Built-in (browser) commands: ls, cat <file>, pwd, echo, clear, models, ps, date, help\nReal PowerShell/bash runs in the Electron desktop build.";
    case "ls":
    case "dir":
      return paths.join("\n") || "(empty workspace)";
    case "pwd":
      return ctx.cwd;
    case "date":
      return new Date().toString();
    case "cat": {
      const f = args[0];
      return f && ctx.vfs[f] !== undefined ? ctx.vfs[f] : `cat: ${f}: no such file`;
    }
    case "echo":
      return args.join(" ");
    case "models":
      try {
        return (await listModels()).map((m) => `${m.name}\t${formatBytes(m.size)}`).join("\n");
      } catch (e) {
        return `Ollama unreachable at ${ollamaHost()} — ${(e as Error).message}`;
      }
    case "ps":
      try {
        return (
          (await listRunning())
            .map((m) => `${m.name}\tVRAM ${formatBytes(m.size_vram)}`)
            .join("\n") || "no models loaded"
        );
      } catch (e) {
        return `Ollama unreachable — ${(e as Error).message}`;
      }
    default:
      return `'${bin}' is not available in the browser sandbox. Run the Electron desktop build for real shell access.`;
  }
}

// ---------------- SSH (via NAWAT bridge :8787) ----------------
// Only these endpoints exist on the bridge:
//   GET  /api/ping · GET /api/ssh/hosts · POST /api/ssh/exec {host,cmd}
//   POST /api/ssh/revive {host,service} · GET /api/ssh/audit?n=30
export type SshConfig = {
  host: string;
  port?: number;
  username: string;
  password?: string;
  keyPath?: string;
  passphrase?: string;
};
export type SshFile = { name: string; size: number; dir: boolean };
export type SshHost = { host: string; user?: string; port?: number; online?: boolean };

export function sshBridgeUrl(): string {
  if (typeof window === "undefined") return "http://127.0.0.1:8787";
  return normalizeHost(localStorage.getItem("nawat.sshBridge") ?? "http://127.0.0.1:8787");
}
export function setSshBridgeUrl(u: string) {
  localStorage.setItem("nawat.sshBridge", normalizeHost(u));
}

async function bridge<T>(path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(sshBridgeUrl() + path, {
      method: body === undefined ? "GET" : "POST",
      ...(body === undefined
        ? {}
        : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    });
  } catch {
    throw new Error(`لا يمكن الوصول إلى الجسر على ${sshBridgeUrl()} — شغّل start-all.`);
  }
  const text = await res.text();
  if (!res.ok) throw new Error(`Bridge ${res.status}: ${shortBody(text)}`);
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as T;
  }
}

/** Turn any bridge reply into readable text. */
function asText(r: unknown): string {
  if (typeof r === "string") return r;
  if (r && typeof r === "object") {
    const o = r as Record<string, unknown>;
    const parts = [o["output"], o["stdout"], o["stderr"], o["result"], o["message"], o["error"]].filter(
      (x) => typeof x === "string" && x,
    );
    if (parts.length) return parts.join("\n");
  }
  return JSON.stringify(r, null, 2);
}

export const bridgePing = () => bridge<unknown>("/api/ping");

export async function sshHosts(): Promise<SshHost[]> {
  const r = await bridge<unknown>("/api/ssh/hosts");
  const list = Array.isArray(r) ? r : ((r as { hosts?: unknown[] })?.hosts ?? []);
  return list as SshHost[];
}
export async function sshExec(host: string, cmd: string): Promise<string> {
  return asText(await bridge("/api/ssh/exec", { host, cmd }));
}
export async function sshRevive(host: string, service: string): Promise<string> {
  return asText(await bridge("/api/ssh/revive", { host, service }));
}
export async function sshAudit(n = 30): Promise<unknown[]> {
  const r = await bridge<unknown>(`/api/ssh/audit?n=${n}`);
  if (Array.isArray(r)) return r;
  const o = r as Record<string, unknown>;
  const arr = o?.["entries"] ?? o?.["audit"] ?? o?.["items"];
  return Array.isArray(arr) ? arr : [r];
}
