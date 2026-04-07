import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const mainCode = readFileSync(join(__dirname, "../main.js"), "utf8");

function loadStartGame(window, document) {
  const wrapped = `${mainCode}\nreturn { startGame };`;
  const fn = new Function(
    "window",
    "document",
    "console",
    "requestAnimationFrame",
    "Game",
    "createMessageHandlers",
    wrapped,
  );
  return fn(window, document, console, () => {}, window.Game, undefined);
}

describe("startGame self player identity", () => {
  it("assigns the real playerId to the PlayerController created during init", async () => {
    class GameStub {
      constructor() {
        this.player = null;
        this.selfPlayerId = null;
      }

      async init() {
        this.player = {
          id: null,
          team: "",
          weapon: "rifle",
          money: 800,
          resetOwnedWeapons() {},
        };
      }
    }

    const window = {
      __FPS_DISABLE_AUTO_INIT__: true,
      Game: GameStub,
      game: null,
      renderer: { scene: {}, camera: {} },
      uiManager: { updateMoney() {} },
      buyMenuUI: { refresh() {} },
      teamSystem: { getDefaultWeapon: () => "usp" },
    };
    const document = {
      getElementById() {
        return null;
      },
    };

    const { startGame } = loadStartGame(window, document);
    await startGame("player-123");

    expect(window.game.player.id).toBe("player-123");
  });

  it("does not auto-lock pointer when the player still needs team selection", async () => {
    class GameStub {
      constructor() {
        this.player = null;
        this.selfPlayerId = null;
      }

      async init() {
        this.player = {
          id: null,
          team: "",
          weapon: "rifle",
          money: 800,
          resetOwnedWeapons() {},
        };
      }
    }

    const lobby = { hide: vi.fn() };
    const teamSelectUI = { show: vi.fn(), hide: vi.fn() };

    const window = {
      __FPS_DISABLE_AUTO_INIT__: true,
      Game: GameStub,
      game: null,
      renderer: { scene: {}, camera: {} },
      uiManager: { updateMoney() {} },
      buyMenuUI: { refresh() {} },
      teamSystem: { getDefaultWeapon: () => "usp" },
      lobby,
      teamSelectUI,
    };
    const document = {
      getElementById() {
        return null;
      },
    };

    const { startGame } = loadStartGame(window, document);
    await startGame("player-123");

    expect(lobby.hide).toHaveBeenCalledWith(false);
    expect(teamSelectUI.show).toHaveBeenCalled();
  });
});
