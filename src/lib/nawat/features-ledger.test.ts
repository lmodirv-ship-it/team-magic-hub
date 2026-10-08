import { describe, expect, it } from "vitest";
import { FEATURES } from "./features-ledger";

describe("features ledger (add, never remove)", () => {
  it("keeps at least the 20 features of 2026-10-08", () => {
    expect(FEATURES.length).toBeGreaterThanOrEqual(20);
  });
  it("ids are sequential starting at 1", () => {
    FEATURES.forEach((f, i) => expect(f.id).toBe(i + 1));
  });
});
