import { callConfiguredBridge } from "./bridge-config";

/** مشاريع السيرفر: كل مشروع في مجلد مستقل داخل PROJECTS_DIR على السيرفر. */
export type ServerProject = { name: string; updated: string };
export type ProjectFile = { path: string; type: "file" | "dir" };

const call = <T>(payload: Record<string, unknown>) => callConfiguredBridge("projects", payload) as Promise<T>;

export const listProjects = () => call<{ root: string; projects: ServerProject[] }>({ action: "list" });
export const createProject = (name: string, files?: Record<string, string>) =>
  call<{ root: string; files: ProjectFile[] }>({ action: "create", name, files });
export const projectTree = (name: string) => call<{ root: string; files: ProjectFile[] }>({ action: "tree", name });
export const readProjectFile = (name: string, path: string) => call<{ content: string }>({ action: "read", name, path });
export const writeProjectFile = (name: string, path: string, content: string) =>
  call<{ ok: boolean; path: string }>({ action: "write", name, path, content });

const ACTIVE_KEY = "nawat.projects.active";
export const getActiveProject = () => (typeof localStorage === "undefined" ? "" : localStorage.getItem(ACTIVE_KEY) ?? "");
export const setActiveProject = (n: string) => localStorage.setItem(ACTIVE_KEY, n);

/** يستخرج كتل الكود ذات اسم الملف: ```ts path/to/file.ts */
export function extractFiles(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /```[\w-]*[ \t]+([^\s`]+\.[\w]+)[^\n]*\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out[m[1]!.replace(/^\/+/, "")] = m[2]!;
  return out;
}
