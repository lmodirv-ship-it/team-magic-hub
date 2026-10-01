import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { journalChanges, writeVerified } from "./safety";


export type Vfs = Record<string, string>;

export type FileMeta = {
  createdAt: string;
  model?: string;
  source?: "atelier" | "chat" | "agent" | "manuel";
  prompt?: string;
  durationMs?: number;
};

export type MetaMap = Record<string, FileMeta>;

const KEY = "nawat.workspace.v1";
const TABS_KEY = "nawat.tabs.v1";
const META_KEY = "nawat.workspace.meta.v1";
const DRAFT_KEY = "nawat.workspace.draft.v1";
export type SaveState = "saved" | "saving" | "error";

/** Fixed workspace roots, always visible in the explorer. */
export const WORKSPACE_ROOTS = [
  { path: "my-app", label: "my-app", hint: "مشروعك" },
  { path: "bibliotheque", label: "bibliotheque", hint: "نتائج الذكاء الاصطناعي" },
  { path: "vision_output", label: "vision_output", hint: "الوسائط" },
  { path: "agents", label: "agents", hint: "سكربتات Python" },
  { path: "models", label: "models", hint: "Ollama" },
  { path: "logs", label: "logs", hint: "الأحداث" },
] as const;

export const LIBRARY_ROOT = "bibliotheque";

const STARTER: Vfs = {
  "my-app/README.md":
    "# NAWAT Workspace\n\nLocal-first workspace. Files live on this machine.\nIn the Electron desktop build this explorer is bound to your real disk.\n",
  "my-app/src/index.html":
    '<!doctype html>\n<html lang="ar" dir="rtl">\n  <head>\n    <meta charset="utf-8" />\n    <title>NAWAT Preview</title>\n    <style>\n      body { font-family: system-ui; background: #0b1220; color: #e2e8f0; display: grid; place-items: center; height: 100vh; margin: 0 }\n      h1 { color: #38bdf8 }\n    </style>\n  </head>\n  <body>\n    <div>\n      <h1>NAWAT Desktop</h1>\n      <p>معاينة مباشرة لصفحات HTML داخل التطبيق.</p>\n    </div>\n  </body>\n</html>\n',
  "my-app/src/main.ts": "export function boot() {\n  console.log('NAWAT boot');\n}\n",
  "my-app/package.json": '{\n  "name": "my-app",\n  "version": "0.1.0"\n}\n',
  "agents/hello_agent.py":
    '"""وكيل NAWAT التجريبي."""\n\n\ndef run(prompt: str) -> str:\n    return f"NAWAT agent: {prompt}"\n',
  "models/README.md":
    "# Ollama\n\nالنماذج المحلية تُدار من صفحة النماذج. هذا المجلد للملاحظات و Modelfiles.\n",
};

export type FileCreatedEvent = { path: string; meta: FileMeta };

type Ctx = {
  vfs: Vfs;
  meta: MetaMap;
  tabs: string[];
  active: string | null;
  saveState: SaveState;
  saveError: string | null;
  saveNow: () => boolean;
  openFile: (p: string) => void;
  closeFile: (p: string) => void;
  setActive: (p: string) => void;
  writeFile: (p: string, c: string, meta?: Partial<FileMeta>) => void;
  createFile: (p: string, content?: string, meta?: Partial<FileMeta>) => void;
  renameFile: (from: string, to: string) => void;
  deleteFile: (p: string) => void;
  reset: () => void;
  /** Bulk import without per-file notifications. */
  importFiles: (files: Record<string, string>) => void;
  /** Subscribe to new-file events (used for toasts). */
  onFileCreated: (cb: (e: FileCreatedEvent) => void) => () => void;
};

// Keep a single context instance across HMR / duplicate module evaluations,
// otherwise the provider and the consumers can end up on different contexts.
const globalScope = globalThis as typeof globalThis & {
  __nawatWorkspaceCtx?: React.Context<Ctx | null>;
};
const WorkspaceCtx: React.Context<Ctx | null> =
  globalScope.__nawatWorkspaceCtx ?? createContext<Ctx | null>(null);
