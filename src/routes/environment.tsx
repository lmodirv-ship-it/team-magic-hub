import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Page, Panel } from "@/components/nawat/StudioUI";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { loadEnvironment, saveEnvironment, environmentPrompt, type AgentEnvironment } from "@/lib/nawat/agent-environment";

export const Route = createFileRoute("/environment")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "Environnement central — NAWAT Studio" },
      { name: "description", content: "Préparez l'environnement : étapes, connexions et méthode, puis invitez l'agent." },
      { property: "og:title", content: "Environnement central — NAWAT Studio" },
      { property: "og:description", content: "On construit l'environnement, puis on y invite l'agent." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EnvironmentPage,
});

const FIELDS: { key: keyof AgentEnvironment; title: string; hint: string }[] = [
  { key: "steps", title: "1. Étapes du travail", hint: "Contexte et étapes du projet, une par ligne." },
  { key: "connections", title: "2. Connexions nécessaires", hint: "Accès, serveurs, dossiers, bases, outils autorisés." },
  { key: "howTo", title: "3. Comment réaliser chaque étape", hint: "Méthode, règles de qualité, conventions." },
];

function EnvironmentPage() {
  const [env, setEnv] = useState<AgentEnvironment>({ steps: "", connections: "", howTo: "" });
  useEffect(() => setEnv(loadEnvironment()), []);
  const preview = environmentPrompt(env);
  return (
    <Page eyebrow="Agents" title="Environnement central" description="On construit l'environnement, puis on y invite l'agent : chaque agent (coordinateur, bâtisseurs, correcteur, réviseur) le lit avant de commencer.">
      <div className="grid gap-4 lg:grid-cols-3">
        {FIELDS.map((f) => (
          <Panel key={f.key} title={f.title}>
            <p className="mb-2 text-xs text-muted-foreground">{f.hint}</p>
            <Textarea rows={10} value={env[f.key]} onChange={(e) => setEnv({ ...env, [f.key]: e.target.value })} />
          </Panel>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <Button onClick={() => { saveEnvironment(env); toast.success("Environnement enregistré — l'agent y est invité."); }}>Enregistrer et inviter l'agent</Button>
      </div>
      <Panel title="Ce que l'agent reçoit">
        <pre className="whitespace-pre-wrap text-xs text-muted-foreground">{preview || "Vide — l'agent travaille sans environnement."}</pre>
      </Panel>
    </Page>
  );
}
