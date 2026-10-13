import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

/** Public read-only sync: current Groupe-HN model list, fetched server-side on every call. */
export const Route = createFileRoute("/api/public/sync")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async () => {
        const key = process.env["GHN_API_KEY"] ?? "";
        const bases = ["https://platform.groupe-hn.com/api/public/v1", "https://platform.hnchat.net/api/public/v1"];
        for (const base of bases) {
          try {
            const r = await fetch(`${base}/models`, key ? { headers: { authorization: `Bearer ${key}` } } : {});
            if (!r.ok) continue;
            const j = (await r.json()) as { data?: { id: string }[] };
            const models = (j.data ?? []).map((m) => m.id).filter((id) => typeof id === "string").slice(0, 500);
            if (models.length)
              return Response.json({ source: base, count: models.length, models, at: new Date().toISOString() }, {
                headers: { ...CORS, "Cache-Control": "no-store" },
              });
          } catch { /* next */ }
        }
        return Response.json({ source: null, count: 0, models: [], at: new Date().toISOString() }, { status: 502, headers: CORS });
      },
    },
  },
});
