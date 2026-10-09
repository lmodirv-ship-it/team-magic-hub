// عميل مشترك لـ CLI وMCP — بلا مكتبات خارجية (Node 18+) — Groupe-HN v1.1.0
import { spawn } from "node:child_process";
import { existsSync, readFileSync, statSync, readdirSync } from "node:fs";
import os from "node:os";

export const VERSION = "1.1.0";

export const cfg = {
  bridge: process.env.NAWAT_BRIDGE ?? "http://192.168.100.67:8788",
  factory: process.env.NAWAT_FACTORY ?? "http://192.168.100.67:8789",
  ollama: process.env.NAWAT_OLLAMA ?? "http://192.168.100.67:11434",
  token: process.env.NAWAT_TOKEN ?? "",
  comfy: process.env.NAWAT_COMFY ?? "http://192.168.2.4:8188",
  mode: process.env.NAWAT_MODE ?? "auto", // lan | public | auto
  public: process.env.NAWAT_PUBLIC ?? "https://bridge.nawat.pro",
  relayToken: process.env.NAWAT_RELAY_TOKEN ?? "",
  nodes: (process.env.GHN_NODES ?? "192.168.100.66,192.168.100.67").split(",").map((s) => s.trim()).filter(Boolean),
  modelDir: process.env.GHN_MODEL_DIR ?? "/data/model",
  sshUser: process.env.GHN_SSH_USER ?? "root",
  studioPort: Number(process.env.GHN_STUDIO_PORT ?? 8091),
  bridgePort: Number(process.env.GHN_BRIDGE_PORT ?? 8795),
  registryFile: process.env.GHN_REGISTRY_FILE ?? "",
  supabaseUrl: process.env.SUPABASE_URL ?? "",
};

export const masked = () => ({ ...cfg, token: cfg.token ? "***" : "", relayToken: cfg.relayToken ? "***" : "" });

export async function call(base, path, { method = "GET", body, timeout = 15000, raw = false } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (cfg.token && base === cfg.bridge) headers.Authorization = `Bearer ${cfg.token}`;
  if (cfg.relayToken && base === cfg.public) headers.Authorization = `Bearer ${cfg.relayToken}`;
  const r = await fetch(base.replace(/\/$/, "") + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeout),
  });
  if (raw) { if (!r.ok) throw new Error(`${r.status}`); return Buffer.from(await r.arrayBuffer()); }
  const text = await r.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!r.ok) throw new Error(`${r.status} ${typeof data === "string" ? data : JSON.stringify(data)}`);
  return data;
}

// الجسر: محلي أولًا ثم العام (Relay) حسب NAWAT_MODE
export async function bridgeCall(path, opts = {}) {
  if (cfg.mode === "public") return call(cfg.public, path, opts);
  try { return await call(cfg.bridge, path, opts); }
  catch (e) { if (cfg.mode === "auto") return call(cfg.public, path, opts); throw e; }
}

export const safe = async (fn) => { try { return { ok: true, data: await fn() }; } catch (e) { return { ok: false, error: String(e.message ?? e) }; } };

export function family(name) {
  const n = name.toLowerCase();
  for (const f of ["think", "coder", "code", "shell", "agent", "builder", "tools", "vision", "seer", "image", "embed", "whisper", "darija", "phone", "fast", "mini", "sql", "chat", "mm", "vps"])
    if (n.includes(f)) return f;
  return n.startsWith("nawat") ? "nawat" : "other";
}

