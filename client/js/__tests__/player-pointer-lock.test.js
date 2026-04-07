import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { JSDOM } from "jsdom";

const playerCode = readFileSync(join(__dirname, "../player.js"), "utf8");

function loadPlayerController(window, document) {
  const fn = new Function("window", "document", playerCode);
  fn(window, document);
  return window.PlayerController;
}

describe("PlayerController pointer lock", () => {
  it("swallows pointer lock rejection instead of leaking an unhandled promise", async () => {
    const dom = new JSDOM(`<!doctype html><body></body>`);
    const { window } = dom;
    const { document } = window;

    const rejected = Promise.reject(
      new DOMException(
        "Pointer lock cannot be acquired immediately after the user has exited the lock.",
        "SecurityError",
      ),
    );
    rejected.catch(() => {});
    document.body.requestPointerLock = vi.fn(() => rejected);

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const PlayerController = loadPlayerController(window, document);
    const player = new PlayerController();

    document.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await Promise.resolve();

    expect(document.body.requestPointerLock).toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();

    player.destroy();
  });
});
