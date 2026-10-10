/** Panel open/closed state for /workspace — persisted, merged with defaults, never drops a panel. */
export type PanelKey = "explorer" | "chat" | "term";
export type PanelState = { explorer: boolean; chat: boolean; term: boolean; focus: boolean };

export const PANELS_KEY = "nawat.workspace.panels.v1";

export const DEFAULT_PANELS: PanelState = { explorer: true, chat: true, term: true, focus: false };

const KEYS: readonly (keyof PanelState)[] = ["explorer", "chat", "term", "focus"];

/** A stored list never drops a panel: anything missing or unreadable falls back to the default. */
export function parsePanels(raw: string | null | undefined): PanelState {
  const next: PanelState = { ...DEFAULT_PANELS };
  if (!raw) return next;
  try {
    const stored = JSON.parse(raw) as Partial<PanelState>;
    if (!stored || typeof stored !== "object") return next;
    for (const key of KEYS) if (typeof stored[key] === "boolean") next[key] = stored[key] as boolean;
  } catch {
    return { ...DEFAULT_PANELS };
  }
  return next;
}

export function serializePanels(state: PanelState): string {
  return JSON.stringify(state);
}

/** Show or hide one panel; leaving focus mode automatically when a single panel is reopened. */
export function togglePanel(state: PanelState, key: PanelKey): PanelState {
  return { ...state, [key]: !state[key], focus: false };
}

/** Focus mode hides explorer + chat + terminal; pressing it again brings all three back. */
export function focusMode(state: PanelState): PanelState {
  if (state.focus) return { explorer: true, chat: true, term: true, focus: false };
  return { explorer: false, chat: false, term: false, focus: true };
}
