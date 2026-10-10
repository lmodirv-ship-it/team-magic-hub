import { describe, expect, it } from "vitest";
import { createTerminalNoticeGate } from "./terminal-notices";

describe("terminal recurring connection errors", () => {
  it("emits the same missing response only once across repeated probes", () => {
    const gate = createTerminalNoticeGate();
    const emitted = Array.from({ length: 5 }, () => gate.shouldEmit("bridge-unreachable"));
    expect(emitted.filter(Boolean)).toHaveLength(1);
  });

  it("emits a new failure after a successful recovery", () => {
    const gate = createTerminalNoticeGate();
    expect(gate.shouldEmit("bridge-unreachable")).toBe(true);
    expect(gate.shouldEmit("bridge-unreachable")).toBe(false);
    gate.reset();
    expect(gate.shouldEmit("bridge-unreachable")).toBe(true);
  });

  it("does not suppress a changed host or connection condition", () => {
    const gate = createTerminalNoticeGate();
    expect(gate.shouldEmit("no-hosts")).toBe(true);
    expect(gate.shouldEmit("offline:host-a")).toBe(true);
    expect(gate.shouldEmit("offline:host-b")).toBe(true);
  });
});