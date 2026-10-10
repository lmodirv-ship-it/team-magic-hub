import { chatStream, EngineUnreachable, type ChatMessage, type OllamaModel } from "./bridge";

export type ProviderKind = "openai-compatible";

export type ProviderConfig = {
  id: string;
  name: string;
  kind: ProviderKind;
  baseUrl: string;
  models: string[];
  connected: boolean;
  updatedAt: string;
  /** Models the user activated; undefined keeps the legacy "all models active". */
  enabled?: string[];
};

/** Ready-made cloud providers (OpenAI-compatible). Local Ollama/NAWAT stay primary. */
export const PROVIDER_PRESETS: Array<{ id: string; name: string; baseUrl: string }> = [
  { id: "openrouter", name: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1" },
  { id: "openai", name: "OpenAI", baseUrl: "https://api.openai.com/v1" },
  { id: "deepseek", name: "DeepSeek", baseUrl: "https://api.deepseek.com/v1" },
  { id: "groq", name: "Groq", baseUrl: "https://api.groq.com/openai/v1" },
  { id: "mistral", name: "Mistral", baseUrl: "https://api.mistral.ai/v1" },
  { id: "together", name: "Together", baseUrl: "https://api.together.xyz/v1" },
  { id: "gemini", name: "Google Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai" },
  { id: "xai", name: "xAI Grok", baseUrl: "https://api.x.ai/v1" },
];

export function activeProviderModels(provider: ProviderConfig): string[] {
  return provider.enabled ? provider.models.filter((m) => provider.enabled!.includes(m)) : provider.models;
}

export function setProviderModelEnabled(id: string, model: string, on: boolean) {
  const p = getProviders().find((x) => x.id === id);
  if (!p) return;
  const cur = new Set(activeProviderModels(p));
  if (on) cur.add(model); else cur.delete(model);
  saveProvider({ ...p, enabled: p.models.filter((m) => cur.has(m)) });
}

export type DevelopmentModel = {
  name: string;
  size: number;
  digest: string;
  modifiedAt: string;
};

const PROVIDERS_KEY = "nawat.providers.v1";
const DEVELOPMENT_MODELS_KEY = "nawat.developmentModels.v1";
const CHANGE_EVENT = "nawat:providers-changed";

function official(
  name: string,
  size: number,
  digest: string,
  description: string,
  parameter_size?: string,
  quantization_level?: string,
): OllamaModel {
  return {
    name,
    model: name,
    size,
    digest,
    modified_at: "official",
    description,
    details: {
      ...(parameter_size ? { parameter_size } : {}),
      ...(quantization_level ? { quantization_level } : {}),
    },
    providerId: "groupe-hn",
    official: true,
  };
}

export const officialModels: OllamaModel[] = [
  official("nawat-coder:latest", 4_700_000_000, "ae1a56a1ffcd", "البرمجة: كتابة الأكواد، تصحيح الأخطاء، /draw — القاعدة qwen2.5-coder."),
  official("nawat-chat:latest", 4_700_000_000, "dc3a7aa96300", "محادثة عامة (الافتراضي): أسئلة، كتابة نصوص، تخطيط — القاعدة gemma4."),
  official("nawat-vision", 3_300_000_000, "b7e1c09a44d2", "العين: وصف عربي للصور واستخراج النصوص (OCR)."),
  official("nawat-vision:latest", 3_300_000_000, "b7e1c09a44d3", "العين — أحدث إصدار."),
  official("nawat-embed:latest", 274_000_000, "0a8c33e91f10", "تضمين عربي للبحث الدلالي وقواعد المتجهات — ليس للمحادثة."),
  official("embed-text:latest", 274_000_000, "0a8c33e91f11", "القاعدة الخام للتضمين."),
  official("nawat-whisper", 1_500_000_000, "f41d2b7c8e05", "تحويل الكلام إلى نص (Speech-to-Text)."),
  official("nawat-tri:1.5b-r1", 3_100_000_000, "3ac40249eb52", "الجولة الأولى من التدريب — نموذج صغير سريع.", "1.5B"),
  official("nawat-tri:1.5b-r2", 3_100_000_000, "3ac40249eb53", "الأحدث — التدريب الموحد (eval_loss 0.24).", "1.5B"),
  official("nawat-coder:7b-q4", 4_400_000_000, "9d27e6a0c1b8", "نموذج البرمجة 7B مضغوط q4 — توازن بين الأداء وموارد RAM/VRAM.", "7B", "Q4"),
  // من ollama list على جهاز المستخدم (2026-09-30)
  official("nawat-think:1.5b-r14", 3_100_000_000, "2fe4e96b87b4", "التفكير والاستدلال — الجولة 14.", "1.5B"),
  official("nawat-think:1.5b-r7", 3_100_000_000, "c5b535717c17", "التفكير والاستدلال — الجولة 7.", "1.5B"),
  official("nawat-build:1.5b-r13", 3_100_000_000, "47cdaffe3366", "بناء المشاريع بالعربية — الجولة 13.", "1.5B"),
  official("nawat-coder:1.5b-r6", 3_100_000_000, "6ff7bc6417b7", "برمجة سريعة — الجولة 6.", "1.5B"),
  official("nawat-mm:1.5b-r5", 3_100_000_000, "1d729923ffb5", "متعدد الوسائط — الجولة 5.", "1.5B"),
  official("nawat-shell:1.5b-r12", 3_100_000_000, "56603e12924a", "أوامر الطرفية — الجولة 12.", "1.5B"),
  official("nawat-shell:1.5b-r11", 3_100_000_000, "1b60d3bc06f2", "أوامر الطرفية — الجولة 11.", "1.5B"),
  official("nawat-shell:1.5b-r10", 3_100_000_000, "0c9dede8faea", "أوامر الطرفية — الجولة 10.", "1.5B"),
  official("nawat-agent:1.5b-r9", 3_100_000_000, "841e75f27442", "الوكيل — الجولة 9.", "1.5B"),
  official("nawat-agent:1.5b-r8", 3_100_000_000, "062c0b1f3ab1", "الوكيل — الجولة 8.", "1.5B"),
  official("nawat-tools:1.5b-r4", 3_100_000_000, "5985738a0cdb", "استدعاء الأدوات — الجولة 4.", "1.5B"),
  official("nawat-data:1.5b-r3", 3_100_000_000, "769d56497d70", "تحليل البيانات — الجولة 3.", "1.5B"),
  official("nomic-embed-text:latest", 274_000_000, "0a109f422b47", "تضمين نصوص (nomic) للبحث الدلالي."),
  official("qwen2.5-coder:7b", 4_700_000_000, "dae161e27b0e", "Qwen 2.5 Coder 7B — برمجة.", "7B"),
  official("qwen2.5vl:3b", 3_200_000_000, "fb90415cde1e", "Qwen 2.5 VL — رؤية وصور.", "3B"),
  official("qwen3.5:latest", 6_600_000_000, "6488c96fa5fa", "Qwen 3.5 — عام."),
  official("qwen:latest", 2_300_000_000, "d53d04290064", "Qwen — عام خفيف."),
  official("gemma3:4b", 3_300_000_000, "a2af6cc3eb7f", "Gemma 3 4B — محادثة عامة.", "4B"),
  official("ornith-1.5:9b", 6_600_000_000, "e5df7dcdd8a2", "Ornith 1.5 — 9B.", "9B"),
  official("nemotron3:33b", 27_000_000_000, "f6d8b7ff496c", "Nemotron 3 — 33B ثقيل (يحتاج ذاكرة كبيرة).", "33B"),
  official("batiai/nemotron3-nano-omni-text:iq4", 17_000_000_000, "4bcf36cc7080", "Nemotron 3 Nano Omni — IQ4.", undefined, "IQ4"),
  // مجموعة 2026-10-03 من السيرفر
  official("nawat-think:r19", 7_500_000_000, "r19think0001", "التفكير — الجولة 19 (الأحدث والأكبر)."),
  official("nawat-coder-v16:latest", 2_330_000_000, "v16coder0001", "برمجة — الإصدار 16."),
  official("nawat-think:v17-anon", 2_330_000_000, "v17anon00001", "التفكير — v17 مجهّل البيانات."),
  official("nawat-think:v17-tri-r2", 2_330_000_000, "v17trir20001", "التفكير — v17 مع تدريب tri-r2."),
  official("nawat-think:v16-coder", 2_330_000_000, "v16thcoder01", "التفكير — v16 بتخصص برمجي."),
  official("nawat-think:v16-tri-r1", 2_330_000_000, "v16trir10001", "التفكير — v16 مع tri-r1."),
  official("nawat-think:v15-mini", 2_330_000_000, "v15mini00001", "التفكير — v15 مصغّر."),
  official("nawat-mini:0.5b-v16", 2_330_000_000, "mini05bv1601", "مصغّر فائق السرعة — v16.", "0.5B"),
  official("nawat-mini:0.5b", 2_330_000_000, "mini05b00001", "مصغّر فائق السرعة.", "0.5B"),
  official("qwen3.5:9b", 6_140_000_000, "qwen35p9b001", "Qwen 3.5 — 9B.", "9B"),
];

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    return JSON.parse(localStorage.getItem(key) ?? "") as T;
  } catch {
    return fallback;
  }
}

