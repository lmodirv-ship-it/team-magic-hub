import { useSyncExternalStore } from "react";

/** إعدادات الخادم التي يغيّرها المستخدم من التطبيق — تُحفظ فورًا وتبقى حتى يغيّرها. */
export type ComfyInstance = { id: string; name: string; url: string; task: string };

export type ServerSettings = {
  ollamaFallbacks: string[];
  comfyUrl: string;
  /** نسخ ComfyUI متعددة (منفذ لكل مهمة) — comfyUrl يبقى النسخة النشطة */
  comfyInstances: ComfyInstance[];
  modelStoragePath: string;
  updatedAt: string;
};

export type SettingsLogEntry = { at: string; key: string; value: string };

const KEY = "nawat.server.settings.v1";
const LOG_KEY = "nawat.settings.log.v1";

export const DEFAULT_SERVER_SETTINGS: ServerSettings = {
  ollamaFallbacks: ["http://192.168.2.4:11434"],
  comfyUrl: "http://192.168.2.4:8188",
  comfyInstances: [
    { id: "c1", name: "ComfyUI 1", url: "http://192.168.2.4:8188", task: "عام" },
    { id: "c-hn", name: "ComfyUI السيرفر العام", url: "http://213.156.132.166/comfy/ui/1", task: "عام" },
    { id: "c-local", name: "ComfyUI حاسوبي", url: "http://127.0.0.1:8188", task: "إنتاج سريع" },
  ],
  modelStoragePath: "/data/model",
  updatedAt: "",
};

let current: ServerSettings = DEFAULT_SERVER_SETTINGS;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<ServerSettings> | null;
    if (raw) current = {
      ...DEFAULT_SERVER_SETTINGS,
      ...raw,
      ollamaFallbacks: Array.isArray(raw.ollamaFallbacks) ? raw.ollamaFallbacks.map(String) : DEFAULT_SERVER_SETTINGS.ollamaFallbacks,
      comfyInstances: Array.isArray(raw.comfyInstances) && raw.comfyInstances.length
        ? raw.comfyInstances
        : [{ id: "c1", name: "ComfyUI 1", url: raw.comfyUrl ?? DEFAULT_SERVER_SETTINGS.comfyUrl, task: "عام" }],
    };
  } catch { /* defaults */ }
  window.addEventListener("storage", (e) => { if (e.key === KEY) { loaded = false; load(); listeners.forEach((l) => l()); } });
}

/** يسجّل كل تغيير في سجل محلي (آخر 200 تغيير). */
export function logSettingChange(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    const log = JSON.parse(localStorage.getItem(LOG_KEY) ?? "[]") as SettingsLogEntry[];
    log.unshift({ at: new Date().toISOString(), key, value: typeof value === "string" ? value : JSON.stringify(value) });
    localStorage.setItem(LOG_KEY, JSON.stringify(log.slice(0, 200)));
  } catch { /* storage full */ }
}

export function getSettingsLog(): SettingsLogEntry[] {
  try { return JSON.parse(localStorage.getItem(LOG_KEY) ?? "[]") as SettingsLogEntry[]; } catch { return []; }
}

export function updateServerSettings(patch: Partial<ServerSettings>) {
  load();
  current = { ...current, ...patch, updatedAt: new Date().toISOString() };
  try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* full */ }
  for (const [k, v] of Object.entries(patch)) logSettingChange(`server.${k}`, v);
  listeners.forEach((l) => l());
}

export function getServerSettings(): ServerSettings { load(); return current; }

export function useServerSettings(): ServerSettings {
  return useSyncExternalStore(
    (l) => { load(); listeners.add(l); return () => { listeners.delete(l); }; },
    () => { load(); return current; },
    () => DEFAULT_SERVER_SETTINGS,
  );
}

/** نص ملف البيئة الجاهز للسيرفر (bridge/server.mjs). */
export function serverEnvSnippet(s: ServerSettings) {
  return [`OLLAMA_FALLBACKS=${s.ollamaFallbacks.join(",")}`, `COMFY_URL=${s.comfyUrl}`, `MODEL_STORAGE_PATH=${s.modelStoragePath}`].join("\n");
}
