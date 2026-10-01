import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage } from "./bridge";
import { modelChatStream } from "./providers";

export type RunStatus = "idle" | "queued" | "streaming" | "done" | "error" | "stopped";

export type ModelRun = {
  model: string;
  status: RunStatus;
  output: string;
  error: string | null;
  startedAt: number | null;
  endedAt: number | null;
  saved: boolean;
};

export type AtelierState = {
  runs: Record<string, ModelRun>;
  prompt: string;
  system: string;
  running: boolean;
  startedAt: number | null;
};

const emptyRun = (model: string): ModelRun => ({
  model,
  status: "queued",
  output: "",
  error: null,
  startedAt: null,
  endedAt: null,
  saved: false,
});

export function elapsedOf(run: ModelRun, now: number) {
  if (!run.startedAt) return 0;
  return (run.endedAt ?? now) - run.startedAt;
}

export function formatDuration(ms: number) {
  if (ms <= 0) return "0.0s";
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return `${m}m ${s}s`;
}

/** Runs one prompt against many models in parallel, each with its own stream. */
export function useAtelier() {
  const [state, setState] = useState<AtelierState>({
    runs: {},
    prompt: "",
    system: "",
    running: false,
    startedAt: null,
  });
  const controllers = useRef(new Map<string, AbortController>());
  const [tick, setTick] = useState(0);

  // Live chronometer while anything streams.
  useEffect(() => {
    if (!state.running) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 100);
    return () => window.clearInterval(id);
  }, [state.running]);

  const patch = useCallback((model: string, next: Partial<ModelRun>) => {
    setState((s) => {
      const current = s.runs[model];
      if (!current) return s;
      const runs = { ...s.runs, [model]: { ...current, ...next } };
      const running = Object.values(runs).some(
        (r) => r.status === "queued" || r.status === "streaming",
      );
      return { ...s, runs, running };
    });
  }, []);

  const stop = useCallback(
    (model: string) => {
      controllers.current.get(model)?.abort();
      controllers.current.delete(model);
      patch(model, { status: "stopped", endedAt: Date.now() });
    },
    [patch],
  );

  const stopAll = useCallback(() => {
    controllers.current.forEach((c) => c.abort());
    controllers.current.clear();
    setState((s) => ({
      ...s,
      running: false,
      runs: Object.fromEntries(
        Object.entries(s.runs).map(([k, r]) => [
          k,
          r.status === "streaming" || r.status === "queued"
            ? { ...r, status: "stopped" as RunStatus, endedAt: Date.now() }
            : r,
        ]),
      ),
    }));
  }, []);

  const run = useCallback(
    (models: string[], prompt: string, system: string) => {
      controllers.current.forEach((c) => c.abort());
      controllers.current.clear();

      setState({
        prompt,
        system,
        running: models.length > 0,
        startedAt: Date.now(),
        runs: Object.fromEntries(models.map((m) => [m, emptyRun(m)])),
      });

      models.forEach((model) => {
        const controller = new AbortController();
        controllers.current.set(model, controller);

        void (async () => {
          const messages: ChatMessage[] = [
            ...(system.trim() ? [{ role: "system" as const, content: system.trim() }] : []),
            { role: "user" as const, content: prompt },
          ];
          patch(model, { status: "streaming", startedAt: Date.now() });
          try {
            for await (const chunk of modelChatStream(model, messages, controller.signal)) {
              setState((s) => {
                const current = s.runs[model];
                if (!current || current.status !== "streaming") return s;
                return {
                  ...s,
                  runs: { ...s.runs, [model]: { ...current, output: current.output + chunk } },
                };
              });
            }
            patch(model, { status: "done", endedAt: Date.now() });
          } catch (error) {
            if (controller.signal.aborted) return;
            patch(model, {
              status: "error",
              error: (error as Error).message,
              endedAt: Date.now(),
            });
          } finally {
            controllers.current.delete(model);
          }
        })();
      });
    },
    [patch],
  );

  const markSaved = useCallback((model: string) => patch(model, { saved: true }), [patch]);

  const clear = useCallback(() => {
    controllers.current.forEach((c) => c.abort());
    controllers.current.clear();
    setState((s) => ({ ...s, runs: {}, running: false, startedAt: null }));
  }, []);

  useEffect(() => () => controllers.current.forEach((c) => c.abort()), []);

  return { state, run, stop, stopAll, clear, markSaved, tick };
}
