// Powerup system - 道具系统
package game

import (
	"math/rand"
	"sync"
	"time"
)

// Position 位置
type Position struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
	Z float64 `json:"z"`
}

// PowerupType 道具类型
type PowerupType int

const (
	PowerupHealth PowerupType = iota
	PowerupAmmo
	PowerupSpeed
	PowerupDamage
	PowerupShield
)

// Powerup 道具
type Powerup struct {
	ID       string      `json:"id"`
	Type     PowerupType `json:"type"`
	Position Position    `json:"position"`
	Active   bool        `json:"active"`
}

// PowerupEffect 道具效果
type PowerupEffect struct {
	Type             PowerupType `json:"type"`
	Health           int         `json:"health,omitempty"`
	Ammo             int         `json:"ammo,omitempty"`
	SpeedMultiplier  float64     `json:"speed_multiplier,omitempty"`
	DamageMultiplier float64     `json:"damage_multiplier,omitempty"`
	Shield           int         `json:"shield,omitempty"`
	Duration         int         `json:"duration,omitempty"` // 毫秒
}

// PowerupManager 道具管理器
type PowerupManager struct {
	powerups    map[string]*Powerup
	spawnPoints []Position
	respawnTime time.Duration
	mu          sync.RWMutex
}

// NewPowerupManager 创建道具管理器
func NewPowerupManager() *PowerupManager {
	pm := &PowerupManager{
		powerups:    make(map[string]*Powerup),
		respawnTime: 30 * time.Second,
	}

	// 默认出生点
	pm.spawnPoints = []Position{
		{X: 15, Y: 0, Z: 15},
		{X: -15, Y: 0, Z: 15},
		{X: 15, Y: 0, Z: -15},
		{X: -15, Y: 0, Z: -15},
		{X: 0, Y: 0, Z: 0},
	}

	// 初始化道具
	for _, pos := range pm.spawnPoints {
		pm.spawnPowerup(pos)
	}

	return pm
}

func (pm *PowerupManager) spawnPowerup(pos Position) *Powerup {
	types := []PowerupType{
		PowerupHealth, PowerupAmmo, PowerupSpeed,
		PowerupDamage, PowerupShield,
	}

	p := &Powerup{
		ID:       generatePowerupID(),
		Type:     types[rand.Intn(len(types))],
		Position: pos,
		Active:   true,
	}

	pm.mu.Lock()
	pm.powerups[p.ID] = p
	pm.mu.Unlock()

	return p
}

// GetPowerup 获取道具
func (pm *PowerupManager) GetPowerup(id string) *Powerup {
	pm.mu.RLock()
	defer pm.mu.RUnlock()
	return pm.powerups[id]
}

// GetAllPowerups 获取所有道具
func (pm *PowerupManager) GetAllPowerups() []*Powerup {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	result := make([]*Powerup, 0, len(pm.powerups))
	for _, p := range pm.powerups {
		result = append(result, p)
	}
	return result
}

// CheckPickup 检查拾取
func (pm *PowerupManager) CheckPickup(pos Position, radius float64) *Powerup {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	for _, p := range pm.powerups {
		if !p.Active {
			continue
		}

		dx := pos.X - p.Position.X
		dz := pos.Z - p.Position.Z
		dist := dx*dx + dz*dz

		if dist < radius*radius {
			p.Active = false

			// 设置重生
			go pm.respawnPowerup(p.ID, p.Position)

			return p
		}
	}

	return nil
}

// RespawnPowerup 重生道具
func (pm *PowerupManager) respawnPowerup(oldID string, pos Position) {
	time.Sleep(pm.respawnTime)

	pm.mu.Lock()
	delete(pm.powerups, oldID)
	pm.mu.Unlock()

	pm.spawnPowerup(pos)
}

// GetEffect 获取道具效果
func (pm *PowerupManager) GetEffect(t PowerupType) *PowerupEffect {
	effects := map[PowerupType]*PowerupEffect{
		PowerupHealth: {Type: PowerupHealth, Health: 50, Duration: 0},
		PowerupAmmo:   {Type: PowerupAmmo, Ammo: 30, Duration: 0},
		PowerupSpeed:  {Type: PowerupSpeed, SpeedMultiplier: 1.5, Duration: 10000},
		PowerupDamage: {Type: PowerupDamage, DamageMultiplier: 2, Duration: 15000},
		PowerupShield: {Type: PowerupShield, Shield: 100, Duration: 20000},
	}

	return effects[t]
}

// TypeName 获取道具类型名称
func (t PowerupType) String() string {
	names := map[PowerupType]string{
		PowerupHealth: "health",
		PowerupAmmo:   "ammo",
		PowerupSpeed:  "speed",
		PowerupDamage: "damage",
		PowerupShield: "shield",
	}
	return names[t]
}

func generatePowerupID() string {
	const charset = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, 8)
	for i := range b {
		b[i] = charset[rand.Intn(len(charset))]
	}
	return "pw_" + string(b)
}
