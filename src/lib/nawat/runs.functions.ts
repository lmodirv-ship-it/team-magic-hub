import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const admin = async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin;

const Run = z.object({
  model: z.string().max(200),
  at: z.string().max(40),
  ms: z.number(),
  chars: z.number(),
  tps: z.number(),
  ok: z.boolean(),
  score: z.number().min(0).max(10).optional(),
  prompt: z.string().max(4000),
  round: z.string().max(80).optional(),
  inTps: z.number().optional(),
});

/** Save one task run in the site database so rounds survive closed pages. */
export const saveTaskRun = createServerFn({ method: "POST" })
  .inputValidator((d) => Run.parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { error } = await (db as unknown as { from: (t: string) => { upsert: (r: unknown, o: unknown) => Promise<{ error: { message: string } | null }> } })
      .from("task_runs")
      .upsert({ model: data.model, at: data.at, round: data.round ?? null, data }, { onConflict: "at,model" });
    return { ok: !error, error: error?.message ?? null };
  });

export const listTaskRuns = createServerFn({ method: "GET" }).handler(async () => {
  const db = await admin();
  const { data, error } = await (db as unknown as { from: (t: string) => { select: (c: string) => { order: (c: string, o: unknown) => { limit: (n: number) => Promise<{ data: { data: unknown }[] | null; error: unknown }> } } } })
    .from("task_runs").select("data").order("at", { ascending: false }).limit(2000);
  if (error || !data) return [];
  return data.map((r) => r.data as z.infer<typeof Run>);
});
