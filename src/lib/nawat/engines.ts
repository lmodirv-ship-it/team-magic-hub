import type { ConfigRow } from "@/components/nawat/ConfigTable";
import { normalizeHost, ollamaHost } from "./bridge";

const ENGINES_KEY = "nawat.cfg.engines";
const SECURITY_KEY = "nawat.cfg.security";
const MODEL_ENGINE_KEY = "nawat.modelEngine";

function readRows(key: string): ConfigRow[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as ConfigRow[]) : null;
  } catch {
    return null;
  }
}

export type Engine = { name: string; url: string };

/** Enabled Ollama engines from the settings table (falls back to the main Ollama address). */
export function enabledEngines(): Engine[] {
  const rows = readRows(ENGINES_KEY);
  const list = (rows ?? [])
    .filter((r) => r.enabled && r.value.trim())
    .map((r) => ({ name: r.name, url: normalizeHost(r.value) }));
  const main = ollamaHost();
  if (!list.some((e) => e.url === main)) list.unshift({ name: "Ollama الرئيسي", url: main });
  return list;
}

export function modelEngine(model: string): string | null {
  try {
    const map = JSON.parse(localStorage.getItem(MODEL_ENGINE_KEY) ?? "{}") as Record<string, string>;
    return map[model] ?? null;
  } catch {
    return null;
  }
}

export function setModelEngine(model: string, url: string | null) {
  const map = JSON.parse(localStorage.getItem(MODEL_ENGINE_KEY) ?? "{}") as Record<string, string>;
  if (url) map[model] = url;
  else delete map[model];
  localStorage.setItem(MODEL_ENGINE_KEY, JSON.stringify(map));
}

/** Engines in the order to try for a model: chosen engine first, then the other enabled ones. */
export function enginesFor(model: string): string[] {
  const all = enabledEngines().map((e) => e.url);
  const chosen = modelEngine(model);
  if (chosen) return [chosen, ...all.filter((u) => u !== chosen)];
  return all;
}

/** Check that an engine answers; returns model count or throws. */
export async function testEngine(url: string): Promise<string> {
  const started = performance.now();
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(normalizeHost(url) + "/api/tags", { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { models?: unknown[] };
    return `${data.models?.length ?? 0} نموذج · ${Math.round(performance.now() - started)}ms`;
  } finally {
    clearTimeout(t);
  }
}

/** Is a permission (by its value, e.g. "powershell") enabled in the security table? */
export function isPermitted(value: string, fallback = true): boolean {
  const rows = readRows(SECURITY_KEY);
  const row = rows?.find((r) => r.value === value);
  return row ? row.enabled : fallback;
}
