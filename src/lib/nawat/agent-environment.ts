// Central environment: the agent is invited into a prepared context
// (work steps, connections/access, how to do each step) before it starts.
export type AgentEnvironment = { steps: string; connections: string; howTo: string };

const KEY = "nawat.agentEnvironment.v1";
const EMPTY: AgentEnvironment = { steps: "", connections: "", howTo: "" };

export function loadEnvironment(): AgentEnvironment {
  if (typeof window === "undefined") return EMPTY;
  try { return { ...EMPTY, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return EMPTY; }
}

export function saveEnvironment(e: AgentEnvironment) {
  localStorage.setItem(KEY, JSON.stringify(e));
}

/** Text block prepended to every agent system prompt; empty when nothing is defined. */
export function environmentPrompt(e: AgentEnvironment = loadEnvironment()): string {
  const parts = [
    e.steps.trim() && `## Work steps\n${e.steps.trim()}`,
    e.connections.trim() && `## Connections & access\n${e.connections.trim()}`,
    e.howTo.trim() && `## How to complete each step\n${e.howTo.trim()}`,
  ].filter(Boolean);
  return parts.length ? `# Central environment (follow it)\n${parts.join("\n\n")}\n\n` : "";
}
