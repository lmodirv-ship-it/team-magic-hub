import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// الجسر السحابي: الهاتف/الموقع يرسلون المهام هنا، والوكيل المحلي على الخادم يسحبها وينفذها ثم يعيد النتيجة.
// كل النقاط (عدا status) تتطلب كلمة سر الجسر RELAY_TOKEN في ترويسة Authorization: Bearer.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...CORS } });

function authorized(request: Request) {
  const token = process.env["RELAY_TOKEN"];
  if (!token) return false;
  const got = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (got.length !== token.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ token.charCodeAt(i);
  return diff === 0;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const admin = async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin;

const Submit = z.object({
  kind: z.enum(["chat", "image", "models", "health", "version", "update", "system", "projects", "sync"]),
  payload: z.record(z.string(), z.unknown()).default({}),
  wait: z.number().min(0).max(25).default(20),
});
const Done = z.object({
  id: z.string().uuid(),
  result: z.unknown().optional(),
  error: z.string().max(2000).optional(),
});

async function waitFor(id: string, seconds: number) {
  const db = await admin();
  const end = Date.now() + seconds * 1000;
  do {
    const { data } = await db.from("relay_jobs").select("status,result,error").eq("id", id).maybeSingle();
    if (data && (data.status === "done" || data.status === "failed")) return data;
    if (seconds === 0) return data;
    await sleep(1000);
  } while (Date.now() < end);
  return null;
}

async function handle(request: Request, path: string) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const db = await admin();

  if (path === "status" && request.method === "GET") {
    const { data } = await db.from("relay_agent").select("last_seen,info").eq("id", 1).maybeSingle();
    const age = data ? (Date.now() - new Date(data.last_seen).getTime()) / 1000 : null;
    return json({ ok: true, relay: "nawat-cloud", agentOnline: age !== null && age < 30, lastSeenSecs: age });
  }

  if (!process.env["RELAY_TOKEN"]) return json({ error: "لم تُضبط كلمة سر الجسر السحابي بعد" }, 503);
  if (!authorized(request)) return json({ error: "unauthorized" }, 401);

  // --- عملاء: الهاتف والموقع ---
  if (path === "submit" && request.method === "POST") {
    const parsed = Submit.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return json({ error: "طلب غير صالح" }, 400);
    const size = JSON.stringify(parsed.data.payload).length;
    if (size > 2_000_000) return json({ error: "الطلب كبير جدًا" }, 413);
    const { data, error } = await db.from("relay_jobs")
      .insert({ kind: parsed.data.kind, payload: parsed.data.payload as never }).select("id").single();
    if (error || !data) return json({ error: "تعذّر حفظ المهمة" }, 500);
    const r = await waitFor(data.id, parsed.data.wait);
    if (r?.status === "done") return json({ id: data.id, status: "done", result: r.result });
    if (r?.status === "failed") return json({ id: data.id, status: "failed", error: r.error }, 502);
    return json({ id: data.id, status: "pending" }, 202);
  }

  const m = path.match(/^result\/([0-9a-f-]{36})$/);
  if (m?.[1] && request.method === "GET") {
    const r = await waitFor(m[1], 20);
    if (!r) return json({ id: m[1], status: "pending" }, 202);
    return json({ id: m[1], ...r });
  }

  // --- الوكيل المحلي على الخادم ---
  if (path === "pull" && request.method === "GET") {
    await db.from("relay_agent").upsert({ id: 1, last_seen: new Date().toISOString() });
    await db.from("relay_jobs").delete().lt("created_at", new Date(Date.now() - 3600_000).toISOString());
    const { data } = await db.rpc("relay_claim", { _limit: 3 });
    return json({ jobs: (data ?? []).map((j) => ({ id: j.id, kind: j.kind, payload: j.payload })) });
  }

  if (path === "done" && request.method === "POST") {
    const parsed = Done.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return json({ error: "طلب غير صالح" }, 400);
    const { id, result, error } = parsed.data;
    await db.from("relay_jobs").update({
      status: error ? "failed" : "done", result: (result ?? null) as never, error: error ?? null, done_at: new Date().toISOString(),
    }).eq("id", id);
    return json({ ok: true });
  }

  return json({ error: "not found", endpoints: ["status", "submit", "result/:id", "pull", "done"] }, 404);
}

export const Route = createFileRoute("/api/public/relay/$")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      GET: ({ request, params }) => handle(request, params._splat ?? ""),
      POST: ({ request, params }) => handle(request, params._splat ?? ""),
      OPTIONS: ({ request, params }) => handle(request, params._splat ?? ""),
    },
  },
});
