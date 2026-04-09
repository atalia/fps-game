import { describe, it, expect, beforeEach, vi } from "vitest";

describe("MobileControls voice UX", () => {
  beforeEach(() => {
    document.body.innerHTML = "";

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: true,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });

    Object.defineProperty(window.navigator, "userAgent", {
      configurable: true,
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
    });

    window.game = { started: true };
  });

  it("renders a mobile voice button alongside other action buttons", async () => {
    await import("../js/mobile-controls.js");
    const MobileControls = window.MobileControls;
    new MobileControls();

    expect(document.getElementById("shoot-btn")).not.toBeNull();
    expect(document.getElementById("reload-btn")).not.toBeNull();
    expect(document.getElementById("jump-btn")).not.toBeNull();
    expect(document.getElementById("voice-btn")).not.toBeNull();
  });
});
