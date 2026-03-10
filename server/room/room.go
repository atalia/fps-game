package room

import (
	"crypto/rand"
	"encoding/hex"
	"sync"

	"fps-game/player"
)

// Room represents a game room
type Room struct {
	ID       string
	Players  map[string]*player.Player
	mu       sync.RWMutex
}

// Manager manages all game rooms
type Manager struct {
	Rooms map[string]*Room
	mu    sync.RWMutex
}

// NewManager creates a new room manager
func NewManager() *Manager {
	return &Manager{
		Rooms: make(map[string]*Room),
	}
}

// CreateRoom creates a new room
func (m *Manager) CreateRoom() *Room {
	m.mu.Lock()
	defer m.mu.Unlock()

	room := &Room{
		ID:      generateID(),
		Players: make(map[string]*player.Player),
	}
	m.Rooms[room.ID] = room
	return room
}

// GetRoom gets a room by ID
func (m *Manager) GetRoom(id string) *Room {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.Rooms[id]
}

// RemoveRoom removes a room
func (m *Manager) RemoveRoom(id string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.Rooms, id)
}

// AddPlayer adds a player to the room
func (r *Room) AddPlayer(p *player.Player) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.Players[p.ID] = p
}

// RemovePlayer removes a player from the room
func (r *Room) RemovePlayer(playerID string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.Players, playerID)
}

// GetPlayerList returns a list of players
func (r *Room) GetPlayerList() []map[string]interface{} {
	r.mu.RLock()
	defer r.mu.RUnlock()

	list := make([]map[string]interface{}, 0, len(r.Players))
	for _, p := range r.Players {
		list = append(list, map[string]interface{}{
			"id":       p.ID,
			"name":     p.Name,
			"position": p.Position,
			"health":   p.Health,
		})
	}
	return list
}

// Broadcast sends a message to all players except the sender
func (r *Room) Broadcast(msg interface{}, excludePlayerID string) {
	// This will be implemented with client connections
	// For now, just a placeholder
}

func generateID() string {
	b := make([]byte, 4)
	rand.Read(b)
	return hex.EncodeToString(b)
}
