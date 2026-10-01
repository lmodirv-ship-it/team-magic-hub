import { useEffect, useState } from "react";

const DEPTH_KEY = "nawat.depth.v1";
const DEPTH_EVENT = "nawat:depth-change";

export type DepthStyle = "default" | "beveled" | "industrial" | "glass";

export const depthStyles: ReadonlyArray<{
  id: DepthStyle;
  name: string;
  description: string;
}> = [
  {
    id: "default",
    name: "الحالي",
    description: "الشكل الرسمي الحالي دون تأثيرات عمق إضافية.",
  },
  {
    id: "beveled",
    name: "مشطوف ناعم",
    description: "ألواح مرتفعة بظلال ناعمة وحواف مضيئة، وأزرار تغوص عند الضغط.",
  },
  {
    id: "industrial",
    name: "صناعي ذهبي",
    description: "معدن داكن بطبقات ظل عميقة ولمسات ذهبية معدنية على الحواف.",
  },
  {
    id: "glass",
    name: "زجاجي داكن",
    description: "أسطح زجاجية شفافة بضبابية خلفية وتوهج خفيف حول العناصر.",
  },
];

function isDepthStyle(value: string | null): value is DepthStyle {
  return depthStyles.some((style) => style.id === value);
}

function apply(style: DepthStyle) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (style === "default") delete root.dataset["depth"];
  else root.dataset["depth"] = style;
}

export function getDepth(): DepthStyle {
  if (typeof window === "undefined") return "default";
  const stored = window.localStorage.getItem(DEPTH_KEY);
  return isDepthStyle(stored) ? stored : "default";
}

export function setDepth(style: DepthStyle) {
  window.localStorage.setItem(DEPTH_KEY, style);
  apply(style);
  window.dispatchEvent(new CustomEvent(DEPTH_EVENT, { detail: style }));
}

// Apply the persisted style as soon as the module loads (before first paint).
apply(getDepth());

/** Persisted 3D depth style, synchronized across every control. */
export function useDepth() {
  const [depth, setDepthState] = useState<DepthStyle>("default");
  useEffect(() => {
    setDepthState(getDepth());
    const onChange = (event: Event) =>
      setDepthState((event as CustomEvent<DepthStyle>).detail ?? getDepth());
    window.addEventListener(DEPTH_EVENT, onChange);
    return () => window.removeEventListener(DEPTH_EVENT, onChange);
  }, []);
  return { depth, setDepth };
}