globalScope.__nawatWorkspaceCtx = WorkspaceCtx;

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [vfs, setVfs] = useState<Vfs>(STARTER);
  const [meta, setMeta] = useState<MetaMap>({});
  const [tabs, setTabs] = useState<string[]>([]);
  const [active, setActiveState] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const latestVfs = useRef(vfs);
  latestVfs.current = vfs;
  const listeners = useRef(new Set<(e: FileCreatedEvent) => void>());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
       const draft = localStorage.getItem(DRAFT_KEY);
       const persisted = raw ? (JSON.parse(raw) as Vfs) : {};
       setVfs({ ...STARTER, ...persisted, ...(draft ? (JSON.parse(draft) as Vfs) : {}) });
      const m = localStorage.getItem(META_KEY);
      if (m) setMeta(JSON.parse(m) as MetaMap);
      const t = localStorage.getItem(TABS_KEY);
      if (t) {
        const parsed = JSON.parse(t) as { tabs: string[]; active: string | null };
        setTabs(parsed.tabs ?? []);
        setActiveState(parsed.active ?? null);
      } else {
        setTabs(["my-app/src/index.html"]);
        setActiveState("my-app/src/index.html");
      }
    } catch {
      setSaveState("error");
      setSaveError("تعذّرت قراءة ملفات مساحة العمل المحفوظة");
    }
    setHydrated(true);
  }, []);

  const saveNow = useCallback(() => {
    try {
      const t0 = performance.now();
      try {
        const prev = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Vfs;
        journalChanges(prev, latestVfs.current);
      } catch { /* السجل اختياري */ }
      writeVerified(KEY, JSON.stringify(latestVfs.current));
      void import("./metrics").then((m) => m.record("حفظ", performance.now() - t0));
      localStorage.removeItem(DRAFT_KEY);
      setSaveState("saved");
      setSaveError(null);
      return true;
    } catch {
      setSaveState("error");
      setSaveError("فشل الحفظ: مساحة التخزين ممتلئة أو غير متاحة. انسخ تعديلاتك قبل إغلاق الصفحة.");
      return false;
    }
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    setSaveState("saving");
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(vfs));
    } catch {
      setSaveState("error");
      setSaveError("تعذّر حفظ مسودة الطوارئ؛ انسخ تعديلاتك قبل إغلاق الصفحة.");
      return;
    }
    const id = window.setTimeout(saveNow, 250);
    return () => window.clearTimeout(id);
  }, [vfs, hydrated, saveNow]);
  useEffect(() => {
    if (!hydrated) return;
    const id = window.setTimeout(() => {
      try { localStorage.setItem(META_KEY, JSON.stringify(meta)); }
      catch { setSaveState("error"); setSaveError("تعذّر حفظ بيانات الملفات"); }
    }, 250);
    return () => window.clearTimeout(id);
  }, [meta, hydrated]);
  useEffect(() => {
    if (hydrated) {
      try { localStorage.setItem(TABS_KEY, JSON.stringify({ tabs, active })); }
      catch { setSaveState("error"); setSaveError("تعذّر حفظ جلسة التبويبات"); }
    }
  }, [tabs, active, hydrated]);

  const emitCreated = useCallback((path: string, fileMeta: FileMeta) => {
    listeners.current.forEach((cb) => cb({ path, meta: fileMeta }));
  }, []);

  const openFile = useCallback((p: string) => {
    setTabs((t) => (t.includes(p) ? t : [...t, p]));
    setActiveState(p);
  }, []);

  const closeFile = useCallback((p: string) => {
    setTabs((t) => {
      const next = t.filter((x) => x !== p);
      setActiveState((a) => (a === p ? (next[next.length - 1] ?? null) : a));
      return next;
    });
  }, []);

  const registerMeta = useCallback((p: string, patch?: Partial<FileMeta>) => {
    const entry: FileMeta = {
      createdAt: new Date().toISOString(),
      source: "manuel",
      ...patch,
    };
    setMeta((m) => ({ ...m, [p]: { ...entry, ...m[p], ...patch } }));
    return entry;
  }, []);

  const writeFile = useCallback(
    (p: string, c: string, patch?: Partial<FileMeta>) => {
      let isNew = false;
      setVfs((v) => {
        isNew = v[p] === undefined;
        return { ...v, [p]: c };
      });
      const entry = registerMeta(p, patch);
      if (isNew) emitCreated(p, entry);
    },
    [emitCreated, registerMeta],
  );

  const createFile = useCallback(
    (p: string, content = "", patch?: Partial<FileMeta>) => {
      let isNew = false;
      setVfs((v) => {
        if (v[p] !== undefined) return v;
        isNew = true;
        return { ...v, [p]: content };
      });
      setTabs((t) => (t.includes(p) ? t : [...t, p]));
      setActiveState(p);
      const entry = registerMeta(p, patch);
      if (isNew) emitCreated(p, entry);
    },
    [emitCreated, registerMeta],
  );

  const importFiles = useCallback((files: Record<string, string>) => {
    const now = new Date().toISOString();
    setVfs((v) => ({ ...v, ...files }));
    setMeta((m) => {
      const next = { ...m };
      for (const p of Object.keys(files)) next[p] = { createdAt: now, source: "manuel", ...m[p] };
      return next;
    });
  }, []);

  const renameFile = useCallback((from: string, to: string) => {
    setVfs((v) => {
      if (v[from] === undefined) return v;
      const next = { ...v, [to]: v[from] };
      delete next[from];
      return next;
    });
    setMeta((m) => {
      if (!m[from]) return m;
      const next = { ...m, [to]: m[from] };
      delete next[from];
      return next;
    });
    setTabs((t) => t.map((x) => (x === from ? to : x)));
    setActiveState((a) => (a === from ? to : a));
  }, []);

  const deleteFile = useCallback(
    (p: string) => {
      setVfs((v) => {
        const next = { ...v };
        delete next[p];
        return next;
      });
      setMeta((m) => {
        const next = { ...m };
        delete next[p];
        return next;
      });
      closeFile(p);
    },
    [closeFile],
  );

  const reset = useCallback(() => {
    setVfs(STARTER);
    setMeta({});
    setTabs(["my-app/src/index.html"]);
    setActiveState("my-app/src/index.html");
  }, []);

  const onFileCreated = useCallback((cb: (e: FileCreatedEvent) => void) => {
    listeners.current.add(cb);
    return () => {
      listeners.current.delete(cb);
    };
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      vfs,
      meta,
      tabs,
      active,
      saveState,
      saveError,
      saveNow,
      openFile,
      closeFile,
      setActive: setActiveState,
      writeFile,
      createFile,
      renameFile,
      deleteFile,
      reset,
      importFiles,
      onFileCreated,
    }),
    [
      vfs,
      meta,
      tabs,
      active,
      saveState,
      saveError,
      saveNow,
      openFile,
      closeFile,
      writeFile,
      createFile,
      renameFile,
      deleteFile,
      reset,
      importFiles,
      onFileCreated,
    ],
  );

  return <WorkspaceCtx.Provider value={value}>{children}</WorkspaceCtx.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceCtx);
  if (!ctx) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return ctx;
}

