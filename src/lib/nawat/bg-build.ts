/** Background team build: runs outside any page so builds continue while the user navigates. */
import { callConfiguredBridge } from "@/lib/nawat/bridge-config";
import { writeProjectFile } from "@/lib/nawat/projects";

export type BgRole = { role: string; model: string; task: string; status: "wait" | "run" | "done" | "fail"; output?: string };
export type BgBuild = { project: string; goal: string; running: boolean; roles: BgRole[]; started: number; finished?: number };
export type BgBuilder = { id: string; file: string; lang: string; model: string };

const KEY = "nawat.bg-build.v1";
let state: BgBuild | null = null;
const subs = new Set<(s: BgBuild | null) => void>();

function emit() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* */ }
  subs.forEach((f) => f(state));
  window.dispatchEvent(new CustomEvent("nawat:bg-build", { detail: state }));
}
export function getBgBuild(): BgBuild | null {
  if (state) return state;
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? "null") as BgBuild | null;
    // A build interrupted by a page reload cannot resume; mark running steps as stopped.
    if (s?.running) { s.running = false; s.roles = s.roles.map((r) => (r.status === "run" || r.status === "wait" ? { ...r, status: "fail", output: "interrupted" } : r)); }
    state = s;
  } catch { state = null; }
  return state;
}
export function subscribeBgBuild(f: (s: BgBuild | null) => void) { subs.add(f); return () => { subs.delete(f); }; }

const stripFence = (t: string) => (t.match(/```[\w-]*[^\n]*\n([\s\S]*?)```/)?.[1] ?? t).trim();
async function ask(model: string, system: string, user: string) {
  const d = (await callConfiguredBridge("chat", { model, stream: false, messages: [{ role: "system", content: system }, { role: "user", content: user }] })) as { message?: { content?: string } };
  return d.message?.content ?? "";
}

export function startBgBuild(o: { project: string; goal: string; builders: BgBuilder[]; coordinator: string; debugger: string; reviewer: string }) {
  if (state?.running) return false;
  const { builders, project, goal } = o;
  const list = builders.map((b) => b.file).join(", ");
  state = {
    project, goal, running: true, started: Date.now(),
    roles: [
      { role: "coordinator", model: o.coordinator, task: "Contracts between files", status: "run" },
      ...builders.map((b) => ({ role: b.id, model: b.model, task: b.file, status: "wait" as const })),
      { role: "debugger", model: o.debugger, task: "Fix files in place", status: "wait" },
      { role: "reviewer", model: o.reviewer, task: "Quality review", status: "wait" },
    ],
  };
  emit();
  const upd = (i: number, p: Partial<BgRole>) => { if (!state) return; state = { ...state, roles: state.roles.map((r, j) => (j === i ? { ...r, ...p } : r)) }; emit(); };
  const live = (text: string, model: string) => window.dispatchEvent(new CustomEvent("nawat:stream", { detail: { text, model, started: Date.now(), done: true } }));
  void (async () => {
    try {
      const spec = await ask(o.coordinator,
        `You are the coordinator. Write a short shared spec: sections, ids/classes, functions, tables, routes, so these files match: ${list}. index.html must link the CSS in <head> and the script before </body>. No code.`, goal);
      upd(0, { status: "done", output: spec });
      const files: Record<string, string> = {};
      await Promise.all(builders.map(async (b, k) => {
        const i = k + 1; upd(i, { status: "run" });
        try {
          const out = await ask(b.model, `You are a ${b.lang} specialist only. Write the full content of ${b.file} in one code block, no explanation. Project files: ${list} — link them correctly. Never put real secrets.`, `Goal: ${goal}\nSpec:\n${spec}`);
          files[b.file] = stripFence(out);
          await writeProjectFile(project, b.file, files[b.file]!);
          live(files[b.file]!, b.model);
          upd(i, { status: "done", output: files[b.file] });
        } catch (e) { upd(i, { status: "fail", output: (e as Error).message }); }
      }));
      const di = builders.length + 1; upd(di, { status: "run" });
      const all = Object.entries(files).map(([f, c]) => `--- ${f}\n${c}`).join("\n\n");
      for (const [f, c] of Object.entries(files)) {
        const fixed = stripFence(await ask(o.debugger, `You are the debugger. Fix errors and mismatches in ${f} against the other files. Return the full file in one code block.`, `${all}\n\nTarget: ${f}\n${c}`));
        if (fixed.length > 20) { await writeProjectFile(project, f, fixed); files[f] = fixed; live(fixed, o.debugger); }
      }
      upd(di, { status: "done", output: "Fixed: " + Object.keys(files).join(", ") });
      upd(di + 1, { status: "run" });
      const review = await ask(o.reviewer, "You are the reviewer. Score quality out of 10 and list the top 5 notes briefly.", Object.entries(files).map(([f, c]) => `--- ${f}\n${c}`).join("\n\n"));
      upd(di + 1, { status: "done", output: review });
    } catch (e) {
      if (state) state = { ...state, roles: state.roles.map((r) => (r.status === "run" ? { ...r, status: "fail", output: (e as Error).message } : r)) };
    }
    if (state) { state = { ...state, running: false, finished: Date.now() }; emit(); }
  })();
  return true;
}
