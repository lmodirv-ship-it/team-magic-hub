/** Dual save: settings stay in this browser and are also copied to /data/nawat-config.json via the LAN bridge. */
const BRIDGE_KEY = "nawat.configBridge";
const SECRET = /(key|token|secret|password|pass)/i;

export function configBridgeUrl(): string {
  if (typeof window === "undefined") return "http://127.0.0.1:8788";
  return localStorage.getItem(BRIDGE_KEY) || "http://127.0.0.1:8788";
}
export function setConfigBridgeUrl(u: string) {
  localStorage.setItem(BRIDGE_KEY, u.replace(/\/+$/, ""));
}

/** Collect nawat.* settings, excluding secrets. */
export function collectSettings(): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)!;
    if (k.startsWith("nawat.") && !SECRET.test(k)) out[k] = localStorage.getItem(k) ?? "";
  }
  return out;
}

export async function saveToServer(): Promise<string> {
  const r = await fetch(configBridgeUrl() + "/api/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ settings: collectSettings() }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return ((await r.json()) as { savedAt: string }).savedAt;
}

/** Additive restore: only fills keys missing locally (add, never remove). */
export async function restoreFromServer(overwrite = false): Promise<number> {
  const r = await fetch(configBridgeUrl() + "/api/config");
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const { settings } = (await r.json()) as { settings: Record<string, string> };
  let n = 0;
  for (const [k, v] of Object.entries(settings ?? {})) {
    if (!k.startsWith("nawat.") || SECRET.test(k)) continue;
    if (overwrite || localStorage.getItem(k) === null) {
      localStorage.setItem(k, v);
      n++;
    }
  }
  return n;
}
