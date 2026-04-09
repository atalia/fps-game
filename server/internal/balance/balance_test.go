package balance

import (
	"testing"
	"time"
)

func TestDefaultConfig(t *testing.T) {
	cfg := DefaultConfig()

	if cfg.Economy.StartMoney != 800 {
		t.Errorf("StartMoney = %d, want 800", cfg.Economy.StartMoney)
	}

	if cfg.Bot.DifficultyPreset != "normal" {
		t.Errorf("DifficultyPreset = %s, want normal", cfg.Bot.DifficultyPreset)
	}

	if len(cfg.Weapons) == 0 {
		t.Error("Weapons map is empty")
	}
}

func TestSetDifficulty(t *testing.T) {
	cfg := DefaultConfig()

	// Test easy
	cfg.SetDifficulty("easy")
	if cfg.Bot.AimAccuracy != 0.4 {
		t.Errorf("easy AimAccuracy = %f, want 0.4", cfg.Bot.AimAccuracy)
	}
	if cfg.Bot.DifficultyPreset != "easy" {
		t.Errorf("DifficultyPreset = %s, want easy", cfg.Bot.DifficultyPreset)
	}

	// Test nightmare
	cfg.SetDifficulty("nightmare")
	if cfg.Bot.AimAccuracy != 0.95 {
		t.Errorf("nightmare AimAccuracy = %f, want 0.95", cfg.Bot.AimAccuracy)
	}
	if cfg.Bot.ReactionTime != 100*time.Millisecond {
		t.Errorf("nightmare ReactionTime = %v, want 100ms", cfg.Bot.ReactionTime)
	}
}

func TestGetWeapon(t *testing.T) {
	cfg := DefaultConfig()

	rifle := cfg.GetWeapon("rifle")
	if rifle.Damage != 30 {
		t.Errorf("rifle Damage = %d, want 30", rifle.Damage)
	}
	if rifle.FireRate != 100*time.Millisecond {
		t.Errorf("rifle FireRate = %v, want 100ms", rifle.FireRate)
	}

	// Test fallback
	unknown := cfg.GetWeapon("unknown_weapon")
	if unknown.Damage == 0 {
		t.Error("unknown weapon should fallback to pistol")
	}
}

func TestGetHitboxMultiplier(t *testing.T) {
	cfg := DefaultConfig()

	tests := []struct {
		hitbox   string
		expected float64
	}{
		{"head", 2.5},
		{"body", 1.0},
		{"arm", 0.8},
		{"leg", 0.7},
		{"unknown", 1.0},
	}

	for _, tt := range tests {
		got := cfg.GetHitboxMultiplier(tt.hitbox)
		if got != tt.expected {
			t.Errorf("GetHitboxMultiplier(%s) = %f, want %f", tt.hitbox, got, tt.expected)
		}
	}
}

func TestSnapshot(t *testing.T) {
	cfg := DefaultConfig()
	snapshot := cfg.Snapshot()

	economy, ok := snapshot["economy"].(map[string]interface{})
	if !ok {
		t.Fatal("economy not found in snapshot")
	}

	if economy["start_money"] != 800 {
		t.Errorf("start_money = %v, want 800", economy["start_money"])
	}

	bot, ok := snapshot["bot"].(map[string]interface{})
	if !ok {
		t.Fatal("bot not found in snapshot")
	}

	if bot["difficulty"] != "normal" {
		t.Errorf("difficulty = %v, want normal", bot["difficulty"])
	}
}

func TestReset(t *testing.T) {
	cfg := DefaultConfig()

	// Modify
	cfg.SetDifficulty("nightmare")
	cfg.Economy.StartMoney = 9999

	// Reset
	cfg.Reset()

	if cfg.Bot.DifficultyPreset != "normal" {
		t.Errorf("after Reset, DifficultyPreset = %s, want normal", cfg.Bot.DifficultyPreset)
	}
	if cfg.Economy.StartMoney != 800 {
		t.Errorf("after Reset, StartMoney = %d, want 800", cfg.Economy.StartMoney)
	}
}

func TestGlobalConfig(t *testing.T) {
	global := Get()
	if global == nil {
		t.Fatal("Get() returned nil")
	}

	// Reset for clean state
	global.Reset()

	// Test SetDifficulty affects global
	global.SetDifficulty("hard")
	if global.Bot.DifficultyPreset != "hard" {
		t.Errorf("global difficulty = %s, want hard", global.Bot.DifficultyPreset)
	}

	// Reset
	global.Reset()
}
