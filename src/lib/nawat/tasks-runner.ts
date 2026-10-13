/** Background task runner for /tasks: lives at module level so runs continue when the page unmounts. */
export type TaskResult = { model: string; output: string; ms: number; done: boolean; at?: string; score?: number };
export type TaskRunState = { results: TaskResult[]; running: boolean; prompt: string };

let state: TaskRunState = { results: [], running: false, prompt: "" };
const subs = new Set<() => void>();

export const getTaskRun = () => state;
export const subscribeTaskRun = (fn: () => void) => {
  subs.add(fn);
  return () => void subs.delete(fn);
};
export function setTaskRun(patch: Partial<TaskRunState> | ((s: TaskRunState) => Partial<TaskRunState>)) {
  state = { ...state, ...(typeof patch === "function" ? patch(state) : patch) };
  subs.forEach((f) => f());
}
export function updateTaskResults(fn: (rs: TaskResult[]) => TaskResult[]) {
  setTaskRun((s) => ({ results: fn(s.results) }));
}

export async function askNotificationPermission() {
  if (typeof Notification === "undefined") return;
  if (Notification.permission === "default") {
    try { await Notification.requestPermission(); } catch { /* ignore */ }
  }
}

export function notifyTask(title: string, body: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("nawat:task-notify", { detail: { title, body } }));
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    try { new Notification(title, { body, icon: "/favicon.ico", tag: "nawat-tasks" }); } catch { /* ignore */ }
  }
}
