package ai

import (
	"testing"
)

func TestNewManager(t *testing.T) {
	m := NewManager()

	if m == nil {
		t.Fatal("expected manager to be created")
	}

	if m.autoFill != true {
		t.Error("expected autoFill to be true by default")
	}

	if m.maxBots != 10 {
		t.Error("expected maxBots to be 10 by default")
	}

	if m.defaultDifficulty != DifficultyNormal {
		t.Error("expected default difficulty to be normal")
	}
}

func TestManager_AddBot(t *testing.T) {
	m := NewManager()

	bot := m.AddBot(DifficultyNormal, "")

	if bot == nil {
		t.Fatal("expected bot to be added")
	}

	if m.GetBotCount() != 1 {
		t.Errorf("expected 1 bot, got %d", m.GetBotCount())
	}
}

func TestManager_AddBot_MaxLimit(t *testing.T) {
	m := NewManager()
	m.maxBots = 2

	// 添加两个机器人
	m.AddBot(DifficultyEasy, "")
	m.AddBot(DifficultyEasy, "")

	// 第三个应该失败
	bot := m.AddBot(DifficultyEasy, "")
	if bot != nil {
		t.Error("expected nil when max bots reached")
	}

	if m.GetBotCount() != 2 {
		t.Errorf("expected 2 bots, got %d", m.GetBotCount())
	}
}

func TestManager_AddBot_WithTeam(t *testing.T) {
	m := NewManager()

	bot := m.AddBot(DifficultyNormal, "red")
	if bot == nil {
		t.Fatal("expected bot to be added")
	}

	if bot.Team != "red" {
		t.Errorf("expected team red, got %s", bot.Team)
	}
}

func TestManager_RemoveBot(t *testing.T) {
	m := NewManager()

	bot := m.AddBot(DifficultyNormal, "")
	if bot == nil {
		t.Fatal("expected bot to be added")
	}

	m.RemoveBot(bot.ID)

	if m.GetBotCount() != 0 {
		t.Errorf("expected 0 bots, got %d", m.GetBotCount())
	}
}

func TestManager_GetBot(t *testing.T) {
	m := NewManager()

	bot := m.AddBot(DifficultyNormal, "")

	found := m.GetBot(bot.ID)
	if found == nil {
		t.Fatal("expected to find bot")
	}

	if found.ID != bot.ID {
		t.Errorf("expected ID %s, got %s", bot.ID, found.ID)
	}
}

func TestManager_GetBot_NotFound(t *testing.T) {
	m := NewManager()

	found := m.GetBot("nonexistent")
	if found != nil {
		t.Error("expected nil for nonexistent bot")
	}
}

func TestManager_GetAllBots(t *testing.T) {
	m := NewManager()

	m.AddBot(DifficultyEasy, "")
	m.AddBot(DifficultyNormal, "")

	bots := m.GetAllBots()

	if len(bots) != 2 {
		t.Errorf("expected 2 bots, got %d", len(bots))
	}
}

func TestManager_AutoFill(t *testing.T) {
	m := NewManager()
	room := NewMockRoom()

	// 目标 4 个玩家，当前 1 个真人
	added := m.AutoFill(room, 1, 4)

	if len(added) != 3 {
		t.Errorf("expected 3 bots to be added, got %d", len(added))
	}

	if m.GetBotCount() != 3 {
		t.Errorf("expected 3 total bots, got %d", m.GetBotCount())
	}
}

func TestManager_AutoFill_Disabled(t *testing.T) {
	m := NewManager()
	m.SetAutoFill(false)
	room := NewMockRoom()

	added := m.AutoFill(room, 1, 4)

	if len(added) != 0 {
		t.Errorf("expected 0 bots when autoFill disabled, got %d", len(added))
	}
}

func TestManager_AutoFill_MaxLimit(t *testing.T) {
	m := NewManager()
	m.maxBots = 2
	room := NewMockRoom()

	// 目标 10 个玩家，但最大只能 2 个机器人
	added := m.AutoFill(room, 1, 10)

	if len(added) != 2 {
		t.Errorf("expected 2 bots due to max limit, got %d", len(added))
	}
}

func TestManager_SetAutoFill(t *testing.T) {
	m := NewManager()

	m.SetAutoFill(false)
	if m.autoFill != false {
		t.Error("expected autoFill to be false")
	}

	m.SetAutoFill(true)
	if m.autoFill != true {
		t.Error("expected autoFill to be true")
	}
}

func TestManager_SetDefaultDifficulty(t *testing.T) {
	m := NewManager()

	m.SetDefaultDifficulty(DifficultyHard)
	if m.defaultDifficulty != DifficultyHard {
		t.Errorf("expected hard difficulty, got %s", m.defaultDifficulty)
	}
}

func TestManager_UpdateAll(t *testing.T) {
	m := NewManager()

	bot := m.AddBot(DifficultyNormal, "")
	bot.Position.X = 0
	bot.Position.Z = 0

	room := NewMockRoom()

	// 更新所有机器人
	m.UpdateAll(room, 1.0)

	// 不应该 panic，状态可能改变
	_ = bot.State
}
