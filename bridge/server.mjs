#!/usr/bin/env node
// NAWAT Bridge — يربط تطبيق الهاتف والموقع المنشور بخدمات الخادم (Ollama + ComfyUI).
// بلا اعتماديات: يعمل بـ Node 18+ فقط.  التشغيل: node bridge/server.mjs
import http from "node:http";
import { randomUUID } from "node:crypto";
import { execFile, spawn } from "node:child_process";
import { readFileSync, openSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const git = (...args) => new Promise((ok) => execFile("git", args, { cwd: ROOT, timeout: 20000 }, (e, out) => ok(e ? "" : out.trim())));
async function version() {
  const br = process.env.GIT_BRANCH ?? "main";
  await git("fetch", "-q", "origin", br);
  const [local, remote, date, behind, msg] = await Promise.all([
    git("rev-parse", "--short", "HEAD"), git("rev-parse", "--short", `origin/${br}`),
    git("log", "-1", "--format=%cI"), git("rev-list", "--count", `HEAD..origin/${br}`), git("log", "-1", "--format=%s", `origin/${br}`),
  ]);
  let log = ""; try { log = readFileSync(path.join(ROOT, "update.log"), "utf8").split("\n").slice(-8).join("\n"); } catch {}
  return { local, remote, branch: br, localDate: date, behind: Number(behind || 0), latest: msg, updating: updating, log };
}
let updating = false;
function runUpdate() {
  if (updating) return { started: false, message: "تحديث جارٍ بالفعل" };
  updating = true;
  const out = openSync(path.join(ROOT, "update.log"), "a");
  const child = spawn("bash", [path.join(ROOT, "deploy/update.sh")], { cwd: ROOT, stdio: ["ignore", out, out], detached: true });
  child.on("exit", () => { updating = false; });
  child.unref();
  return { started: true, message: "بدأ سحب آخر التعديلات وإعادة البناء" };
}

const env = (k, d) => process.env[k] ?? d;
const PORT = Number(env("BRIDGE_PORT", 8788));
const OLLAMA_HOSTS = [env("OLLAMA_URL", "http://127.0.0.1:11434"), ...env("OLLAMA_FALLBACKS", "http://192.168.2.4:11434").split(",")]
  .map((s) => s.trim().replace(/\/$/, "")).filter((v, i, a) => v && a.indexOf(v) === i);
let OLLAMA = OLLAMA_HOSTS[0];
const MODEL_DIR = env("MODEL_STORAGE_PATH", "/data/model");
const PROJECTS_DIR = path.resolve(env("PROJECTS_DIR", "/data/projects"));
const SYNC_PEERS = env("SYNC_PEERS", "").split(",").map((s) => s.trim().replace(/\/$/, "")).filter(Boolean);
const safeName = (n) => String(n ?? "").trim().replace(/[^\w\u0600-\u06FF.-]+/g, "-").replace(/^[.-]+/, "").slice(0, 60);
function inProject(name, rel = "") {
  const root = path.join(PROJECTS_DIR, safeName(name));
  const full = path.resolve(root, String(rel).replace(/^\/+/, ""));
  if (!safeName(name) || (full !== root && !full.startsWith(root + path.sep))) throw new Error("مسار غير مسموح");
  return { root, full };
}
async function walk(dir, base = dir, out = []) {
  for (const e of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    if (e.name === "node_modules" || e.name === ".git") continue;
    const f = path.join(dir, e.name);
    out.push({ path: path.relative(base, f), type: e.isDirectory() ? "dir" : "file" });
    if (e.isDirectory() && out.length < 2000) await walk(f, base, out);
  }
  return out;
}
async function projects(b) {
  const a = b.action ?? "list";
  if (a === "list") {
    await mkdir(PROJECTS_DIR, { recursive: true });
    const list = [];
    for (const e of await readdir(PROJECTS_DIR, { withFileTypes: true })) if (e.isDirectory()) {
      const st = await stat(path.join(PROJECTS_DIR, e.name)); list.push({ name: e.name, updated: st.mtime.toISOString() });
    }
    return { root: PROJECTS_DIR, projects: list };
  }
  const { root, full } = inProject(b.name, b.path ?? "");
  if (a === "create") {
    await mkdir(root, { recursive: true });
    const files = b.files && typeof b.files === "object" ? b.files : { "README.md": `# ${safeName(b.name)}\n\nمشروع أُنشئ من NAWAT Studio.\n` };
    for (const [rel, content] of Object.entries(files)) { const t = inProject(b.name, rel).full; await mkdir(path.dirname(t), { recursive: true }); await writeFile(t, String(content)); }
    return { ok: true, root, files: await walk(root) };
  }
  if (a === "tree") return { root, files: await walk(root) };
  if (a === "read") return { path: b.path, content: await readFile(full, "utf8") };
  if (a === "write") { await mkdir(path.dirname(full), { recursive: true }); await writeFile(full, String(b.content ?? "")); return { ok: true, path: path.relative(root, full) }; }
  throw new Error("إجراء غير معروف");
}
async function sync(b) {
  const self = await version();
  const peers = await Promise.all(SYNC_PEERS.map(async (u) => {
    try {
      if (b.action === "update") { const r = await fetch(u + "/api/update", { method: "POST", signal: AbortSignal.timeout(8000) }); return { url: u, ok: r.ok, ...(await r.json().catch(() => ({}))) }; }
      const r = await fetch(u + "/api/version", { signal: AbortSignal.timeout(8000) }); return { url: u, ok: r.ok, ...(await r.json()) };
    } catch (e) { return { url: u, ok: false, error: String(e.message ?? e) }; }
  }));
  if (b.action === "update") runUpdate();
  return { self, peers };
}
const NO_THINK = env("QWEN_NO_THINK", "1") !== "0";
const COMFY = env("COMFY_URL", "http://192.168.2.4:8188").replace(/\/$/, "");
const TOKEN = env("BRIDGE_TOKEN", ""); // اختياري: إن وُضع يُطلب من كل طلب
const DEFAULT_MODEL = env("DEFAULT_MODEL", "nawat-coder:latest");
const ORIGINS = env("ALLOWED_ORIGINS",
  "https://nawat.groupe-hn.com,https://team-magic-hub.lovable.app,http://localhost:5174,http://localhost:8080"
).split(",").map((s) => s.trim());

const log = (...a) => console.log(new Date().toISOString(), ...a);

function cors(req, res) {
  const o = req.headers.origin;
  // تطبيق الهاتف لا يرسل origin؛ الشبكة المحلية مسموحة؛ والمواقع المعروفة فقط.
  const ok = !o || ORIGINS.includes(o) || /^https?:\/\/(localhost|127\.|192\.168\.|10\.)/.test(o) || /\.lovable\.app$/.test(new URL(o).hostname);
  if (o && ok) res.setHeader("Access-Control-Allow-Origin", o);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  res.setHeader("Access-Control-Allow-Private-Network", "true");
  return ok;
}

const send = (res, code, body) => {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
};

async function readJson(req, limit = 20 * 1024 * 1024) {
  let size = 0; const chunks = [];
  for await (const c of req) { size += c.length; if (size > limit) throw new Error("body too large"); chunks.push(c); }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}

async function up(url, opts = {}, ms = 5000) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try { return await fetch(url, { ...opts, signal: c.signal }); } finally { clearTimeout(t); }
}

