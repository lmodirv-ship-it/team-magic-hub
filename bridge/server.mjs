#!/usr/bin/env node
// NAWAT Bridge — يربط تطبيق الهاتف والموقع المنشور بخدمات الخادم (Ollama + ComfyUI).
// بلا اعتماديات: يعمل بـ Node 18+ فقط.  التشغيل: node bridge/server.mjs
import http from "node:http";
import { randomUUID } from "node:crypto";

const env = (k, d) => process.env[k] ?? d;
const PORT = Number(env("BRIDGE_PORT", 8788));
const OLLAMA = env("OLLAMA_URL", "http://127.0.0.1:11434").replace(/\/$/, "");
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
  return { ok: true, bridge: "nawat", version: "1.0.0", ollama, comfy, ollamaUrl: OLLAMA, comfyUrl: COMFY };
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
  const payload = {
    model: body.model || DEFAULT_MODEL,
    stream: !!body.stream,
    messages: [{ role: "system", content: sys.join(" ") }, ...messages],
  };
  const r = await up(`${OLLAMA}/api/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }, 600_000);
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
    if (p === "/api/models" && req.method === "GET") return send(res, 200, await models());
    if (p === "/api/chat" && req.method === "POST") return await chat(await readJson(req), res);
    if (p === "/api/image" && req.method === "POST") {
      const b = await readJson(req);
      if (!b.prompt) return send(res, 400, { error: "prompt مطلوب" });
      return send(res, 200, { image: await generateImage(String(b.prompt).slice(0, 2000), b) });
    }
    send(res, 404, { error: "not found", endpoints: ["/api/ping", "/api/health", "/api/models", "/api/chat", "/api/image"] });
  } catch (e) {
    log("ERR", p, e.message);
    if (!res.headersSent) send(res, 502, { error: e.name === "AbortError" ? "انتهت مهلة الخدمة" : e.message });
    else res.end();
  }
});

server.listen(PORT, "0.0.0.0", () => {
  log(`NAWAT Bridge على :${PORT}  →  Ollama ${OLLAMA}  |  ComfyUI ${COMFY}  |  رمز ${TOKEN ? "مفعّل" : "غير مفعّل"}`);
});
