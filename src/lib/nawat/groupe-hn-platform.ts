import { useEffect, useState } from "react";

/** ربط منصة Groupe-HN (platform.hnchat.net) — المفتاح يبقى على هذا الجهاز فقط. */
export const GHN_PLATFORM = {
  name: "Groupe-HN",
  baseUrl: "https://platform.hnchat.net/api/public/v1",
  model: "nawat-chat",
  endpoint: "https://platform.hnchat.net/api/public/v1/chat/completions",
};

const KEY = "nawat.ghn.key";
const FREE_KEY = "nawat.ghn.freeUntil";
const EVT = "nawat:ghn-changed";
/** فترة الاستعمال المجاني المفتوح لنماذج المجموعة (آخر يوم مشمول). */
export const DEFAULT_FREE_UNTIL = "2026-10-20";

export type GhnState = { key: string; freeUntil: string; freeOpen: boolean; daysLeft: number; active: boolean };

function compute(): GhnState {
  const key = typeof window === "undefined" ? "" : (localStorage.getItem(KEY) ?? "");
  const freeUntil = typeof window === "undefined" ? DEFAULT_FREE_UNTIL : (localStorage.getItem(FREE_KEY) ?? DEFAULT_FREE_UNTIL);
  const end = new Date(`${freeUntil}T23:59:59`).getTime();
  const daysLeft = Math.max(0, Math.ceil((end - Date.now()) / 86_400_000));
  const freeOpen = Date.now() <= end;
  return { key, freeUntil, freeOpen, daysLeft, active: freeOpen || key.startsWith("ghn_") };
}

export function setGhnKey(key: string) {
  if (key.trim()) localStorage.setItem(KEY, key.trim());
  else localStorage.removeItem(KEY);
  window.dispatchEvent(new Event(EVT));
}

export function setFreeUntil(date: string) {
  localStorage.setItem(FREE_KEY, date || DEFAULT_FREE_UNTIL);
  window.dispatchEvent(new Event(EVT));
}

export function useGhn(): GhnState {
  const [s, setS] = useState<GhnState>({ key: "", freeUntil: DEFAULT_FREE_UNTIL, freeOpen: true, daysLeft: 0, active: true });
  useEffect(() => {
    const sync = () => setS(compute());
    sync();
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return s;
}

/** Stream a chat from the Groupe-HN platform (OpenAI-compatible SSE); key optional during the free period. */
export async function* ghnChatStream(model: string, messages: { role: string; content: string }[], signal?: AbortSignal): AsyncGenerator<string> {
  const key = typeof window === "undefined" ? "" : (localStorage.getItem(KEY) ?? "");
  const res = await fetch(GHN_PLATFORM.endpoint, {
    method: "POST", signal,
    headers: { "content-type": "application/json", ...(key ? { authorization: `Bearer ${key}` } : {}) },
    body: JSON.stringify({ model, messages, stream: true }),
  });
  if (!res.ok || !res.body) throw new Error(`Groupe-HN ${res.status}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const l of lines) {
      const s = l.replace(/^data:\s*/, "").trim();
      if (!s || s === "[DONE]") continue;
      try {
        const j = JSON.parse(s);
        const t = j.choices?.[0]?.delta?.content ?? j.choices?.[0]?.message?.content ?? j.message?.content ?? "";
        if (t) yield t;
      } catch { /* partial line */ }
    }
  }
}
