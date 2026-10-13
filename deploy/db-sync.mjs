// NAWAT server-to-server sync: copies app_store + task_runs between servers (add, never remove).
// Env: SYNC_LOCAL=http://127.0.0.1:3120  SYNC_REMOTES=https://hn-ai.site,https://nawat.groupe-hn.com  RELAY_TOKEN=...  SYNC_EVERY=300
const local = (process.env.SYNC_LOCAL || "http://127.0.0.1:3120").replace(/\/$/, "");
const remotes = (process.env.SYNC_REMOTES || "https://hn-ai.site").split(",").map((s) => s.trim().replace(/\/$/, "")).filter((r) => r && r !== local);
const token = process.env.RELAY_TOKEN || process.env.BRIDGE_TOKEN;
const every = Number(process.env.SYNC_EVERY || 300) * 1000;
const h = { authorization: `Bearer ${token}`, "content-type": "application/json" };
const pull = async (base) => { const r = await fetch(`${base}/api/public/db-mirror?scope=sync`, { headers: h }); if (!r.ok) throw new Error(`${base} ${r.status}`); return r.json(); };
const push = async (base, data) => { const r = await fetch(`${base}/api/public/db-mirror`, { method: "POST", headers: h, body: JSON.stringify(data) }); return r.ok ? r.json() : { error: r.status }; };
let lastErr = "";
async function round() {
  try {
    const mine = await pull(local);
    for (const rem of remotes) {
      const theirs = await pull(rem);
      const a = await push(local, theirs), b = await push(rem, mine);
      console.log(new Date().toISOString(), rem, "in", JSON.stringify(a.saved ?? a), "out", JSON.stringify(b.saved ?? b));
    }
    lastErr = "";
  } catch (e) { const m = String(e.message || e); if (m !== lastErr) console.error("sync:", m); lastErr = m; }
}
if (!token) { console.error("RELAY_TOKEN required"); process.exit(1); }
await round(); setInterval(round, every);
