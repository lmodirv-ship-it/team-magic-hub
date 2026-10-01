export type BridgeMode = "auto" | "lan" | "public";

export type BridgeConfig = {
  version: 1;
  mode: BridgeMode;
  localUrl: string;
  publicUrl: string;
};

export type BridgeCheck = {
  ok: boolean;
  latencyMs: number;
  detail: string;
};

const CONFIG_KEY = "nawat.bridge.config.v1";
const TOKEN_KEY = "nawat.bridge.relayToken";
const CHANGE_EVENT = "nawat:bridge-config";

export const DEFAULT_BRIDGE_CONFIG: BridgeConfig = {
  version: 1,
  mode: "auto",
  localUrl: "http://192.168.100.66:8788",
  publicUrl: "https://nawat.groupe-hn.com",
};

function normalizeUrl(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return fallback;
    return url.origin + url.pathname.replace(/\/+$/, "");
  } catch {
    return fallback;
  }
}

function normalizeConfig(value: unknown): BridgeConfig | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<BridgeConfig>;
  if (candidate.version !== 1 || !["auto", "lan", "public"].includes(candidate.mode ?? "")) return null;
  return {
    version: 1,
    mode: candidate.mode as BridgeMode,
    localUrl: normalizeUrl(candidate.localUrl, DEFAULT_BRIDGE_CONFIG.localUrl),
    publicUrl: normalizeUrl(candidate.publicUrl, DEFAULT_BRIDGE_CONFIG.publicUrl),
  };
}

export function getBridgeConfig(): BridgeConfig {
  if (typeof window === "undefined") return DEFAULT_BRIDGE_CONFIG;
  try {
    const stored = localStorage.getItem(CONFIG_KEY);
    if (stored) return normalizeConfig(JSON.parse(stored)) ?? DEFAULT_BRIDGE_CONFIG;

    const mobile = JSON.parse(localStorage.getItem("nawat.mobile.v1") ?? "null") as { bridge?: unknown; relayToken?: unknown } | null;
    const oldBridge = typeof mobile?.bridge === "string" ? mobile.bridge : "";
    const publicMode = oldBridge.includes("nawat.groupe-hn.com") || oldBridge.includes("lovable.app");
    const migrated: BridgeConfig = {
      ...DEFAULT_BRIDGE_CONFIG,
      mode: oldBridge ? (publicMode ? "public" : "lan") : "auto",
      ...(oldBridge && !publicMode ? { localUrl: normalizeUrl(oldBridge, DEFAULT_BRIDGE_CONFIG.localUrl) } : {}),
      ...(oldBridge && publicMode ? { publicUrl: normalizeUrl(oldBridge, DEFAULT_BRIDGE_CONFIG.publicUrl) } : {}),
    };
    localStorage.setItem(CONFIG_KEY, JSON.stringify(migrated));
    if (typeof mobile?.relayToken === "string" && mobile.relayToken) localStorage.setItem(TOKEN_KEY, mobile.relayToken);
    return migrated;
  } catch {
    return DEFAULT_BRIDGE_CONFIG;
  }
}

export function saveBridgeConfig(config: BridgeConfig): BridgeConfig {
  const normalized = normalizeConfig(config);
  if (!normalized) throw new Error("إعدادات الجسر غير صالحة");
  localStorage.setItem(CONFIG_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: normalized }));
  return normalized;
}

export function getRelayToken(): string {
  return typeof window === "undefined" ? "" : localStorage.getItem(TOKEN_KEY) ?? "";
}

export function saveRelayToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function subscribeBridgeConfig(listener: (config: BridgeConfig) => void) {
  const onChange = (event: Event) => listener((event as CustomEvent<BridgeConfig>).detail ?? getBridgeConfig());
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => window.removeEventListener(CHANGE_EVENT, onChange);
}

export function exportBridgeConfig(config = getBridgeConfig()): string {
  return JSON.stringify({ kind: "nawat-bridge-config", exportedAt: new Date().toISOString(), ...config }, null, 2);
}

export function importBridgeConfig(text: string): BridgeConfig {
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error("الملف ليس JSON صالحًا"); }
  if (!value || typeof value !== "object" || (value as { kind?: unknown }).kind !== "nawat-bridge-config") {
    throw new Error("هذا ليس ملف إعدادات جسر NAWAT");
  }
  const normalized = normalizeConfig(value);
  if (!normalized) throw new Error("إصدار ملف الإعدادات غير مدعوم");
  return saveBridgeConfig(normalized);
}

async function timedFetch(url: string, init?: RequestInit): Promise<{ response: Response; latencyMs: number }> {
  const started = performance.now();
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    return { response, latencyMs: Math.round(performance.now() - started) };
  } finally {
    window.clearTimeout(timer);
  }
}

export async function checkBridge(target: "lan" | "public", config = getBridgeConfig()): Promise<BridgeCheck> {
  try {
    const url = target === "lan"
      ? `${config.localUrl}/api/ping`
      : `${config.publicUrl}/api/public/relay/status`;
    const { response, latencyMs } = await timedFetch(url);
    if (!response.ok) return { ok: false, latencyMs, detail: `HTTP ${response.status}` };
    const data = await response.json().catch(() => ({})) as { agentOnline?: boolean };
    const ok = target === "lan" || data.agentOnline === true;
    return { ok, latencyMs, detail: ok ? "متصل" : "الوكيل المحلي غير متصل" };
  } catch (error) {
    return { ok: false, latencyMs: 0, detail: error instanceof Error && error.name === "AbortError" ? "انتهت المهلة" : "تعذّر الاتصال" };
  }
}

type BridgeKind = "chat" | "models" | "health" | "image";

async function callLocal(config: BridgeConfig, kind: BridgeKind, payload: Record<string, unknown>) {
  const path = kind === "chat" ? "/api/chat" : kind === "models" ? "/api/models" : kind === "image" ? "/api/image" : "/api/health";
  const response = await fetch(config.localUrl + path, kind === "chat" || kind === "image"
    ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }
    : undefined);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${response.status}`);
  return data;
}

async function callPublic(config: BridgeConfig, token: string, kind: BridgeKind, payload: Record<string, unknown>) {
  if (!token) throw new Error("كلمة سر الجسر العام مطلوبة");
  const base = `${config.publicUrl}/api/public/relay`;
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
  let response = await fetch(`${base}/submit`, { method: "POST", headers, body: JSON.stringify({ kind, payload, wait: 20 }) });
  let data = await response.json().catch(() => ({})) as { id?: string; status?: string; result?: unknown; error?: string };
  if (!response.ok && response.status !== 202) throw new Error(data.error ?? `HTTP ${response.status}`);
  for (let attempt = 0; data.status === "pending" && data.id && attempt < 3; attempt++) {
    response = await fetch(`${base}/result/${data.id}`, { headers });
    data = await response.json().catch(() => ({}));
  }
  if (data.status !== "done") throw new Error(data.error ?? "لم يرد الخادم المحلي");
  return data.result;
}

export async function callConfiguredBridge(kind: BridgeKind, payload: Record<string, unknown> = {}, config = getBridgeConfig()) {
  if (config.mode === "lan") return callLocal(config, kind, payload);
  if (config.mode === "public") return callPublic(config, getRelayToken(), kind, payload);
  try {
    return await callLocal(config, kind, payload);
  } catch {
    return callPublic(config, getRelayToken(), kind, payload);
  }
}