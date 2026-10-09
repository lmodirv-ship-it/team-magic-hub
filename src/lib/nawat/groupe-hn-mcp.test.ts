import { describe, expect, it } from "vitest";

describe("Groupe-HN MCP", () => {
  it("exposes exactly 29 tools with unique names", async () => {
    process.env["NAWAT_MCP_NO_LISTEN"] = "1";
    // @ts-expect-error plain .mjs module without types
    const { TOOLS } = await import("../../../cli/mcp-server.mjs");
    const names = (TOOLS as { name: string }[]).map((t) => t.name);
    expect(names.length).toBe(29);
    expect(new Set(names).size).toBe(29);
  });
});
