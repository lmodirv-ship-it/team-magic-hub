import { createFileRoute } from "@tanstack/react-router";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "content-type, authorization" };
const TABLES = ["app_roles", "app_pages", "app_role_permissions", "app_store", "api_keys", "usage_events", "task_runs"] as const;
const SYNC = ["app_store", "task_runs"] as const;

function authorized(req: Request) {
  const t = process.env["RELAY_TOKEN"] || process.env["BRIDGE_TOKEN"];
  return Boolean(t && t !== "change-me" && req.headers.get("authorization") === `Bearer ${t}`);
}

/** Read-only app configuration for copies without a DB; token-protected two-way sync of store + task results between servers. */
export const Route = createFileRoute("/api/public/db-mirror")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        if (!process.env["SUPABASE_URL"] || !process.env["SUPABASE_SERVICE_ROLE_KEY"])
          return Response.json({ error: "no database on this copy" }, { status: 503, headers: CORS });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const db = supabaseAdmin as unknown as { from: (t: string) => any };
        const url = new URL(request.url);
        if (url.searchParams.get("scope") === "sync") {
          if (!authorized(request)) return new Response("unauthorized", { status: 401, headers: CORS });
          const out: Record<string, unknown[]> = {};
          for (const t of SYNC) { const { data } = await db.from(t).select("*").limit(5000); out[t] = data ?? []; }
          return Response.json(out, { headers: { ...CORS, "Cache-Control": "no-store" } });
        }
        const counts = await Promise.all(TABLES.map(async (t) => {
          const { count, error } = await db.from(t).select("*", { count: "exact", head: true });
          return { table: t, rows: count ?? 0, ok: !error };
        }));
        const [roles, pages, perms] = await Promise.all([
          db.from("app_roles").select("*").order("key"), db.from("app_pages").select("*").order("sort"), db.from("app_role_permissions").select("*"),
        ]);
        return Response.json({ counts, roles: roles.data ?? [], pages: pages.data ?? [], perms: perms.data ?? [] }, { headers: { ...CORS, "Cache-Control": "no-store" } });
      },
      POST: async ({ request }) => {
        if (!authorized(request)) return new Response("unauthorized", { status: 401, headers: CORS });
        if (!process.env["SUPABASE_URL"] || !process.env["SUPABASE_SERVICE_ROLE_KEY"]) return new Response("no database", { status: 503, headers: CORS });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const db = supabaseAdmin as unknown as { from: (t: string) => any };
        const body = (await request.json()) as Record<string, unknown[]>;
        const saved: Record<string, number> = {};
        for (const t of SYNC) {
          const rows = Array.isArray(body[t]) ? body[t].slice(0, 5000) : [];
          if (!rows.length) continue;
          // add, never remove: upsert only, never delete
          const { error } = await db.from(t).upsert(rows, { ignoreDuplicates: t === "task_runs" });
          saved[t] = error ? 0 : rows.length;
        }
        return Response.json({ saved }, { headers: CORS });
      },
    },
  },
});
