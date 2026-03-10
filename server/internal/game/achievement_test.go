package game

import (
	"testing"
)

func TestNewAchievementManager(t *testing.T) {
	am := NewAchievementManager()

	if am == nil {
		t.Error("AchievementManager should not be nil")
	}

	achievements := am.GetAllAchievements()
	if len(achievements) == 0 {
		t.Error("Should have default achievements")
	}
}

func TestAchievementManager_GetAchievement(t *testing.T) {
	am := NewAchievementManager()

	achievement := am.GetAchievement("first_blood")
	if achievement == nil {
		t.Error("Should find first_blood achievement")
	}

	if achievement.Name != "第一滴血" {
		t.Errorf("Achievement name = %s, want 第一滴血", achievement.Name)
	}

	// 不存在的成就
	achievement = am.GetAchievement("nonexistent")
	if achievement != nil {
		t.Error("Should return nil for nonexistent achievement")
	}
}

func TestAchievementManager_GetVisibleAchievements(t *testing.T) {
	am := NewAchievementManager()

	visible := am.GetVisibleAchievements()
	hidden := 0

	for _, a := range visible {
		if a.Hidden {
			hidden++
		}
	}

	if hidden > 0 {
		t.Error("Visible achievements should not include hidden ones")
	}
}

func TestAchievementManager_UpdateProgress(t *testing.T) {
	am := NewAchievementManager()

	// 更新击杀进度
	completed := am.UpdateProgress("player1", AchievementKill, 1)

	// 第一次击杀应该完成 first_blood 成就
	found := false
	for _, c := range completed {
		if c.AchievementID == "first_blood" {
			found = true
			if !c.Completed {
				t.Error("first_blood should be completed")
			}
		}
	}

	if !found {
		t.Error("Should complete first_blood achievement")
	}
}

func TestAchievementManager_UpdateProgress_Partial(t *testing.T) {
	am := NewAchievementManager()

	// 击杀 5 人（目标 10）
	am.UpdateProgress("player1", AchievementKill, 5)

	progress := am.GetPlayerProgress("player1")
	for _, p := range progress {
		if p.AchievementID == "killer_10" {
			if p.Completed {
				t.Error("killer_10 should not be completed yet")
			}
			if p.Progress != 5 {
				t.Errorf("Progress = %d, want 5", p.Progress)
			}
		}
	}
}

func TestAchievementManager_GetCompletedAchievements(t *testing.T) {
	am := NewAchievementManager()

	// 完成 first_blood
	am.UpdateProgress("player1", AchievementKill, 1)

	completed := am.GetCompletedAchievements("player1")
	if len(completed) == 0 {
		t.Error("Should have completed achievements")
	}

	found := false
	for _, a := range completed {
		if a.ID == "first_blood" {
			found = true
		}
	}

	if !found {
		t.Error("first_blood should be in completed list")
	}
}

func TestAchievementManager_CalculateTotalReward(t *testing.T) {
	am := NewAchievementManager()

	// 完成多个成就
	am.UpdateProgress("player1", AchievementKill, 1)
	am.UpdateProgress("player1", AchievementHeadshot, 1)

	reward := am.CalculateTotalReward("player1")

	// first_blood (100) + headshot_1 (200) = 300
	if reward < 300 {
		t.Errorf("Total reward = %d, should be at least 300", reward)
	}
}

func TestAchievementManager_MultiplePlayers(t *testing.T) {
	am := NewAchievementManager()

	// 两个玩家
	am.UpdateProgress("player1", AchievementKill, 1)
	am.UpdateProgress("player2", AchievementKill, 5)

	p1Progress := am.GetPlayerProgress("player1")
	p2Progress := am.GetPlayerProgress("player2")

	if len(p1Progress) == 0 || len(p2Progress) == 0 {
		t.Error("Both players should have progress")
	}
}

func TestAchievementManager_HiddenAchievement(t *testing.T) {
	am := NewAchievementManager()

	// 获取隐藏成就
	oneShot := am.GetAchievement("one_shot")
	if oneShot == nil {
		t.Error("Should find hidden achievement")
	}
	if !oneShot.Hidden {
		t.Error("one_shot should be hidden")
	}
}
