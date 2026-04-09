// protocol.test.js - 协议契约测试
import { describe, it, expect } from "vitest";
import { z } from "zod";

// Schema 定义 - 与 shared/schemas/*.json 保持一致
const weaponIds = [
  "pistol",
  "rifle",
  "shotgun",
  "sniper",
  "usp",
  "glock",
  "deagle",
  "mp5",
  "p90",
  "m4a1",
  "famas",
  "ak47",
  "galil",
  "awp",
];

const schemas = {
  room_joined: z.object({
    room_id: z.string(),
    player_id: z.string(),
    teams: z
      .array(
        z.object({
          id: z.enum(["ct", "t"]),
          name: z.string(),
          short_name: z.enum(["CT", "T"]),
          color: z.string(),
          score: z.number().int().optional(),
          player_count: z.number().int().optional(),
          max_players: z.number().int().optional(),
        }),
      )
      .optional(),
    players: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        health: z.number().int().min(0).max(100).optional(),
        money: z.number().int().min(0).optional(),
        position: z
          .object({
            x: z.number(),
            y: z.number(),
            z: z.number(),
          })
          .optional(),
        is_bot: z.boolean().optional(),
        team: z.enum(["ct", "t"]).optional(),
        weapon: z.enum(weaponIds).optional(),
        kills: z.number().int().optional(),
        deaths: z.number().int().optional(),
      }),
    ),
  }),

  player_joined: z.object({
    player_id: z.string(),
    name: z.string(),
    position: z
      .object({
        x: z.number(),
        y: z.number(),
        z: z.number(),
      })
      .optional(),
    is_bot: z.boolean().optional(),
    difficulty: z.enum(["easy", "normal", "hard", "nightmare"]).optional(),
    team: z.enum(["ct", "t"]).optional(),
    weapon: z.enum(weaponIds).optional(),
    health: z.number().optional(),
    kills: z.number().optional(),
    deaths: z.number().optional(),
  }),

  player_shot: z.object({
    player_id: z.string(),
    position: z.object({
      x: z.number(),
      y: z.number(),
      z: z.number(),
    }),
    rotation: z.number().optional(),
    ammo: z.number().int().optional(),
    weapon_id: z.enum(weaponIds).optional(),
    direction: z
      .object({
        x: z.number(),
        y: z.number(),
        z: z.number(),
      })
      .optional(),
  }),

  player_damaged: z.object({
    player_id: z.string(),
    attacker_id: z.string(),
    attacker_position: z
      .object({
        x: z.number(),
        y: z.number(),
        z: z.number(),
      })
      .optional(),
    damage: z.number().int().min(0),
    hitbox: z.enum(["head", "body", "arm", "leg"]).optional(),
    remaining_health: z.number().int().min(0).max(100),
    position: z
      .object({
        x: z.number(),
        y: z.number(),
        z: z.number(),
      })
      .optional(),
    is_bot: z.boolean().optional(),
  }),

  player_killed: z.object({
    victim_id: z.string(),
    killer_id: z.string(),
    weapon_id: z.string().optional(),
    hitbox: z.enum(["head", "body", "arm", "leg"]).optional(),
    is_headshot: z.boolean().optional(),
    kill_distance: z.number().min(0).optional(),
    is_bot: z.boolean().optional(),
  }),

  armor_updated: z.object({
    player_id: z.string(),
    armor: z.number().int().min(0).max(100),
    has_helmet: z.boolean().optional(),
  }),

  player_respawned: z.object({
    player_id: z.string(),
    position: z.object({
      x: z.number(),
      y: z.number(),
      z: z.number(),
    }),
    health: z.number().int().min(0).max(100),
    armor: z.number().int().min(0).max(100).optional(),
    has_helmet: z.boolean().optional(),
    ammo: z.number().int().min(0).optional(),
  }),

  weapon_changed: z.object({
    player_id: z.string(),
    weapon: z.enum(weaponIds),
    reason: z.enum(["round_reset", "team_join"]).optional(),
  }),

  money_updated: z.object({
    player_id: z.string(),
    money: z.number().int().min(0),
    delta: z.number().int().optional(),
    reason: z.enum(["purchase", "kill", "round_win", "round_loss"]).optional(),
  }),

  round_state: z.object({
    phase: z.enum(["waiting", "freeze", "live", "ended", "match_over"]),
    round_number: z.number().int().min(1),
    rounds_played: z.number().int().min(0).optional(),
    regulation_rounds: z.number().int().min(1),
    first_to_win: z.number().int().min(1).optional(),
    timer_seconds: z.number().int().min(0),
    buy_time_left: z.number().int().min(0).optional(),
    can_move: z.boolean(),
    can_shoot: z.boolean(),
    can_buy: z.boolean(),
    is_overtime: z.boolean().optional(),
    match_winner: z.enum(["ct", "t"]).optional(),
    teams: z
      .array(
        z.object({
          id: z.enum(["ct", "t"]),
          score: z.number().int().optional(),
        }),
      )
      .optional(),
  }),

  round_started: z.object({
    phase: z.enum(["waiting", "freeze", "live", "ended", "match_over"]),
    round_number: z.number().int().min(1),
    regulation_rounds: z.number().int().min(1),
    timer_seconds: z.number().int().min(0),
    can_move: z.boolean(),
    can_shoot: z.boolean(),
    can_buy: z.boolean(),
    announcement: z.string(),
    teams: z.array(z.object({ id: z.enum(["ct", "t"]) })).optional(),
  }),

  round_ended: z.object({
    round_number: z.number().int().min(1),
    winner: z.enum(["ct", "t"]),
    reason: z.enum(["elimination", "time"]),
    announcement: z.string(),
    is_halftime: z.boolean().optional(),
    is_overtime: z.boolean().optional(),
    mvp: z
      .object({
        player_id: z.string(),
        name: z.string(),
        kills: z.number().int().min(0),
        damage: z.number().int().min(0),
      })
      .optional(),
    teams: z.array(z.object({ id: z.enum(["ct", "t"]) })).optional(),
  }),

  match_ended: z.object({
    winner: z.enum(["ct", "t"]),
    round_number: z.number().int().min(1),
    is_overtime: z.boolean().optional(),
    teams: z.array(z.object({ id: z.enum(["ct", "t"]) })).optional(),
  }),

  c4_planted: z.object({
    player_id: z.string(),
    position: z.object({
      x: z.number(),
      y: z.number(),
      z: z.number(),
    }),
    team: z.enum(["ct", "t"]).optional(),
    explosion_in: z.number().int().min(0).optional(),
  }),

  c4_exploded: z.object({
    position: z.object({
      x: z.number(),
      y: z.number(),
      z: z.number(),
    }),
  }),

  c4_defused: z.object({
    player_id: z.string(),
    team: z.enum(["ct", "t"]).optional(),
  }),

  grenade_thrown: z.object({
    player_id: z.string(),
    type: z.enum(["flashbang", "smoke", "he", "molotov", "decoy"]),
    position: z.object({
      x: z.number(),
      y: z.number(),
      z: z.number(),
    }),
    velocity: z.object({
      x: z.number(),
      y: z.number(),
      z: z.number(),
    }),
  }),

  voice_start: z.object({
    playerId: z.string(),
  }),

  voice_data: z.object({
    playerId: z.string(),
    audio: z.string(),
  }),

  voice_stop: z.object({
    playerId: z.string(),
  }),
};

