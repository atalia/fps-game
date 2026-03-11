package game

import (
	"sync"
)

// Team 队伍
type Team struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Color       string `json:"color"`
	Score       int    `json:"score"`
	MaxPlayers  int    `json:"max_players"`
	PlayerCount int    `json:"player_count"`
}

// TeamManager 队伍管理器
type TeamManager struct {
	teams    map[string]*Team
	balance  bool // 是否自动平衡
	mu       sync.RWMutex
}

// NewTeamManager 创建队伍管理器
func NewTeamManager() *TeamManager {
	tm := &TeamManager{
		teams:   make(map[string]*Team),
		balance: true,
	}

	// 默认队伍
	tm.CreateTeam("red", "红队", "#f44336", 10)
	tm.CreateTeam("blue", "蓝队", "#2196F3", 10)

	return tm
}

// CreateTeam 创建队伍
func (tm *TeamManager) CreateTeam(id, name, color string, maxPlayers int) *Team {
	tm.mu.Lock()
	defer tm.mu.Unlock()

	team := &Team{
		ID:         id,
		Name:       name,
		Color:      color,
		MaxPlayers: maxPlayers,
	}
	tm.teams[id] = team
	return team
}

// GetTeam 获取队伍
func (tm *TeamManager) GetTeam(id string) *Team {
	tm.mu.RLock()
	defer tm.mu.RUnlock()
	return tm.teams[id]
}

// GetAllTeams 获取所有队伍
func (tm *TeamManager) GetAllTeams() []*Team {
	tm.mu.RLock()
	defer tm.mu.RUnlock()

	teams := make([]*Team, 0, len(tm.teams))
	for _, team := range tm.teams {
		teams = append(teams, team)
	}
	return teams
}

// AddPlayerToTeam 添加玩家到队伍
func (tm *TeamManager) AddPlayerToTeam(teamID string) bool {
	tm.mu.Lock()
	defer tm.mu.Unlock()

	team, exists := tm.teams[teamID]
	if !exists {
		return false
	}

	if team.PlayerCount >= team.MaxPlayers {
		return false
	}

	team.PlayerCount++
	return true
}

// RemovePlayerFromTeam 从队伍移除玩家
func (tm *TeamManager) RemovePlayerFromTeam(teamID string) {
	tm.mu.Lock()
	defer tm.mu.Unlock()

	if team, exists := tm.teams[teamID]; exists {
		if team.PlayerCount > 0 {
			team.PlayerCount--
		}
	}
}

// GetAutoAssignTeam 自动分配队伍
func (tm *TeamManager) GetAutoAssignTeam() string {
	tm.mu.RLock()
	defer tm.mu.RUnlock()

	if !tm.balance {
		// 返回人少的队伍
		for _, team := range tm.teams {
			if team.PlayerCount < team.MaxPlayers {
				return team.ID
			}
		}
		return ""
	}

	// 平衡模式：选择人最少的队伍
	var minTeam *Team
	for _, team := range tm.teams {
		if minTeam == nil || team.PlayerCount < minTeam.PlayerCount {
			minTeam = team
		}
	}

	if minTeam != nil && minTeam.PlayerCount < minTeam.MaxPlayers {
		return minTeam.ID
	}

	return ""
}

// AddScore 队伍加分
func (tm *TeamManager) AddScore(teamID string, points int) {
	tm.mu.Lock()
	defer tm.mu.Unlock()

	if team, exists := tm.teams[teamID]; exists {
		team.Score += points
	}
}

// GetScore 获取队伍分数
func (tm *TeamManager) GetScore(teamID string) int {
	tm.mu.RLock()
	defer tm.mu.RUnlock()

	if team, exists := tm.teams[teamID]; exists {
		return team.Score
	}
	return 0
}

// ResetScores 重置所有队伍分数
func (tm *TeamManager) ResetScores() {
	tm.mu.Lock()
	defer tm.mu.Unlock()

	for _, team := range tm.teams {
		team.Score = 0
	}
}

// GetWinningTeam 获取领先队伍
func (tm *TeamManager) GetWinningTeam() *Team {
	tm.mu.RLock()
	defer tm.mu.RUnlock()

	var winner *Team
	for _, team := range tm.teams {
		if winner == nil || team.Score > winner.Score {
			winner = team
		}
	}
	return winner
}

// SetBalance 设置自动平衡
func (tm *TeamManager) SetBalance(enabled bool) {
	tm.mu.Lock()
	defer tm.mu.Unlock()
	tm.balance = enabled
}

// GetTeamCounts 获取各队伍人数
func (tm *TeamManager) GetTeamCounts() map[string]int {
	tm.mu.RLock()
	defer tm.mu.RUnlock()

	counts := make(map[string]int)
	for id, team := range tm.teams {
		counts[id] = team.PlayerCount
	}
	return counts
}
