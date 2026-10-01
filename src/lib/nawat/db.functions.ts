import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Development mode: no sign-in. All access goes through these server functions.
const admin = async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin;

const TABLES = ["app_roles", "app_pages", "app_role_permissions", "app_store", "api_keys", "usage_events"] as const;

export const getDbOverview = createServerFn({ method: "GET" }).handler(async () => {
  const db = await admin();
  const counts = await Promise.all(
    TABLES.map(async (t) => {
      const { count, error } = await db.from(t).select("*", { count: "exact", head: true });
      return { table: t, rows: count ?? 0, ok: !error };
    }),
  );
  const [roles, pages, perms] = await Promise.all([
    db.from("app_roles").select("*").order("key"),
    db.from("app_pages").select("*").order("sort"),
    db.from("app_role_permissions").select("*"),
  ]);
  return { counts, roles: roles.data ?? [], pages: pages.data ?? [], perms: perms.data ?? [] };
});

export const setPermission = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      role_key: z.string().max(40),
      page_path: z.string().max(80),
      field: z.enum(["can_view", "can_edit", "can_delete"]),
      value: z.boolean(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { error } = await db
      .from("app_role_permissions")
      .update({ [data.field]: data.value } as { can_view?: boolean; can_edit?: boolean; can_delete?: boolean })
      .eq("role_key", data.role_key)
      .eq("page_path", data.page_path);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleRow = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ table: z.enum(["app_roles", "app_pages"]), id: z.string().max(80), enabled: z.boolean() }).parse(d),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { error } =
      data.table === "app_roles"
        ? await db.from("app_roles").update({ enabled: data.enabled }).eq("key", data.id)
        : await db.from("app_pages").update({ enabled: data.enabled }).eq("path", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const enableAll = createServerFn({ method: "POST" }).handler(async () => {
  const db = await admin();
  await db.from("app_roles").update({ enabled: true }).neq("key", "");
  await db.from("app_pages").update({ enabled: true }).neq("path", "");
  return { ok: true };
});

export const pushStore = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ device: z.string().max(80), items: z.array(z.object({ key: z.string().max(200), value: z.unknown() })).max(500) }).parse(d),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const rows = data.items.map((i) => ({ key: i.key, value: i.value as never, device: data.device, updated_at: new Date().toISOString() }));
    if (rows.length) {
      const { error } = await db.from("app_store").upsert(rows);
      if (error) throw new Error(error.message);
    }
    return { saved: rows.length };
  });

export const pullStore = createServerFn({ method: "GET" }).handler(async () => {
  const db = await admin();
  const { data, error } = await db.from("app_store").select("key,value");
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const syncApiKeys = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      keys: z.array(z.object({
        id: z.string().max(40), name: z.string().max(120), key_prefix: z.string().max(20),
        enabled: z.boolean(), monthly_limit: z.number(), created_at: z.string(), last_used_at: z.string().nullable(),
      })).max(200),
      usage: z.array(z.object({
        at: z.string(), model: z.string().max(120), key_id: z.string().nullable(),
        prompt_tokens: z.number(), output_tokens: z.number(), ms: z.number(),
      })).max(2000),
      since: z.string().nullable(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    if (data.keys.length) await db.from("api_keys").upsert(data.keys);
    const fresh = data.usage
      .filter((u) => !data.since || u.at > data.since)
      .map((u) => ({ ...u, prompt_tokens: Math.round(u.prompt_tokens), output_tokens: Math.round(u.output_tokens), ms: Math.round(u.ms) }));
    if (fresh.length) await db.from("usage_events").insert(fresh);
    return { keys: data.keys.length, usage: fresh.length };
  });
