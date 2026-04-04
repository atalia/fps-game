package team

import (
	"math"
	"strings"
	"sync"
)

const (
	TeamCounterTerrorists = "ct"
	TeamTerrorists        = "t"
	AutoAssignTeam        = "auto"
)

var teamAliases = map[string]string{
	"blue":               TeamCounterTerrorists,
	"counter-terrorists": TeamCounterTerrorists,
	"counter_terrorists": TeamCounterTerrorists,
	"counterterrorists":  TeamCounterTerrorists,
	"ct":                 TeamCounterTerrorists,
	"red":                TeamTerrorists,
	"terrorists":         TeamTerrorists,
	"terrorist":          TeamTerrorists,
	"t":                  TeamTerrorists,
}

// Team 队伍
type Team struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	ShortName   string `json:"short_name"`
	Color       string `json:"color"`
	Model       string `json:"model"`
	Score       int    `json:"score"`
	MaxPlayers  int    `json:"max_players"`
	PlayerCount int    `json:"player_count"`
}

// TeamManager 队伍管理器
type TeamManager struct {
	teams   map[string]*Team
	order   []string
	balance bool
	mu      sync.RWMutex
}

// NormalizeTeamID 兼容旧的 red/blue 标识，并统一为 CT/T。
func NormalizeTeamID(teamID string) string {
	normalized := strings.ToLower(strings.TrimSpace(teamID))
	if normalized == "" {
		return ""
	}
	if alias, ok := teamAliases[normalized]; ok {
		return alias
	}
	return normalized
}

func NewTeamManager() *TeamManager {
	return NewTeamManagerForRoom(10)
}

func NewTeamManagerForRoom(maxRoomPlayers int) *TeamManager {
	if maxRoomPlayers <= 0 {
		maxRoomPlayers = 10
	}

	perTeamMax := int(math.Ceil(float64(maxRoomPlayers) / 2))
	tm := &TeamManager{
		teams:   make(map[string]*Team),
		order:   make([]string, 0, 2),
		balance: true,
	}

	tm.CreateTeam(TeamCounterTerrorists, "Counter-Terrorists", "CT", "#2196F3", "ct", perTeamMax)
	tm.CreateTeam(TeamTerrorists, "Terrorists", "T", "#f44336", "t", perTeamMax)

	return tm
}

func (tm *TeamManager) CreateTeam(id, name, shortName, color, model string, maxPlayers int) *Team {
	tm.mu.Lock()
	defer tm.mu.Unlock()

	id = NormalizeTeamID(id)
	team := &Team{
		ID:         id,
		Name:       name,
		ShortName:  shortName,
		Color:      color,
		Model:      model,
		MaxPlayers: maxPlayers,
	}
	if _, exists := tm.teams[id]; !exists {
		tm.order = append(tm.order, id)
	}
	tm.teams[id] = team
	return team
}

func (tm *TeamManager) GetTeam(id string) *Team {
	tm.mu.RLock()
	defer tm.mu.RUnlock()
	return tm.teams[NormalizeTeamID(id)]
}

func (tm *TeamManager) GetAllTeams() []*Team {
	tm.mu.RLock()
	defer tm.mu.RUnlock()

	teams := make([]*Team, 0, len(tm.order))
	for _, id := range tm.order {
		if current, ok := tm.teams[id]; ok {
			copied := *current
			teams = append(teams, &copied)
		}
	}
	return teams
}

func (tm *TeamManager) projectedCountsLocked(targetID, currentTeamID string) (int, int, bool) {
	targetID = NormalizeTeamID(targetID)
	currentTeamID = NormalizeTeamID(currentTeamID)

	target, ok := tm.teams[targetID]
	if !ok {
		return 0, 0, false
	}

	otherID := tm.otherTeamIDLocked(targetID)
	if otherID == "" {
		return target.PlayerCount, 0, true
	}

	targetCount := target.PlayerCount
	otherCount := tm.teams[otherID].PlayerCount

	if currentTeamID != "" && currentTeamID != targetID && currentTeamID == otherID {
		otherCount--
	}

	if currentTeamID != targetID {
		targetCount++
	}

	return targetCount, otherCount, true
}

func (tm *TeamManager) otherTeamIDLocked(teamID string) string {
	for _, id := range tm.order {
		if id != teamID {
			return id
		}
	}
	return ""
}

