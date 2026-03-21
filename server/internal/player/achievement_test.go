package player

import (
	"testing"
)

func TestAchievementSystem_Get(t *testing.T) {
	as := NewAchievementSystem()

	// 测试获取存在的成就
	a := as.Get("first-blood")
	if a == nil {
		t.Fatal("Achievement should exist")
	}

	if a.Name != "首杀" {
		t.Errorf("Name = %s, want 首杀", a.Name)
	}

	// 测试获取不存在的成就
	a = as.Get("non-existent")
	if a != nil {
		t.Error("Non-existent achievement should be nil")
	}
}

func TestAchievementSystem_GetAll(t *testing.T) {
	as := NewAchievementSystem()

	all := as.GetAll()
	if len(all) == 0 {
		t.Error("Should have achievements")
	}
}

func TestAchievementSystem_GetByCategory(t *testing.T) {
	as := NewAchievementSystem()

	kills := as.GetByCategory("kills")
	if len(kills) == 0 {
		t.Error("Should have kill achievements")
	}

	for _, a := range kills {
		if a.Category != "kills" {
			t.Errorf("Category = %s, want kills", a.Category)
		}
	}
}

func TestPlayerAchievements_Unlock(t *testing.T) {
	pa := NewPlayerAchievements("player1")

	// 解锁成就
	unlocked := pa.Unlock("first-blood", 10)
	if !unlocked {
		t.Error("Should unlock achievement")
	}

	if pa.TotalPoints != 10 {
		t.Errorf("TotalPoints = %d, want 10", pa.TotalPoints)
	}

	// 重复解锁
	unlocked = pa.Unlock("first-blood", 10)
	if unlocked {
		t.Error("Should not unlock same achievement twice")
	}

	if pa.TotalPoints != 10 {
		t.Errorf("TotalPoints = %d, want 10 (unchanged)", pa.TotalPoints)
	}
}

func TestPlayerAchievements_IsUnlocked(t *testing.T) {
	pa := NewPlayerAchievements("player1")

	if pa.IsUnlocked("first-blood") {
		t.Error("Achievement should not be unlocked yet")
	}

	pa.Unlock("first-blood", 10)

	if !pa.IsUnlocked("first-blood") {
		t.Error("Achievement should be unlocked")
	}
}

func TestStats_KD(t *testing.T) {
	stats := NewStats("player1")

	stats.AddKill("pistol", false)
	stats.AddKill("pistol", true)
	stats.AddDeath()

	kd := stats.GetKD()
	if kd != 2.0 {
		t.Errorf("KD = %f, want 2.0", kd)
	}
}

func TestStats_WinRate(t *testing.T) {
	stats := NewStats("player1")

	stats.AddMatch()
	stats.AddWin()

	stats.AddMatch()
	stats.AddLoss()

	winRate := stats.GetWinRate()
	if winRate != 0.5 {
		t.Errorf("WinRate = %f, want 0.5", winRate)
	}
}

func TestStats_HeadshotRate(t *testing.T) {
	stats := NewStats("player1")

	stats.AddKill("sniper", true)
	stats.AddKill("sniper", true)
	stats.AddKill("pistol", false)

	rate := stats.GetHeadshotRate()
	if rate != 2.0/3.0 {
		t.Errorf("HeadshotRate = %f, want %f", rate, 2.0/3.0)
	}
}

func TestStats_WinStreak(t *testing.T) {
	stats := NewStats("player1")

	// 连续赢 3 次
	stats.AddWin()
	stats.AddWin()
	stats.AddWin()

	if stats.WinStreak != 3 {
		t.Errorf("WinStreak = %d, want 3", stats.WinStreak)
	}

	if stats.MaxWinStreak != 3 {
		t.Errorf("MaxWinStreak = %d, want 3", stats.MaxWinStreak)
	}

	// 输一次
	stats.AddLoss()

	if stats.WinStreak != 0 {
		t.Errorf("WinStreak should reset to 0 after loss")
	}

	if stats.MaxWinStreak != 3 {
		t.Errorf("MaxWinStreak should remain 3")
	}
}

func TestStats_WeaponKills(t *testing.T) {
	stats := NewStats("player1")

	stats.AddKill("pistol", false)
	stats.AddKill("pistol", false)
	stats.AddKill("sniper", true)

	if stats.WeaponKills["pistol"] != 2 {
		t.Errorf("Pistol kills = %d, want 2", stats.WeaponKills["pistol"])
	}

	if stats.WeaponKills["sniper"] != 1 {
		t.Errorf("Sniper kills = %d, want 1", stats.WeaponKills["sniper"])
	}
}

func TestStats_ToMap(t *testing.T) {
	stats := NewStats("player1")

	stats.AddKill("pistol", false)
	stats.AddDeath()
	stats.AddMatch()
	stats.AddWin()

	m := stats.ToMap()

	if m["kills"].(int) != 1 {
		t.Errorf("kills = %d, want 1", m["kills"])
	}

	if m["deaths"].(int) != 1 {
		t.Errorf("deaths = %d, want 1", m["deaths"])
	}

	if m["wins"].(int) != 1 {
		t.Errorf("wins = %d, want 1", m["wins"])
	}
}
