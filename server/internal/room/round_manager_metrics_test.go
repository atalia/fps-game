package room

import (
	"testing"
	"time"

	"fps-game/pkg/metrics"
)

func TestRoundManager_MetricsStartRecordedOncePerMatchStart(t *testing.T) {
	metrics.Get().Reset()
	t.Cleanup(metrics.Get().Reset)

	room, _, _, _ := newRoundTestRoom(t, RoundConfig{
		FreezeTime:       10 * time.Millisecond,
		RoundTime:        80 * time.Millisecond,
		BuyTime:          40 * time.Millisecond,
		RoundEndDelay:    20 * time.Millisecond,
		RegulationRounds: 30,
		FirstToWin:       16,
		HalftimeAfter:    15,
	})

	if !room.RoundManager.MaybeStart() {
		t.Fatal("expected round to start")
	}

	waitForPhase(t, room.RoundManager, RoundPhaseLive, 200*time.Millisecond)
	time.Sleep(30 * time.Millisecond)

	snapshot := metrics.Get().Snapshot()
	matches := snapshot["matches"].(map[string]interface{})
	if got := matches["started"].(int64); got != 1 {
		t.Fatalf("matches.started = %d, want 1", got)
	}
}
