import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  model: z.string().min(1).max(120),
  messages: z.array(z.object({ role: z.enum(["system", "user", "assistant"]), content: z.string().max(60_000) })).min(1).max(40),
});

/** Chat through Groupe-HN using the server-held GHN_API_KEY (never sent to the browser). */
export const ghnServerChat = createServerFn({ method: "POST" })
  .inputValidator((d) => Input.parse(d))
  .handler(async ({ data }) => {
    const key = process.env.GHN_API_KEY;
    if (!key) return { ok: false as const, error: "NO_KEY", text: "" };
    const r = await fetch("https://platform.groupe-hn.com/api/public/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: data.model, messages: data.messages, stream: false }),
    });
    if (!r.ok) return { ok: false as const, error: r.status === 401 ? "GHN_KEY" : `HTTP_${r.status}`, text: "" };
    const j = (await r.json()) as { choices?: { message?: { content?: string } }[] };
    return { ok: true as const, error: "", text: j.choices?.[0]?.message?.content ?? "" };
  });
