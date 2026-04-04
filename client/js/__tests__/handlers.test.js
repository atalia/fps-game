// handlers.test.js - 消息处理链测试（测试真实的 message-handlers.js）
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// 加载 message-handlers.js 内容
const messageHandlersCode = readFileSync(
  join(__dirname, "../message-handlers.js"),
  "utf8",
);

// 创建一个简单的上下文来执行代码
function loadMessageHandlers() {
  const context = {
    window: {},
    THREE: null,
  };

  // 在上下文中执行代码
  const fn = new Function("window", "THREE", messageHandlersCode);
  fn(context.window, context.THREE);

  return context.window.createMessageHandlers;
}

// 获取 createMessageHandlers 函数
const createMessageHandlers = loadMessageHandlers();

// Mock 依赖
const mockRenderer = {
  addPlayer: vi.fn(),
  removePlayer: vi.fn(),
  updatePlayer: vi.fn(),
  addProjectile: vi.fn(),
  clearPlayers: vi.fn(),
};

const mockUIManager = {
  updateHealth: vi.fn(),
  updateAmmo: vi.fn(),
  updateMoney: vi.fn(),
  updateRoundState: vi.fn(),
  updateWeapon: vi.fn(),
  updateKills: vi.fn(),
  updateDeaths: vi.fn(),
  showMessage: vi.fn(),
  addKillFeed: vi.fn(),
  showDeathScreen: vi.fn(),
  hideDeathScreen: vi.fn(),
};

const mockAudioManager = {
  playShoot: vi.fn(),
  playHit: vi.fn(),
  playKill: vi.fn(),
};

const mockScreenEffects = {
  flashDamage: vi.fn(),
  flashKill: vi.fn(),
};

const mockHitIndicator = {
  show: vi.fn(),
};

const mockEffectsSystem = {
  core: {
    createHitBurst: vi.fn(),
    createBloodSplatter: vi.fn(),
  },
};

const mockDamageNumber = {
  show: vi.fn(),
};

const mockDynamicCrosshair = {
  showHit: vi.fn(),
};

const mockKillNotice = {
  show: vi.fn(),
};

const mockKillstreakEnhanced = {
  addKill: vi.fn(),
};

const mockAILabels = {
  createLabel: vi.fn(),
  removeLabel: vi.fn(),
};

const mockHitEffects = {
  showHitMarker: vi.fn(),
};

// 创建游戏状态
function createGameState() {
  return {
    player: {
      id: "test-player-123",
      health: 100,
      ammo: 30,
      weapon: "rifle",
      money: 800,
      kills: 0,
      deaths: 0,
    },
    players: new Map([
      [
        "test-player-123",
        {
          id: "test-player-123",
          name: "TestPlayer",
          health: 100,
          weapon: "rifle",
        },
      ],
    ]),
  };
}

// 创建消息处理器
function createHandlers(gameState) {
  return createMessageHandlers({
    game: gameState,
    renderer: mockRenderer,
    uiManager: mockUIManager,
    audioManager: mockAudioManager,
    screenEffects: mockScreenEffects,
    hitIndicator: mockHitIndicator,
    effectsSystem: mockEffectsSystem,
    damageNumber: mockDamageNumber,
    dynamicCrosshair: mockDynamicCrosshair,
    hitEffects: mockHitEffects,
    killNotice: mockKillNotice,
    killstreakEnhanced: mockKillstreakEnhanced,
    aiLabels: mockAILabels,
  });
}

