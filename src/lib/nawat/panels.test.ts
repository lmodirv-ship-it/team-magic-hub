import { describe, expect, it } from "vitest";
import {
  DEFAULT_PANELS,
  focusMode,
  parsePanels,
  serializePanels,
  togglePanel,
} from "./panels";

describe("workspace panel state", () => {
  it("opens every panel by default", () => {
    expect(parsePanels(null)).toEqual({ explorer: true, chat: true, term: true, focus: false });
  });

  it("keeps a stored choice and adds back a panel that is missing from it", () => {
    expect(parsePanels(JSON.stringify({ explorer: false }))).toEqual({
      explorer: false,
      chat: true,
      term: true,
      focus: false,
    });
  });

  it("ignores unreadable or non-boolean values instead of hiding panels", () => {
    expect(parsePanels("{oops")).toEqual(DEFAULT_PANELS);
    expect(parsePanels(JSON.stringify({ explorer: "off" }))).toEqual(DEFAULT_PANELS);
  });

  it("round-trips through storage", () => {
    const state = togglePanel(DEFAULT_PANELS, "chat");
    expect(parsePanels(serializePanels(state))).toEqual(state);
  });

  it("toggles one panel without touching the others", () => {
    expect(togglePanel(DEFAULT_PANELS, "explorer")).toEqual({
      explorer: false,
      chat: true,
      term: true,
      focus: false,
    });
  });

  it("focus mode hides all three panels and restores them on the second press", () => {
    const hidden = focusMode(DEFAULT_PANELS);
    expect(hidden).toEqual({ explorer: false, chat: false, term: false, focus: true });
    expect(focusMode(hidden)).toEqual(DEFAULT_PANELS);
  });
});
