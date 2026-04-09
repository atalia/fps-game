import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const uiCode = readFileSync(`${__dirname}/../ui.js`, "utf8");

function loadUI(window, document) {
  const fn = new Function("window", "document", uiCode);
  fn(window, document);
  return window.UIManager;
}

describe("UIManager player list", () => {
  function setup() {
    const dom = new JSDOM(`<!doctype html><body>
      <div id="players-container"></div>
      <div id="player-count"></div>
    </body>`);
    const { window } = dom;
    const { document } = window;

    const UIManager = loadUI(window, document);
    const ui = new UIManager();
    ui.setSelfPlayerId("abcd1234");
    return { document, ui };
  }

  it("shows each row with the player name and its real id", () => {
    const { document, ui } = setup();

    ui.updatePlayerList([
      { id: "abcd1234", name: "You", health: 100, kills: 0, team: "ct" },
      { id: "other999", name: "Other", health: 100, kills: 0, team: "t" },
    ]);

    const rows = [...document.querySelectorAll(".player-item")].map((row) =>
      row.textContent,
    );
    expect(rows[0]).toContain("You");
    expect(rows[0].includes("abcd1234") || rows[0].includes("ABCD1234")).toBe(
      true,
    );
    expect(rows[0].toLowerCase()).toContain("you");
    expect(rows[1]).toContain("Other");
    expect(rows[1]).toContain("other999");
  });

  it("stores the real player id on each player row", () => {
    const { document, ui } = setup();

    ui.updatePlayerList([
      { id: "abcd1234", name: "You", health: 100, kills: 0, team: "ct" },
      { id: "other999", name: "Other", health: 100, kills: 0, team: "t" },
    ]);

    const rows = [...document.querySelectorAll(".player-item")];
    const items = [...document.querySelectorAll(".player-item .name")];
    expect(rows[0].dataset.playerId).toBe("abcd1234");
    expect(rows[1].dataset.playerId).toBe("other999");
    expect(items[0].dataset.playerId).toBe("abcd1234");
    expect(items[1].dataset.playerId).toBe("other999");
  });

  it("shows a speaking indicator on the matching player only", () => {
    const { document, ui } = setup();

    ui.updatePlayerList([
      { id: "abcd1234", name: "You", health: 100, kills: 0, team: "ct" },
      { id: "other999", name: "Other", health: 100, kills: 0, team: "t" },
    ]);

    ui.showSpeakingIndicator("other999", true);

    const rows = [...document.querySelectorAll(".player-item")];
    expect(rows[0].querySelector(".speaking-indicator")).toBeNull();
    expect(rows[1].querySelector(".speaking-indicator")?.textContent).toContain(
      "🔊",
    );
  });
});
