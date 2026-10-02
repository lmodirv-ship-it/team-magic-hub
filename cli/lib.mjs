// عميل مشترك لـ CLI وMCP — بلا مكتبات خارجية (Node 18+)
export const cfg = {
  bridge: process.env.NAWAT_BRIDGE ?? "http://192.168.100.67:8788",
  factory: process.env.NAWAT_FACTORY ?? "http://192.168.100.67:8789",
  ollama: process.env.NAWAT_OLLAMA ?? "http://192.168.100.67:11434",
  token: process.env.NAWAT_TOKEN ?? "",
};

export async function call(base, path, { method = "GET", body, timeout = 15000 } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (cfg.token && base === cfg.bridge) headers.Authorization = `Bearer ${cfg.token}`;
  const r = await fetch(base.replace(/\/$/, "") + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeout),
  });
  const text = await r.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!r.ok) throw new Error(`${r.status} ${typeof data === "string" ? data : JSON.stringify(data)}`);
  return data;
}

const safe = async (fn) => { try { return { ok: true, data: await fn() }; } catch (e) { return { ok: false, error: String(e.message ?? e) }; } };

export const api = {
  status: async () => ({
    bridge: await safe(() => call(cfg.bridge, "/api/health")),
    factory: await safe(() => call(cfg.factory, "/api/status")),
    ollama: await safe(() => call(cfg.ollama, "/api/version")),
  }),
  system: () => call(cfg.bridge, "/api/system"),
  models: async () => {
    const d = await call(cfg.ollama, "/api/tags");
    return (d.models ?? []).map((m) => ({ name: m.name, gb: +(m.size / 1e9).toFixed(2) }));
  },
  chat: async (model, prompt) => {
    const t0 = Date.now();
    const d = await call(cfg.ollama, "/api/generate", {
      method: "POST",
      body: { model, prompt, stream: false, think: false, options: { num_predict: 1024 } },
      timeout: 180000,
    });
    return { model, ms: Date.now() - t0, answer: d.response ?? "" };
  },
  queue: () => call(cfg.factory, "/api/queue"),
  stats: () => call(cfg.factory, "/api/stats"),
  logs: () => call(cfg.factory, "/api/logs"),
  queueAdd: (task) => call(cfg.factory, "/api/queue/add", { method: "POST", body: task }),
  workerStart: () => call(cfg.factory, "/api/worker/start", { method: "POST", body: {} }),
  workerStop: () => call(cfg.factory, "/api/worker/stop", { method: "POST", body: {} }),
};
