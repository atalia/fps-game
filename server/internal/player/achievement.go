package player

import (
	"sync"
	"time"
)

// Achievement 成就定义
type Achievement struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Icon        string `json:"icon"`
	Category    string `json:"category"`
	Requirement int    `json:"requirement"`
	Points      int    `json:"points"`
}

// PlayerAchievements 玩家成就
type PlayerAchievements struct {
	PlayerID      string         `json:"player_id"`
	Unlocked      []string       `json:"unlocked"`
	Progress      map[string]int `json:"progress"`
	TotalPoints   int            `json:"total_points"`
	LastUnlocked  time.Time      `json:"last_unlocked"`
	mu            sync.RWMutex
}

// AchievementSystem 成就系统
type AchievementSystem struct {
	achievements map[string]*Achievement
	mu           sync.RWMutex
}

// NewAchievementSystem 创建成就系统
func NewAchievementSystem() *AchievementSystem {
	system := &AchievementSystem{
		achievements: make(map[string]*Achievement),
	}

	// 初始化成就
	system.initAchievements()

	return system
}

func (as *AchievementSystem) initAchievements() {
	// 击杀成就
	as.add(&Achievement{
		ID: "first-blood", Name: "首杀", Description: "完成第一次击杀",
		Icon: "🩸", Category: "kills", Requirement: 1, Points: 10,
	})
	as.add(&Achievement{
		ID: "killer", Name: "杀手", Description: "累计击杀 100 次",
		Icon: "💀", Category: "kills", Requirement: 100, Points: 50,
	})
	as.add(&Achievement{
		ID: "serial-killer", Name: "连环杀手", Description: "累计击杀 500 次",
		Icon: "🔪", Category: "kills", Requirement: 500, Points: 100,
	})
	as.add(&Achievement{
		ID: "mass-murderer", Name: "杀神", Description: "累计击杀 1000 次",
		Icon: "☠️", Category: "kills", Requirement: 1000, Points: 200,
	})

	// 连杀成就
	as.add(&Achievement{
		ID: "double-kill", Name: "双杀", Description: "达成双杀",
		Icon: "✌️", Category: "streak", Requirement: 2, Points: 20,
	})
	as.add(&Achievement{
		ID: "triple-kill", Name: "三杀", Description: "达成三杀",
		Icon: "3️⃣", Category: "streak", Requirement: 3, Points: 30,
	})
	as.add(&Achievement{
		ID: "ultra-kill", Name: "四杀", Description: "达成四杀",
		Icon: "4️⃣", Category: "streak", Requirement: 4, Points: 50,
	})
	as.add(&Achievement{
		ID: "rampage", Name: "五杀", Description: "达成五杀",
		Icon: "5️⃣", Category: "streak", Requirement: 5, Points: 80,
	})
	as.add(&Achievement{
		ID: "unstoppable", Name: "不可阻挡", Description: "达成十连杀",
		Icon: "🔥", Category: "streak", Requirement: 10, Points: 200,
	})

	// 武器成就
	as.add(&Achievement{
		ID: "pistol-master", Name: "手枪大师", Description: "使用手枪击杀 50 人",
		Icon: "🔫", Category: "weapon", Requirement: 50, Points: 50,
	})
	as.add(&Achievement{
		ID: "sniper-elite", Name: "狙击精英", Description: "使用狙击枪击杀 100 人",
		Icon: "🎯", Category: "weapon", Requirement: 100, Points: 100,
	})
	as.add(&Achievement{
		ID: "shotgun-surgeon", Name: "霰弹外科医生", Description: "使用霰弹枪击杀 50 人",
		Icon: "💥", Category: "weapon", Requirement: 50, Points: 50,
	})

	// 爆头成就
	as.add(&Achievement{
		ID: "headhunter", Name: "猎头者", Description: "爆头击杀 50 次",
		Icon: "🎯", Category: "headshot", Requirement: 50, Points: 50,
	})
	as.add(&Achievement{
		ID: "sharpshooter", Name: "神枪手", Description: "爆头击杀 200 次",
		Icon: "🎖️", Category: "headshot", Requirement: 200, Points: 100,
	})

	// 比赛成就
	as.add(&Achievement{
		ID: "mvp", Name: "MVP", Description: "获得 MVP 10 次",
		Icon: "🏆", Category: "match", Requirement: 10, Points: 100,
	})
	as.add(&Achievement{
		ID: "winner", Name: "胜利者", Description: "赢得 100 场比赛",
		Icon: "🥇", Category: "match", Requirement: 100, Points: 200,
	})
	as.add(&Achievement{
		ID: "undefeated", Name: "不败传说", Description: "连续赢得 10 场比赛",
		Icon: "👑", Category: "match", Requirement: 10, Points: 300,
	})

	// 生存成就
	as.add(&Achievement{
		ID: "survivor", Name: "幸存者", Description: "单局不死",
		Icon: "🛡️", Category: "survival", Requirement: 1, Points: 50,
	})
	as.add(&Achievement{
		ID: "immortal", Name: "不死之身", Description: "单局不死且击杀 10 人",
		Icon: "♾️", Category: "survival", Requirement: 10, Points: 200,
	})

	// 道具成就
	as.add(&Achievement{
		ID: "collector", Name: "收集者", Description: "拾取 500 个道具",
		Icon: "💎", Category: "powerup", Requirement: 500, Points: 50,
	})

	// 时间成就
	as.add(&Achievement{
		ID: "dedicated", Name: "专注玩家", Description: "游戏时间达到 10 小时",
		Icon: "⏰", Category: "time", Requirement: 36000, Points: 50,
	})
	as.add(&Achievement{
		ID: "veteran", Name: "资深玩家", Description: "游戏时间达到 100 小时",
		Icon: "🎖️", Category: "time", Requirement: 360000, Points: 200,
	})
}

