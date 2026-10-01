import { useEffect, useState } from "react";

const KEY = "nawat.ai.enabled";
const EVT = "nawat:ai-toggle";

export function aiEnabled(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(KEY) !== "0";
}

export function setAiEnabled(on: boolean) {
  localStorage.setItem(KEY, on ? "1" : "0");
  window.dispatchEvent(new Event(EVT));
}

export class AiDisabled extends Error {
  constructor() {
    super("الذكاء الاصطناعي موقوف — فعّله من شريط الحالة.");
  }
}

export function assertAi() {
  if (!aiEnabled()) throw new AiDisabled();
}

export function useAiEnabled() {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const sync = () => setOn(aiEnabled());
    sync();
    window.addEventListener(EVT, sync);
    return () => window.removeEventListener(EVT, sync);
  }, []);
  return [on, setAiEnabled] as const;
}
