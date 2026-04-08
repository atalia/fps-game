package room

import (
	"testing"
	"time"

	"fps-game/internal/ai"
	"fps-game/internal/player"
)

func TestRoom_UpdateBots_BroadcastsMovement(t *testing.T) {
	r := NewRoom(10)
	bot := r.AddBot(ai.DifficultyNormal, "")
	if bot == nil {
		t.Fatal("expected bot to be created")
	}

	bot.State = ai.StatePatrol
	bot.Path = []player.Position{{X: bot.Position.X + 10, Y: bot.Position.Y, Z: bot.Position.Z}}
	bot.LastDecision = time.Time{}

	var broadcasts []string
	r.SetBroadcaster(func(msgType string, data interface{}, excludeID string) {
		broadcasts = append(broadcasts, msgType)
	})

	before := bot.Position
	r.UpdateBots(200 * time.Millisecond)
	after := bot.Position

	if before == after {
		t.Fatal("expected bot position to change after update")
	}

	found := false
	for _, msgType := range broadcasts {
		if msgType == "player_moved" {
			found = true
			break
		}
	}
	if !found {
		t.Fatal("expected player_moved broadcast for bot movement")
	}
}