func (as *AchievementSystem) add(a *Achievement) {
	as.achievements[a.ID] = a
}

// Get 获取成就
func (as *AchievementSystem) Get(id string) *Achievement {
	as.mu.RLock()
	defer as.mu.RUnlock()
	return as.achievements[id]
}

// GetAll 获取所有成就
func (as *AchievementSystem) GetAll() []*Achievement {
	as.mu.RLock()
	defer as.mu.RUnlock()

	result := make([]*Achievement, 0, len(as.achievements))
	for _, a := range as.achievements {
		result = append(result, a)
	}
	return result
}

// GetByCategory 按类别获取
func (as *AchievementSystem) GetByCategory(category string) []*Achievement {
	as.mu.RLock()
	defer as.mu.RUnlock()

	result := make([]*Achievement, 0)
	for _, a := range as.achievements {
		if a.Category == category {
			result = append(result, a)
		}
	}
	return result
}

// NewPlayerAchievements 创建玩家成就
func NewPlayerAchievements(playerID string) *PlayerAchievements {
	return &PlayerAchievements{
		PlayerID: playerID,
		Unlocked: make([]string, 0),
		Progress: make(map[string]int),
	}
}

// Unlock 解锁成就
func (pa *PlayerAchievements) Unlock(achievementID string, points int) bool {
	pa.mu.Lock()
	defer pa.mu.Unlock()

	// 检查是否已解锁
	for _, id := range pa.Unlocked {
		if id == achievementID {
			return false
		}
	}

	pa.Unlocked = append(pa.Unlocked, achievementID)
	pa.TotalPoints += points
	pa.LastUnlocked = time.Now()

	return true
}

// UpdateProgress 更新进度
func (pa *PlayerAchievements) UpdateProgress(achievementID string, progress int) {
	pa.mu.Lock()
	defer pa.mu.Unlock()
	pa.Progress[achievementID] = progress
}

// GetProgress 获取进度
func (pa *PlayerAchievements) GetProgress(achievementID string) int {
	pa.mu.RLock()
	defer pa.mu.RUnlock()
	return pa.Progress[achievementID]
}

