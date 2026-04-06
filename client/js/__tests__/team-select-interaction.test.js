import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { JSDOM } from "jsdom";

const teamCode = readFileSync(join(__dirname, "../team.js"), "utf8");
const playerCode = readFileSync(join(__dirname, "../player.js"), "utf8");

function loadTeamClasses(window, document) {
  const fn = new Function("window", "document", teamCode);
  fn(window, document);
}

function loadPlayerController(window, document) {
  const fn = new Function("window", "document", playerCode);
  fn(window, document);
  return window.PlayerController;
}

describe("Team selection interaction", () => {
  it("does not request pointer lock when clicking a team card", () => {
    const dom = new JSDOM(`<!doctype html><body><div id=\"root\"></div></body>`);
    const { window } = dom;
    const { document } = window;

    document.body.requestPointerLock = vi.fn();
    document.exitPointerLock = vi.fn();

    loadTeamClasses(window, document);
    const PlayerController = loadPlayerController(window, document);

    const teamSystem = {
      getAllTeams: () => [
        { id: "ct", name: "Counter-Terrorists", short_name: "CT", color: "#4aa3ff", player_count: 0, max_players: 5, score: 0 },
        { id: "t", name: "Terrorists", short_name: "T", color: "#ff7a45", player_count: 0, max_players: 5, score: 0 },
      ],
      getAvailableWeapons: () => ["usp", "m4a1"],
    };

    const player = new PlayerController();
    player.isLocked = false;

    const ui = new window.TeamSelectUI(document.getElementById("root"), teamSystem);
    const onSelect = vi.fn();
    ui.onSelect = onSelect;
    ui.show();

    const teamCard = ui.element.querySelector('.team-card[data-id="ct"]');
    teamCard.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));

    expect(onSelect).toHaveBeenCalledWith("ct");
    expect(document.body.requestPointerLock).not.toHaveBeenCalled();

    player.destroy();
  });
});
