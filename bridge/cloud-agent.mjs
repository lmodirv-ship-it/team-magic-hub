#!/usr/bin/env node
// وكيل الجسر السحابي — يعمل على الخادم المحلي بجانب bridge/server.mjs.
// يتصل هو بالموقع المنشور (اتصال خارج فقط، بلا فتح منافذ) ويسحب المهام وينفذها عبر الجسر المحلي.
// التشغيل:  RELAY_TOKEN=كلمة-السر node bridge/cloud-agent.mjs
const CLOUD = (process.env.CLOUD_URL ?? "https://studio-nawat.lovable.app").replace(/\/$/, "") + "/api/public/relay";
const LOCAL = (process.env.LOCAL_BRIDGE ?? "http://127.0.0.1:8788").replace(/\/$/, "");
const TOKEN = process.env.RELAY_TOKEN;
const LOCAL_TOKEN = process.env.BRIDGE_TOKEN ?? "";
if (!TOKEN) { console.error("RELAY_TOKEN مطلوب"); process.exit(1); }

const H = { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` };
const LH = { "Content-Type": "application/json", ...(LOCAL_TOKEN ? { Authorization: `Bearer ${LOCAL_TOKEN}` } : {}) };
const log = (...a) => console.log(new Date().toISOString(), ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run(job) {
  const map = {
    chat: ["POST", "/api/chat"], image: ["POST", "/api/image"],
    models: ["GET", "/api/models"], health: ["GET", "/api/health"],
  };
  const [method, path] = map[job.kind] ?? [];
  if (!path) throw new Error(`نوع غير معروف: ${job.kind}`);
  const r = await fetch(LOCAL + path, { method, headers: LH, body: method === "POST" ? JSON.stringify({ ...job.payload, stream: false }) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
  return d;
}

async function finish(id, body) {
  await fetch(`${CLOUD}/done`, { method: "POST", headers: H, body: JSON.stringify({ id, ...body }) });
}

log(`وكيل الجسر السحابي: ${CLOUD}  ⇄  ${LOCAL}`);
let fails = 0;
for (;;) {
  try {
    const r = await fetch(`${CLOUD}/pull`, { headers: H });
    if (r.status === 401) { log("كلمة السر خاطئة — توقف"); process.exit(1); }
    const { jobs = [] } = await r.json();
    fails = 0;
    await Promise.all(jobs.map(async (job) => {
      const t = Date.now();
      try { await finish(job.id, { result: await run(job) }); log("✓", job.kind, `${Date.now() - t}ms`); }
      catch (e) { await finish(job.id, { error: String(e.message ?? e) }); log("✗", job.kind, e.message); }
    }));
    await sleep(jobs.length ? 200 : 2000);
  } catch (e) {
    fails++; log("انقطاع:", e.message);
    await sleep(Math.min(30000, 2000 * fails));
  }
}
