package game

import "testing"

func TestNewTeamManager(t *testing.T) {
	tm := NewTeamManager()

	if tm == nil {
		t.Fatal("Team manager should not be nil")
	}

	teams := tm.GetAllTeams()
	if len(teams) != 2 {
		t.Fatalf("Expected 2 default teams, got %d", len(teams))
	}
	if teams[0].ID != TeamCounterTerrorists || teams[1].ID != TeamTerrorists {
		t.Fatalf("Unexpected default team order: %+v", teams)
	}
}

func TestNormalizeTeamID(t *testing.T) {
	tests := map[string]string{
		"blue": TeamCounterTerrorists,
		"ct":   TeamCounterTerrorists,
		"red":  TeamTerrorists,
		"t":    TeamTerrorists,
	}

	for input, want := range tests {
		if got := NormalizeTeamID(input); got != want {
			t.Errorf("NormalizeTeamID(%q) = %q, want %q", input, got, want)
		}
	}
}

func TestTeamManager_AddAndRemovePlayer(t *testing.T) {
	tm := NewTeamManager()

	if !tm.AddPlayerToTeam(TeamCounterTerrorists) {
		t.Fatal("Should add player to CT")
	}
	tm.RemovePlayerFromTeam("blue")

	ct := tm.GetTeam(TeamCounterTerrorists)
	if ct.PlayerCount != 0 {
		t.Fatalf("PlayerCount = %d, want 0", ct.PlayerCount)
	}
}

func TestTeamManager_GetAutoAssignTeamBalancesCounts(t *testing.T) {
	tm := NewTeamManager()
	tm.AddPlayerToTeam(TeamCounterTerrorists)

	team := tm.GetAutoAssignTeam()
	if team != TeamTerrorists {
		t.Fatalf("GetAutoAssignTeam() = %s, want %s", team, TeamTerrorists)
	}
}

func TestTeamManager_CanJoinTeamPreventsOverstacking(t *testing.T) {
	tm := NewTeamManager()
	tm.AddPlayerToTeam(TeamCounterTerrorists)
	tm.AddPlayerToTeam(TeamCounterTerrorists)
	tm.AddPlayerToTeam(TeamTerrorists)

	if tm.CanJoinTeam(TeamCounterTerrorists, "") {
		t.Fatal("Should block joining the fuller team")
	}
	if !tm.CanJoinTeam(TeamTerrorists, "") {
		t.Fatal("Should allow joining the smaller team")
	}
}

func TestTeamManager_AddScoreAndWinner(t *testing.T) {
	tm := NewTeamManager()
	tm.AddScore(TeamCounterTerrorists, 2)
	tm.AddScore(TeamTerrorists, 1)

	if score := tm.GetScore("ct"); score != 2 {
		t.Fatalf("CT score = %d, want 2", score)
	}

	winner := tm.GetWinningTeam()
	if winner == nil || winner.ID != TeamCounterTerrorists {
		t.Fatalf("Winner = %+v, want CT", winner)
	}
}

func TestTeamManager_GetTeamCounts(t *testing.T) {
	tm := NewTeamManager()
	tm.AddPlayerToTeam(TeamCounterTerrorists)
	tm.AddPlayerToTeam(TeamTerrorists)

	counts := tm.GetTeamCounts()
	if counts[TeamCounterTerrorists] != 1 || counts[TeamTerrorists] != 1 {
		t.Fatalf("Unexpected counts: %+v", counts)
	}
}
