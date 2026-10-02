import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  logs: z.string().max(60000),
  metrics: z.string().max(20000),
});

const SYSTEM = `أنت مهندس تشغيل خبير بخوادم Linux (Ubuntu) وPM2 وnginx وDocker وOllama وComfyUI.
حلّل السجلات والمقاييس، وأجب بالعربية بهذا الشكل بالضبط (Markdown):
## التشخيص
سبب العطل المرجّح باختصار.
## الخطورة
منخفضة / متوسطة / عالية / حرجة مع سبب.
## خطوات الإصلاح
قائمة مرقّمة؛ كل خطوة فيها أمر bash جاهز داخل \`\`\`bash.
## التحقق
أوامر للتأكد من نجاح الإصلاح.
لا تقترح أوامر هدّامة (rm -rf، حذف بيانات) دون تحذير صريح. الحد الأقصى 500 كلمة.`;

export const diagnoseServer = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { ok: false as const, error: "مفتاح الذكاء الاصطناعي غير مضبوط على الخادم." };
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        store: false,
        reasoning: { effort: "low" },
        instructions: SYSTEM,
        input: `### السجلات\n${data.logs || "(لا يوجد)"}\n\n### المقاييس\n${data.metrics || "(لا يوجد)"}`,
      }),
    });
    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      console.error("diagnose gateway", res.status, text.slice(0, 500));
      const msg = res.status === 402 ? "رصيد الذكاء الاصطناعي غير كافٍ." : res.status === 429 ? "طلبات كثيرة — حاول بعد دقيقة." : `تعذّر التشخيص (${res.status}).`;
      return { ok: false as const, error: msg };
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let out = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const ev = JSON.parse(payload) as { type?: string; delta?: string; response?: { error?: { message?: string } } };
          if (ev.type === "response.output_text.delta" && ev.delta) out += ev.delta;
          if (ev.type === "response.failed") return { ok: false as const, error: ev.response?.error?.message ?? "فشل التشخيص." };
        } catch { /* partial */ }
      }
    }
    return out ? { ok: true as const, report: out } : { ok: false as const, error: "لم يُرجع النموذج أي نص." };
  });
