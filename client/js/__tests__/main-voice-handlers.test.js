import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";

const mainCode = readFileSync(`${__dirname}/../main.js`, "utf8");

function loadMain(window, document) {
  const wrapped = `${mainCode}\nreturn { setupVoiceHandlers };`;
  const fn = new Function(
    "window",
    "document",
    "console",
    "requestAnimationFrame",
    "Game",
    "createMessageHandlers",
    wrapped,
  );
  return fn(
    window,
    document,
    console,
    () => {},
    window.Game,
    window.createMessageHandlers,
  );
}

describe("setupVoiceHandlers", () => {
  it("updates the real uiManager on voice start and stop", () => {
    const handlers = new Map();
    const showSpeakingIndicator = vi.fn();
    const stopReceiving = vi.fn();

    const window = {
      __FPS_DISABLE_AUTO_INIT__: true,
      Game: class {},
      createMessageHandlers: () => ({}),
      network: {
        on(type, handler) {
          handlers.set(type, handler);
        },
      },
      uiManager: {
        showSpeakingIndicator,
      },
      voiceSystem: {
        stopReceiving,
      },
    };

    const document = {
      getElementById() {
        return null;
      },
    };

    const { setupVoiceHandlers } = loadMain(window, document);
    setupVoiceHandlers();

    handlers.get("voice_start")({ playerId: "p2" });
    handlers.get("voice_stop")({ playerId: "p2" });

    expect(showSpeakingIndicator).toHaveBeenNthCalledWith(1, "p2", true);
    expect(showSpeakingIndicator).toHaveBeenNthCalledWith(2, "p2", false);
    expect(stopReceiving).toHaveBeenCalledWith("p2");
  });
});