export function languageOf(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "ts":
      return "typescript";
    case "tsx":
      return "typescript";
    case "js":
    case "cjs":
    case "mjs":
      return "javascript";
    case "jsx":
      return "javascript";
    case "json":
      return "json";
    case "css":
      return "css";
    case "scss":
      return "scss";
    case "html":
      return "html";
    case "md":
      return "markdown";
    case "py":
      return "python";
    case "rs":
      return "rust";
    case "sh":
      return "shell";
    case "yml":
    case "yaml":
      return "yaml";
    default:
      return "plaintext";
  }
}

export type PreviewKind =
  "html" | "markdown" | "json" | "image" | "video" | "audio" | "pdf" | "log" | "zip" | "code";

export function previewKindOf(path: string): PreviewKind {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "html" || ext === "htm") return "html";
  if (ext === "md" || ext === "markdown") return "markdown";
  if (ext === "json") return "json";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "avif", "bmp"].includes(ext)) return "image";
  if (["mp4", "webm", "mov", "ogv"].includes(ext)) return "video";
  if (["mp3", "wav", "ogg", "m4a"].includes(ext)) return "audio";
  if (ext === "pdf") return "pdf";
  if (ext === "log" || ext === "txt") return "log";
  if (ext === "zip") return "zip";
  return "code";
}

/** Slug-safe filename fragment for a model name. */
export function slugifyModel(model: string) {
  return model.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
}
