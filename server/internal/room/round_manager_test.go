package room

import (
	"sync"
	"testing"
	"time"

	"fps-game/internal/player"
	"fps-game/internal/team"
)

type broadcastEvent struct {
	msgType string
	data    interface{}
}

type broadcastRecorder struct {
	mu     sync.Mutex
	events []broadcastEvent
}

func (r *broadcastRecorder) record(msgType string, data interface{}, _ string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.events = append(r.events, broadcastEvent{msgType: msgType, data: data})
}

func (r *broadcastRecorder) count(msgType string) int {
	r.mu.Lock()
	defer r.mu.Unlock()

	count := 0
	for _, event := range r.events {
		if event.msgType == msgType {
			count++
		}
	}
	return count
}

func (r *broadcastRecorder) latest(msgType string) interface{} {
	r.mu.Lock()
	defer r.mu.Unlock()

	for i := len(r.events) - 1; i >= 0; i-- {
		if r.events[i].msgType == msgType {
			return r.events[i].data
		}
	}
	return nil
}

func newRoundTestRoom(t *testing.T, cfg RoundConfig) (*Room, *player.Player, *player.Player, *broadcastRecorder) {
	t.Helper()

	room := NewRoom(10)
	room.RoundManager.Close()
	room.RoundManager = NewRoundManager(room, cfg)

	recorder := &broadcastRecorder{}
	room.SetBroadcaster(recorder.record)

	ctPlayer := player.NewPlayer()
	ctPlayer.SetName("Alpha")
	if !room.AddPlayer(ctPlayer) {
		t.Fatal("failed to add ct player")
	}
	if _, err := room.JoinTeam(ctPlayer, team.TeamCounterTerrorists); err != nil {
		t.Fatalf("failed to join ct: %v", err)
	}

	tPlayer := player.NewPlayer()
	tPlayer.SetName("Bravo")
	if !room.AddPlayer(tPlayer) {
		t.Fatal("failed to add t player")
	}
	if _, err := room.JoinTeam(tPlayer, team.TeamTerrorists); err != nil {
		t.Fatalf("failed to join t: %v", err)
	}

	t.Cleanup(room.Close)
	return room, ctPlayer, tPlayer, recorder
}

func waitForPhase(t *testing.T, rm *RoundManager, want RoundPhase, timeout time.Duration) RoundState {
	t.Helper()

	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		state := rm.Snapshot()
		if state.Phase == want {
			return state
		}
		time.Sleep(5 * time.Millisecond)
	}

	t.Fatalf("timed out waiting for phase %s (last=%s)", want, rm.Snapshot().Phase)
	return RoundState{}
}

func waitForCondition(t *testing.T, timeout time.Duration, fn func() bool) {
	t.Helper()

	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		if fn() {
			return
		}
		time.Sleep(5 * time.Millisecond)
	}

	t.Fatal("timed out waiting for condition")
}

func TestRoundManager_StartsRoundAndTransitionsToLive(t *testing.T) {
	room, ctPlayer, tPlayer, recorder := newRoundTestRoom(t, RoundConfig{
		FreezeTime:       20 * time.Millisecond,
		RoundTime:        80 * time.Millisecond,
		BuyTime:          60 * time.Millisecond,
		RoundEndDelay:    20 * time.Millisecond,
		RegulationRounds: 30,
		FirstToWin:       16,
		HalftimeAfter:    15,
	})

	if !room.RoundManager.MaybeStart() {
		t.Fatal("expected round to start")
	}

	freeze := waitForPhase(t, room.RoundManager, RoundPhaseFreeze, 200*time.Millisecond)
	if freeze.RoundNumber != 1 {
		t.Fatalf("freeze round number = %d, want 1", freeze.RoundNumber)
	}
	if freeze.CanMove || freeze.CanShoot {
		t.Fatal("freeze phase should block movement and shooting")
	}
	if ctPlayer.Position.X >= 0 {
		t.Fatalf("ct player spawn should be on ct side, got %+v", ctPlayer.Position)
	}
	if tPlayer.Position.X <= 0 {
		t.Fatalf("t player spawn should be on t side, got %+v", tPlayer.Position)
	}

	live := waitForPhase(t, room.RoundManager, RoundPhaseLive, 200*time.Millisecond)
	if !live.CanMove || !live.CanShoot {
		t.Fatal("live phase should allow movement and shooting")
	}
	if recorder.count("player_respawned") < 2 {
		t.Fatalf("expected round start respawns, got %d", recorder.count("player_respawned"))
	}
	if recorder.count("round_started") == 0 {
		t.Fatal("expected round_started broadcast")
	}
}