func (tm *TeamManager) CanJoinTeam(teamID, currentTeamID string) bool {
	tm.mu.RLock()
	defer tm.mu.RUnlock()

	teamID = NormalizeTeamID(teamID)
	currentTeamID = NormalizeTeamID(currentTeamID)

	target, exists := tm.teams[teamID]
	if !exists {
		return false
	}
	if teamID == currentTeamID {
		return true
	}
	if target.PlayerCount >= target.MaxPlayers {
		return false
	}
	if !tm.balance {
		return true
	}

	targetCount, otherCount, ok := tm.projectedCountsLocked(teamID, currentTeamID)
	if !ok {
		return false
	}
	return abs(targetCount-otherCount) <= 1
}

func (tm *TeamManager) AddPlayerToTeam(teamID string) bool {
	tm.mu.Lock()
	defer tm.mu.Unlock()

	current, exists := tm.teams[NormalizeTeamID(teamID)]
	if !exists {
		return false
	}
	if current.PlayerCount >= current.MaxPlayers {
		return false
	}
	current.PlayerCount++
	return true
}

func (tm *TeamManager) RemovePlayerFromTeam(teamID string) {
	tm.mu.Lock()
	defer tm.mu.Unlock()

	if current, exists := tm.teams[NormalizeTeamID(teamID)]; exists && current.PlayerCount > 0 {
		current.PlayerCount--
	}
}

func (tm *TeamManager) GetAutoAssignTeam() string {
	return tm.GetAutoAssignTeamForCurrent("")
}

func (tm *TeamManager) GetAutoAssignTeamForCurrent(currentTeamID string) string {
	tm.mu.RLock()
	defer tm.mu.RUnlock()

	bestID := ""
	bestProjected := math.MaxInt

	for _, id := range tm.order {
		if !tm.canJoinTeamLocked(id, currentTeamID) {
			continue
		}

		projected, _, ok := tm.projectedCountsLocked(id, currentTeamID)
		if !ok {
			continue
		}

		if projected < bestProjected {
			bestProjected = projected
			bestID = id
		}
	}

	return bestID
}

func (tm *TeamManager) canJoinTeamLocked(teamID, currentTeamID string) bool {
	teamID = NormalizeTeamID(teamID)
	currentTeamID = NormalizeTeamID(currentTeamID)

	target, exists := tm.teams[teamID]
	if !exists {
		return false
	}
	if teamID == currentTeamID {
		return true
	}
	if target.PlayerCount >= target.MaxPlayers {
		return false
	}
	if !tm.balance {
		return true
	}

	targetCount, otherCount, ok := tm.projectedCountsLocked(teamID, currentTeamID)
	if !ok {
		return false
	}
	return abs(targetCount-otherCount) <= 1
}

func (tm *TeamManager) AddScore(teamID string, points int) {
	tm.mu.Lock()
	defer tm.mu.Unlock()

	if current, exists := tm.teams[NormalizeTeamID(teamID)]; exists {
		current.Score += points
	}
}

func (tm *TeamManager) GetScore(teamID string) int {
	tm.mu.RLock()
	defer tm.mu.RUnlock()

	if current, exists := tm.teams[NormalizeTeamID(teamID)]; exists {
		return current.Score
	}
	return 0
}

func (tm *TeamManager) ResetScores() {
	tm.mu.Lock()
	defer tm.mu.Unlock()

	for _, current := range tm.teams {
		current.Score = 0
	}
}

func (tm *TeamManager) SyncPlayerCounts(counts map[string]int) {
	tm.mu.Lock()
	defer tm.mu.Unlock()

	for _, id := range tm.order {
		tm.teams[id].PlayerCount = counts[NormalizeTeamID(id)]
	}
}

func (tm *TeamManager) GetWinningTeam() *Team {
	tm.mu.RLock()
	defer tm.mu.RUnlock()

	var winner *Team
	for _, id := range tm.order {
		current := tm.teams[id]
		if winner == nil || current.Score > winner.Score {
			winner = current
		}
	}
	if winner == nil {
		return nil
	}

	copied := *winner
	return &copied
}

func (tm *TeamManager) SetBalance(enabled bool) {
	tm.mu.Lock()
	defer tm.mu.Unlock()
	tm.balance = enabled
}

func (tm *TeamManager) GetTeamCounts() map[string]int {
	tm.mu.RLock()
	defer tm.mu.RUnlock()

	counts := make(map[string]int, len(tm.teams))
	for _, id := range tm.order {
		counts[id] = tm.teams[id].PlayerCount
	}
	return counts
}

func abs(v int) int {
	if v < 0 {
		return -v
	}
	return v
}