async function health() {
  const check = async (u) => { try { const r = await up(u, {}, 3000); return r.ok; } catch { return false; } };
  const [ollama, comfy] = await Promise.all([check(`${OLLAMA}/api/tags`), check(`${COMFY}/system_stats`)]);
  return { ok: true, bridge: "nawat", version: "1.1.0", ollama, comfy, ollamaUrl: OLLAMA, ollamaHosts: OLLAMA_HOSTS, comfyUrl: COMFY };
}

// ---------- حالة السيرفر (قراءة فقط) ----------
const sh = (cmd, args, t = 8000) => new Promise((ok) => execFile(cmd, args, { timeout: t }, (e, out) => ok(e ? "" : String(out))));
async function system() {
  const [df, mem, pm2, smart, du, net] = await Promise.all([
    sh("df", ["-B1", "--output=target,size,used,avail", "/", "/data"]),
    sh("free", ["-b"]), sh("pm2", ["jlist"]), sh("smartctl", ["--version"]),
    sh("du", ["-sb", MODEL_DIR], 20000), sh("bash", ["-c", "cat /sys/class/net/*/speed 2>/dev/null | sort -n | tail -1"]),
  ]);
  const disks = df.trim().split("\n").slice(1).map((l) => { const [mount, size, used, avail] = l.trim().split(/\s+/); return { mount, size: +size, used: +used, avail: +avail }; });
  const m = mem.split("\n")[1]?.trim().split(/\s+/) ?? [];
  let procs = []; try { procs = JSON.parse(pm2).map((p) => ({ name: p.name, status: p.pm2_env?.status })); } catch {}
  let rebootRequired = false; try { readFileSync("/var/run/reboot-required"); rebootRequired = true; } catch {}
  return { ok: true, version: "1.1.0", disks, memory: { total: +m[1] || 0, used: +m[2] || 0 }, pm2: procs, smart: !!smart,
    rebootRequired, modelDir: MODEL_DIR, modelBytes: +(du.split(/\s/)[0] || 0), linkMbps: +net.trim() || 0, ...(await health()) };
}

