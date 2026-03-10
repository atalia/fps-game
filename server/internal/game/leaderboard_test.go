package game

import (
	"testing"
)

func TestNewLeaderboard(t *testing.T) {
	lb := NewLeaderboard(100)

	if lb == nil {
		t.Error("Leaderboard should not be nil")
	}
	if lb.maxSize != 100 {
		t.Errorf("maxSize = %d, want 100", lb.maxSize)
	}
}

func TestLeaderboard_UpdateEntry(t *testing.T) {
	lb := NewLeaderboard(100)

	lb.UpdateEntry("player1", "TestPlayer", 100, 10, 5)

	if lb.Size() != 1 {
		t.Errorf("Size = %d, want 1", lb.Size())
	}

	entry := lb.GetEntry("player1")
	if entry == nil {
		t.Error("Entry should not be nil")
	}
	if entry.Name != "TestPlayer" {
		t.Errorf("Name = %s, want TestPlayer", entry.Name)
	}
	if entry.Score != 100 {
		t.Errorf("Score = %d, want 100", entry.Score)
	}
}

func TestLeaderboard_RemoveEntry(t *testing.T) {
	lb := NewLeaderboard(100)

	lb.UpdateEntry("player1", "TestPlayer", 100, 10, 5)
	lb.RemoveEntry("player1")

	if lb.Size() != 0 {
		t.Errorf("Size = %d, want 0", lb.Size())
	}

	entry := lb.GetEntry("player1")
	if entry != nil {
		t.Error("Entry should be nil after removal")
	}
}

func TestLeaderboard_GetTop(t *testing.T) {
	lb := NewLeaderboard(100)

	// 添加多个玩家
	lb.UpdateEntry("player1", "Player1", 100, 10, 5)
	lb.UpdateEntry("player2", "Player2", 200, 20, 3)
	lb.UpdateEntry("player3", "Player3", 150, 15, 8)

	top := lb.GetTop(3)

	if len(top) != 3 {
		t.Errorf("Top length = %d, want 3", len(top))
	}

	// 验证排序
	if top[0].Score != 200 {
		t.Errorf("Top 1 score = %d, want 200", top[0].Score)
	}
	if top[0].Rank != 1 {
		t.Errorf("Top 1 rank = %d, want 1", top[0].Rank)
	}
}

func TestLeaderboard_GetRank(t *testing.T) {
	lb := NewLeaderboard(100)

	lb.UpdateEntry("player1", "Player1", 100, 10, 5)
	lb.UpdateEntry("player2", "Player2", 200, 20, 3)
	lb.UpdateEntry("player3", "Player3", 150, 15, 8)

	// player2 分数最高，排名应该是 1
	rank := lb.GetRank("player2")
	if rank != 1 {
		t.Errorf("Rank = %d, want 1", rank)
	}

	// player1 分数最低，排名应该是 3
	rank = lb.GetRank("player1")
	if rank != 3 {
		t.Errorf("Rank = %d, want 3", rank)
	}

	// 不存在的玩家
	rank = lb.GetRank("nonexistent")
	if rank != -1 {
		t.Errorf("Rank = %d, want -1", rank)
	}
}

func TestLeaderboard_Clear(t *testing.T) {
	lb := NewLeaderboard(100)

	lb.UpdateEntry("player1", "Player1", 100, 10, 5)
	lb.Clear()

	if lb.Size() != 0 {
		t.Errorf("Size after clear = %d, want 0", lb.Size())
	}
}

func TestLeaderboard_GetStats(t *testing.T) {
	lb := NewLeaderboard(100)

	lb.UpdateEntry("player1", "Player1", 100, 10, 5)
	lb.UpdateEntry("player2", "Player2", 200, 20, 3)

	stats := lb.GetStats()

	if stats.TotalPlayers != 2 {
		t.Errorf("TotalPlayers = %d, want 2", stats.TotalPlayers)
	}
	if stats.TotalKills != 30 {
		t.Errorf("TotalKills = %d, want 30", stats.TotalKills)
	}
	if stats.TotalDeaths != 8 {
		t.Errorf("TotalDeaths = %d, want 8", stats.TotalDeaths)
	}
	if stats.TotalScore != 300 {
		t.Errorf("TotalScore = %d, want 300", stats.TotalScore)
	}
}

func TestLeaderboardEntry_CalculateKD(t *testing.T) {
	tests := []struct {
		kills   int
		deaths  int
		wantKD  float64
	}{
		{10, 5, 2.0},
		{10, 0, 10.0},
		{0, 10, 0.0},
		{0, 0, 0.0},
	}

	for _, tt := range tests {
		entry := LeaderboardEntry{
			Kills:  tt.kills,
			Deaths: tt.deaths,
		}
		entry.CalculateKD()

		if entry.KD != tt.wantKD {
			t.Errorf("KD for %d/%d = %f, want %f", tt.kills, tt.deaths, entry.KD, tt.wantKD)
		}
	}
}

func TestMatchStats(t *testing.T) {
	match := NewMatchStats("match1", []string{"p1", "p2", "p3"})

	if match.MatchID != "match1" {
		t.Errorf("MatchID = %s, want match1", match.MatchID)
	}
	if len(match.Players) != 3 {
		t.Errorf("Players length = %d, want 3", len(match.Players))
	}
}

func TestMatchStats_RecordKill(t *testing.T) {
	match := NewMatchStats("match1", []string{"p1", "p2"})

	match.RecordKill("p1", "p2")

	if match.Kills["p1"] != 1 {
		t.Errorf("Kills[p1] = %d, want 1", match.Kills["p1"])
	}
	if match.Deaths["p2"] != 1 {
		t.Errorf("Deaths[p2] = %d, want 1", match.Deaths["p2"])
	}
}

func TestMatchStats_RecordScore(t *testing.T) {
	match := NewMatchStats("match1", []string{"p1"})

	match.RecordScore("p1", 100)
	match.RecordScore("p1", 50)

	if match.Scores["p1"] != 150 {
		t.Errorf("Scores[p1] = %d, want 150", match.Scores["p1"])
	}
}

func TestMatchStats_EndMatch(t *testing.T) {
	match := NewMatchStats("match1", []string{"p1", "p2"})

	match.RecordKill("p1", "p2")
	match.RecordScore("p1", 100)
	match.EndMatch("p1")

	if match.Winner != "p1" {
		t.Errorf("Winner = %s, want p1", match.Winner)
	}
	if match.Duration == 0 {
		t.Error("Duration should not be zero")
	}

	lb := match.GetLeaderboard()
	if len(lb) != 2 {
		t.Errorf("Leaderboard length = %d, want 2", len(lb))
	}
	if lb[0].GeoID != "p1" {
		t.Errorf("Winner should be p1, got %s", lb[0].GeoID)
	}
}
