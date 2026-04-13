import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const voiceCode = readFileSync(`${__dirname}/../voice.js`, "utf8");

function loadVoiceSystem(window, document, navigatorOverride) {
  const fn = new Function("window", "document", "navigator", "console", voiceCode);
  fn(window, document, navigatorOverride, console);
  return window.VoiceSystem;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("VoiceSystem.init", () => {
  it("returns false when getUserMedia is unavailable", async () => {
    const dom = new JSDOM(`<!doctype html><html><head></head><body></body></html>`);
    const { window } = dom;
    const { document } = window;
    const navigatorOverride = {};

    window.AudioContext = vi.fn();
    window.webkitAudioContext = vi.fn();

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const VoiceSystem = loadVoiceSystem(window, document, navigatorOverride);
    const voice = new VoiceSystem();

    await expect(voice.init()).resolves.toBe(false);
    expect(voice.enabled).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("gracefully warns instead of erroring when no microphone device is available", async () => {
    const dom = new JSDOM(`<!doctype html><html><head></head><body></body></html>`);
    const { window } = dom;
    const { document } = window;
    const navigatorOverride = {
      mediaDevices: {
        getUserMedia: vi.fn().mockRejectedValue(new DOMException("Requested device not found", "NotFoundError")),
      },
    };

    window.AudioContext = vi.fn(() => ({
      createMediaStreamSource: vi.fn(),
      createAnalyser: vi.fn(),
    }));

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const VoiceSystem = loadVoiceSystem(window, document, navigatorOverride);
    const voice = new VoiceSystem();

    await expect(voice.init()).resolves.toBe(false);
    expect(voice.enabled).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(
      "[VOICE] Microphone unavailable, voice disabled:",
      "NotFoundError",
    );
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
