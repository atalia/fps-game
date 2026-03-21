package ai

import (
	"testing"
)

func TestNewBot(t *testing.T) {
	bot := NewBot("test_bot_1", DifficultyNormal)

	if bot == nil {
		t.Fatal("expected bot to be created")
	}

	if bot.ID != "test_bot_1" {
		t.Errorf("expected ID test_bot_1, got %s", bot.ID)
	}

	if bot.Health != 100 {
		t.Errorf("expected health 100, got %d", bot.Health)
	}

	if bot.State != StatePatrol {
		t.Errorf("expected initial state patrol, got %s", bot.State)
	}

	if bot.Config.Difficulty != DifficultyNormal {
		t.Errorf("expected normal difficulty, got %s", bot.Config.Difficulty)
	}

	if bot.Name == "" {
		t.Error("expected bot to have a name")
	}

	if len(bot.HitBoxes) == 0 {
		t.Error("expected bot to have hitboxes")
	}
}

func TestNewBot_DifferentDifficulties(t *testing.T) {
	difficulties := []Difficulty{DifficultyEasy, DifficultyNormal, DifficultyHard, DifficultyNightmare}

	for _, d := range difficulties {
		t.Run(string(d), func(t *testing.T) {
			bot := NewBot("test", d)
			if bot.Config.Difficulty != d {
				t.Errorf("expected %s, got %s", d, bot.Config.Difficulty)
			}
		})
	}
}

func TestBot_IsBot(t *testing.T) {
	bot := NewBot("test", DifficultyEasy)
	if !bot.IsBot() {
		t.Error("expected IsBot to return true")
	}
}

func TestBot_InitialState(t *testing.T) {
	bot := NewBot("test", DifficultyNormal)

	// 验证初始状态
	if bot.Target != nil {
		t.Error("expected initial target to be nil")
	}

	if len(bot.Path) != 0 {
		t.Error("expected initial path to be empty")
	}
}

func TestBot_PositionInitialization(t *testing.T) {
	bot := NewBot("test", DifficultyNormal)

	// 位置应该在 -50 到 50 范围内
	if bot.Position.X < -50 || bot.Position.X > 50 {
		t.Errorf("X position out of range: %f", bot.Position.X)
	}

	if bot.Position.Z < -50 || bot.Position.Z > 50 {
		t.Errorf("Z position out of range: %f", bot.Position.Z)
	}

	if bot.Position.Y != 0 {
		t.Errorf("expected Y position 0, got %f", bot.Position.Y)
	}
}
