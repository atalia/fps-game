package ai

import (
	"fmt"
	"log"
	"sync"
	"sync/atomic"
	"time"
)

// Manager 机器人管理器
type Manager struct {
	mu                sync.RWMutex
	bots              map[string]*Bot
	defaultDifficulty Difficulty
	autoFill          bool
	maxBots           int
	botCounter        uint64 // 原子计数器，用于生成唯一 ID
}

// NewManager 创建管理器
func NewManager() *Manager {
	return &Manager{
		bots:              make(map[string]*Bot),
		defaultDifficulty: DifficultyNormal,
		autoFill:          true,
		maxBots:           10,
	}
}

// AddBot 添加机器人
func (m *Manager) AddBot(difficulty Difficulty, team string) *Bot {
	if m == nil {
		log.Printf("[ERROR] AddBot: Manager is nil!")
		return nil
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	log.Printf("[DEBUG] AddBot: current bots=%d, maxBots=%d", len(m.bots), m.maxBots)

	if len(m.bots) >= m.maxBots {
		log.Printf("[DEBUG] AddBot: max bots reached")
		return nil
	}

	// 使用原子计数器生成唯一 ID，避免并发冲突
	counter := atomic.AddUint64(&m.botCounter, 1)
	id := fmt.Sprintf("bot_%d", counter)
	bot := NewBot(id, difficulty)
	if team != "" {
		bot.Team = team
	}

	m.bots[id] = bot
	log.Printf("[DEBUG] AddBot: created bot %s, total bots=%d", id, len(m.bots))
	return bot
}

// RemoveBot 移除机器人
func (m *Manager) RemoveBot(id string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.bots, id)
}

// GetBot 获取机器人
func (m *Manager) GetBot(id string) *Bot {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.bots[id]
}

// GetAllBots 获取所有机器人
func (m *Manager) GetAllBots() []*Bot {
	m.mu.RLock()
	defer m.mu.RUnlock()

	bots := make([]*Bot, 0, len(m.bots))
	for _, b := range m.bots {
		bots = append(bots, b)
	}
	return bots
}

// AutoFill 自动填充机器人
func (m *Manager) AutoFill(room Room, playerCount, targetCount int) []*Bot {
	if !m.autoFill {
		return nil
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	var added []*Bot
	botCount := len(m.bots)
	total := playerCount + botCount

	if total < targetCount && botCount < m.maxBots {
		needed := targetCount - total
		for i := 0; i < needed && botCount+i < m.maxBots; i++ {
			id := fmt.Sprintf("bot_%d", len(m.bots)+1)
			bot := NewBot(id, m.defaultDifficulty)
			m.bots[id] = bot
			added = append(added, bot)
		}
	}

	return added
}

// UpdateAll 更新所有机器人
func (m *Manager) UpdateAll(room Room, delta float64) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	for _, bot := range m.bots {
		bot.Update(room, time.Duration(delta*float64(time.Second)))
	}
}

// SetAutoFill 设置自动填充
func (m *Manager) SetAutoFill(enabled bool) {
	m.autoFill = enabled
}

// SetDefaultDifficulty 设置默认难度
func (m *Manager) SetDefaultDifficulty(d Difficulty) {
	m.defaultDifficulty = d
}

// GetBotCount 获取机器人数量
func (m *Manager) GetBotCount() int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return len(m.bots)
}
