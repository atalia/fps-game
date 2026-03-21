package storage

import (
	"context"
	"testing"
	"time"
)

// Tests

func TestMemoryStorage_Player(t *testing.T) {
	s := NewMemoryStorage()
	ctx := context.Background()

	// Save
	err := s.SavePlayer(ctx, "player1", map[string]string{"name": "test"})
	if err != nil {
		t.Errorf("SavePlayer failed: %v", err)
	}

	// Get
	err = s.GetPlayer(ctx, "player1", nil)
	if err != nil {
		t.Errorf("GetPlayer failed: %v", err)
	}

	// Delete
	err = s.DeletePlayer(ctx, "player1")
	if err != nil {
		t.Errorf("DeletePlayer failed: %v", err)
	}

	// Get deleted
	err = s.GetPlayer(ctx, "player1", nil)
	if err == nil {
		t.Error("GetPlayer should fail for deleted player")
	}
}

func TestMemoryStorage_Room(t *testing.T) {
	s := NewMemoryStorage()
	ctx := context.Background()

	err := s.SaveRoom(ctx, "room1", map[string]interface{}{"players": []string{"p1", "p2"}})
	if err != nil {
		t.Errorf("SaveRoom failed: %v", err)
	}

	err = s.GetRoom(ctx, "room1", nil)
	if err != nil {
		t.Errorf("GetRoom failed: %v", err)
	}

	err = s.DeleteRoom(ctx, "room1")
	if err != nil {
		t.Errorf("DeleteRoom failed: %v", err)
	}
}

func TestMemoryStorage_Score(t *testing.T) {
	s := NewMemoryStorage()
	ctx := context.Background()

	score, err := s.IncrementScore(ctx, "player1", 100)
	if err != nil {
		t.Errorf("IncrementScore failed: %v", err)
	}
	if score != 100 {
		t.Errorf("Score = %d, want 100", score)
	}

	score, err = s.IncrementScore(ctx, "player1", 50)
	if err != nil {
		t.Errorf("IncrementScore failed: %v", err)
	}
	if score != 150 {
		t.Errorf("Score = %d, want 150", score)
	}
}

func TestMemoryStorage_Session(t *testing.T) {
	s := NewMemoryStorage()
	ctx := context.Background()

	err := s.SetSession(ctx, "session1", map[string]string{"user": "test"}, time.Hour)
	if err != nil {
		t.Errorf("SetSession failed: %v", err)
	}

	err = s.GetSession(ctx, "session1", nil)
	if err != nil {
		t.Errorf("GetSession failed: %v", err)
	}

	err = s.DeleteSession(ctx, "session1")
	if err != nil {
		t.Errorf("DeleteSession failed: %v", err)
	}
}

func TestMemoryStorage_Lock(t *testing.T) {
	s := NewMemoryStorage()
	ctx := context.Background()

	// First lock should succeed
	locked, err := s.Lock(ctx, "resource1", time.Minute)
	if err != nil {
		t.Errorf("Lock failed: %v", err)
	}
	if !locked {
		t.Error("First lock should succeed")
	}

	// Second lock should fail
	locked, err = s.Lock(ctx, "resource1", time.Minute)
	if err != nil {
		t.Errorf("Lock failed: %v", err)
	}
	if locked {
		t.Error("Second lock should fail")
	}

	// Unlock
	err = s.Unlock(ctx, "resource1")
	if err != nil {
		t.Errorf("Unlock failed: %v", err)
	}

	// Lock again should succeed
	locked, err = s.Lock(ctx, "resource1", time.Minute)
	if err != nil {
		t.Errorf("Lock failed: %v", err)
	}
	if !locked {
		t.Error("Lock after unlock should succeed")
	}
}

func TestMemoryStorage_Leaderboard(t *testing.T) {
	s := NewMemoryStorage()
	ctx := context.Background()

	// Add scores
	_, _ = s.IncrementScore(ctx, "player1", 100)
	_, _ = s.IncrementScore(ctx, "player2", 200)
	_, _ = s.IncrementScore(ctx, "player3", 150)

	// Get leaderboard
	entries, err := s.GetLeaderboard(ctx, 10)
	if err != nil {
		t.Errorf("GetLeaderboard failed: %v", err)
	}
	if len(entries) != 3 {
		t.Errorf("Leaderboard entries = %d, want 3", len(entries))
	}
}