async function models() {
  const r = await up(`${OLLAMA}/api/tags`);
  const d = await r.json();
  return { models: (d.models ?? []).map((m) => ({ name: m.name, size: m.size, family: m.details?.family, params: m.details?.parameter_size })) };
}

// ---------- ComfyUI: نص → صورة ----------
async function pickCheckpoint() {
  const r = await up(`${COMFY}/object_info/CheckpointLoaderSimple`);
  const d = await r.json();
  const list = d?.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0] ?? [];
  if (!list.length) throw new Error("لا يوجد checkpoint في ComfyUI");
  return env("COMFY_CKPT", list[0]);
}

async function generateImage(prompt, { width = 768, height = 768, steps = 25 } = {}) {
  const ckpt = await pickCheckpoint();
  const wf = {
    "4": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: ckpt } },
    "5": { class_type: "EmptyLatentImage", inputs: { width, height, batch_size: 1 } },
    "6": { class_type: "CLIPTextEncode", inputs: { text: prompt, clip: ["4", 1] } },
    "7": { class_type: "CLIPTextEncode", inputs: { text: "blurry, low quality, watermark, text", clip: ["4", 1] } },
    "3": { class_type: "KSampler", inputs: { seed: Math.floor(Math.random() * 2 ** 31), steps, cfg: 7, sampler_name: "euler", scheduler: "normal", denoise: 1, model: ["4", 0], positive: ["6", 0], negative: ["7", 0], latent_image: ["5", 0] } },
    "8": { class_type: "VAEDecode", inputs: { samples: ["3", 0], vae: ["4", 2] } },
    "9": { class_type: "SaveImage", inputs: { filename_prefix: "nawat", images: ["8", 0] } },
  };
  const q = await up(`${COMFY}/prompt`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: wf, client_id: randomUUID() }) });
  const { prompt_id } = await q.json();
  if (!prompt_id) throw new Error("رفض ComfyUI الطلب");
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1500));
    const h = await (await up(`${COMFY}/history/${prompt_id}`)).json();
    const out = h?.[prompt_id]?.outputs?.["9"]?.images?.[0];
    if (out) {
      const img = await up(`${COMFY}/view?filename=${encodeURIComponent(out.filename)}&subfolder=${encodeURIComponent(out.subfolder)}&type=${out.type}`, {}, 30000);
      return `data:image/png;base64,${Buffer.from(await img.arrayBuffer()).toString("base64")}`;
    }
  }
  throw new Error("انتهت مهلة توليد الصورة");
}

