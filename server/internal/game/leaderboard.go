package game

import (
	"sort"
	"sync"
	"time"
)

// LeaderboardEntry 排行榜条目
type LeaderboardEntry struct {
	PlayerID    string  `json:"player_id"`
	PlayerName  string  `json:"player_name"`
	Score       int     `json:"score"`
	Kills       int     `json:"kills"`
	Deaths      int     `json:"deaths"`
	KD          float64 `json:"kd"`
	WinRate     float64 `json:"win_rate"`
	PlayTime    int     `json:"play_time"` // 秒
	Rank        int     `json:"rank"`
}

// Leaderboard 排行榜
type Leaderboard struct {
	entries    map[string]*LeaderboardEntry
	scoreboard []*LeaderboardEntry // 缓存排序结果
	dirty      bool
	mu         sync.RWMutex
}

// NewLeaderboard 创建排行榜
func NewLeaderboard() *Leaderboard {
	return &Leaderboard{
		entries: make(map[string]*LeaderboardEntry),
		dirty:   true,
	}
}

// UpdateEntry 更新排行榜条目
func (l *Leaderboard) UpdateEntry(playerID, playerName string, score, kills, deaths int) {
	l.mu.Lock()
	defer l.mu.Unlock()

	entry, exists := l.entries[playerID]
	if !exists {
		entry = &LeaderboardEntry{
			PlayerID:   playerID,
			PlayerName: playerName,
		}
		l.entries[playerID] = entry
	}

	entry.Score = score
	entry.Kills = kills
	entry.Deaths = deaths

	// 计算 K/D
	if deaths > 0 {
		entry.KD = float64(kills) / float64(deaths)
	} else {
		entry.KD = float64(kills)
	}

	l.dirty = true
}

// GetEntry 获取玩家条目
func (l *Leaderboard) GetEntry(playerID string) *LeaderboardEntry {
	l.mu.RLock()
	defer l.mu.RUnlock()
	return l.entries[playerID]
}

// GetTopN 获取前 N 名
func (l *Leaderboard) GetTopN(n int) []*LeaderboardEntry {
	l.mu.Lock()
	defer l.mu.Unlock()

	// 排序
	if l.dirty {
		l.scoreboard = make([]*LeaderboardEntry, 0, len(l.entries))
		for _, entry := range l.entries {
			l.scoreboard = append(l.scoreboard, entry)
		}

		sort.Slice(l.scoreboard, func(i, j int) bool {
			return l.scoreboard[i].Score > l.scoreboard[j].Score
		})

		// 更新排名
		for i, entry := range l.scoreboard {
			entry.Rank = i + 1
		}

		l.dirty = false
	}

	if n > len(l.scoreboard) {
		n = len(l.scoreboard)
	}

	return l.scoreboard[:n]
}

// GetPlayerRank 获取玩家排名
func (l *Leaderboard) GetPlayerRank(playerID string) int {
	l.GetTopN(len(l.entries)) // 确保排序

	entry := l.entries[playerID]
	if entry == nil {
		return 0
	}
	return entry.Rank
}

// Clear 清空排行榜
func (l *Leaderboard) Clear() {
	l.mu.Lock()
	defer l.mu.Unlock()

	l.entries = make(map[string]*LeaderboardEntry)
	l.scoreboard = nil
	l.dirty = true
}

// GetStats 获取统计信息
func (l *Leaderboard) GetStats() map[string]interface{} {
	l.mu.RLock()
	defer l.mu.RUnlock()

	if len(l.entries) == 0 {
		return map[string]interface{}{
			"total_players": 0,
		}
	}

	totalKills := 0
	totalDeaths := 0
	totalScore := 0

	for _, entry := range l.entries {
		totalKills += entry.Kills
		totalDeaths += entry.Deaths
		totalScore += entry.Score
	}

	return map[string]interface{}{
		"total_players": len(l.entries),
		"total_kills":   totalKills,
		"total_deaths":  totalDeaths,
		"total_score":   totalScore,
	}
}

// MatchLeaderboard 比赛排行榜
type MatchLeaderboard struct {
	roomID     string
	entries    map[string]*LeaderboardEntry
	startTime  time.Time
	mu         sync.RWMutex
}

// NewMatchLeaderboard 创建比赛排行榜
func NewMatchLeaderboard(roomID string) *MatchLeaderboard {
	return &MatchLeaderboard{
		roomID:    roomID,
		entries:   make(map[string]*LeaderboardEntry),
		startTime: time.Now(),
	}
}

// RecordKill 记录击杀
func (ml *MatchLeaderboard) RecordKill(playerID, playerName string) {
	ml.mu.Lock()
	defer ml.mu.Unlock()

	entry, exists := ml.entries[playerID]
	if !exists {
		entry = &LeaderboardEntry{
			PlayerID:   playerID,
			PlayerName: playerName,
		}
		ml.entries[playerID] = entry
	}

	entry.Kills++
	entry.Score += 100

	// 更新 K/D
	if entry.Deaths > 0 {
		entry.KD = float64(entry.Kills) / float64(entry.Deaths)
	} else {
		entry.KD = float64(entry.Kills)
	}
}

// RecordDeath 记录死亡
func (ml *MatchLeaderboard) RecordDeath(playerID string) {
	ml.mu.Lock()
	defer ml.mu.Unlock()

	entry, exists := ml.entries[playerID]
	if !exists {
		return
	}

	entry.Deaths++

	// 更新 K/D
	if entry.Deaths > 0 {
		entry.KD = float64(entry.Kills) / float64(entry.Deaths)
	}
}

// GetResults 获取比赛结果
func (ml *MatchLeaderboard) GetResults() []*LeaderboardEntry {
	ml.mu.RLock()
	defer ml.mu.RUnlock()

	results := make([]*LeaderboardEntry, 0, len(ml.entries))
	for _, entry := range ml.entries {
		results = append(results, entry)
	}

	sort.Slice(results, func(i, j int) bool {
		return results[i].Score > results[j].Score
	})

	for i, entry := range results {
		entry.Rank = i + 1
	}

	return results
}

// GetMVP 获取 MVP
func (ml *MatchLeaderboard) GetMVP() *LeaderboardEntry {
	results := ml.GetResults()
	if len(results) == 0 {
		return nil
	}
	return results[0]
}

// GetDuration 获取比赛时长
func (ml *MatchLeaderboard) GetDuration() time.Duration {
	return time.Since(ml.startTime)
}
