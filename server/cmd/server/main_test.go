package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"fps-game/internal/game"
	"fps-game/internal/player"
	"fps-game/internal/room"
)

func TestStatsHandler_UsesRoomManagerState(t *testing.T) {
	engine := game.NewEngine(60)
	roomManager := room.NewManager(10, 4)
	r := roomManager.CreateRoom()

	if !r.AddPlayer(player.NewPlayer()) || !r.AddPlayer(player.NewPlayer()) {
		t.Fatal("failed to seed room")
	}

	req := httptest.NewRequest(http.MethodGet, "/api/stats", nil)
	rec := httptest.NewRecorder()

	statsHandler(engine, roomManager).ServeHTTP(rec, req)

	var body struct {
		Players int `json:"players"`
		Rooms   int `json:"rooms"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if body.Players != 2 {
		t.Fatalf("players = %d, want 2", body.Players)
	}
	if body.Rooms != 1 {
		t.Fatalf("rooms = %d, want 1", body.Rooms)
	}
}

func TestWithCORS_UsesAllowlist(t *testing.T) {
	handler := withCORS([]string{"https://game.example"}, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))

	t.Run("allowed origin", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodOptions, "/api/rooms", nil)
		req.Header.Set("Origin", "https://game.example")
		rec := httptest.NewRecorder()

		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200", rec.Code)
		}
		if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "https://game.example" {
			t.Fatalf("allow-origin = %q, want https://game.example", got)
		}
	})

	t.Run("blocked origin", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodOptions, "/api/rooms", nil)
		req.Header.Set("Origin", "https://evil.example")
		rec := httptest.NewRecorder()

		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusForbidden {
			t.Fatalf("status = %d, want 403", rec.Code)
		}
		if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "" {
			t.Fatalf("allow-origin = %q, want empty", got)
		}
	})
}
