import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Bot, Play, Square } from "lucide-react";
import { Page, Panel } from "@/components/nawat/StudioUI";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { chatStream, listAllModels } from "@/lib/nawat/bridge";
import { officialModels } from "@/lib/nawat/providers";
import {
  DEFAULT_ENVIRONMENT, environmentPrompt, loadEnvironmentOrDefault, saveEnvironment, type AgentEnvironment,
} from "@/lib/nawat/agent-environment";

export const Route = createFileRoute("/environment")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "Environnement central — NAWAT Studio" },
      { name: "description", content: "Préparez l'environnement : étapes, connexions et méthode, puis invitez n'importe quel agent." },
      { property: "og:title", content: "Environnement central — NAWAT Studio" },
      { property: "og:description", content: "On construit l'environnement, puis on y invite l'agent." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EnvironmentPage,
});

const FIELDS: { key: keyof AgentEnvironment; title: string; hint: string; tone: string }[] = [
  { key: "steps", title: "Étapes du travail", hint: "Contexte et étapes, une par ligne.", tone: "border-primary/60" },
  { key: "connections", title: "Connexions nécessaires", hint: "Accès, serveurs, dossiers, outils.", tone: "border-accent" },
  { key: "howTo", title: "Comment réaliser chaque étape", hint: "Méthode, règles de qualité.", tone: "border-destructive/50" },
];

function EnvironmentPage() {
  const [env, setEnv] = useState<AgentEnvironment>(DEFAULT_ENVIRONMENT);
  const [models, setModels] = useState<string[]>(officialModels.map((m) => m.name));
  const [model, setModel] = useState("nawat-coder:latest");
  const [task, setTask] = useState("");
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    setEnv(loadEnvironmentOrDefault());
    listAllModels().then((l) => l.length && setModels(l.map((m) => m.name))).catch(() => {});
  }, []);

  async function invite() {
    if (!task.trim()) { toast.message("Écrivez d'abord la tâche de l'agent."); return; }
    saveEnvironment(env);
    setOut(""); setBusy(true);
    abort.current = new AbortController();
    try {
      for await (const chunk of chatStream(model, [
        { role: "system", content: environmentPrompt(env) + "Tu es un agent NAWAT invité dans cet environnement. Respecte-le strictement." },
        { role: "user", content: task },
      ], abort.current.signal)) setOut((o) => o + chunk);
    } catch (e) {
      if (!abort.current?.signal.aborted) setOut((o) => o + `\n\n[Modèle injoignable : vérifiez qu'Ollama tourne (port 11434) sur votre ordinateur.]`);
    } finally { setBusy(false); }
  }

  return (
    <Page eyebrow="Agents" title="Environnement central" description="On construit l'environnement, puis on y invite l'agent. Tous les agents (coordinateur, bâtisseurs, correcteur, réviseur) le lisent avant de commencer.">
      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <Panel title="L'environnement">
          <div className="grid gap-3 md:grid-cols-3">
            {FIELDS.map((f, i) => (
              <div key={f.key} className={`rounded-xl border-2 ${f.tone} p-3`}>
                <div className="mb-1 text-sm font-semibold">{i + 1}. {f.title}</div>
                <p className="mb-2 text-xs text-muted-foreground">{f.hint}</p>
                <Textarea aria-label={f.title} rows={9} className="text-xs" value={env[f.key]} onChange={(e) => setEnv({ ...env, [f.key]: e.target.value })} />
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={() => { saveEnvironment(env); toast.success("Environnement enregistré."); }}>Enregistrer</Button>
            <Button variant="outline" onClick={() => setEnv(DEFAULT_ENVIRONMENT)}>Modèle par défaut</Button>
          </div>
        </Panel>

        <Panel title="Inviter un agent">
          <div className="flex flex-col items-center gap-2 py-2">
            <div className="grid size-20 place-items-center rounded-full border-2 border-primary bg-primary/10"><Bot className="size-8 text-primary" /></div>
            <span className="text-xs text-muted-foreground">← invité dans l'environnement</span>
          </div>
          <label className="text-xs font-medium">Agent (modèle)</label>
          <Input aria-label="Agent" list="env-models" value={model} onChange={(e) => setModel(e.target.value)} />
          <datalist id="env-models">{models.map((m) => <option key={m} value={m} />)}</datalist>
          <label className="mt-2 block text-xs font-medium">Tâche</label>
          <Textarea aria-label="Tâche" rows={4} value={task} onChange={(e) => setTask(e.target.value)} placeholder="Ex. : crée une page d'accueil pour une vente de voitures" />
          <div className="mt-2 flex gap-2">
            <Button className="flex-1" disabled={busy} onClick={invite}><Play className="size-4" /> Inviter l'agent</Button>
            {busy && <Button variant="outline" size="icon" aria-label="Arrêter" onClick={() => abort.current?.abort()}><Square className="size-4" /></Button>}
          </div>
        </Panel>
      </div>

      <Panel title="Travail de l'agent">
        <pre className="max-h-[420px] min-h-24 overflow-auto whitespace-pre-wrap text-xs">{out || (busy ? "L'agent lit l'environnement…" : "Aucun travail pour l'instant.")}</pre>
      </Panel>
    </Page>
  );
}
