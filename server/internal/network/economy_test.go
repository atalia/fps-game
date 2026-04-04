package network

import (
	"testing"

	"fps-game/internal/economy"
	"fps-game/internal/player"
	"fps-game/internal/room"
	"fps-game/internal/team"
)

func TestClient_AwardMoney(t *testing.T) {
	client := &Client{hub: NewHub()}
	p := player.NewPlayer()

	client.awardMoney(p, economy.KillReward, "kill")

	if got := p.GetMoney(); got != economy.StartMoney+economy.KillReward {
		t.Fatalf("money = %d, want %d", got, economy.StartMoney+economy.KillReward)
	}
}

func TestClient_AwardRoundMoney(t *testing.T) {
	client := &Client{hub: NewHub()}
	r := room.NewRoom(10)

	ctPlayer := player.NewPlayer()
	ctPlayer.SetTeam(team.TeamCounterTerrorists)
	tPlayer := player.NewPlayer()
	tPlayer.SetTeam(team.TeamTerrorists)

	if !r.AddPlayer(ctPlayer) || !r.AddPlayer(tPlayer) {
		t.Fatal("failed to add test players to room")
	}

	client.awardRoundMoney(r, team.TeamCounterTerrorists)

	if got := ctPlayer.GetMoney(); got != economy.StartMoney+economy.RoundWinReward {
		t.Fatalf("ct money = %d, want %d", got, economy.StartMoney+economy.RoundWinReward)
	}
	if got := tPlayer.GetMoney(); got != economy.StartMoney+economy.RoundLossReward {
		t.Fatalf("t money = %d, want %d", got, economy.StartMoney+economy.RoundLossReward)
	}
}