// ---------- الدردشة ----------
async function chat(body, res) {
  const messages = Array.isArray(body.messages) ? body.messages.slice(-40) : [];
  const last = messages.at(-1)?.content ?? "";
  if (body.image) {
    const prompt = String(last).replace(/^(ارسم لي|ارسم|draw)\s*/i, "");
    const image = await generateImage(prompt);
    return send(res, 200, { message: { role: "assistant", content: "تفضّل الصورة 🎨" }, image });
  }
  const sys = [];
  if (body.think) sys.push("فكّر خطوة بخطوة قبل الإجابة.");
  sys.push("أجب بالعربية ما لم يطلب المستخدم غير ذلك.");
  const model = body.model || DEFAULT_MODEL;
  const payload = {
    model,
    stream: !!body.stream,
    messages: [{ role: "system", content: sys.join(" ") }, ...messages],
  };
  // qwen3: إيقاف التفكير المطوّل وتحديد طول الرد للسرعة
  if (/qwen3/i.test(model) && !body.think && (body.noThink ?? NO_THINK)) { payload.think = false; payload.options = { num_predict: Number(body.maxTokens ?? 1024) }; }
  let r;
  for (const host of [OLLAMA, ...OLLAMA_HOSTS.filter((h) => h !== OLLAMA)]) {
    try { r = await up(`${host}/api/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }, 600_000); if (r.ok || r.status === 400) { OLLAMA = host; break; } } catch (e) { r = null; }
  }
  if (!r) return send(res, 502, { error: "لا يوجد Ollama متاح", hosts: OLLAMA_HOSTS });
  if (!r.ok) return send(res, r.status, { error: `Ollama: ${await r.text()}` });
  if (payload.stream) { // تمرير البث كما هو (NDJSON)
    res.writeHead(200, { "Content-Type": "application/x-ndjson; charset=utf-8" });
    for await (const c of r.body) res.write(c);
    return res.end();
  }
  const d = await r.json();
  send(res, 200, { message: d.message, model: d.model, secs: (d.total_duration ?? 0) / 1e9 });
}

const server = http.createServer(async (req, res) => {
  const allowed = cors(req, res);
  if (req.method === "OPTIONS") { res.writeHead(allowed ? 204 : 403); return res.end(); }
  if (!allowed) return send(res, 403, { error: "origin not allowed" });
  const url = new URL(req.url, "http://x");
  const p = url.pathname;
  if (p === "/api/ping") return send(res, 200, { ok: true, bridge: "nawat", time: Date.now() });
  if (TOKEN) {
    const got = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "") || url.searchParams.get("token");
    if (got !== TOKEN) return send(res, 401, { error: "unauthorized" });
  }
  try {
    if (p === "/api/health" && req.method === "GET") return send(res, 200, await health());
    if (p === "/api/system" && req.method === "GET") return send(res, 200, await system());
    if (p === "/api/version" && req.method === "GET") return send(res, 200, await version());
    if (p === "/api/update" && req.method === "POST") return send(res, 202, runUpdate());
    if (p === "/api/projects" && req.method === "POST") return send(res, 200, await projects(await readJson(req)));
    if (p === "/api/sync" && req.method === "POST") return send(res, 200, await sync(await readJson(req)));
    if (p === "/api/config") {
      const CFG = process.env.NAWAT_CONFIG_PATH || "/data/nawat-config.json";
      if (req.method === "GET") { try { return send(res, 200, JSON.parse(await readFile(CFG, "utf8"))); } catch { return send(res, 200, { settings: {}, savedAt: null }); } }
      if (req.method === "POST") { const b = await readJson(req); await mkdir(path.dirname(CFG), { recursive: true }); const data = { settings: b.settings ?? {}, savedAt: new Date().toISOString() }; await writeFile(CFG + ".tmp", JSON.stringify(data, null, 2)); await writeFile(CFG, JSON.stringify(data, null, 2)); return send(res, 200, { ok: true, savedAt: data.savedAt }); }
    }
    if (p === "/api/models" && req.method === "GET") return send(res, 200, await models());
    if (p === "/api/chat" && req.method === "POST") return await chat(await readJson(req), res);
    if (p === "/api/image" && req.method === "POST") {
      const b = await readJson(req);
      if (!b.prompt) return send(res, 400, { error: "prompt مطلوب" });
      return send(res, 200, { image: await generateImage(String(b.prompt).slice(0, 2000), b) });
    }
    send(res, 404, { error: "not found", endpoints: ["/api/ping", "/api/health", "/api/models", "/api/chat", "/api/image", "/api/version", "/api/update", "/api/projects", "/api/sync"] });
  } catch (e) {
    log("ERR", p, e.message);
    if (!res.headersSent) send(res, 502, { error: e.name === "AbortError" ? "انتهت مهلة الخدمة" : e.message });
    else res.end();
  }
});

server.listen(PORT, "0.0.0.0", () => {
  log(`NAWAT Bridge على :${PORT}  →  Ollama ${OLLAMA}  |  ComfyUI ${COMFY}  |  رمز ${TOKEN ? "مفعّل" : "غير مفعّل"}`);
});
