import { createFileRoute } from "@tanstack/react-router";

type StatKey = "activeModels" | "filesGenerated" | "filesFixed" | "analysesDone";
type StatsPayload = Record<StatKey, number> & {
  type: "stats.update";
  history: Record<StatKey, number[]>;
  trends: Record<StatKey, string>;
};

const KEYS: StatKey[] = ["activeModels", "filesGenerated", "filesFixed", "analysesDone"];

function fallbackPayload(): StatsPayload {
  const values = { activeModels: 0, filesGenerated: 0, filesFixed: 0, analysesDone: 0 };
  return {
    type: "stats.update",
    ...values,
    history: Object.fromEntries(KEYS.map((key) => [key, Array(10).fill(values[key])])) as Record<
      StatKey,
      number[]
    >,
    trends: { activeModels: "+0%", filesGenerated: "+0%", filesFixed: "+0%", analysesDone: "+0%" },
  };
}

function validRemote(value: unknown): value is Partial<StatsPayload> & Record<StatKey, number> {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<StatsPayload>;
  return KEYS.every((key) => typeof item[key] === "number");
}

export const Route = createFileRoute("/api/stats")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const response = await fetch("http://192.168.100.66:5001/api/stats", {
            signal: AbortSignal.timeout(1500),
          });
          if (!response.ok) throw new Error("Local statistics service unavailable");
          const value: unknown = await response.json();
          if (!validRemote(value)) throw new Error("Invalid local statistics payload");
          const fallback = fallbackPayload();
          return Response.json(
            {
              type: "stats.update",
              activeModels: value.activeModels,
              filesGenerated: value.filesGenerated,
              filesFixed: value.filesFixed,
              analysesDone: value.analysesDone,
              history: Object.fromEntries(
                KEYS.map((key) => [
                  key,
                  value.history?.[key]?.slice(-10) ?? Array(10).fill(value[key]),
                ]),
              ) as Record<StatKey, number[]>,
              trends: { ...fallback.trends, ...value.trends },
            } satisfies StatsPayload,
            { headers: { "Cache-Control": "no-store" } },
          );
        } catch {
          return Response.json(fallbackPayload(), { headers: { "Cache-Control": "no-store" } });
        }
      },
    },
  },
});
