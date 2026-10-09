// اكتشاف تلقائي لنماذج Ollama المحلية على الحاسوب والسيرفرات — أضف ولا تحذف.
import type { OllamaModel } from "./bridge";
import { enabledEngines, modelEngine, setModelEngine } from "./engines";

export const DEFAULT_LOCAL_HOSTS = [
  "http://localhost:11434",
  "http://127.0.0.1:11434",
  "http://192.168.100.67:11434",
  "http://192.168.2.4:11434",
];

const KEY = "nawat.localModels.v1";

export type DiscoveredModel = OllamaModel & { host: string };

export function getDiscovered(): DiscoveredModel[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as DiscoveredModel[];
  } catch {
    return [];
  }
}

async function tags(host: string): Promise<DiscoveredModel[]> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 3000);
  try {
    const res = await fetch(host + "/api/tags", { signal: ctrl.signal });
    if (!res.ok) return [];
    const data = (await res.json()) as { models?: OllamaModel[] };
    return (data.models ?? []).map((m) => ({ ...m, host }));
  } catch {
    return [];
  } finally {
    clearTimeout(t);
  }
}

/** يفحص كل العناوين، يضيف النماذج الجديدة تلقائيًا، ويربط كل نموذج بالمحرك الذي وُجد عليه. */
export async function discoverLocalModels(): Promise<DiscoveredModel[]> {
  if (typeof window === "undefined") return [];
  const hosts = [...new Set([...enabledEngines().map((e) => e.url), ...DEFAULT_LOCAL_HOSTS])];
  const found = (await Promise.all(hosts.map(tags))).flat();
  const byName = new Map(getDiscovered().map((m) => [m.name, m]));
  for (const m of found) {
    if (!byName.has(m.name)) byName.set(m.name, m);
    if (!modelEngine(m.name)) setModelEngine(m.name, m.host);
  }
  const next = [...byName.values()];
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}
