import { describe, expect, it } from "vitest";
import { CONTENTS_PAGES, GROUP_START_PAGE, MANUAL_PAGES, manualPage } from "./manual";
describe("extended bilingual manual", () => {
  it("adds twenty group pages to the hundred-page guide", () => {
    expect(MANUAL_PAGES).toBe(120);
    expect(MANUAL_PAGES - GROUP_START_PAGE + 1).toBe(20);
  });
  it("reserves exactly three contents pages after the cover", () => {
    expect(CONTENTS_PAGES).toEqual([2, 3, 4]);
  });
  it("confines page navigation to the document", () => {
    expect(manualPage(0)).toBe(1);
    expect(manualPage(121)).toBe(120);
    expect(manualPage(53)).toBe(53);
  });
});