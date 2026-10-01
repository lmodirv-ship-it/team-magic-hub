import { useEffect, useState } from "react";

const KEY = "nawat.platform.v1";
const EVT = "nawat:platform-change";

export type PlatformStyle = "studio" | "hub" | "sharp";

export const platformStyles: ReadonlyArray<{ id: PlatformStyle; name: string; description: string }> = [
  { id: "studio", name: "الاستوديو (الحالي)", description: "الشكل الحالي دون أي تغيير." },
  { id: "hub", name: "منصة Ecosystem Hub", description: "زوايا دائرية واسعة، بطاقات ناعمة ومسافات أريح في كل الصفحات." },
  { id: "sharp", name: "مهني حاد", description: "زوايا حادة، حدود واضحة وكثافة عالية للعمل الطويل." },
];

const isStyle = (v: string | null): v is PlatformStyle => platformStyles.some((s) => s.id === v);

function apply(s: PlatformStyle) {
  if (typeof document === "undefined") return;
  if (s === "studio") delete document.documentElement.dataset["platform"];
  else document.documentElement.dataset["platform"] = s;
}

export function getPlatform(): PlatformStyle {
  if (typeof window === "undefined") return "studio";
  const v = localStorage.getItem(KEY);
  return isStyle(v) ? v : "studio";
}

export function setPlatform(s: PlatformStyle) {
  localStorage.setItem(KEY, s);
  apply(s);
  window.dispatchEvent(new CustomEvent(EVT, { detail: s }));
}

apply(getPlatform());

export function usePlatform() {
  const [style, set] = useState<PlatformStyle>("studio");
  useEffect(() => {
    set(getPlatform());
    const on = () => set(getPlatform());
    window.addEventListener(EVT, on);
    return () => window.removeEventListener(EVT, on);
  }, []);
  return { style, setPlatform };
}
