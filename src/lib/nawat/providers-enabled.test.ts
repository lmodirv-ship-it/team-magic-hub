import { describe, expect, it } from "vitest";
import { activeProviderModels, type ProviderConfig } from "./providers";

const base: ProviderConfig = { id: "p", name: "P", kind: "openai-compatible", baseUrl: "x", models: ["a", "b"], connected: true, updatedAt: "" };

describe("provider model activation", () => {
  it("new provider shows no models until activated", () => {
    expect(activeProviderModels({ ...base, enabled: [] })).toEqual([]);
  });
  it("only activated models are exposed", () => {
    expect(activeProviderModels({ ...base, enabled: ["b"] })).toEqual(["b"]);
  });
  it("legacy providers without a selection keep all models", () => {
    expect(activeProviderModels(base)).toEqual(["a", "b"]);
  });
});
