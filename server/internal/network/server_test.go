package network

import (
	"encoding/json"
	"testing"
	"time"

	"fps-game/internal/player"
)

func TestNewMessage(t *testing.T) {
	msg := NewMessage("test", map[string]string{"key": "value"})

	if msg.Type != "test" {
		t.Errorf("Type = %s, want test", msg.Type)
	}
	if msg.Timestamp == 0 {
		t.Error("Timestamp should not be zero")
	}
}

func TestMessage_ToJSON(t *testing.T) {
	msg := NewMessage("test", map[string]string{"key": "value"})
	data := msg.ToJSON()

	var parsed Message
	if err := json.Unmarshal(data, &parsed); err != nil {
		t.Errorf("Failed to unmarshal: %v", err)
	}
	if parsed.Type != "test" {
		t.Errorf("Parsed type = %s, want test", parsed.Type)
	}
}

func TestNewHub(t *testing.T) {
	hub := NewHub()

	if hub == nil {
		t.Error("Hub should not be nil")
	}
	if hub.clients == nil {
		t.Error("Hub clients should be initialized")
	}
}

func TestHub_Register(t *testing.T) {
	hub := NewHub()
	go hub.Run()

	client := &Client{
		Player: player.NewPlayer(),
		Send:   make(chan []byte, 10),
	}

	hub.register <- client

	// 等待处理
	time.Sleep(10 * time.Millisecond)

	if hub.GetClientCount() != 1 {
		t.Errorf("Client count = %d, want 1", hub.GetClientCount())
	}
}

func TestHub_Unregister(t *testing.T) {
	hub := NewHub()
	go hub.Run()

	client := &Client{
		Player: player.NewPlayer(),
		Send:   make(chan []byte, 10),
	}

	hub.register <- client
	time.Sleep(10 * time.Millisecond)

	hub.unregister <- client
	time.Sleep(10 * time.Millisecond)

	if hub.GetClientCount() != 0 {
		t.Errorf("Client count = %d, want 0", hub.GetClientCount())
	}
}

func TestHub_GetClientCount(t *testing.T) {
	hub := NewHub()

	if hub.GetClientCount() != 0 {
		t.Errorf("Initial count = %d, want 0", hub.GetClientCount())
	}

	hub.clients[&Client{}] = true

	if hub.GetClientCount() != 1 {
		t.Errorf("Count after add = %d, want 1", hub.GetClientCount())
	}
}

func TestMustMarshal(t *testing.T) {
	data := mustMarshal(map[string]string{"key": "value"})

	var parsed map[string]string
	if err := json.Unmarshal(data, &parsed); err != nil {
		t.Errorf("Failed to unmarshal: %v", err)
	}
	if parsed["key"] != "value" {
		t.Errorf("Parsed key = %s, want value", parsed["key"])
	}
}
