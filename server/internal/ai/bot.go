package ai

import (
	"fmt"
	"math/rand"
	"time"

	"fps-game/internal/player"
)

// State AI 状态
type State string

const (
	StatePatrol State = "patrol"
	StateChase  State = "chase"
	StateAttack State = "attack"
	StateCover  State = "cover"
)

// Bot 机器人
type Bot struct {
	*player.Player
	Config       Config
	State        State
	Target       *player.Player
	Path         []player.Position
	LastDecision time.Time
	LastShot     time.Time
	Name         string
}

// NewBot 创建机器人
func NewBot(id string, difficulty Difficulty) *Bot {
	cfg := GetConfig(difficulty)

	name := generateBotName()
	return &Bot{
		Player: &player.Player{
			ID:        id,
			Name:      name,
			Health:    100,
			MaxHealth: 100,
			Position: player.Position{
				X: rand.Float64()*100 - 50,
				Y: 0,
				Z: rand.Float64()*100 - 50,
			},
			Weapon:   "rifle",
			Ammo:     30,
			HitBoxes: player.DefaultHitBoxes,
		},
		Config: cfg,
		State:  StatePatrol,
		Name:   name,
	}
}

// generateBotName 生成机器人名称
func generateBotName() string {
	prefixes := []string{"Alpha", "Beta", "Gamma", "Delta", "Echo", "Foxtrot", "Ghost", "Hunter", "Ivy", "Jet"}
	suffixes := []string{"Bot", "AI", "Droid", "Unit", "Core", "Node"}

	return fmt.Sprintf("%s-%s", prefixes[rand.Intn(len(prefixes))], suffixes[rand.Intn(len(suffixes))])
}

// IsBot 标识为机器人
func (b *Bot) IsBot() bool {
	return true
}
