import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { JSDOM } from "jsdom";

const teamCode = readFileSync(join(__dirname, "../team.js"), "utf8");

function loadTeamClasses(document) {
  const window = { document };
  const fn = new Function("window", "document", teamCode);
  fn(window, document);
  return {
    TeamSelectUI: window.TeamSelectUI,
  };
}

describe("TeamSelectUI pointer lock behavior", () => {
  it("releases pointer lock when showing team selection", () => {
    const dom = new JSDOM(`<!doctype html><body><div id=\"root\"></div></body>`);
    const { document } = dom.window;
    document.exitPointerLock = vi.fn();

    const { TeamSelectUI } = loadTeamClasses(document);
    const teamSystem = {
      getAllTeams: () => [
        { id: "ct", name: "Counter-Terrorists", short_name: "CT", color: "#4aa3ff", player_count: 0, max_players: 5, score: 0 },
        { id: "t", name: "Terrorists", short_name: "T", color: "#ff7a45", player_count: 0, max_players: 5, score: 0 },
      ],
      getAvailableWeapons: () => ["usp", "m4a1"],
    };

    const ui = new TeamSelectUI(document.getElementById("root"), teamSystem);
    ui.show();

    expect(document.exitPointerLock).toHaveBeenCalledTimes(1);
  });
});
