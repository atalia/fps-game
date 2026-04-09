// Package balance provides configurable game balance parameters.
// These values can be tuned based on telemetry data.
package balance

import (
	"sync"
	"time"
)

// Config holds all balance parameters.
type Config struct {
	mu sync.RWMutex

	// 经济系统
	Economy EconomyConfig

	// 武器参数
	Weapons map[string]WeaponConfig

	// 机器人难度
	Bot BotConfig

	// 命中倍率
	Hitbox HitboxConfig
}

// EconomyConfig holds economy-related balance parameters.
type EconomyConfig struct {
	StartMoney      int
	KillReward      int
	RoundWinReward  int
	RoundLossReward int
	LossBonusCap    int // 连败奖励上限
}

// WeaponConfig holds weapon balance parameters.
type WeaponConfig struct {
	Damage       int
	FireRate     time.Duration
	MagazineSize int
	MaxAmmo      int
	Range        float64
	Recoil       float64
	Spread       float64
	Price        int
}

// BotConfig holds bot behavior parameters.
type BotConfig struct {
	// 难度系数 (0.0-1.0)
	AimAccuracy    float64
	ReactionTime   time.Duration
	DecisionSpeed  time.Duration
	Aggressiveness float64

	// 难度预设
	DifficultyPreset string // easy, normal, hard, nightmare
}

// HitboxConfig holds hitbox damage multipliers.
type HitboxConfig struct {
	HeadMultiplier   float64
	BodyMultiplier   float64
	ArmMultiplier    float64
	LegMultiplier    float64
	MinDamageFactor  float64 // 最小伤害比例 (距离衰减后)
}

// DefaultConfig returns the default balance configuration.
func DefaultConfig() *Config {
	return &Config{
		Economy: EconomyConfig{
			StartMoney:      800,
			KillReward:      300,
			RoundWinReward:  3000,
			RoundLossReward: 1400,
			LossBonusCap:    3400,
		},
		Weapons: map[string]WeaponConfig{
			"pistol": {
				Damage:       25,
				FireRate:     300 * time.Millisecond,
				MagazineSize: 12,
				MaxAmmo:      48,
				Range:        50,
				Recoil:       0.1,
				Spread:       0.02,
				Price:        400,
			},
			"rifle": {
				Damage:       30,
				FireRate:     100 * time.Millisecond,
				MagazineSize: 30,
				MaxAmmo:      90,
				Range:        100,
				Recoil:       0.15,
				Spread:       0.03,
				Price:        2700,
			},
			"shotgun": {
				Damage:       15, // 每颗弹丸
				FireRate:     800 * time.Millisecond,
				MagazineSize: 8,
				MaxAmmo:      32,
				Range:        20,
				Recoil:       0.3,
				Spread:       0.15,
				Price:        1800,
			},
			"sniper": {
				Damage:       100,
				FireRate:     1500 * time.Millisecond,
				MagazineSize: 10,
				MaxAmmo:      30,
				Range:        200,
				Recoil:       0.4,
				Spread:       0.001,
				Price:        4750,
			},
			"smg": {
				Damage:       22,
				FireRate:     70 * time.Millisecond,
				MagazineSize: 25,
				MaxAmmo:      75,
				Range:        40,
				Recoil:       0.12,
				Spread:       0.05,
				Price:        1500,
			},
		},
		Bot: BotConfig{
			AimAccuracy:     0.7,
			ReactionTime:    300 * time.Millisecond,
			DecisionSpeed:   500 * time.Millisecond,
			Aggressiveness:  0.5,
			DifficultyPreset: "normal",
		},
		Hitbox: HitboxConfig{
			HeadMultiplier:  2.5,
			BodyMultiplier:  1.0,
			ArmMultiplier:   0.8,
			LegMultiplier:   0.7,
			MinDamageFactor: 0.3,
		},
	}
}

// Global balance config instance.
var global *Config

func init() {
	global = DefaultConfig()
}

// Get returns the global balance config.
func Get() *Config {
	return global
}

