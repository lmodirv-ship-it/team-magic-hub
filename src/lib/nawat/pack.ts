import { createZip } from "./zip";

export const PACK_VERSION = 1;
export const SETTINGS_KEYS = [
  "nawat.cfg.engines",
  "nawat.cfg.security",
  "nawat.cfg.endpoints",
  "nawat.cfg.devModels",
  "nawat.modelEngine",
  "nawat.helperModels",
  "nawat.ollamaHost",
];
const RECENT_KEY = "nawat.packs.recent";
const UNDO_KEY = "nawat.packs.undo";

export type PackModel = { name: string; size: number; digest: string; modifiedAt: string; role?: string };

export type PackManifest = {
  format: "nawat.pack";
  version: number;
  name: string;
  createdAt: string;
  files: string[];
  settings: Record<string, string>;
  models: PackModel[];
  sha256: string;
};

export type LoadedPack = { manifest: PackManifest; files: Record<string, string>; valid: boolean };

async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const digestInput = (files: Record<string, string>, settings: Record<string, string>, models: PackModel[] = []) =>
  JSON.stringify({ files: Object.keys(files).sort().map((k) => [k, files[k]]), settings, models });

export function readSettings(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of SETTINGS_KEYS) {
    const v = localStorage.getItem(k);
    if (v !== null) out[k] = v;
  }
  return out;
}

export async function buildPack(name: string, files: Record<string, string>, withSettings: boolean, models: PackModel[] = []) {
  const settings = withSettings ? readSettings() : {};
  const manifest: PackManifest = {
    format: "nawat.pack",
    version: PACK_VERSION,
    name,
    createdAt: new Date().toISOString(),
    files: Object.keys(files).sort(),
    settings,
    models,
    sha256: await sha256(digestInput(files, settings, models)),
  };
  const blob = createZip([
    { path: "pack.json", content: JSON.stringify(manifest, null, 2) },
    ...Object.entries(files).map(([p, c]) => ({ path: `files/${p}`, content: c })),
  ]);
  pushRecent({ name, at: manifest.createdAt, files: manifest.files.length, kind: "إنشاء" });
  return { blob, manifest };
}

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function readZip(bytes: Uint8Array): Promise<Record<string, string>> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0 && i > bytes.length - 22 - 65536; i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("ليس ملف حزمة صالحًا.");
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  const out: Record<string, string> = {};
  for (let i = 0; i < count; i++) {
    if (view.getUint32(p, true) !== 0x02014b50) break;
    const method = view.getUint16(p + 10, true);
    const csize = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const local = view.getUint32(p + 42, true);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    const lName = view.getUint16(local + 26, true);
    const lExtra = view.getUint16(local + 28, true);
    const start = local + 30 + lName + lExtra;
    const raw = bytes.subarray(start, start + csize);
    if (!name.endsWith("/")) out[name] = dec.decode(method === 8 ? await inflate(raw) : raw);
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

export async function loadPack(file: File): Promise<LoadedPack> {
  const entries = await readZip(new Uint8Array(await file.arrayBuffer()));
  const raw = entries["pack.json"];
  if (!raw) throw new Error("الحزمة لا تحتوي pack.json.");
  const manifest = JSON.parse(raw) as PackManifest;
  if (manifest.format !== "nawat.pack") throw new Error("صيغة غير معروفة.");
  const files: Record<string, string> = {};
  for (const [k, v] of Object.entries(entries)) if (k.startsWith("files/")) files[k.slice(6)] = v;
  manifest.models = Array.isArray(manifest.models) ? manifest.models : [];
  const valid = (await sha256(digestInput(files, manifest.settings ?? {}, manifest.models))) === manifest.sha256;
  return { manifest, files, valid };
}

/** تسجيل نماذج الحزمة في سجل النماذج التطويرية لتُستدعى عند الطلب */
export function applyModels(models: PackModel[]): number {
  if (!models.length) return 0;
  // استيراد كسول لتفادي دورة الاعتماديات
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const key = "nawat.developmentModels.v1";
  let existing: PackModel[] = [];
  try { existing = JSON.parse(localStorage.getItem(key) ?? "[]") as PackModel[]; } catch { /* تجاهل */ }
  const fresh = models.filter((m) => !existing.some((e) => e.name === m.name));
  if (fresh.length) {
    localStorage.setItem(key, JSON.stringify([...existing, ...fresh]));
    window.dispatchEvent(new Event("nawat:providers-changed"));
  }
  return fresh.length;
}

export function applySettings(settings: Record<string, string>) {
  for (const [k, v] of Object.entries(settings)) if (SETTINGS_KEYS.includes(k)) localStorage.setItem(k, v);
}

export function saveUndo(vfs: Record<string, string>) {
  try {
    localStorage.setItem(UNDO_KEY, JSON.stringify({ vfs, settings: readSettings() }));
  } catch { /* storage full */ }
}

export function readUndo(): { vfs: Record<string, string>; settings: Record<string, string> } | null {
  try { return JSON.parse(localStorage.getItem(UNDO_KEY) ?? "null"); } catch { return null; }
}

export type RecentPack = { name: string; at: string; files: number; kind: string };
export function getRecent(): RecentPack[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") as RecentPack[]; } catch { return []; }
}
export function pushRecent(r: RecentPack) {
  localStorage.setItem(RECENT_KEY, JSON.stringify([r, ...getRecent()].slice(0, 8)));
}

export function packSummary(m: PackManifest) {
  const models = (m.models ?? []).map((x) => x.name).join(", ");
  return `حزمة NAWAT «${m.name}» (${m.createdAt.slice(0, 10)}) — ${m.files.length} ملفًا:\n${m.files.slice(0, 200).join("\n")}\nالنماذج: ${models || "لا شيء"}\nالإعدادات: ${Object.keys(m.settings).join(", ") || "لا شيء"}`;
}
