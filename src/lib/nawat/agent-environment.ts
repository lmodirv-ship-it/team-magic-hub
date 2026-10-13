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
export function environmentPrompt(e: AgentEnvironment = loadEnvironmentOrDefault()): string {
  const parts = [
    e.steps.trim() && `## Work steps\n${e.steps.trim()}`,
    e.connections.trim() && `## Connections & access\n${e.connections.trim()}`,
    e.howTo.trim() && `## How to complete each step\n${e.howTo.trim()}`,
  ].filter(Boolean);
  return parts.length ? `# Central environment (follow it)\n${parts.join("\n\n")}\n\n` : "";
}

/** Ready-made environment used when nothing has been saved yet. */
export const DEFAULT_ENVIRONMENT: AgentEnvironment = {
  steps: `1. Lire l'objectif et reformuler la tâche en une phrase.
2. Lister les fichiers à créer ou modifier.
3. Écrire le code fichier par fichier (HTML, CSS, JS séparés).
4. Vérifier : erreurs, liens entre fichiers, responsive.
5. Rendre un résumé court + le code final.`,
  connections: `- Modèles locaux Ollama (LAN), aucun cloud imposé.
- Pont NAWAT : 192.168.100.67:8788 (optionnel, pour le terminal).
- Serveur public : hn-ai.site / nawat.groupe-hn.com.
- Dossier de travail : un dossier par projet (PROJECTS_DIR).
- Ne jamais afficher de mot de passe ni de clé.`,
  howTo: `- Code complet, jamais de « ... » ni de partie omise.
- Interface en français par défaut, prête pour FR | AR | EN (AR = RTL).
- Règle « ajouter, ne jamais supprimer » : garder l'existant.
- Réponses courtes, ton encourageant.
- Si une information manque : le dire au lieu d'inventer.`,
};

export function loadEnvironmentOrDefault(): AgentEnvironment {
  if (typeof window === "undefined" || !localStorage.getItem(KEY)) return DEFAULT_ENVIRONMENT;
  return loadEnvironment();
}
