import { serverBridgeCall, serverBridgeStatus } from "./relay.functions";

export type BridgeMode = "auto" | "lan" | "public";

export type BridgeConfig = {
  version: 1;
  mode: BridgeMode;
  localUrl: string;
  publicUrl: string;
  /** عدة جسور عامة؛ النشط يُستخدم أولًا ثم البقية كاحتياط. */
  bridges: PublicBridge[];
  activeBridge: string;
};

/** serverKey: كلمة السر محفوظة على الخادم وليس في المتصفح. */
export type PublicBridge = { id: string; name: string; url: string; serverKey?: boolean };

export const BUILTIN_BRIDGES: PublicBridge[] = [
  { id: "hnchat", name: "HN Chat Bridge", url: "https://bridge.hnchat.net/index.php", serverKey: true },
  { id: "nawat", name: "نواة الرسمي", url: "https://nawat.groupe-hn.com" },
  { id: "hn-ai-site", name: "نواة — نسخة hn-ai.site", url: "https://hn-ai.site" },
];

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
  bridges: BUILTIN_BRIDGES,
  activeBridge: "hnchat",
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
  const custom = (Array.isArray(candidate.bridges) ? candidate.bridges : [])
    .filter((b) => b && typeof b.id === "string" && !BUILTIN_BRIDGES.some((x) => x.id === b.id))
    .slice(0, 20)
    .map((b) => ({ id: String(b.id).slice(0, 40), name: String(b.name ?? b.id).slice(0, 60), url: normalizeUrl(b.url, "") }))
    .filter((b) => b.url);
  const bridges = [...BUILTIN_BRIDGES, ...custom];
  return {
    version: 1,
    mode: candidate.mode as BridgeMode,
    localUrl: normalizeUrl(candidate.localUrl, DEFAULT_BRIDGE_CONFIG.localUrl),
    publicUrl: normalizeUrl(candidate.publicUrl, DEFAULT_BRIDGE_CONFIG.publicUrl),
    bridges,
    activeBridge: bridges.some((b) => b.id === candidate.activeBridge) ? candidate.activeBridge! : bridges[0]!.id,
  };
}

export function getBridgeConfig(): BridgeConfig {
  if (typeof window === "undefined") return DEFAULT_BRIDGE_CONFIG;
  try {
    const stored = localStorage.getItem(CONFIG_KEY);
    if (stored) {
      const raw = JSON.parse(stored) as Partial<BridgeConfig>;
      const cfg = normalizeConfig(raw) ?? DEFAULT_BRIDGE_CONFIG;
      if (!raw.bridges) { const next = { ...cfg, mode: "public" as const, activeBridge: "hnchat" }; localStorage.setItem(CONFIG_KEY, JSON.stringify(next)); return next; }
      return cfg;
    }

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

export function activeBridges(config: BridgeConfig): PublicBridge[] {
  currentPublicUrl = config.publicUrl;
  const a = config.bridges.find((b) => b.id === config.activeBridge);
  return a ? [a, ...config.bridges.filter((b) => b !== a)] : config.bridges;
}
let currentPublicUrl = DEFAULT_BRIDGE_CONFIG.publicUrl;
const relayBase = (b: PublicBridge) => b.id === "nawat" ? currentPublicUrl : b.url;

export async function checkPublicBridge(b: PublicBridge): Promise<BridgeCheck> {
  if (b.serverKey) return serverBridgeStatus({ data: { id: b.id } }).catch((e: unknown) => ({ ok: false, latencyMs: 0, detail: e instanceof Error ? e.message : "تعذّر الاتصال" }));
  try {
    const { response, latencyMs } = await timedFetch(`${relayBase(b)}/api/public/relay/status`);
    const data = await response.json().catch(() => ({})) as { agentOnline?: boolean };
    const ok = response.ok && data.agentOnline === true;
    return { ok, latencyMs, detail: ok ? "متصل" : response.ok ? "الوكيل المحلي غير متصل" : `HTTP ${response.status}` };
  } catch { return { ok: false, latencyMs: 0, detail: "تعذّر الاتصال" }; }
}

export async function checkBridge(target: "lan" | "public", config = getBridgeConfig()): Promise<BridgeCheck> {
  if (target === "public") return checkPublicBridge(activeBridges(config)[0]!);
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

type BridgeKind = "chat" | "models" | "health" | "image" | "version" | "update" | "system" | "projects" | "sync";

async function callLocal(config: BridgeConfig, kind: BridgeKind, payload: Record<string, unknown>) {
  const path = `/api/${kind}`;
  const post = kind === "chat" || kind === "image" || kind === "update" || kind === "projects" || kind === "sync";
  const response = await fetch(config.localUrl + path, post
    ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }
    : undefined);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${response.status}`);
  return data;
}

async function callPublic(config: BridgeConfig, token: string, kind: BridgeKind, payload: Record<string, unknown>) {
  let last: unknown;
  for (const b of activeBridges(config)) {
    try { return await callOne(b, token, kind, payload); } catch (e) { last = e; }
  }
  throw last instanceof Error ? last : new Error("تعذّر الوصول إلى أي جسر عام");
}

async function callOne(b: PublicBridge, token: string, kind: BridgeKind, payload: Record<string, unknown>) {
  if (b.serverKey) return (await serverBridgeCall({ data: { id: b.id, kind, payload } })).result as unknown;
  if (!token) throw new Error("كلمة سر الجسر العام مطلوبة");
  const base = `${relayBase(b)}/api/public/relay`;
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
  let response = await fetch(`${base}/submit`, { method: "POST", headers, body: JSON.stringify({ kind, payload, wait: 20 }) });
  let data = await response.json().catch(() => ({})) as { id?: string; status?: string; result?: unknown; error?: string };
  if (!response.ok && response.status !== 202) throw new Error(data.error ?? `HTTP ${response.status}`);
  for (let attempt = 0; (data.status ?? "") !== "" && ["pending","working"].includes(data.status as string) && data.id && attempt < 30; attempt++) {
    await new Promise((res) => setTimeout(res, 2000));
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