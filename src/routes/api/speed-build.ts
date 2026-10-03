import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Body = z.object({
  messages: z.array(z.object({ role: z.enum(["system", "user", "assistant"]), content: z.string().max(40000) })).max(20),
});

/** Streams plain-text deltas from the cloud model for the Speed Build page. */
export const Route = createFileRoute("/api/speed-build")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return new Response("مفتاح الذكاء السحابي غير مضبوط.", { status: 500 });
        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return new Response("طلب غير صالح", { status: 400 });
        const msgs = parsed.data.messages;
        const instructions = msgs.filter((m) => m.role === "system").map((m) => m.content).join("\n");
        const input = msgs.filter((m) => m.role !== "system").map((m) => ({ role: m.role, content: m.content }));
        const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
          method: "POST",
          signal: request.signal,
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch" },
          body: JSON.stringify({ model: "openai/gpt-6-astra", stream: true, store: false, reasoning: { effort: "low" }, instructions, input }),
        });
        if (!res.ok || !res.body) {
          const t = await res.text().catch(() => "");
          console.error("speed-build gateway", res.status, t.slice(0, 300));
          const msg = res.status === 402 ? "رصيد الذكاء الاصطناعي غير كافٍ." : res.status === 429 ? "طلبات كثيرة — حاول بعد دقيقة." : `تعذّر الاتصال (${res.status}).`;
          return new Response(msg, { status: res.status });
        }
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        const enc = new TextEncoder();
        const stream = new ReadableStream({
          async start(ctrl) {
            let buf = "";
            try {
              for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                buf += dec.decode(value, { stream: true });
                const lines = buf.split("\n");
                buf = lines.pop() ?? "";
                for (const line of lines) {
                  if (!line.startsWith("data:")) continue;
                  const p = line.slice(5).trim();
                  if (!p || p === "[DONE]") continue;
                  try {
                    const ev = JSON.parse(p) as { type?: string; delta?: string };
                    if (ev.type === "response.output_text.delta" && ev.delta) ctrl.enqueue(enc.encode(ev.delta));
                  } catch { /* partial */ }
                }
              }
            } catch { /* aborted */ }
            ctrl.close();
          },
          cancel() { void reader.cancel(); },
        });
        return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
      },
    },
  },
});
