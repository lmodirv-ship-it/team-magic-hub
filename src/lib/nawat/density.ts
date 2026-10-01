// ============= Table density control (smaller / default / larger) =============

import { useEffect, useSyncExternalStore } from "react";

export type TableDensity = "compact" | "default" | "large";

const KEY = "nawat.tableDensity.v1";

let current: TableDensity = read();
const listeners = new Set<() => void>();

function read(): TableDensity {
  if (typeof window === "undefined") return "default";
  const raw = window.localStorage.getItem(KEY);
  return raw === "compact" || raw === "large" ? raw : "default";
}

function apply(density: TableDensity) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset["tableDensity"] = density;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setTableDensity(density: TableDensity) {
  current = density;
  try {
    window.localStorage.setItem(KEY, density);
  } catch {
    /* storage unavailable — keep in-memory value */
  }
  apply(density);
  listeners.forEach((l) => l());
}

export function useTableDensity(): TableDensity {
  const density = useSyncExternalStore(
    subscribe,
    () => current,
    () => "default" as TableDensity,
  );
  useEffect(() => { apply(density); }, [density]);
  return density;
}