func TestRoundManager_EndsRoundOnEliminationAndAwardsMoney(t *testing.T) {
	room, ctPlayer, tPlayer, recorder := newRoundTestRoom(t, RoundConfig{
		FreezeTime:       10 * time.Millisecond,
		RoundTime:        100 * time.Millisecond,
		BuyTime:          40 * time.Millisecond,
		RoundEndDelay:    20 * time.Millisecond,
		RegulationRounds: 30,
		FirstToWin:       16,
		HalftimeAfter:    15,
	})

	room.RoundManager.MaybeStart()
	waitForPhase(t, room.RoundManager, RoundPhaseLive, 200*time.Millisecond)

	room.RoundManager.RecordDamage(ctPlayer.ID, 140)
	room.RoundManager.RecordKill(ctPlayer.ID)
	tPlayer.Die()
	room.RoundManager.HandleRosterChanged()

	state := waitForPhase(t, room.RoundManager, RoundPhaseEnded, 200*time.Millisecond)
	if state.RoundNumber != 1 {
		t.Fatalf("ended round number = %d, want 1", state.RoundNumber)
	}
	if got := room.TeamManager.GetScore(team.TeamCounterTerrorists); got != 1 {
		t.Fatalf("ct score = %d, want 1", got)
	}
	if got := ctPlayer.GetMoney(); got != 800+3000 {
		t.Fatalf("ct money = %d, want 3800", got)
	}
	if got := tPlayer.GetMoney(); got != 800+1400 {
		t.Fatalf("t money = %d, want 2200", got)
	}

	roundEnded, ok := recorder.latest("round_ended").(RoundEndEvent)
	if !ok {
		t.Fatal("expected round_ended payload")
	}
	if roundEnded.Winner != team.TeamCounterTerrorists {
		t.Fatalf("round winner = %s, want ct", roundEnded.Winner)
	}
	if roundEnded.MVP == nil || roundEnded.MVP.PlayerID != ctPlayer.ID {
		t.Fatalf("unexpected MVP payload: %#v", roundEnded.MVP)
	}
	if recorder.count("money_updated") != 2 {
		t.Fatalf("expected round money updates, got %d", recorder.count("money_updated"))
	}
}

func TestRoundManager_SwitchesSidesAtHalftime(t *testing.T) {
	room, ctPlayer, tPlayer, recorder := newRoundTestRoom(t, RoundConfig{
		FreezeTime:       10 * time.Millisecond,
		RoundTime:        60 * time.Millisecond,
		BuyTime:          30 * time.Millisecond,
		RoundEndDelay:    15 * time.Millisecond,
		RegulationRounds: 2,
		FirstToWin:       3,
		HalftimeAfter:    1,
	})

	room.RoundManager.MaybeStart()
	waitForPhase(t, room.RoundManager, RoundPhaseLive, 200*time.Millisecond)
	if !room.RoundManager.endRound(team.TeamCounterTerrorists, RoundEndReasonElimination) {
		t.Fatal("expected first round to end")
	}

	waitForCondition(t, 200*time.Millisecond, func() bool {
		return ctPlayer.GetTeam() == team.TeamTerrorists && tPlayer.GetTeam() == team.TeamCounterTerrorists
	})
	waitForPhase(t, room.RoundManager, RoundPhaseFreeze, 250*time.Millisecond)

	if recorder.count("team_changed") < 2 {
		t.Fatalf("expected halftime team_changed broadcasts, got %d", recorder.count("team_changed"))
	}
}

func TestRoundManager_EntersOvertimeAtTieAndRequiresTwoRoundLead(t *testing.T) {
	room, _, _, _ := newRoundTestRoom(t, RoundConfig{
		FreezeTime:       20 * time.Millisecond,
		RoundTime:        120 * time.Millisecond,
		BuyTime:          30 * time.Millisecond,
		RoundEndDelay:    25 * time.Millisecond,
		RegulationRounds: 2,
		FirstToWin:       2,
		HalftimeAfter:    1,
	})

	room.RoundManager.MaybeStart()
	waitForPhase(t, room.RoundManager, RoundPhaseLive, 200*time.Millisecond)
	room.RoundManager.endRound(team.TeamCounterTerrorists, RoundEndReasonElimination)

	waitForPhase(t, room.RoundManager, RoundPhaseLive, 400*time.Millisecond)
	room.RoundManager.endRound(team.TeamTerrorists, RoundEndReasonElimination)

	waitForCondition(t, 200*time.Millisecond, func() bool {
		return room.RoundManager.Snapshot().IsOvertime
	})

	waitForPhase(t, room.RoundManager, RoundPhaseLive, 400*time.Millisecond)
	room.RoundManager.endRound(team.TeamCounterTerrorists, RoundEndReasonElimination)

	waitForCondition(t, 200*time.Millisecond, func() bool {
		state := room.RoundManager.Snapshot()
		return state.Phase != RoundPhaseMatchOver && state.MatchWinner == ""
	})

	waitForPhase(t, room.RoundManager, RoundPhaseLive, 400*time.Millisecond)
	room.RoundManager.endRound(team.TeamCounterTerrorists, RoundEndReasonElimination)

	finalState := waitForPhase(t, room.RoundManager, RoundPhaseMatchOver, 200*time.Millisecond)
	if !finalState.IsOvertime {
		t.Fatal("expected overtime state at match end")
	}
	if finalState.MatchWinner != team.TeamCounterTerrorists {
		t.Fatalf("match winner = %s, want ct", finalState.MatchWinner)
	}
	if got := room.TeamManager.GetScore(team.TeamCounterTerrorists); got != 3 {
		t.Fatalf("ct score = %d, want 3", got)
	}
}
