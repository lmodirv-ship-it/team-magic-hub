import dictionary from "./i18n-dict.json";

export type UiLang = "fr" | "ar" | "en";
export const ARABIC_TEXT = /[\u0600-\u06FF]/;
const entries: Record<string, [string, string]> = {
  ...dictionary,
  "شعار نواة": ["Logo NAWAT", "NAWAT logo"],
  "شعار نواة الرئيسي": ["Logo principal NAWAT", "Main NAWAT logo"],
  "الطرفية": ["Terminal", "Terminal"],
  "طي الطرفية": ["Réduire le terminal", "Collapse terminal"],
  "إرفاق الملف المفتوح": ["Joindre le fichier ouvert", "Attach open file"],
  "حفظ الناتج في ملف": ["Enregistrer le résultat dans un fichier", "Save output to file"],
  "الإنتاج السريع": ["Production rapide", "Speed Build"],
  "الاستوديو": ["STUDIO", "STUDIO"],
};
const arabicKeys = Object.keys(entries).sort((a, b) => b.length - a.length);
const reverse = new Map<string, string>();
for (const [ar, translations] of Object.entries(entries)) {
  for (const text of translations) if (text && text !== ar && !reverse.has(text)) reverse.set(text, ar);
}
const foreignKeys = [...reverse.keys()].sort((a, b) => b.length - a.length);
const cache = new Map<string, string>();

/** Translate known interface labels while preserving identifiers and unknown content. */
export function translateUi(source: string, lang: UiLang): string {
  const cacheKey = `${lang}\0${source}`;
  const cached = cache.get(cacheKey);
  if (cached !== undefined) return cached;
  const core = source.trim();
  let arabic = entries[core] ? core : reverse.get(core);
  if (!arabic && ARABIC_TEXT.test(source)) arabic = core;
  let result = source;
  if (arabic) {
    let translated = arabic;
    if (lang !== "ar") {
      const i = lang === "fr" ? 0 : 1;
      translated = entries[arabic]?.[i] ?? arabic;
      if (translated === arabic) {
        for (const key of arabicKeys) {
          if (translated.includes(key)) translated = translated.split(key).join(entries[key][i]);
        }
      }
      // Arabic vowel marks and tatweel may remain after a compound-label replacement.
      translated = translated.replace(/[\u064B-\u065F\u0640]/g, "");
    }
    result = source.replace(core, translated);
  } else if (lang === "ar") {
    // Translate complete known labels only: never rewrite code or model names.
    const match = foreignKeys.find((key) => key === core);
    const ar = match ? reverse.get(match) : undefined;
    if (ar) result = source.replace(core, ar);
  }
  cache.set(cacheKey, result);
  return result;
}