// SetDifficulty sets bot difficulty preset.
func (c *Config) SetDifficulty(preset string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.Bot.DifficultyPreset = preset
	switch preset {
	case "easy":
		c.Bot.AimAccuracy = 0.4
		c.Bot.ReactionTime = 600 * time.Millisecond
		c.Bot.DecisionSpeed = 800 * time.Millisecond
		c.Bot.Aggressiveness = 0.3
	case "normal":
		c.Bot.AimAccuracy = 0.6
		c.Bot.ReactionTime = 400 * time.Millisecond
		c.Bot.DecisionSpeed = 600 * time.Millisecond
		c.Bot.Aggressiveness = 0.5
	case "hard":
		c.Bot.AimAccuracy = 0.8
		c.Bot.ReactionTime = 200 * time.Millisecond
		c.Bot.DecisionSpeed = 400 * time.Millisecond
		c.Bot.Aggressiveness = 0.7
	case "nightmare":
		c.Bot.AimAccuracy = 0.95
		c.Bot.ReactionTime = 100 * time.Millisecond
		c.Bot.DecisionSpeed = 200 * time.Millisecond
		c.Bot.Aggressiveness = 0.9
	}
}

// GetWeapon returns weapon config by name.
func (c *Config) GetWeapon(name string) WeaponConfig {
	c.mu.RLock()
	defer c.mu.RUnlock()

	if w, ok := c.Weapons[name]; ok {
		return w
	}
	return c.Weapons["pistol"] // default fallback
}

// GetHitboxMultiplier returns damage multiplier for hitbox type.
func (c *Config) GetHitboxMultiplier(hitboxType string) float64 {
	c.mu.RLock()
	defer c.mu.RUnlock()

	switch hitboxType {
	case "head":
		return c.Hitbox.HeadMultiplier
	case "body":
		return c.Hitbox.BodyMultiplier
	case "arm":
		return c.Hitbox.ArmMultiplier
	case "leg":
		return c.Hitbox.LegMultiplier
	default:
		return 1.0
	}
}

// Snapshot returns a snapshot of current config for logging/debugging.
func (c *Config) Snapshot() map[string]interface{} {
	c.mu.RLock()
	defer c.mu.RUnlock()

	weapons := make(map[string]interface{})
	for k, v := range c.Weapons {
		weapons[k] = map[string]interface{}{
			"damage":        v.Damage,
			"fire_rate_ms":  v.FireRate.Milliseconds(),
			"magazine_size": v.MagazineSize,
			"max_ammo":      v.MaxAmmo,
			"range":         v.Range,
			"recoil":        v.Recoil,
			"spread":        v.Spread,
			"price":         v.Price,
		}
	}

	return map[string]interface{}{
		"economy": map[string]interface{}{
			"start_money":       c.Economy.StartMoney,
			"kill_reward":       c.Economy.KillReward,
			"round_win_reward":  c.Economy.RoundWinReward,
			"round_loss_reward": c.Economy.RoundLossReward,
			"loss_bonus_cap":    c.Economy.LossBonusCap,
		},
		"weapons": weapons,
		"bot": map[string]interface{}{
			"aim_accuracy":     c.Bot.AimAccuracy,
			"reaction_time_ms": c.Bot.ReactionTime.Milliseconds(),
			"decision_speed_ms": c.Bot.DecisionSpeed.Milliseconds(),
			"aggressiveness":   c.Bot.Aggressiveness,
			"difficulty":       c.Bot.DifficultyPreset,
		},
		"hitbox": map[string]interface{}{
			"head_multiplier":  c.Hitbox.HeadMultiplier,
			"body_multiplier":  c.Hitbox.BodyMultiplier,
			"arm_multiplier":   c.Hitbox.ArmMultiplier,
			"leg_multiplier":   c.Hitbox.LegMultiplier,
			"min_damage_factor": c.Hitbox.MinDamageFactor,
		},
	}
}

// Reset resets to default configuration.
func (c *Config) Reset() {
	c.mu.Lock()
	defer c.mu.Unlock()

	defaults := DefaultConfig()
	c.Economy = defaults.Economy
	c.Weapons = defaults.Weapons
	c.Bot = defaults.Bot
	c.Hitbox = defaults.Hitbox
}
