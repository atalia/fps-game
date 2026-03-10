// 排行榜系统
package game

import (
	"sort"
	"sync"
	"time"
)

// Leaderboard 排行榜
type Leaderboard struct {
	entries map[string]*LeaderboardEntry
	mu      sync.RWMutex
	maxSize int
}

// NewLeaderboard 创建排行榜
func NewLeaderboard(maxSize int) *Leaderboard {
	return &Leaderboard{
		entries: make(map[string]*LeaderboardEntry),
		maxSize: maxSize,
	}
}

// UpdateEntry 更新排行榜条目
func (l *Leaderboard) UpdateEntry(playerID, name string, score, kills, deaths int) {
	l.mu.Lock()
	defer l.mu.Unlock()

	entry, exists := l.entries[playerID]
	if !exists {
		entry = &LeaderboardEntry{
			GeoID: playerID,
		}
		l.entries[playerID] = entry
	}

	entry.Name = name
	entry.Score = score
	entry.Kills = kills
	entry.Deaths = deaths
	entry.UpdatedAt = time.Now()
}

// RemoveEntry 移除排行榜条目
func (l *Leaderboard) RemoveEntry(playerID string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	delete(l.entries, playerID)
}

// GetTop 获取前 N 名
func (l *Leaderboard) GetTop(n int) []LeaderboardEntry {
	l.mu.RLock()
	defer l.mu.RUnlock()

	// 转换为切片
	entries := make([]LeaderboardEntry, 0, len(l.entries))
	for _, entry := range l.entries {
		entries = append(entries, *entry)
	}

	// 按分数排序
	sort.Slice(entries, func(i, j int) bool {
		return entries[i].Score > entries[j].Score
	})

	// 限制数量
	if n > len(entries) {
		n = len(entries)
	}

	// 设置排名
	for i := range entries[:n] {
		entries[i].Rank = i + 1
	}

	return entries[:n]
}

// GetRank 获取玩家排名
func (l *Leaderboard) GetRank(playerID string) int {
	l.mu.RLock()
	defer l.mu.RUnlock()

	entry, exists := l.entries[playerID]
	if !exists {
		return -1
	}

	// 计算排名
	rank := 1
	for _, e := range l.entries {
		if e.Score > entry.Score {
			rank++
		}
	}

	return rank
}

// GetEntry 获取玩家条目
func (l *Leaderboard) GetEntry(playerID string) *LeaderboardEntry {
	l.mu.RLock()
	defer l.mu.RUnlock()

	entry, exists := l.entries[playerID]
	if !exists {
		return nil
	}

	copy := *entry
	return &copy
}

// Clear 清空排行榜
func (l *Leaderboard) Clear() {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.entries = make(map[string]*LeaderboardEntry)
}

// Size 获取排行榜大小
func (l *Leaderboard) Size() int {
	l.mu.RLock()
	defer l.mu.RUnlock()
	return len(l.entries)
}

// LeaderboardEntry 排行榜条目（扩展）
type LeaderboardEntry struct {
	Rank      int       `json:"rank"`
	GeoID     string    `json:"player_id"`
	Name      string    `json:"name"`
	Score     int       `json:"score"`
	Kills     int       `json:"kills"`
	Deaths    int       `json:"deaths"`
	KD        float64   `json:"kd"`
	UpdatedAt time.Time `json:"updated_at"`
}

// CalculateKD 计算击杀死亡比
func (e *LeaderboardEntry) CalculateKD() {
	if e.Deaths == 0 {
		e.KD = float64(e.Kills)
	} else {
		e.KD = float64(e.Kills) / float64(e.Deaths)
	}
}

// Stats 统计信息
type Stats struct {
	TotalPlayers  int `json:"total_players"`
	TotalKills    int `json:"total_kills"`
	TotalDeaths   int `json:"total_deaths"`
	TotalScore    int `json:"total_score"`
	AverageScore  int `json:"average_score"`
	AverageKD     int `json:"average_kd"`
}

// GetStats 获取统计信息
func (l *Leaderboard) GetStats() Stats {
	l.mu.RLock()
	defer l.mu.RUnlock()

	stats := Stats{
		TotalPlayers: len(l.entries),
	}

	for _, entry := range l.entries {
		stats.TotalKills += entry.Kills
		stats.TotalDeaths += entry.Deaths
		stats.TotalScore += entry.Score
	}

	if stats.TotalPlayers > 0 {
		stats.AverageScore = stats.TotalScore / stats.TotalPlayers
		if stats.TotalDeaths > 0 {
			stats.AverageKD = stats.TotalKills / stats.TotalDeaths
		} else {
			stats.AverageKD = stats.TotalKills
		}
	}

	return stats
}

// MatchStats 比赛统计
type MatchStats struct {
	MatchID    string            `json:"match_id"`
	StartTime  time.Time         `json:"start_time"`
	EndTime    time.Time         `json:"end_time"`
	Duration   time.Duration     `json:"duration"`
	Winner     string            `json:"winner"`
	Players    []string          `json:"players"`
	Scores     map[string]int    `json:"scores"`
	Kills      map[string]int    `json:"kills"`
	Deaths     map[string]int    `json:"deaths"`
	Leaderboard []LeaderboardEntry `json:"leaderboard"`
}

// NewMatchStats 创建比赛统计
func NewMatchStats(matchID string, players []string) *MatchStats {
	return &MatchStats{
		MatchID:   matchID,
		StartTime: time.Now(),
		Players:   players,
		Scores:    make(map[string]int),
		Kills:     make(map[string]int),
		Deaths:    make(map[string]int),
	}
}

// EndMatch 结束比赛
func (m *MatchStats) EndMatch(winner string) {
	m.EndTime = time.Now()
	m.Duration = m.EndTime.Sub(m.StartTime)
	m.Winner = winner
}

// RecordKill 记录击杀
func (m *MatchStats) RecordKill(killer, victim string) {
	m.Kills[killer]++
	m.Deaths[victim]++
}

// RecordScore 记录得分
func (m *MatchStats) RecordScore(player string, score int) {
	m.Scores[player] += score
}

// GetLeaderboard 获取比赛排行榜
func (m *MatchStats) GetLeaderboard() []LeaderboardEntry {
	entries := make([]LeaderboardEntry, 0, len(m.Players))

	for _, playerID := range m.Players {
		entry := LeaderboardEntry{
			GeoID:  playerID,
			Score:  m.Scores[playerID],
			Kills:  m.Kills[playerID],
			Deaths: m.Deaths[playerID],
		}
		entry.CalculateKD()
		entries = append(entries, entry)
	}

	// 排序
	sort.Slice(entries, func(i, j int) bool {
		return entries[i].Score > entries[j].Score
	})

	// 设置排名
	for i := range entries {
		entries[i].Rank = i + 1
	}

	m.Leaderboard = entries
	return entries
}
