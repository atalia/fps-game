package player

import (
	"crypto/rand"
	"encoding/hex"
	"sync"
)

// Position represents a 3D position
type Position struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
	Z float64 `json:"z"`
}

// Player represents a game player
type Player struct {
	ID       string   `json:"id"`
	Name     string   `json:"name"`
	Position Position `json:"position"`
	Rotation float64  `json:"rotation"`
	Health   int      `json:"health"`
	Score    int      `json:"score"`
	Team     string   `json:"team"`
	mu       sync.RWMutex
}

// NewPlayer creates a new player
func NewPlayer() *Player {
	return &Player{
		ID:     generateID(),
		Health: 100,
		Score:  0,
		Position: Position{
			X: 0,
			Y: 0,
			Z: 0,
		},
	}
}

// SetName sets the player name
func (p *Player) SetName(name string) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.Name = name
}

// SetPosition sets the player position
func (p *Player) SetPosition(x, y, z float64) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.Position.X = x
	p.Position.Y = y
	p.Position.Z = z
}

// TakeDamage applies damage to the player
func (p *Player) TakeDamage(damage int) int {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.Health -= damage
	if p.Health < 0 {
		p.Health = 0
	}
	return p.Health
}

// Heal heals the player
func (p *Player) Heal(amount int) int {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.Health += amount
	if p.Health > 100 {
		p.Health = 100
	}
	return p.Health
}

// AddScore adds score to the player
func (p *Player) AddScore(points int) int {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.Score += points
	return p.Score
}

// IsAlive checks if the player is alive
func (p *Player) IsAlive() bool {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.Health > 0
}

// Respawn respawns the player
func (p *Player) Respawn() {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.Health = 100
	p.Position = Position{X: 0, Y: 0, Z: 0}
}

func generateID() string {
	b := make([]byte, 4)
	rand.Read(b)
	return hex.EncodeToString(b)
}