// IsUnlocked 是否已解锁
func (pa *PlayerAchievements) IsUnlocked(achievementID string) bool {
	pa.mu.RLock()
	defer pa.mu.RUnlock()

	for _, id := range pa.Unlocked {
		if id == achievementID {
			return true
		}
	}
	return false
}

// GetUnlocked 获取已解锁
func (pa *PlayerAchievements) GetUnlocked() []string {
	pa.mu.RLock()
	defer pa.mu.RUnlock()

	result := make([]string, len(pa.Unlocked))
	copy(result, pa.Unlocked)
	return result
}

// Stats 玩家统计
type Stats struct {
	PlayerID         string         `json:"player_id"`
	Kills            int            `json:"kills"`
	Deaths           int            `json:"deaths"`
	Headshots        int            `json:"headshots"`
	Wins             int            `json:"wins"`
	Losses           int            `json:"losses"`
	MVPCount         int            `json:"mvp_count"`
	WinStreak        int            `json:"win_streak"`
	MaxWinStreak     int            `json:"max_win_streak"`
	MaxKillStreak    int            `json:"max_kill_streak"`
	PowerupsCollected int           `json:"powerups_collected"`
	PlayTime         time.Duration  `json:"play_time"`
	WeaponKills      map[string]int `json:"weapon_kills"`
	Matches          int            `json:"matches"`
	mu               sync.RWMutex
}

// NewStats 创建统计
func NewStats(playerID string) *Stats {
	return &Stats{
		PlayerID:    playerID,
		WeaponKills: make(map[string]int),
	}
}

// AddKill 增加击杀
func (s *Stats) AddKill(weapon string, isHeadshot bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.Kills++
	if isHeadshot {
		s.Headshots++
	}
	if weapon != "" {
		s.WeaponKills[weapon]++
	}
}

// AddDeath 增加死亡
func (s *Stats) AddDeath() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.Deaths++
}

// AddWin 增加胜利
func (s *Stats) AddWin() {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.Wins++
	s.WinStreak++
	if s.WinStreak > s.MaxWinStreak {
		s.MaxWinStreak = s.WinStreak
	}
}

// AddLoss 增加失败
func (s *Stats) AddLoss() {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.Losses++
	s.WinStreak = 0
}

// AddMatch 增加比赛
func (s *Stats) AddMatch() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.Matches++
}

// AddMVP 增加 MVP
func (s *Stats) AddMVP() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.MVPCount++
}

// AddPowerup 增加道具
func (s *Stats) AddPowerup() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.PowerupsCollected++
}

// AddPlayTime 增加游戏时间
func (s *Stats) AddPlayTime(d time.Duration) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.PlayTime += d
}

// GetKD 获取 K/D
func (s *Stats) GetKD() float64 {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if s.Deaths == 0 {
		return float64(s.Kills)
	}
	return float64(s.Kills) / float64(s.Deaths)
}

// GetWinRate 获取胜率
func (s *Stats) GetWinRate() float64 {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if s.Matches == 0 {
		return 0
	}
	return float64(s.Wins) / float64(s.Matches)
}

// GetHeadshotRate 获取爆头率
func (s *Stats) GetHeadshotRate() float64 {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if s.Kills == 0 {
		return 0
	}
	return float64(s.Headshots) / float64(s.Kills)
}

// ToMap 转换为 map
func (s *Stats) ToMap() map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()

	return map[string]interface{}{
		"player_id":          s.PlayerID,
		"kills":              s.Kills,
		"deaths":             s.Deaths,
		"kd":                 s.GetKD(),
		"headshots":          s.Headshots,
		"headshot_rate":      s.GetHeadshotRate(),
		"wins":               s.Wins,
		"losses":             s.Losses,
		"win_rate":           s.GetWinRate(),
		"mvp_count":          s.MVPCount,
		"win_streak":         s.WinStreak,
		"max_win_streak":     s.MaxWinStreak,
		"max_kill_streak":    s.MaxKillStreak,
		"powerups_collected": s.PowerupsCollected,
		"play_time_seconds":  s.PlayTime.Seconds(),
		"weapon_kills":       s.WeaponKills,
		"matches":            s.Matches,
	}
}