function notify() {
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function getProviders(): ProviderConfig[] {
  return readJson<ProviderConfig[]>(PROVIDERS_KEY, []);
}

export function saveProvider(provider: ProviderConfig, apiKey?: string) {
  const providers = getProviders();
  const next = [...providers.filter((item) => item.id !== provider.id), provider];
  localStorage.setItem(PROVIDERS_KEY, JSON.stringify(next));
  if (apiKey) {
    sessionStorage.setItem(`nawat.providerKey.${provider.id}`, apiKey);
    localStorage.setItem(`nawat.providerKey.${provider.id}`, apiKey);
  }
  notify();
}

export function removeProvider(id: string) {
  localStorage.setItem(
    PROVIDERS_KEY,
    JSON.stringify(getProviders().filter((item) => item.id !== id)),
  );
  sessionStorage.removeItem(`nawat.providerKey.${id}`);
  localStorage.removeItem(`nawat.providerKey.${id}`);
  notify();
}

export function getDevelopmentModels(): DevelopmentModel[] {
  return readJson<DevelopmentModel[]>(DEVELOPMENT_MODELS_KEY, []);
}

export function saveDevelopmentModel(model: DevelopmentModel) {
  const next = [...getDevelopmentModels().filter((item) => item.name !== model.name), model];
  localStorage.setItem(DEVELOPMENT_MODELS_KEY, JSON.stringify(next));
  notify();
}

export function removeDevelopmentModel(name: string) {
  localStorage.setItem(
    DEVELOPMENT_MODELS_KEY,
    JSON.stringify(getDevelopmentModels().filter((item) => item.name !== name)),
  );
  notify();
}

export function subscribeProviders(listener: () => void) {
  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

function normalizedBaseUrl(baseUrl: string) {
  return baseUrl.trim().replace(/\/+$/, "");
}

export async function discoverProviderModels(baseUrl: string, apiKey: string): Promise<string[]> {
  const response = await fetch(`${normalizedBaseUrl(baseUrl)}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!response.ok) throw new Error(`فشل الاتصال بالمزوّد (${response.status})`);
  const body = (await response.json()) as { data?: Array<{ id?: string }> };
  return (body.data ?? []).flatMap((item) => (item.id ? [item.id] : []));
}

export function providerModels(): OllamaModel[] {
  return getProviders().flatMap((provider) =>
    activeProviderModels(provider).map((name) => ({
      name,
      model: name,
      size: 0,
      digest: provider.id,
      modified_at: provider.updatedAt,
      providerId: provider.id,
    })),
  );
}

export function developmentModels(): OllamaModel[] {
  return getDevelopmentModels().map((model) => ({
    name: model.name,
    model: model.name,
    size: model.size,
    digest: model.digest,
    modified_at: model.modifiedAt,
    providerId: "groupe-hn",
  }));
}

/** The user's own LAN/local Ollama engines, tried directly for NAWAT native models. */
export const NATIVE_HOSTS = [
  "http://127.0.0.1:11434",
  "http://192.168.100.67:11434",
  "http://192.168.2.4:11434",
];

/** NAWAT models are the user's own: they never need a bridge or an API key. */
export function isNativeNawatModel(model: string): boolean {
  const m = model.toLowerCase();
  return m.startsWith("nawat") || officialModels.some((o) => o.name === model);
}

export function getProviderForModel(model: string) {
  return getProviders().find((provider) => provider.models.includes(model));
}

export async function* modelChatStream(
  model: string,
  messages: ChatMessage[],
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const native = isNativeNawatModel(model);
  const provider = native ? undefined : getProviderForModel(model);
  if (provider) {
    yield* providerChatStream(provider, model, messages, signal);
    return;
  }
  const { getBridgeConfig } = await import("./bridge-config");
  const bridgeMode = getBridgeConfig().mode;
  const secure = typeof location !== "undefined" && location.protocol === "https:";
  // Public mode (or a secure page in auto mode): never touch 192.168.*/localhost.
  // NAWAT native models always go direct to the user's own engines — no bridge, no keys.
  if (!native && (bridgeMode === "public" || (bridgeMode === "auto" && secure))) {
    yield await relayChat(model, messages, signal);
    return;
  }
  const { enginesFor } = await import("./engines");
  const hosts = enginesFor(model);
  if (native) for (const h of NATIVE_HOSTS) if (!hosts.includes(h)) hosts.push(h);
  let lastErr: unknown = null;
  for (const host of hosts) {
    let started = false;
    try {
      for await (const chunk of chatStream(model, messages, signal, host)) {
        started = true;
        yield chunk;
      }
      return;
    } catch (e) {
      if (signal?.aborted || started || !(e instanceof EngineUnreachable)) throw e;
      lastErr = e;
    }
  }
  if (bridgeMode === "auto") {
    yield await relayChat(model, messages, signal);
    return;
  }
  throw lastErr ?? new Error("لا يوجد محرك مفعّل في الإعدادات.");
}

/** Chat through the public relay bridge: submit once, poll the result, no NDJSON streaming. */
async function relayChat(model: string, messages: ChatMessage[], signal?: AbortSignal): Promise<string> {
  const { callConfiguredBridge } = await import("./bridge-config");
  const job = callConfiguredBridge("chat", { model, messages, stream: false }) as Promise<{ message?: { content?: string }; response?: string } | null>;
  const result = await new Promise<Awaited<typeof job>>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("انتهت مهلة الجسر العام (120 ثانية)")), 120_000);
    signal?.addEventListener("abort", () => { clearTimeout(timer); reject(new DOMException("أُلغي الطلب", "AbortError")); }, { once: true });
    job.then((v) => { clearTimeout(timer); resolve(v); }, (e) => { clearTimeout(timer); reject(e); });
  });
  const text = result?.message?.content ?? result?.response ?? "";
  if (!text) throw new Error("ردّ الجسر العام فارغ");
  return text;
}

export async function* providerChatStream(
  provider: ProviderConfig,
  model: string,
  messages: ChatMessage[],
  signal?: AbortSignal,
): AsyncGenerator<string> {
  (await import("./ai-control")).assertAi();
  const apiKey =
    sessionStorage.getItem(`nawat.providerKey.${provider.id}`) ??
    localStorage.getItem(`nawat.providerKey.${provider.id}`);
  if (!apiKey) throw new Error("أعد إدخال مفتاح المزوّد في صفحة المزوّدين لهذه الجلسة.");
  const response = await fetch(`${normalizedBaseUrl(provider.baseUrl)}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, stream: true }),
    ...(signal ? { signal } : {}),
  });
  if (!response.ok || !response.body)
    throw new Error(
      `فشل طلب المزوّد (${response.status}): ${(await response.text()).slice(0, 160)}`,
    );
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const raw of lines) {
      const line = raw.replace(/^data:\s*/, "").trim();
      if (!line || line === "[DONE]") continue;
      try {
        const event = JSON.parse(line) as { choices?: Array<{ delta?: { content?: string } }> };
        const text = event.choices?.[0]?.delta?.content;
        if (text) yield text;
      } catch {
        // Ignore provider keep-alives and incomplete frames.
      }
    }
  }
}
