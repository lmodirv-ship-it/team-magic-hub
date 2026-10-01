import { useEffect, useState } from "react";
import { getProviders, saveProvider } from "./providers";
import { ollamaHost } from "./bridge";

/** Local-first API keys for the Groupe-HN provider and per-model usage tracking. */
export type ApiKey = {
  id: string;
  name: string;
  key: string;
  provider: string;
  enabled: boolean;
  monthlyLimit: number; // tokens, 0 = unlimited
  createdAt: string;
  lastUsedAt?: string;
};

export type UsageEntry = {
  at: string;
  model: string;
  keyId?: string;
  promptTokens: number;
  outputTokens: number;
  ms: number;
};

const KEYS = "nawat.apiKeys.v1";
const ACTIVE = "nawat.apiKeys.active";
const USAGE = "nawat.usage.v1";
const EVT = "nawat:api-keys";
const MAX_USAGE = 2000;

function read<T>(k: string, f: T): T {
  if (typeof window === "undefined") return f;
  try {
    return JSON.parse(localStorage.getItem(k) ?? "") as T;
  } catch {
    return f;
  }
}
function notify() {
  window.dispatchEvent(new Event(EVT));
}

export const estimateTokens = (text: string) => Math.ceil(text.length / 4);

export function getKeys(): ApiKey[] {
  return read<ApiKey[]>(KEYS, []);
}
function saveKeys(keys: ApiKey[]) {
  localStorage.setItem(KEYS, JSON.stringify(keys));
  notify();
}
export function getActiveKeyId(): string | null {
  return typeof window === "undefined" ? null : localStorage.getItem(ACTIVE);
}
export function setActiveKey(id: string | null) {
  if (id) localStorage.setItem(ACTIVE, id);
  else localStorage.removeItem(ACTIVE);
  notify();
}

export function createKey(name: string, monthlyLimit = 0): ApiKey {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const key = "nwt_" + [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  const item: ApiKey = {
    id: "K" + Date.now().toString(36).toUpperCase(),
    name: name || "مفتاح جديد",
    key,
    provider: "groupe-hn",
    enabled: true,
    monthlyLimit,
    createdAt: new Date().toISOString(),
  };
  saveKeys([...getKeys(), item]);
  if (!getActiveKeyId()) setActiveKey(item.id);
  return item;
}
export function updateKey(id: string, patch: Partial<ApiKey>) {
  saveKeys(getKeys().map((k) => (k.id === id ? { ...k, ...patch } : k)));
}
export function deleteKey(id: string) {
  saveKeys(getKeys().filter((k) => k.id !== id));
  if (getActiveKeyId() === id) setActiveKey(null);
}

export function getUsage(): UsageEntry[] {
  return read<UsageEntry[]>(USAGE, []);
}
export function clearUsage() {
  localStorage.removeItem(USAGE);
  notify();
}
export function recordUsage(e: Omit<UsageEntry, "at" | "keyId">) {
  if (typeof window === "undefined") return;
  const keyId = getActiveKeyId() ?? undefined;
  const list = [...getUsage(), { ...e, at: new Date().toISOString(), ...(keyId ? { keyId } : {}) }];
  localStorage.setItem(USAGE, JSON.stringify(list.slice(-MAX_USAGE)));
  if (keyId) {
    const keys = getKeys().map((k) => (k.id === keyId ? { ...k, lastUsedAt: new Date().toISOString() } : k));
    localStorage.setItem(KEYS, JSON.stringify(keys));
  }
  notify();
}

export function usedThisMonth(keyId: string, usage = getUsage()) {
  const m = new Date().toISOString().slice(0, 7);
  return usage
    .filter((u) => u.keyId === keyId && u.at.startsWith(m))
    .reduce((s, u) => s + u.promptTokens + u.outputTokens, 0);
}

/** Registers Groupe-HN as a provider in NAWAT Studio, pointed at the Ollama engine. */
export function setupGroupeHnProvider() {
  const existing = getProviders().find((p) => p.id === "groupe-hn");
  const active = getKeys().find((k) => k.id === getActiveKeyId());
  saveProvider(
    {
      id: "groupe-hn",
      name: "Groupe-HN",
      kind: "openai-compatible",
      baseUrl: existing?.baseUrl ?? ollamaHost() + "/v1",
      models: existing?.models ?? [],
      connected: true,
      updatedAt: new Date().toISOString(),
    },
    active?.key,
  );
}
export function isGroupeHnReady() {
  return getProviders().some((p) => p.id === "groupe-hn" && p.connected);
}

export function useApiKeys() {
  const [state, setState] = useState({
    keys: [] as ApiKey[],
    usage: [] as UsageEntry[],
    active: null as string | null,
    ready: false,
  });
  useEffect(() => {
    const sync = () =>
      setState({ keys: getKeys(), usage: getUsage(), active: getActiveKeyId(), ready: isGroupeHnReady() });
    sync();
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", sync);
    window.addEventListener("nawat:providers-changed", sync);
    return () => {
      window.removeEventListener(EVT, sync);
      window.removeEventListener("storage", sync);
      window.removeEventListener("nawat:providers-changed", sync);
    };
  }, []);
  return state;
}
