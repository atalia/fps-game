import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { JSDOM } from "jsdom";

const uiCode = readFileSync(join(__dirname, "../ui.js"), "utf8");

function loadUI(window, document) {
  const fn = new Function("window", "document", uiCode);
  fn(window, document);
  return window.UIManager;
}

describe("UIManager player list", () => {
  it("shows self using id with a you marker instead of plain You", () => {
    const dom = new JSDOM(`<!doctype html><body>
      <div id="players-container"></div>
      <div id="player-count"></div>
    </body>`);
    const { window } = dom;
    const { document } = window;

    const UIManager = loadUI(window, document);
    const ui = new UIManager();
    ui.setSelfPlayerId("abcd1234");

    ui.updatePlayerList([
      { id: "abcd1234", name: "You", health: 100, kills: 0, team: "ct" },
      { id: "other999", name: "Other", health: 100, kills: 0, team: "t" },
    ]);

    const items = [...document.querySelectorAll(".player-item .name")].map((n) => n.textContent);
    expect(items[0]).toContain("abcd1234");
    expect(items[0].toLowerCase()).toContain("you");
    expect(items[1]).toContain("Other");
  });
});