export function run(bin, argv, { timeout = 600000 } = {}) {
  return new Promise((resolve) => {
    const p = spawn(bin, argv, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    const t = setTimeout(() => p.kill("SIGTERM"), timeout);
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("error", (e) => { clearTimeout(t); resolve({ code: 127, out, err: String(e.message) }); });
    p.on("close", (code) => { clearTimeout(t); resolve({ code, out, err }); });
  });
}

const genOpts = (o = {}) => ({ num_predict: o.maxTokens ?? 1024, ...(o.temperature != null ? { temperature: Number(o.temperature) } : {}) });

export const api = {
  status: async () => {
    const [bridge, factory, ollama] = await Promise.all([
      safe(() => call(cfg.bridge, "/api/health")),
      safe(() => call(cfg.factory, "/api/status")),
      safe(() => call(cfg.ollama, "/api/version")),
    ]);
    return { bridge, factory, ollama };
  },
  health: async () => {
    const [ollama, comfy] = await Promise.all([safe(() => call(cfg.ollama, "/api/version")), safe(() => call(cfg.comfy, "/system_stats", { timeout: 5000 }))]);
    return { ollama, comfy };
  },
  ping: async () => { const t0 = Date.now(); const r = await safe(() => bridgeCall("/api/health", { timeout: 5000 })); return { ...r, ms: Date.now() - t0 }; },
  version: () => bridgeCall("/api/version").catch(() => ({ cli: VERSION })),
  system: () => bridgeCall("/api/system"),
  models: async () => {
    let d;
    try { d = await bridgeCall("/api/tags"); } catch { d = await call(cfg.ollama, "/api/tags"); }
    return (d.models ?? []).map((m) => ({ name: m.name, gb: +((m.size ?? 0) / 1e9).toFixed(2), family: family(m.name) }));
  },
  chat: async (model, prompt, o = {}) => {
    const t0 = Date.now();
    const d = await call(cfg.ollama, "/api/generate", {
      method: "POST",
      body: { model, prompt, stream: false, think: !!o.think, options: genOpts(o) },
      timeout: 180000,
    });
    return { model, ms: Date.now() - t0, answer: d.response ?? "" };
  },
  bridgeChat: async (prompt, o = {}) => {
    const t0 = Date.now();
    const model = o.model ?? "nawat-coder:latest";
    const d = await bridgeCall("/api/chat", {
      method: "POST",
      body: { model, stream: false, think: !!o.think, messages: [{ role: "user", content: prompt }], options: genOpts(o) },
      timeout: 180000,
    });
    return { model, ms: Date.now() - t0, answer: d.message?.content ?? d.response ?? d.answer ?? "" };
  },
  compare: async (m1, m2, prompt = "من أنت ومن طوّرك؟") =>
    Promise.all([m1, m2].map((m) => api.chat(m, prompt).catch((e) => ({ model: m, ms: 0, answer: `⏸ ${e.message}` })))),
  image: async ({ prompt, width = 768, height = 768, steps = 20 }) => {
    const info = await call(cfg.comfy, "/object_info/CheckpointLoaderSimple");
    const ckpt = process.env.NAWAT_COMFY_CKPT ?? info?.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0]?.[0];
    if (!ckpt) throw new Error("لا يوجد نموذج صور (checkpoint) في ComfyUI");
    const wf = {
      4: { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: ckpt } },
      5: { class_type: "EmptyLatentImage", inputs: { width, height, batch_size: 1 } },
      6: { class_type: "CLIPTextEncode", inputs: { text: prompt, clip: ["4", 1] } },
      7: { class_type: "CLIPTextEncode", inputs: { text: "blurry, low quality", clip: ["4", 1] } },
      3: { class_type: "KSampler", inputs: { seed: Math.floor(Math.random() * 1e9), steps, cfg: 7, sampler_name: "euler", scheduler: "normal", denoise: 1, model: ["4", 0], positive: ["6", 0], negative: ["7", 0], latent_image: ["5", 0] } },
      8: { class_type: "VAEDecode", inputs: { samples: ["3", 0], vae: ["4", 2] } },
      9: { class_type: "SaveImage", inputs: { filename_prefix: "nawat", images: ["8", 0] } },
    };
    const { prompt_id } = await call(cfg.comfy, "/prompt", { method: "POST", body: { prompt: wf } });
    for (let i = 0; i < 180; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const h = await call(cfg.comfy, `/history/${prompt_id}`);
      const img = h?.[prompt_id]?.outputs?.["9"]?.images?.[0];
      if (img) {
        const buf = await call(cfg.comfy, `/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder ?? "")}&type=${img.type ?? "output"}`, { raw: true, timeout: 60000 });
        return { filename: img.filename, base64: buf.toString("base64") };
      }
    }
    throw new Error("انتهت مهلة توليد الصورة");
  },
  queue: () => call(cfg.factory, "/api/queue"),
  stats: () => call(cfg.factory, "/api/stats"),
  logs: (tail) => call(cfg.factory, `/api/logs${tail ? `?tail=${tail}` : ""}`),
  datasets: () => call(cfg.factory, "/api/datasets"),
  testTeacher: (teacher) => call(cfg.factory, "/api/test", { method: "POST", body: { teacher }, timeout: 180000 }),
  queueAdd: (task) => call(cfg.factory, "/api/queue/add", { method: "POST", body: task }),
  queueRemove: (id) => call(cfg.factory, "/api/queue/remove", { method: "POST", body: { id } }),
  queueClear: () => call(cfg.factory, "/api/queue/clear", { method: "POST", body: {} }),
  workerStart: () => call(cfg.factory, "/api/worker/start", { method: "POST", body: {} }),
  workerStop: () => call(cfg.factory, "/api/worker/stop", { method: "POST", body: {} }),
  projects: ({ action = "list", name, path, content } = {}) =>
    bridgeCall("/api/projects", { method: "POST", body: { action, name, path, content } }),
  sync: (action = "status") => bridgeCall("/api/sync", { method: "POST", body: { action } }),
};

