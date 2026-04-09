package network

import (
	"testing"

	"fps-game/internal/ai"
	"fps-game/internal/balance"
	"fps-game/internal/player"
	"fps-game/internal/room"
	"fps-game/pkg/metrics"
)

func TestClient_handleJoinRoom_RecordsJoinSuccessAndFailure(t *testing.T) {
	metrics.Get().Reset()
	t.Cleanup(metrics.Get().Reset)

	hub := NewHub()
	roomManager := room.NewManager(10, 10)

	invalidClient := &Client{Player: player.NewPlayer(), Send: make(chan []byte, 10), hub: hub}
	invalidClient.handleJoinRoom(mustMarshal(map[string]string{
		"name": "!",
	}), roomManager)

	snapshot := metrics.Get().Snapshot()
	connections := snapshot["connections"].(map[string]interface{})
	if got := connections["join_failures"].(int64); got != 1 {
		t.Fatalf("join_failures = %d, want 1", got)
	}
	if got := connections["join_successes"].(int64); got != 0 {
		t.Fatalf("join_successes = %d, want 0 before successful join", got)
	}

	validClient := &Client{Player: player.NewPlayer(), Send: make(chan []byte, 10), hub: hub}
	validClient.handleJoinRoom(mustMarshal(map[string]string{
		"name": "ValidPlayer",
	}), roomManager)

	snapshot = metrics.Get().Snapshot()
	connections = snapshot["connections"].(map[string]interface{})
	if got := connections["join_successes"].(int64); got != 1 {
		t.Fatalf("join_successes = %d, want 1", got)
	}
}

func TestClient_handleAddBot_UsesConfiguredBalanceDifficultyByDefault(t *testing.T) {
	cfg := balance.Get()
	cfg.Reset()
	t.Cleanup(cfg.Reset)
	cfg.SetDifficulty("hard")

	hub := NewHub()
	roomManager := room.NewManager(10, 10)
	r := roomManager.CreateRoom()
	client := &Client{Player: player.NewPlayer(), Send: make(chan []byte, 10), hub: hub, Room: r}
	if !r.AddPlayer(client.Player) {
		t.Fatal("failed to add player to room")
	}

	client.handleAddBot(mustMarshal(map[string]string{}))

	bots := r.BotManager.GetAllBots()
	if len(bots) != 1 {
		t.Fatalf("bot count = %d, want 1", len(bots))
	}
	if bots[0].Config.Difficulty != ai.DifficultyHard {
		t.Fatalf("bot difficulty = %s, want %s", bots[0].Config.Difficulty, ai.DifficultyHard)
	}
}
