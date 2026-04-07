import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const mainCode = readFileSync(join(__dirname, "../main.js"), "utf8");

function loadMain(window, document) {
  const wrapped = `${mainCode}\nreturn { setupNetworkHandlers };`;
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

describe("player_joined race during startup", () => {
  it("does not lose a remote player if player_joined arrives before message handlers are ready", async () => {
    const handlers = new Map();
    const updatePlayerList = vi.fn();
    let resolveInit;

    class GameStub {
      constructor() {
        this.player = null;
        this.players = new Map();
        this.selfPlayerId = null;
      }

      async init() {
        await new Promise((resolve) => {
          resolveInit = resolve;
        });
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
      createMessageHandlers: () => ({
        handlePlayerJoined(data) {
          window.renderer.addPlayer(data.player_id, data.position, {
            isBot: !!data.is_bot,
            team: data.team || "",
          });
          window.game.players.set(data.player_id, {
            id: data.player_id,
            name: data.name,
            position: data.position,
            is_bot: !!data.is_bot,
            team: data.team || "",
            health: data.health || 100,
            kills: data.kills || 0,
            deaths: data.deaths || 0,
            score: data.score || 0,
          });
        },
      }),
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
        addKillFeed() {},
      },
      renderer: {
        addPlayer: vi.fn(),
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

    handlers.get("room_joined")({
      room_id: "room-1",
      player_count: 1,
      player_id: "self-id",
      players: [{ id: "self-id", name: "Self", team: "", health: 100, kills: 0, deaths: 0, score: 0 }],
      teams: [],
    });

    handlers.get("player_joined")({
      player_id: "other-id",
      name: "Other",
      position: { x: 1, y: 1.25, z: 2 },
      is_bot: false,
      team: "",
    });

    resolveInit();
    await Promise.resolve();
    await Promise.resolve();

    handlers.get("team_changed")({
      player_id: "self-id",
      team: "ct",
      teams: [],
    });

    const latestPlayers = updatePlayerList.mock.calls.at(-1)?.[0] || [];
    expect(latestPlayers).toHaveLength(2);
    expect(latestPlayers.map((p) => p.id).sort()).toEqual(["other-id", "self-id"]);
  });
});