// ===== Groupe-HN: أوامر المنصة =====
function localModels() {
  try { return readdirSync(cfg.modelDir).filter((f) => f.endsWith(".gguf")).map((f) => ({ name: f, gb: +(statSync(`${cfg.modelDir}/${f}`).size / 1e9).toFixed(2), local: true })); }
  catch { return []; }
}
function registry() {
  if (!cfg.registryFile || !existsSync(cfg.registryFile)) return [];
  try { const j = JSON.parse(readFileSync(cfg.registryFile, "utf8")); return Array.isArray(j) ? j : j.models ?? []; } catch { return []; }
}

export const ghn = {
  models: async () => {
    const ollama = await api.models().catch(() => []);
    return { ollama: ollama.map((m) => ({ ...m, installed: true })), gguf: localModels(), registry: registry() };
  },
  queue: () => api.queue().catch((e) => ({ ok: false, note: "المصنع غير مشغّل (اختياري)", error: e.message })),
  stats: async () => {
    const [ollama, factory, pm2, disk] = await Promise.all([
      safe(() => call(cfg.ollama, "/api/ps")),
      safe(() => api.stats()),
      run("pm2", ["jlist"], { timeout: 10000 }).then((r) => { try { return JSON.parse(r.out).map((p) => ({ name: p.name, status: p.pm2_env?.status })); } catch { return []; } }),
      run("df", ["-h", cfg.modelDir], { timeout: 5000 }).then((r) => r.out.trim()),
    ]);
    return { ollama, factory, pm2, disk, memory: { totalGB: +(os.totalmem() / 1e9).toFixed(1), freeGB: +(os.freemem() / 1e9).toFixed(1) }, load: os.loadavg() };
  },
  info: async () => ({ version: VERSION, host: os.hostname(), platform: `${os.platform()} ${os.arch()}`, node: process.version, config: masked(), status: await api.status() }),
  studio: async (action = "check") => {
    const url = `http://127.0.0.1:${cfg.studioPort}`;
    if (action === "check") return safe(() => call(url, "/", { timeout: 4000 }).then(() => ({ url, up: true })));
    const r = await run("pm2", [action === "stop" ? "stop" : "start", "nawat-studio"], { timeout: 20000 });
    return { action, code: r.code, out: r.out.slice(-1500), err: r.err.slice(-500) };
  },
  sync: async ({ model, from = cfg.nodes[0], to = cfg.nodes[1], dry = true } = {}) => {
    if (!model) throw new Error("حدّد --model اسم ملف GGUF");
    if (/[^\w.\-:]/.test(model)) throw new Error("اسم نموذج غير صالح");
    const src = `${cfg.sshUser}@${from}:${cfg.modelDir}/${model}`;
    const argv = ["-avh", "--progress", "--ignore-existing", ...(dry ? ["--dry-run"] : []), "-e", "ssh", src, `${cfg.sshUser}@${to}:${cfg.modelDir}/`];
    const r = await run("rsync", argv, { timeout: 6 * 3600 * 1000 });
    return { dry, from, to, model, code: r.code, out: r.out.slice(-2000), err: r.err.slice(-800) };
  },
  doctor: async () => {
    const checks = [];
    const add = (name, ok, detail = "") => checks.push({ name, ok, detail });
    const st = await api.status();
    add("bridge", st.bridge.ok, st.bridge.ok ? cfg.bridge : `غير متاح الآن — ${cfg.bridge}`);
    add("ollama", st.ollama.ok, st.ollama.ok ? cfg.ollama : `غير متاح الآن — ${cfg.ollama}`);
    add("factory (اختياري)", true, st.factory.ok ? "متصل" : "غير مشغّل");
    add("model dir", existsSync(cfg.modelDir), cfg.modelDir);
    for (const f of ["bridge/server.mjs", "cli/mcp-server.mjs", "deploy/factory/factory_server.py"]) add(`file ${f}`, existsSync(f), "");
    for (const n of cfg.nodes) {
      const r = await safe(() => call(`http://${n}:11434`, "/api/version", { timeout: 4000 }));
      add(`node ${n}`, r.ok, r.ok ? "Ollama متاح" : "غير متاح الآن");
    }
    const failed = checks.filter((c) => !c.ok).length;
    return { ok: failed === 0, failed, checks };
  },
};