// 验证函数
function validateMessage(type, data) {
  const schema = schemas[type];
  if (!schema) {
    throw new Error(`Unknown message type: ${type}`);
  }
  return schema.parse(data);
}

// 测试
describe("Protocol Schema Tests", () => {
  describe("room_joined", () => {
    it("validates correct message", () => {
      const msg = {
        room_id: "room-123",
        player_id: "player-456",
        players: [{ id: "player-789", name: "TestPlayer" }],
      };
      expect(() => validateMessage("room_joined", msg)).not.toThrow();
    });

    it("rejects missing room_id", () => {
      const msg = {
        player_id: "player-456",
        players: [],
      };
      expect(() => validateMessage("room_joined", msg)).toThrow();
    });
  });

  describe("player_joined", () => {
    it("validates player with position", () => {
      const msg = {
        player_id: "player-123",
        name: "TestPlayer",
        position: { x: 10, y: 0, z: 20 },
        is_bot: false,
      };
      expect(() => validateMessage("player_joined", msg)).not.toThrow();
    });

    it("validates bot with difficulty", () => {
      const msg = {
        player_id: "bot-123",
        name: "Bot",
        is_bot: true,
        difficulty: "normal",
      };
      expect(() => validateMessage("player_joined", msg)).not.toThrow();
    });

    it("rejects missing player_id", () => {
      const msg = { name: "TestPlayer" };
      expect(() => validateMessage("player_joined", msg)).toThrow();
    });
  });

  describe("player_shot", () => {
    it("validates shot with all fields", () => {
      const msg = {
        player_id: "player-123",
        position: { x: 10, y: 1.7, z: 20 },
        rotation: 1.57,
        ammo: 29,
        weapon_id: "rifle",
        direction: { x: 0, y: 0, z: -1 },
      };
      expect(() => validateMessage("player_shot", msg)).not.toThrow();
    });

    it("validates minimal shot", () => {
      const msg = {
        player_id: "player-123",
        position: { x: 0, y: 0, z: 0 },
      };
      expect(() => validateMessage("player_shot", msg)).not.toThrow();
    });

    it("rejects missing position", () => {
      const msg = { player_id: "player-123" };
      expect(() => validateMessage("player_shot", msg)).toThrow();
    });
  });

  describe("player_damaged", () => {
    it("validates damage with attacker_position", () => {
      const msg = {
        player_id: "victim-123",
        attacker_id: "attacker-456",
        attacker_position: { x: 10, y: 0, z: 20 },
        damage: 25,
        hitbox: "body",
        remaining_health: 75,
      };
      expect(() => validateMessage("player_damaged", msg)).not.toThrow();
    });

    it("rejects missing required fields", () => {
      const msg = { player_id: "victim-123" };
      expect(() => validateMessage("player_damaged", msg)).toThrow();
    });
  });

  describe("player_killed", () => {
    it("validates a complete kill payload", () => {
      const msg = {
        victim_id: "victim-123",
        killer_id: "killer-456",
        weapon_id: "ak47",
        hitbox: "head",
        is_headshot: true,
        kill_distance: 23.5,
        is_bot: false,
      };
      expect(() => validateMessage("player_killed", msg)).not.toThrow();
    });

    it("rejects an invalid hitbox", () => {
      const msg = {
        victim_id: "victim-123",
        killer_id: "killer-456",
        hitbox: "torso",
      };
      expect(() => validateMessage("player_killed", msg)).toThrow();
    });
  });

  describe("armor_updated", () => {
    it("validates armor update", () => {
      const msg = {
        player_id: "player-123",
        armor: 75,
        has_helmet: true,
      };
      expect(() => validateMessage("armor_updated", msg)).not.toThrow();
    });

    it("rejects armor above maximum", () => {
      const msg = {
        player_id: "player-123",
        armor: 120,
      };
      expect(() => validateMessage("armor_updated", msg)).toThrow();
    });
  });

  describe("player_respawned", () => {
    it("validates respawn payload", () => {
      const msg = {
        player_id: "player-123",
        position: { x: 10, y: 0, z: -5 },
        health: 100,
        armor: 50,
        has_helmet: true,
        ammo: 30,
      };
      expect(() => validateMessage("player_respawned", msg)).not.toThrow();
    });

    it("rejects missing position", () => {
      const msg = {
        player_id: "player-123",
        health: 100,
      };
      expect(() => validateMessage("player_respawned", msg)).toThrow();
    });
  });

  describe("weapon_changed", () => {
    it("validates weapon change", () => {
      const msg = {
        player_id: "player-123",
        weapon: "awp",
      };
      expect(() => validateMessage("weapon_changed", msg)).not.toThrow();
    });

    it("rejects invalid weapon", () => {
      const msg = {
        player_id: "player-123",
        weapon: "laser",
      };
      expect(() => validateMessage("weapon_changed", msg)).toThrow();
    });
  });

  describe("money_updated", () => {
    it("validates a purchase update", () => {
      const msg = {
        player_id: "player-123",
        money: 150,
        delta: -650,
        reason: "purchase",
      };
      expect(() => validateMessage("money_updated", msg)).not.toThrow();
    });

    it("rejects invalid money update reasons", () => {
      const msg = {
        player_id: "player-123",
        money: 1100,
        reason: "bonus",
      };
      expect(() => validateMessage("money_updated", msg)).toThrow();
    });
  });

  describe("round_state", () => {
    it("validates an active round snapshot", () => {
      const msg = {
        phase: "freeze",
        round_number: 2,
        regulation_rounds: 30,
        timer_seconds: 5,
        buy_time_left: 15,
        can_move: false,
        can_shoot: false,
        can_buy: true,
        is_overtime: false,
        teams: [{ id: "ct", score: 1 }, { id: "t", score: 0 }],
      };
      expect(() => validateMessage("round_state", msg)).not.toThrow();
    });
  });

  describe("round_ended", () => {
    it("validates MVP payload", () => {
      const msg = {
        round_number: 9,
        winner: "ct",
        reason: "elimination",
        announcement: "CT win by elimination | MVP: Alice",
        is_halftime: false,
        is_overtime: false,
        mvp: {
          player_id: "alice",
          name: "Alice",
          kills: 2,
          damage: 145,
        },
      };
      expect(() => validateMessage("round_ended", msg)).not.toThrow();
    });
  });

  describe("match_ended", () => {
    it("validates match result payload", () => {
      const msg = {
        winner: "ct",
        round_number: 16,
        is_overtime: false,
      };
      expect(() => validateMessage("match_ended", msg)).not.toThrow();
    });

    it("rejects invalid winners", () => {
      const msg = {
        winner: "draw",
        round_number: 16,
      };
      expect(() => validateMessage("match_ended", msg)).toThrow();
    });
  });

  describe("c4 events", () => {
    it("validates c4_planted", () => {
      const msg = {
        player_id: "player-123",
        position: { x: 12, y: 0, z: -8 },
        team: "t",
        explosion_in: 40,
      };
      expect(() => validateMessage("c4_planted", msg)).not.toThrow();
    });

    it("validates c4_exploded", () => {
      const msg = {
        position: { x: 12, y: 0, z: -8 },
      };
      expect(() => validateMessage("c4_exploded", msg)).not.toThrow();
    });

    it("validates c4_defused", () => {
      const msg = {
        player_id: "player-123",
        team: "ct",
      };
      expect(() => validateMessage("c4_defused", msg)).not.toThrow();
    });

    it("rejects c4_planted without position", () => {
      const msg = {
        player_id: "player-123",
      };
      expect(() => validateMessage("c4_planted", msg)).toThrow();
    });
  });

  describe("grenade_thrown", () => {
    it("validates grenade throw payload", () => {
      const msg = {
        player_id: "player-123",
        type: "flashbang",
        position: { x: 1, y: 2, z: 3 },
        velocity: { x: 4, y: 5, z: 6 },
      };
      expect(() => validateMessage("grenade_thrown", msg)).not.toThrow();
    });

    it("rejects invalid grenade type", () => {
      const msg = {
        player_id: "player-123",
        type: "frag",
        position: { x: 1, y: 2, z: 3 },
        velocity: { x: 4, y: 5, z: 6 },
      };
      expect(() => validateMessage("grenade_thrown", msg)).toThrow();
    });
  });

  describe("voice events", () => {
    it("validates voice_start", () => {
      const msg = { playerId: "player-123" };
      expect(() => validateMessage("voice_start", msg)).not.toThrow();
    });

    it("validates voice_data", () => {
      const msg = {
        playerId: "player-123",
        audio: "base64encodeddata",
      };
      expect(() => validateMessage("voice_data", msg)).not.toThrow();
    });

    it("rejects voice_start without playerId", () => {
      const msg = {};
      expect(() => validateMessage("voice_start", msg)).toThrow();
    });
  });
});

// 导出 schema 供其他模块使用
export { schemas, validateMessage };
