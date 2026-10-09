import { useCallback, useEffect, useSyncExternalStore } from "react";
import { listModels, listRunning, type OllamaModel, type RunningModel } from "./bridge";
import { developmentModels, officialModels, providerModels, subscribeProviders } from "./providers";
import { discoverLocalModels, getDiscovered } from "./local-discovery";

function availableModels(discovered: OllamaModel[] = []) {
  const models = [
    ...officialModels,
    ...developmentModels(),
    ...providerModels(),
    ...getDiscovered(),
    ...discovered,
  ];
  return [...new Map(models.map((model) => [model.name, model])).values()];
}

let lastScan = 0;
function autoScan() {
  if (Date.now() - lastScan < 30_000) return;
  lastScan = Date.now();
  void discoverLocalModels().then(() => emit({ ...snapshot, models: availableModels(snapshot.models) }));
}

type ModelsSnapshot = {
  models: OllamaModel[];
  running: RunningModel[];
  error: string | null;
  loading: boolean;
};

const officialRunning = officialModels.map((model) => ({ name: model.name, size: model.size }));
let snapshot: ModelsSnapshot = {
  models: officialModels,
  running: officialRunning,
  error: null,
  loading: true,
};
const listeners = new Set<() => void>();
let pollTimer: ReturnType<typeof setInterval> | null = null;
let providerUnsubscribe: (() => void) | null = null;
let refreshInFlight: Promise<void> | null = null;

function emit(next: ModelsSnapshot) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

async function refreshModels() {
  if (refreshInFlight) return refreshInFlight;
  autoScan();
  refreshInFlight = (async () => {
    try {
      const [models, running] = await Promise.all([listModels(), listRunning()]);
      emit({
        models: availableModels(models),
        running: [
          ...officialRunning,
          ...running.filter((item) => !officialModels.some((model) => model.name === item.name)),
        ],
        error: null,
        loading: false,
      });
    } catch (error) {
      emit({
        models: availableModels(),
        running: officialRunning,
        error: (error as Error).message,
        loading: false,
      });
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    void refreshModels();
    pollTimer = setInterval(() => {
      if (document.visibilityState === "visible") void refreshModels();
    }, 10_000);
    providerUnsubscribe = subscribeProviders(() =>
      emit({ ...snapshot, models: availableModels() }),
    );
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = null;
      providerUnsubscribe?.();
      providerUnsubscribe = null;
    }
  };
}

export function useModels(_pollMs = 8000) {
  const state = useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => snapshot,
  );
  const refresh = useCallback(() => refreshModels(), []);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshModels();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  return { ...state, refresh };
}
