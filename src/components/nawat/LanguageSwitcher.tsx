import { useEffect } from "react";
import { LANGS, applyLang, readLang, useLang } from "@/lib/nawat/i18n";

export function LanguageSwitcher() {
  const { lang, setLang, t } = useLang();
  useEffect(() => applyLang(readLang()), []);
  return (
    <div
      role="group"
      aria-label={t("اللغة")}
      className="me-1 flex items-center overflow-hidden rounded-md border border-border text-[10px]"
    >
      {LANGS.map((l) => (
        <button
          key={l.id}
          type="button"
          onClick={() => setLang(l.id)}
          aria-pressed={lang === l.id}
          className={`px-1.5 py-1 font-semibold transition-colors ${
            lang === l.id ? "bg-nawat text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
