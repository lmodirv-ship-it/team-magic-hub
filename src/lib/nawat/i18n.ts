import { useEffect, useState } from "react";
import { translateUi } from "./ui-translation";

export type Lang = "fr" | "ar" | "en";
export const LANG_KEY = "nawat.lang.v1";
export const DEFAULT_LANG: Lang = "fr";
export const LANGS: { id: Lang; label: string }[] = [
  { id: "fr", label: "FR" },
  { id: "ar", label: "AR" },
  { id: "en", label: "EN" },
];

export function dirOf(l: Lang) {
  return l === "ar" ? "rtl" : "ltr";
}

export function readLang(): Lang {
  try {
    const v = window.localStorage.getItem(LANG_KEY);
    if (v === "fr" || v === "ar" || v === "en") return v;
  } catch {}
  return DEFAULT_LANG;
}

export function applyLang(l: Lang) {
  const el = document.documentElement;
  el.lang = l;
  el.dir = dirOf(l);
}

export function setLang(l: Lang) {
  try {
    window.localStorage.setItem(LANG_KEY, l);
  } catch {}
  applyLang(l);
  window.dispatchEvent(new CustomEvent("nawat:lang", { detail: l }));
}

/** Dictionary keyed by the original Arabic text: [fr, en]. Arabic stays as-is. */
const DICT: Record<string, [string, string]> = {
  "نظرة عامة": ["Aperçu", "Overview"],
  "مساحة العمل": ["Espace de travail", "Workspace"],
  "المحادثات": ["Conversations", "Chats"],
  "الورشة متعددة النماذج": ["Atelier multi-modèles", "Multi-model workshop"],
  "النتائج": ["Résultats", "Results"],
  "الوكلاء": ["Agents", "Agents"],
  "الأدوات": ["Outils", "Tools"],
  "المراقبة": ["Surveillance", "Monitoring"],
  "النماذج": ["Modèles", "Models"],
  "المزوّدون": ["Fournisseurs", "Providers"],
  "مفاتيح API والاستهلاك": ["Clés API et consommation", "API keys & usage"],
  "قواعد البيانات": ["Bases de données", "Databases"],
  "المهام": ["Tâches", "Tasks"],
  "خطة الأسبوع": ["Plan de la semaine", "Weekly plan"],
  "البنية": ["Architecture", "Architecture"],
  "الإعدادات": ["Paramètres", "Settings"],
  "المنافذ": ["Ports", "Ports"],
  "الربط السريع": ["Liens rapides", "Quick links"],
  "المشاريع والمنسّق": ["Projets et orchestrateur", "Projects & orchestrator"],
  "استوديو ComfyUI": ["Studio ComfyUI", "ComfyUI studio"],
  "المزامنة ودمج الإضافات": ["Synchronisation et fusion", "Sync & merge"],
  "متصل ويعمل": ["Connecté", "Online"],
  "بحث…": ["Rechercher…", "Search…"],
  "بحث شامل": ["Recherche globale", "Global search"],
  "منظومة محلية آمنة": ["Système local sécurisé", "Secure local system"],
  "اللغة": ["Langue", "Language"],
};

export function translate(text: string, l: Lang): string {
  if (l === "ar") return text;
  const e = DICT[text];
  return e ? (l === "fr" ? e[0] : e[1]) : translateUi(text, l);
}

export function useLang() {
  const [lang, set] = useState<Lang>(DEFAULT_LANG);
  useEffect(() => {
    set(readLang());
    const on = (e: Event) => set((e as CustomEvent<Lang>).detail);
    window.addEventListener("nawat:lang", on);
    return () => window.removeEventListener("nawat:lang", on);
  }, []);
  return { lang, t: (s: string) => translate(s, lang), setLang };
}
