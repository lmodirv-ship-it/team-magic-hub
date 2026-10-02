import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Public bridges whose password lives only on the server (never in the browser). */
const SERVER_BRIDGES: Record<string, { url: string; env: string }> = {
  hnchat: { url: "https://bridge.hnchat.net/index.php", env: "HNCHAT_RELAY_TOKEN" },
};
const KINDS = ["chat", "image", "models", "health", "version", "update"] as const;

function bridge(id: string) {
  const b = SERVER_BRIDGES[id];
  if (!b) throw new Error("جسر غير معروف");
  const token = process.env[b.env];
  if (!token) throw new Error("كلمة سر الجسر غير محفوظة على الخادم");
  return { base: `${b.url}/api/public/relay`, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, root: b.url };
}

export const serverBridgeStatus = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().max(40) }).parse(d))
  .handler(async ({ data }) => {
    const b = SERVER_BRIDGES[data.id];
    if (!b) return { ok: false, latencyMs: 0, detail: "جسر غير معروف" };
    const t = Date.now();
    try {
      const r = await fetch(b.url, { signal: AbortSignal.timeout(6000) });
      const d = (await r.json().catch(() => ({}))) as { agentOnline?: boolean };
      const ok = r.ok && d.agentOnline === true;
      return { ok, latencyMs: Date.now() - t, detail: ok ? "متصل" : r.ok ? "الوكيل المحلي غير متصل" : `HTTP ${r.status}` };
    } catch {
      return { ok: false, latencyMs: 0, detail: "تعذّر الاتصال" };
    }
  });

export const serverBridgeCall = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ id: z.string().max(40), kind: z.enum(KINDS), payload: z.record(z.string(), z.unknown()).default({}) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { base, headers } = bridge(data.id);
    let r = await fetch(`${base}/submit`, { method: "POST", headers, body: JSON.stringify({ kind: data.kind, payload: data.payload, wait: 20 }) });
    let d = (await r.json().catch(() => ({}))) as { id?: string; status?: string; result?: unknown; error?: string | null };
    if (!r.ok && r.status !== 202) throw new Error(d.error ?? `HTTP ${r.status}`);
    for (let i = 0; (d.status ?? "") !== "" && ["pending","working"].includes(d.status as string) && d.id && i < 30; i++) {
      await new Promise((res) => setTimeout(res, 2000));
    r = await fetch(`${base}/result/${d.id}`, { headers });
      d = await r.json().catch(() => ({}));
    }
    if (d.status !== "done") throw new Error(d.error ?? "لم يرد الخادم المحلي");
    return { result: (d.result ?? null) as never };
  });
