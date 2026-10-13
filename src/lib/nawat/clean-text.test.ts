import { describe, expect, it } from "vitest";
import { cleanInvisibleMarks } from "./clean-text";

describe("cleanInvisibleMarks", () => {
  it("removes the RTL mark the model put inside a generated date", () => {
    const dirty = "13\u200f/10\u200f/2026, 4:14:54 \u0645";
    expect(cleanInvisibleMarks(dirty)).toBe("13/10/2026, 4:14:54 \u0645");
  });

  it("removes zero-width and bidi-override marks and the BOM", () => {
    const dirty = "\uFEFFplan\u200b\u202e-\u2066README\u200e.md";
    expect(cleanInvisibleMarks(dirty)).toBe("plan-README.md");
  });

  it("keeps visible French and Arabic text untouched", () => {
    const clean = "# Plan du projet\nخطة عمل: README.md\n";
    expect(cleanInvisibleMarks(clean)).toBe(clean);
  });
});
