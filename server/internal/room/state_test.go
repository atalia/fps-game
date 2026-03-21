package room

import (
	"testing"
	"time"

	"fps-game/internal/player"
)

func TestNewRoomWithState(t *testing.T) {
	r := NewRoomWithState(10)

	if r == nil {
		t.Fatal("RoomWithState should not be nil")
	}
	if r.state != StateWaiting {
		t.Errorf("State = %d, want StateWaiting", r.state)
	}
}

func TestRoomWithState_StartGame(t *testing.T) {
	r := NewRoomWithState(10)

	// 人数不够，不能开始
	if r.StartGame() {
		t.Fatal("Should not start game with 0 players")
	}

	// 添加玩家
	p1 := player.NewPlayer()
	p2 := player.NewPlayer()
	r.AddPlayer(p1)
	r.AddPlayer(p2)

	// 现在可以开始
	if !r.StartGame() {
		t.Fatal("Should start game with 2 players")
	}

	if r.state != StatePlaying {
		t.Errorf("State = %d, want StatePlaying", r.state)
	}

	// 已经在游戏中，不能再次开始
	if r.StartGame() {
		t.Fatal("Should not start game again")
	}
}

func TestRoomWithState_Update(t *testing.T) {
	r := NewRoomWithState(10)
	p1 := player.NewPlayer()
	p2 := player.NewPlayer()
	r.AddPlayer(p1)
	r.AddPlayer(p2)
	r.StartGame()

	r.Update(time.Second)

	if r.matchTime != time.Second {
		t.Errorf("MatchTime = %v, want 1s", r.matchTime)
	}
}

func TestRoomWithState_GetState(t *testing.T) {
	r := NewRoomWithState(10)

	if r.GetState() != StateWaiting {
		t.Errorf("State = %d, want StateWaiting", r.GetState())
	}
}

func TestRoomWithState_Scores(t *testing.T) {
	r := NewRoomWithState(10)

	r.AddScoreTeam1(10)
	r.AddScoreTeam2(5)

	s1, s2 := r.GetScores()
	if s1 != 10 {
		t.Errorf("Team1 score = %d, want 10", s1)
	}
	if s2 != 5 {
		t.Errorf("Team2 score = %d, want 5", s2)
	}
}

func TestRoomWithState_ToMap(t *testing.T) {
	r := NewRoomWithState(10)
	r.AddScoreTeam1(10)

	m := r.ToMap()

	if m["id"] != r.ID {
		t.Error("Map should contain room ID")
	}
	if m["score_team1"] != 10 {
		t.Errorf("score_team1 = %v, want 10", m["score_team1"])
	}
}
