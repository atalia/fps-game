package game

import (
	"testing"
)

func TestNewTeamManager(t *testing.T) {
	tm := NewTeamManager()

	if tm == nil {
		t.Error("TeamManager should not be nil")
	}

	teams := tm.GetAllTeams()
	if len(teams) != 2 {
		t.Errorf("Expected 2 default teams, got %d", len(teams))
	}
}

func TestTeamManager_CreateTeam(t *testing.T) {
	tm := NewTeamManager()

	team := tm.CreateTeam("green", "绿队", "#4CAF50", 5)
	if team == nil {
		t.Error("Team should not be nil")
	}

	if team.Name != "绿队" {
		t.Errorf("Team name = %s, want 绿队", team.Name)
	}

	// 获取新创建的队伍
	team = tm.GetTeam("green")
	if team == nil {
		t.Error("Should find green team")
	}
}

func TestTeamManager_GetTeam(t *testing.T) {
	tm := NewTeamManager()

	// 默认队伍
	red := tm.GetTeam("red")
	if red == nil {
		t.Error("Should find red team")
	}

	if red.Name != "红队" {
		t.Errorf("Team name = %s, want 红队", red.Name)
	}

	// 不存在的队伍
	team := tm.GetTeam("nonexistent")
	if team != nil {
		t.Error("Should return nil for nonexistent team")
	}
}

func TestTeamManager_AddPlayerToTeam(t *testing.T) {
	tm := NewTeamManager()

	// 添加玩家
	if !tm.AddPlayerToTeam("red") {
		t.Error("Should add player to red team")
	}

	red := tm.GetTeam("red")
	if red.PlayerCount != 1 {
		t.Errorf("Player count = %d, want 1", red.PlayerCount)
	}
}

func TestTeamManager_AddPlayerToTeam_Full(t *testing.T) {
	tm := NewTeamManager()

	// 创建小队伍
	tm.CreateTeam("small", "小队", "#fff", 1)

	// 添加第一个玩家
	if !tm.AddPlayerToTeam("small") {
		t.Error("Should add first player")
	}

	// 添加第二个玩家（应该失败）
	if tm.AddPlayerToTeam("small") {
		t.Error("Should not add player to full team")
	}
}

func TestTeamManager_RemovePlayerFromTeam(t *testing.T) {
	tm := NewTeamManager()

	// 添加后移除
	tm.AddPlayerToTeam("red")
	tm.RemovePlayerFromTeam("red")

	red := tm.GetTeam("red")
	if red.PlayerCount != 0 {
		t.Errorf("Player count = %d, want 0", red.PlayerCount)
	}
}

func TestTeamManager_GetAutoAssignTeam(t *testing.T) {
	tm := NewTeamManager()

	// 初始应该返回第一个队伍
	team := tm.GetAutoAssignTeam()
	if team == "" {
		t.Error("Should return a team")
	}

	// 添加玩家到红队
	tm.AddPlayerToTeam("red")

	// 自动分配应该选择人少的蓝队
	team = tm.GetAutoAssignTeam()
	if team != "blue" {
		t.Errorf("Auto assign team = %s, want blue", team)
	}
}

func TestTeamManager_AddScore(t *testing.T) {
	tm := NewTeamManager()

	tm.AddScore("red", 10)
	tm.AddScore("red", 5)

	if tm.GetScore("red") != 15 {
		t.Errorf("Score = %d, want 15", tm.GetScore("red"))
	}
}

func TestTeamManager_ResetScores(t *testing.T) {
	tm := NewTeamManager()

	tm.AddScore("red", 100)
	tm.AddScore("blue", 50)
	tm.ResetScores()

	if tm.GetScore("red") != 0 || tm.GetScore("blue") != 0 {
		t.Error("Scores should be reset to 0")
	}
}

func TestTeamManager_GetWinningTeam(t *testing.T) {
	tm := NewTeamManager()

	tm.AddScore("red", 100)
	tm.AddScore("blue", 50)

	winner := tm.GetWinningTeam()
	if winner == nil || winner.ID != "red" {
		t.Error("Red team should be winning")
	}
}

func TestTeamManager_GetTeamCounts(t *testing.T) {
	tm := NewTeamManager()

	tm.AddPlayerToTeam("red")
	tm.AddPlayerToTeam("red")
	tm.AddPlayerToTeam("blue")

	counts := tm.GetTeamCounts()

	if counts["red"] != 2 {
		t.Errorf("Red team count = %d, want 2", counts["red"])
	}
	if counts["blue"] != 1 {
		t.Errorf("Blue team count = %d, want 1", counts["blue"])
	}
}
