package game

import (
	"testing"
)

func TestNewLeaderboard(t *testing.T) {
	lb := NewLeaderboard()

	if lb == nil {
		t.Fatal("Leaderboard should not be nil")
	}

	if len(lb.entries) != 0 {
		t.Fatal("Leaderboard should be empty")
	}
}

func TestLeaderboard_UpdateEntry(t *testing.T) {
	lb := NewLeaderboard()

	lb.UpdateEntry("player1", "Player One", 100, 10, 5)

	entry := lb.GetEntry("player1")
	if entry == nil {
		t.Fatal("Entry should exist")
	}

	if entry.Score != 100 {
		t.Errorf("Score = %d, want 100", entry.Score)
	}

	if entry.KD != 2.0 {
		t.Errorf("KD = %f, want 2.0", entry.KD)
	}
}

func TestLeaderboard_GetTopN(t *testing.T) {
	lb := NewLeaderboard()

	lb.UpdateEntry("player1", "Player One", 100, 10, 5)
	lb.UpdateEntry("player2", "Player Two", 200, 20, 3)
	lb.UpdateEntry("player3", "Player Three", 50, 5, 10)

	top := lb.GetTopN(2)

	if len(top) != 2 {
		t.Errorf("Top N length = %d, want 2", len(top))
	}

	if top[0].PlayerID != "player2" {
		t.Errorf("Top 1 = %s, want player2", top[0].PlayerID)
	}

	if top[0].Rank != 1 {
		t.Errorf("Rank = %d, want 1", top[0].Rank)
	}
}

func TestLeaderboard_GetPlayerRank(t *testing.T) {
	lb := NewLeaderboard()

	lb.UpdateEntry("player1", "Player One", 100, 10, 5)
	lb.UpdateEntry("player2", "Player Two", 200, 20, 3)
	lb.UpdateEntry("player3", "Player Three", 50, 5, 10)

	rank := lb.GetPlayerRank("player2")
	if rank != 1 {
		t.Errorf("Player2 rank = %d, want 1", rank)
	}
}

func TestLeaderboard_Clear(t *testing.T) {
	lb := NewLeaderboard()

	lb.UpdateEntry("player1", "Player One", 100, 10, 5)
	lb.Clear()

	if len(lb.entries) != 0 {
		t.Fatal("Leaderboard should be empty after clear")
	}
}

func TestLeaderboard_GetStats(t *testing.T) {
	lb := NewLeaderboard()

	lb.UpdateEntry("player1", "Player One", 100, 10, 5)
	lb.UpdateEntry("player2", "Player Two", 200, 20, 3)

	stats := lb.GetStats()

	if stats["total_players"].(int) != 2 {
		t.Errorf("Total players = %d, want 2", stats["total_players"])
	}

	if stats["total_kills"].(int) != 30 {
		t.Errorf("Total kills = %d, want 30", stats["total_kills"])
	}
}

func TestMatchLeaderboard(t *testing.T) {
	ml := NewMatchLeaderboard("room1")

	ml.RecordKill("player1", "Player One")
	ml.RecordKill("player1", "Player One")
	ml.RecordDeath("player1")

	entry := ml.entries["player1"]
	if entry.Kills != 2 {
		t.Errorf("Kills = %d, want 2", entry.Kills)
	}

	if entry.Score != 200 {
		t.Errorf("Score = %d, want 200", entry.Score)
	}
}

func TestMatchLeaderboard_GetMVP(t *testing.T) {
	ml := NewMatchLeaderboard("room1")

	ml.RecordKill("player1", "Player One")
	ml.RecordKill("player1", "Player One")
	ml.RecordKill("player2", "Player Two")

	mvp := ml.GetMVP()
	if mvp == nil {
		t.Fatal("MVP should not be nil")
	}

	if mvp.PlayerID != "player1" {
		t.Errorf("MVP = %s, want player1", mvp.PlayerID)
	}
}

func TestMatchLeaderboard_GetResults(t *testing.T) {
	ml := NewMatchLeaderboard("room1")

	ml.RecordKill("player1", "Player One")
	ml.RecordKill("player2", "Player Two")
	ml.RecordKill("player2", "Player Two")

	results := ml.GetResults()

	if len(results) != 2 {
		t.Errorf("Results length = %d, want 2", len(results))
	}

	if results[0].PlayerID != "player2" {
		t.Errorf("Winner = %s, want player2", results[0].PlayerID)
	}
}
