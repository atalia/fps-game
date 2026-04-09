// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";

const mainCode = readFileSync(new URL("../main.js", import.meta.url), "utf8");

function loadMain(window, document) {
  const wrapped = `${mainCode}\nreturn { setupNetworkHandlers, startGame };`;
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

describe("player list around team selection", () => {
  it("keeps both players in the list after self team_changed", async () => {
    const handlers = new Map();
    const updatePlayerList = vi.fn();

    class GameStub {
      constructor() {
        this.player = null;
        this.players = new Map();
        this.selfPlayerId = null;
      }

      async init() {
        this.player = {
          id: null,
          name: "Self",
          team: "",
          weapon: "rifle",
          money: 800,
          health: 100,
          kills: 0,
          deaths: 0,
          score: 0,
          resetOwnedWeapons() {},
        };
      }
    }

    const window = {
      __FPS_DISABLE_AUTO_INIT__: true,
      Game: GameStub,
      createMessageHandlers: () => ({ handlePlayerJoined() {} }),
      network: {
        connected: true,
        playerId: null,
        on(type, handler) {
          handlers.set(type, handler);
        },
        send: vi.fn(),
      },
      uiManager: {
        updateRoom() {},
        showMessage() {},
        updatePlayerList,
        setSelfPlayerId() {},
        updateScoreboardTeamSummary() {},
        updateMoney() {},
      },
      renderer: {
        addPlayer() {},
        setPlayerTeam() {},
      },
      teamSystem: {
        setTeams() {},
        getAllTeams() { return []; },
        syncPlayers() {},
        setPlayerTeam() {},
        getDefaultWeapon() { return "usp"; },
      },
      teamScoreUI: { show() {}, updateTeams() {} },
      teamSelectUI: { show() {}, hide() {}, render() {}, onSelect: null },
      buyMenuUI: { refresh() {} },
      BUY_MENU_CATALOG: [],
      findBuyMenuItem: () => null,
      lobby: { hide() {} },
      messageHandlers: null,
    };

    const document = {
      getElementById() {
        return null;
      },
    };

    const { setupNetworkHandlers } = loadMain(window, document);
    setupNetworkHandlers();

    const roomJoined = handlers.get("room_joined");
    const teamChanged = handlers.get("team_changed");

    roomJoined({
      room_id: "room-1",
      player_count: 2,
      player_id: "self-id",
      players: [
        { id: "self-id", name: "Self", team: "", health: 100, kills: 0, deaths: 0, score: 0 },
        { id: "other-id", name: "Other", team: "", health: 100, kills: 0, deaths: 0, score: 0 },
      ],
      teams: [],
    });

    await Promise.resolve();
    await Promise.resolve();

    teamChanged({
      player_id: "self-id",
      team: "ct",
      teams: [],
    });

    const latestPlayers = updatePlayerList.mock.calls.at(-1)?.[0] || [];
    expect(latestPlayers).toHaveLength(2);
    expect(latestPlayers.map((p) => p.id).sort()).toEqual(["other-id", "self-id"]);
  });
});
