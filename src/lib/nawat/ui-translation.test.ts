import { describe, expect, it } from "vitest";
import { DEFAULT_LANG, dirOf } from "./i18n";
import { translateUi } from "./ui-translation";

describe("interface language rules", () => {
  it("defaults to French with left-to-right direction", () => {
    expect(DEFAULT_LANG).toBe("fr");
    expect(dirOf(DEFAULT_LANG)).toBe("ltr");
  });
  it("uses right-to-left direction only for Arabic", () => {
    expect(dirOf("ar")).toBe("rtl");
    expect(dirOf("en")).toBe("ltr");
  });
  it("restores a French interface label to Arabic", () => {
    expect(translateUi("Joindre le fichier ouvert", "ar")).toBe("إرفاق الملف المفتوح");
  });
  it("translates Arabic field labels into French without Arabic characters", () => {
    const result = translateUi("شعار نواة الرئيسي", "fr");
    expect(result).toBe("Logo principal NAWAT");
    expect(/[\u0600-\u06ff]/.test(result)).toBe(false);
  });
});