describe("消息处理链测试", () => {
  let gameState;
  let handlers;

  beforeEach(() => {
    // 重置所有 mock
    vi.clearAllMocks();

    // 创建新的游戏状态
    gameState = createGameState();

    // 创建新的消息处理器
    handlers = createHandlers(gameState);
  });

  describe("player_damaged 处理链", () => {
    it("自己受伤：更新血量 + 闪烁屏幕 + 显示受击指示器", () => {
      const data = {
        player_id: "test-player-123",
        attacker_id: "enemy-456",
        attacker_position: { x: 10, y: 0, z: 20 },
        damage: 25,
        remaining_health: 75,
        hitbox: "body",
      };

      handlers.handlePlayerDamaged(data);

      // 验证调用真实代码路径
      expect(gameState.player.health).toBe(75);
      expect(mockUIManager.updateHealth).toHaveBeenCalledWith(75);
      expect(mockScreenEffects.flashDamage).toHaveBeenCalled();
      expect(mockHitIndicator.show).toHaveBeenCalledWith(
        { x: 10, y: 0, z: 20 },
        25,
      );
    });

    it("自己击中敌人：播放命中效果 + 调用旧版 hitEffects", () => {
      gameState.player.id = "shooter-123";

      const data = {
        player_id: "enemy-456",
        attacker_id: "shooter-123",
        damage: 30,
        remaining_health: 70,
        position: { x: 5, y: 1, z: 10 },
        hitbox: "head",
      };

      handlers.handlePlayerDamaged(data);

      // 验证命中效果链
      expect(mockEffectsSystem.core.createHitBurst).toHaveBeenCalledWith(
        { x: 5, y: 1, z: 10 },
        true, // isHeadshot
      );
      expect(mockEffectsSystem.core.createBloodSplatter).toHaveBeenCalled();
      expect(mockDamageNumber.show).toHaveBeenCalled();
      expect(mockDynamicCrosshair.showHit).toHaveBeenCalled();
      expect(mockAudioManager.playHit).toHaveBeenCalled();
      // 验证兼容旧系统 - hitEffects.showHitMarker 被调用
      expect(mockHitEffects.showHitMarker).toHaveBeenCalled();
    });

    it("其他玩家受伤：不更新自己 UI", () => {
      const data = {
        player_id: "other-player",
        attacker_id: "another-player",
        damage: 20,
        remaining_health: 80,
      };

      handlers.handlePlayerDamaged(data);

      // 不应该更新自己状态
      expect(gameState.player.health).toBe(100);
      expect(mockUIManager.updateHealth).not.toHaveBeenCalled();
      expect(mockScreenEffects.flashDamage).not.toHaveBeenCalled();
    });
  });

  describe("player_shot 处理链", () => {
    it("播放武器音效 + 添加弹道", () => {
      const data = {
        player_id: "enemy-456",
        weapon_id: "sniper",
        position: { x: 0, y: 1.7, z: 0 },
        direction: { x: 0, y: 0, z: -1 },
      };

      handlers.handlePlayerShot(data);

      expect(mockAudioManager.playShoot).toHaveBeenCalledWith("sniper");
      expect(mockRenderer.addProjectile).toHaveBeenCalledWith(
        { x: 0, y: 1.7, z: 0 },
        { x: 0, y: 0, z: -1 },
      );
    });

    it("使用默认值处理缺失字段", () => {
      const data = {
        player_id: "enemy-456",
        position: { x: 10, y: 0, z: 20 },
      };

      handlers.handlePlayerShot(data);

      expect(mockAudioManager.playShoot).toHaveBeenCalledWith("rifle");
      expect(mockRenderer.addProjectile).toHaveBeenCalledWith(
        { x: 10, y: 0, z: 20 },
        { x: 0, y: 0, z: -1 }, // 默认方向
      );
    });
  });

  describe("player_killed 处理链", () => {
    it("自己击杀敌人：更新击杀数 + 播放效果", () => {
      gameState.player.id = "killer-123";
      gameState.player.kills = 5;

      const data = {
        victim_id: "enemy-456",
        killer_id: "killer-123",
        is_headshot: true,
      };

      handlers.handlePlayerKilled(data);

      expect(gameState.player.kills).toBe(6);
      expect(mockUIManager.updateKills).toHaveBeenCalledWith(6);
      expect(mockUIManager.addKillFeed).toHaveBeenCalledWith(
        "击杀 enemy-456 (爆头!)",
      );
      expect(mockAudioManager.playKill).toHaveBeenCalled();
      expect(mockKillNotice.show).toHaveBeenCalled();
      expect(mockKillstreakEnhanced.addKill).toHaveBeenCalled();
      expect(mockScreenEffects.flashKill).toHaveBeenCalled();
    });

    it("自己死亡：更新死亡数 + 显示死亡屏幕", () => {
      gameState.player.id = "victim-456";
      gameState.player.deaths = 2;

      const data = {
        victim_id: "victim-456",
        killer_id: "enemy-123",
      };

      handlers.handlePlayerKilled(data);

      expect(gameState.player.deaths).toBe(3);
      expect(mockUIManager.updateDeaths).toHaveBeenCalledWith(3);
      expect(mockUIManager.showDeathScreen).toHaveBeenCalled();
    });

    it("无关击杀：只更新击杀信息", () => {
      const data = {
        victim_id: "player-1",
        killer_id: "player-2",
      };

      handlers.handlePlayerKilled(data);

      // 不应该更新自己的击杀/死亡数
      expect(gameState.player.kills).toBe(0);
      expect(gameState.player.deaths).toBe(0);
      expect(mockUIManager.updateKills).not.toHaveBeenCalled();
      expect(mockUIManager.updateDeaths).not.toHaveBeenCalled();
    });
  });

  describe("weapon_changed 处理链", () => {
    it("自己切换武器：更新状态 + 显示消息", () => {
      const data = {
        player_id: "test-player-123",
        weapon: "shotgun",
      };

      handlers.handleWeaponChanged(data);

      expect(gameState.player.weapon).toBe("shotgun");
      expect(mockUIManager.showMessage).toHaveBeenCalledWith("切换到 shotgun");
    });

    it("其他玩家切换武器：更新玩家列表", () => {
      gameState.players.set("other-player", {
        id: "other-player",
        weapon: "rifle",
      });

      const data = {
        player_id: "other-player",
        weapon: "sniper",
      };

      handlers.handleWeaponChanged(data);

      expect(gameState.players.get("other-player").weapon).toBe("sniper");
      // 不应该显示消息给自己
      expect(mockUIManager.showMessage).not.toHaveBeenCalled();
    });

    it("回合重置武器同步：更新状态但不弹提示", () => {
      handlers.handleWeaponChanged({
        player_id: "test-player-123",
        weapon: "usp",
        reason: "round_reset",
      });

      expect(gameState.player.weapon).toBe("usp");
      expect(mockUIManager.showMessage).not.toHaveBeenCalled();
    });
  });

  describe("money_updated 处理链", () => {
    it("自己收到金钱更新：同步状态和 HUD", () => {
      const data = {
        player_id: "test-player-123",
        money: 1100,
        delta: 300,
        reason: "kill",
      };

      handlers.handleMoneyUpdated(data);

      expect(gameState.player.money).toBe(1100);
      expect(mockUIManager.updateMoney).toHaveBeenCalledWith(1100);
    });

    it("其他玩家的金钱更新不会影响自己", () => {
      handlers.handleMoneyUpdated({
        player_id: "other-player",
        money: 2500,
      });

      expect(gameState.player.money).toBe(800);
      expect(mockUIManager.updateMoney).not.toHaveBeenCalled();
    });
  });

  describe("round handlers", () => {
    it("同步 round_state 到本地状态和 HUD", () => {
      handlers.handleRoundState({
        phase: "freeze",
        round_number: 3,
        regulation_rounds: 30,
        timer_seconds: 5,
      });

      expect(gameState.roundState).toEqual({
        phase: "freeze",
        round_number: 3,
        regulation_rounds: 30,
        timer_seconds: 5,
      });
      expect(mockUIManager.updateRoundState).toHaveBeenCalled();
    });

    it("round_ended 会显示公告", () => {
      handlers.handleRoundEnded({
        round_number: 8,
        phase: "ended",
        is_overtime: false,
        announcement: "CT win by elimination | MVP: Alice",
        teams: [],
      });

      expect(mockUIManager.showMessage).toHaveBeenCalledWith(
        "CT win by elimination | MVP: Alice",
        "success",
        2800,
      );
    });
  });

  describe("player_joined 处理链", () => {
    it("普通玩家加入：添加到渲染器 + 显示消息", () => {
      const data = {
        player_id: "new-player-789",
        name: "NewPlayer",
        position: { x: 15, y: 0, z: 25 },
        health: 100,
        is_bot: false,
      };

      handlers.handlePlayerJoined(data);

      expect(mockRenderer.addPlayer).toHaveBeenCalledWith(
        "new-player-789",
        { x: 15, y: 0, z: 25 },
        { isBot: false, team: "" },
      );
      expect(mockUIManager.addKillFeed).toHaveBeenCalledWith(
        "NewPlayer 加入了游戏",
      );
      expect(gameState.players.has("new-player-789")).toBe(true);
    });

    it("机器人加入：添加 AI 标签", () => {
      const data = {
        player_id: "bot-123",
        name: "Bot",
        position: { x: 0, y: 0, z: 0 },
        is_bot: true,
        difficulty: "hard",
      };

      handlers.handlePlayerJoined(data);

      expect(mockRenderer.addPlayer).toHaveBeenCalledWith(
        "bot-123",
        { x: 0, y: 0, z: 0 },
        { isBot: true, team: "" },
      );
      expect(mockAILabels.createLabel).toHaveBeenCalledWith(
        "bot-123",
        "Bot",
        "hard",
      );
      expect(gameState.players.get("bot-123").is_bot).toBe(true);
    });
  });

  describe("player_respawned 处理链", () => {
    it("自己重生：更新状态 + 隐藏死亡屏幕", () => {
      const data = {
        player_id: "test-player-123",
        health: 100,
        position: { x: 50, y: 0, z: 50 },
      };

      handlers.handlePlayerRespawned(data);

      expect(gameState.player.health).toBe(100);
      expect(gameState.player.position).toEqual({ x: 50, y: 0, z: 50 });
      expect(mockUIManager.updateHealth).toHaveBeenCalledWith(100);
      expect(mockUIManager.hideDeathScreen).toHaveBeenCalled();
      expect(mockRenderer.updatePlayer).toHaveBeenCalled();
    });

    it("其他玩家重生：只更新位置", () => {
      const data = {
        player_id: "other-player",
        health: 100,
        position: { x: 20, y: 0, z: 30 },
      };

      handlers.handlePlayerRespawned(data);

      // 不应该更新自己状态
      expect(mockUIManager.hideDeathScreen).not.toHaveBeenCalled();
      expect(mockRenderer.updatePlayer).toHaveBeenCalledWith(
        "other-player",
        { x: 20, y: 0, z: 30 },
        0,
      );
    });
  });
});
