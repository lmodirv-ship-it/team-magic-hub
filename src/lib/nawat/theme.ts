import { useCallback, useEffect, useState } from "react";

export type ThemeId =
  | "official"
  | "edge"
  | "system-night"
  | "graphite"
  | "aurora"
  | "sahara"
  | "ocean"
  | "crimson"
  | "light";

const THEME_KEY = "nawat.theme.v1";
const THEME_EVENT = "nawat:theme-change";
const THEME_CLASSES = [
  "theme-edge",
  "theme-system-night",
  "theme-graphite",
  "theme-aurora",
  "theme-sahara",
  "theme-ocean",
  "theme-crimson",
  "theme-light",
] as const;

export const themes: ReadonlyArray<{
  id: ThemeId;
  name: string;
  description: string;
  dark: boolean;
}> = [
  { id: "official", name: "NAWAT الرسمي", description: "الهوية الأساسية الخضراء الداكنة", dark: true },
  { id: "edge", name: "Edge", description: "أزرق تقني واضح للعمل المكثف", dark: true },
  { id: "system-night", name: "System Night", description: "أسود هادئ وتباين مريح ليلًا", dark: true },
  { id: "graphite", name: "Graphite", description: "رمادي احترافي محايد", dark: true },
  { id: "aurora", name: "Aurora", description: "أخضر زمردي مع لمسات دافئة", dark: true },
  { id: "sahara", name: "Sahara HN", description: "بني داكن مع ذهب شعار HN", dark: true },
  { id: "ocean", name: "Ocean", description: "أزرق بحري عميق مع فيروزي", dark: true },
  { id: "crimson", name: "Crimson", description: "فحمي مع أحمر قرمزي هادئ", dark: true },
  { id: "light", name: "Light Studio", description: "واجهة فاتحة ونظيفة للنهار", dark: false },
];

function isThemeId(value: string | null): value is ThemeId {
  return themes.some((theme) => theme.id === value);
}

export function storedTheme(): ThemeId {
  if (typeof window === "undefined") return "official";
  const stored = window.localStorage.getItem(THEME_KEY);
  if (isThemeId(stored)) return stored;
  // Migrate the former dark/light setting without changing the official default.
  return stored === "light" ? "light" : "official";
}

function apply(theme: ThemeId) {
  const root = document.documentElement;
  root.classList.remove(...THEME_CLASSES);
  if (theme !== "official") root.classList.add(`theme-${theme}`);
  root.dataset["theme"] = theme;
  root.style.colorScheme = theme === "light" ? "light" : "dark";
}

export function setStoredTheme(theme: ThemeId) {
  window.localStorage.setItem(THEME_KEY, theme);
  apply(theme);
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: theme }));
}

/** Persisted visual theme, synchronized across every theme control. */
export function useTheme() {
  const [theme, setThemeState] = useState<ThemeId>("official");

  useEffect(() => {
    const next = storedTheme();
    setThemeState(next);
    apply(next);
    const onChange = (event: Event) => {
      const nextTheme = (event as CustomEvent<ThemeId>).detail;
      if (isThemeId(nextTheme)) setThemeState(nextTheme);
    };
    window.addEventListener(THEME_EVENT, onChange);
    return () => window.removeEventListener(THEME_EVENT, onChange);
  }, []);

  const setTheme = useCallback((next: ThemeId) => setStoredTheme(next), []);
  const toggle = useCallback(() => {
    setTheme(theme === "light" ? "official" : "light");
  }, [setTheme, theme]);

  return { theme, setTheme, toggle, isDark: theme !== "light" };
}
