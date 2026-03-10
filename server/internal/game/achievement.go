// Achievement System - 成就系统
package game

import (
	"sync"
)

// AchievementType 成就类型
type AchievementType int

const (
	AchievementKill AchievementType = iota
	AchievementDeath
	AchievementWin
	AchievementHeadshot
	AchievementDamage
	AchievementPlaytime
)

// Achievement 成就
type Achievement struct {
	ID          string          `json:"id"`
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Type        AchievementType `json:"type"`
	Target      int             `json:"target"`      // 目标值
	Reward      int             `json:"reward"`      // 奖励金币
	Icon        string          `json:"icon"`
	Hidden      bool            `json:"hidden"`      // 隐藏成就
}

// PlayerAchievement 玩家成就进度
type PlayerAchievement struct {
	AchievementID string `json:"achievement_id"`
	Progress      int    `json:"progress"`
	Completed     bool   `json:"completed"`
	CompletedAt   int64  `json:"completed_at,omitempty"`
}

// AchievementManager 成就管理器
type AchievementManager struct {
	achievements map[string]*Achievement
	playerProgress map[string]map[string]*PlayerAchievement // playerID -> achievementID -> progress
	mu sync.RWMutex
}

// NewAchievementManager 创建成就管理器
func NewAchievementManager() *AchievementManager {
	am := &AchievementManager{
		achievements: make(map[string]*Achievement),
		playerProgress: make(map[string]map[string]*PlayerAchievement),
	}

	am.initDefaultAchievements()
	return am
}

func (am *AchievementManager) initDefaultAchievements() {
	achievements := []*Achievement{
		// 击杀成就
		{ID: "first_blood", Name: "第一滴血", Description: "击杀1名敌人", Type: AchievementKill, Target: 1, Reward: 100},
		{ID: "killer_10", Name: "杀手", Description: "击杀10名敌人", Type: AchievementKill, Target: 10, Reward: 500},
		{ID: "killer_50", Name: "杀手大师", Description: "击杀50名敌人", Type: AchievementKill, Target: 50, Reward: 2000},
		{ID: "killer_100", Name: "杀戮之王", Description: "击杀100名敌人", Type: AchievementKill, Target: 100, Reward: 5000},
		{ID: "killer_1000", Name: "传奇杀手", Description: "击杀1000名敌人", Type: AchievementKill, Target: 1000, Reward: 20000},

		// 爆头成就
		{ID: "headshot_1", Name: "神枪手", Description: "完成1次爆头", Type: AchievementHeadshot, Target: 1, Reward: 200},
		{ID: "headshot_10", Name: "狙击手", Description: "完成10次爆头", Type: AchievementHeadshot, Target: 10, Reward: 1000},
		{ID: "headshot_50", Name: "死亡凝视", Description: "完成50次爆头", Type: AchievementHeadshot, Target: 50, Reward: 5000},

		// 胜利成就
		{ID: "first_win", Name: "初尝胜利", Description: "获得1场胜利", Type: AchievementWin, Target: 1, Reward: 300},
		{ID: "winner_10", Name: "常胜将军", Description: "获得10场胜利", Type: AchievementWin, Target: 10, Reward: 2000},
		{ID: "winner_100", Name: "胜利之师", Description: "获得100场胜利", Type: AchievementWin, Target: 100, Reward: 10000},

		// 伤害成就
		{ID: "damage_1000", Name: "火力压制", Description: "累计造成1000点伤害", Type: AchievementDamage, Target: 1000, Reward: 500},
		{ID: "damage_10000", Name: "毁灭者", Description: "累计造成10000点伤害", Type: AchievementDamage, Target: 10000, Reward: 3000},

		// 隐藏成就
		{ID: "one_shot", Name: "??? (一击必杀)", Description: "一击造成100+伤害", Type: AchievementDamage, Target: 100, Reward: 1000, Hidden: true},
	}

	for _, a := range achievements {
		am.achievements[a.ID] = a
	}
}

// GetAchievement 获取成就
func (am *AchievementManager) GetAchievement(id string) *Achievement {
	am.mu.RLock()
	defer am.mu.RUnlock()
	return am.achievements[id]
}

// GetAllAchievements 获取所有成就
func (am *AchievementManager) GetAllAchievements() []*Achievement {
	am.mu.RLock()
	defer am.mu.RUnlock()

	result := make([]*Achievement, 0, len(am.achievements))
	for _, a := range am.achievements {
		result = append(result, a)
	}
	return result
}

// GetVisibleAchievements 获取可见成就（非隐藏）
func (am *AchievementManager) GetVisibleAchievements() []*Achievement {
	am.mu.RLock()
	defer am.mu.RUnlock()

	result := make([]*Achievement, 0)
	for _, a := range am.achievements {
		if !a.Hidden {
			result = append(result, a)
		}
	}
	return result
}

// UpdateProgress 更新成就进度
func (am *AchievementManager) UpdateProgress(playerID string, achievementType AchievementType, value int) []*PlayerAchievement {
	am.mu.Lock()
	defer am.mu.Unlock()

	completed := make([]*PlayerAchievement, 0)

	// 初始化玩家进度
	if am.playerProgress[playerID] == nil {
		am.playerProgress[playerID] = make(map[string]*PlayerAchievement)
	}

	// 遍历所有相关类型的成就
	for _, achievement := range am.achievements {
		if achievement.Type != achievementType {
			continue
		}

		progress := am.playerProgress[playerID][achievement.ID]
		if progress == nil {
			progress = &PlayerAchievement{
				AchievementID: achievement.ID,
				Progress:      0,
			}
			am.playerProgress[playerID][achievement.ID] = progress
		}

		// 已完成的不再更新
		if progress.Completed {
			continue
		}

		// 更新进度
		progress.Progress += value

		// 检查是否完成
		if progress.Progress >= achievement.Target {
			progress.Completed = true
			progress.CompletedAt = currentTimestamp()
			completed = append(completed, progress)
		}
	}

	return completed
}

// GetPlayerProgress 获取玩家成就进度
func (am *AchievementManager) GetPlayerProgress(playerID string) []*PlayerAchievement {
	am.mu.RLock()
	defer am.mu.RUnlock()

	progress := am.playerProgress[playerID]
	if progress == nil {
		return []*PlayerAchievement{}
	}

	result := make([]*PlayerAchievement, 0, len(progress))
	for _, p := range progress {
		result = append(result, p)
	}
	return result
}

// GetCompletedAchievements 获取玩家已完成的成就
func (am *AchievementManager) GetCompletedAchievements(playerID string) []*Achievement {
	am.mu.RLock()
	defer am.mu.RUnlock()

	progress := am.playerProgress[playerID]
	if progress == nil {
		return []*Achievement{}
	}

	completed := make([]*Achievement, 0)
	for achievementID, p := range progress {
		if p.Completed {
			if achievement, exists := am.achievements[achievementID]; exists {
				completed = append(completed, achievement)
			}
		}
	}
	return completed
}

// CalculateTotalReward 计算总奖励
func (am *AchievementManager) CalculateTotalReward(playerID string) int {
	am.mu.RLock()
	defer am.mu.RUnlock()

	total := 0
	progress := am.playerProgress[playerID]

	for achievementID, p := range progress {
		if p.Completed {
			if achievement, exists := am.achievements[achievementID]; exists {
				total += achievement.Reward
			}
		}
	}

	return total
}

func currentTimestamp() int64 {
	return 0 // 简化，实际应返回 time.Now().Unix()
}
