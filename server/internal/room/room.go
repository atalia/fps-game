package room

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"sync"
	"time"

	"fps-game/internal/ai"
	"fps-game/internal/player"
	"fps-game/internal/team"
)

// Room 游戏房间
type Room struct {
	ID           string
	Name         string
	MaxSize      int
	Players      map[string]*player.Player
	BotManager   *ai.Manager
	CreatedAt    time.Time
	StartedAt    time.Time
	TeamManager  *team.TeamManager
	RoundManager *RoundManager
	// C4 爆破模式
	C4Planted         bool
	C4Planter         string
	C4Position        player.Position
	C4PlantedAt       time.Time
	GameMode          string
	roundResetPending bool
	broadcastFn       func(string, interface{}, string)
	// 火焰区域
	FireZones []*FireZone
	mu                sync.RWMutex
}

// FireZone 火焰区域
type FireZone struct {
	Position     player.Position
	Radius       float64
	StartTime    time.Time
	Duration     time.Duration
	DPS          int
	AttackerID   string
	AttackerTeam string
}

// NewRoom 创建房间
func NewRoom(maxSize int) *Room {
	r := &Room{
		ID:          generateID(),
		MaxSize:     maxSize,
		Players:     make(map[string]*player.Player),
		BotManager:  ai.NewManager(),
		TeamManager: team.NewTeamManagerForRoom(maxSize),
		CreatedAt:   time.Now(),
		FireZones:   make([]*FireZone, 0),
	}
	r.RoundManager = NewRoundManager(r, DefaultRoundConfig)
	return r
}

// AddFireZone 添加火焰区域
func (r *Room) AddFireZone(fire *FireZone) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.FireZones = append(r.FireZones, fire)
}

// GetFireZones 获取火焰区域列表
func (r *Room) GetFireZones() []*FireZone {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.FireZones
}

// CleanExpiredFireZones 清理过期的火焰区域
func (r *Room) CleanExpiredFireZones() {
	r.mu.Lock()
	defer r.mu.Unlock()
	now := time.Now()
	active := make([]*FireZone, 0)
	for _, fire := range r.FireZones {
		if now.Sub(fire.StartTime) < fire.Duration {
			active = append(active, fire)
		}
	}
	r.FireZones = active
}

// GetPlayers 获取玩家列表的副本（线程安全）
func (r *Room) GetPlayers() map[string]*player.Player {
	r.mu.RLock()
	defer r.mu.RUnlock()
	// 返回副本而不是内部 map 引用，防止外部无锁修改
	playersCopy := make(map[string]*player.Player, len(r.Players))
	for k, v := range r.Players {
		playersCopy[k] = v
	}
	return playersCopy
}

// GetPlayerIDs 获取所有玩家 ID 列表（线程安全）
func (r *Room) GetPlayerIDs() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	ids := make([]string, 0, len(r.Players))
	for id := range r.Players {
		ids = append(ids, id)
	}
	return ids
}

// AddBot 添加机器人
func (r *Room) AddBot(difficulty ai.Difficulty, team string) *ai.Bot {
	return r.BotManager.AddBot(difficulty, team)
}

// RemoveBot 移除机器人
func (r *Room) RemoveBot(botID string) {
	r.BotManager.RemoveBot(botID)
}

// GetBots 获取所有机器人
func (r *Room) GetBots() []*ai.Bot {
	return r.BotManager.GetAllBots()
}

// GetBotCount 获取机器人数量
func (r *Room) GetBotCount() int {
	return r.BotManager.GetBotCount()
}

// AddPlayer 添加玩家
func (r *Room) AddPlayer(p *player.Player) bool {
	r.mu.Lock()
	defer r.mu.Unlock()

	if len(r.Players) >= r.MaxSize {
		return false
	}

	r.Players[p.ID] = p
	return true
}

// RemovePlayer 移除玩家
func (r *Room) RemovePlayer(playerID string) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if existing, ok := r.Players[playerID]; ok {
		if existingTeam := existing.GetTeam(); existingTeam != "" && r.TeamManager != nil {
			r.TeamManager.RemovePlayerFromTeam(existingTeam)
		}
		delete(r.Players, playerID)
	}
}

// GetPlayer 获取玩家
func (r *Room) GetPlayer(playerID string) *player.Player {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.Players[playerID]
}

// GetPlayerCount 获取玩家数量
func (r *Room) GetPlayerCount() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.Players)
}

// IsFull 房间是否已满
func (r *Room) IsFull() bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.Players) >= r.MaxSize
}

// IsActive 房间是否活跃
func (r *Room) IsActive() bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.Players) > 0
}

// Update 更新房间状态
func (r *Room) Update() {
	r.mu.Lock()
	defer r.mu.Unlock()

	// 更新所有玩家状态
	for _, p := range r.Players {
		p.Update()
	}
}

// GetPlayerList 获取玩家列表
func (r *Room) GetPlayerList() []map[string]interface{} {
	r.mu.RLock()
	defer r.mu.RUnlock()

	list := make([]map[string]interface{}, 0, len(r.Players))
	for _, p := range r.Players {
		list = append(list, p.ToMap())
	}
	return list
}

// Broadcast 广播消息（占位，实际由 network 层实现）
func (r *Room) Broadcast(msgType string, data interface{}, excludeID string) {
	r.mu.RLock()
	broadcastFn := r.broadcastFn
	r.mu.RUnlock()

	if broadcastFn != nil {
		broadcastFn(msgType, data, excludeID)
	}
}

// SetBroadcaster 设置房间广播回调。
func (r *Room) SetBroadcaster(fn func(string, interface{}, string)) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.broadcastFn = fn
}

// Close 释放房间资源。
func (r *Room) Close() {
	if r.RoundManager != nil {
		r.RoundManager.Close()
	}
}

// GetTeams 获取当前房间的队伍快照。
func (r *Room) GetTeams() []*team.Team {
	if r.TeamManager == nil {
		return nil
	}
	return r.TeamManager.GetAllTeams()
}

// JoinTeam 将玩家加入到指定队伍，支持 auto/red/blue/ct/t。
func (r *Room) JoinTeam(p *player.Player, requestedTeam string) (string, error) {
	if r.TeamManager == nil {
		return "", fmt.Errorf("team manager not initialized")
	}

	currentTeam := p.GetTeam()
	targetTeam := requestedTeam
	if team.NormalizeTeamID(requestedTeam) == "" && requestedTeam != team.AutoAssignTeam {
		return "", fmt.Errorf("unknown team %q", requestedTeam)
	}

	if requestedTeam == team.AutoAssignTeam {
		targetTeam = r.TeamManager.GetAutoAssignTeamForCurrent(currentTeam)
	} else {
		targetTeam = team.NormalizeTeamID(requestedTeam)
	}

	if targetTeam == "" {
		return "", fmt.Errorf("no team available")
	}

	if !r.TeamManager.CanJoinTeam(targetTeam, currentTeam) {
		return "", fmt.Errorf("team %s is locked for balance", targetTeam)
	}

	if normalizedCurrent := team.NormalizeTeamID(currentTeam); normalizedCurrent != "" && normalizedCurrent != targetTeam {
		r.TeamManager.RemovePlayerFromTeam(normalizedCurrent)
	}
	if team.NormalizeTeamID(currentTeam) != targetTeam {
		if !r.TeamManager.AddPlayerToTeam(targetTeam) {
			return "", fmt.Errorf("team %s is full", targetTeam)
		}
	}

	p.SetTeam(targetTeam)
	return targetTeam, nil
}

// CompleteRoundIfWon 在任一队伍完成歼灭时结算该回合。
func (r *Room) CompleteRoundIfWon() (string, []*team.Team, bool) {
	r.mu.Lock()
	if r.roundResetPending {
		r.mu.Unlock()
		return "", nil, false
	}

	teamMembers := map[string]int{}
	aliveByTeam := map[string]int{}

	for _, p := range r.Players {
		teamID := team.NormalizeTeamID(p.GetTeam())
		if teamID == "" {
			continue
		}

		teamMembers[teamID]++
		if p.IsAlive() {
			aliveByTeam[teamID]++
		}
	}

	winner := ""
	if teamMembers[team.TeamCounterTerrorists] > 0 && teamMembers[team.TeamTerrorists] > 0 {
		switch {
		case aliveByTeam[team.TeamCounterTerrorists] > 0 && aliveByTeam[team.TeamTerrorists] == 0:
			winner = team.TeamCounterTerrorists
		case aliveByTeam[team.TeamTerrorists] > 0 && aliveByTeam[team.TeamCounterTerrorists] == 0:
			winner = team.TeamTerrorists
		}
	}

	if winner == "" {
		r.mu.Unlock()
		return "", nil, false
	}

	r.roundResetPending = true
	r.mu.Unlock()

	r.TeamManager.AddScore(winner, 1)
	return winner, r.TeamManager.GetAllTeams(), true
}

// ResetRoundState 清除回合重置中的标记。
func (r *Room) ResetRoundState() {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.roundResetPending = false
}

// Manager 房间管理器
type Manager struct {
	rooms       map[string]*Room
	playerRooms map[string]string // playerID -> roomID
	mu          sync.RWMutex
	maxRooms    int
	defaultSize int
}

// NewManager 创建房间管理器
func NewManager(maxRooms, defaultSize int) *Manager {
	return &Manager{
		rooms:       make(map[string]*Room),
		playerRooms: make(map[string]string),
		maxRooms:    maxRooms,
		defaultSize: defaultSize,
	}
}

// CreateRoom 创建房间
func (m *Manager) CreateRoom() *Room {
	m.mu.Lock()
	defer m.mu.Unlock()

	if len(m.rooms) >= m.maxRooms {
		return nil
	}

	room := NewRoom(m.defaultSize)
	m.rooms[room.ID] = room
	return room
}

// GetRoom 获取房间
func (m *Manager) GetRoom(id string) *Room {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.rooms[id]
}

// RemoveRoom 移除房间
func (m *Manager) RemoveRoom(id string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if room, exists := m.rooms[id]; exists {
		// 清理玩家-房间映射
		for playerID := range room.Players {
			delete(m.playerRooms, playerID)
		}
		room.Close()
		delete(m.rooms, id)
	}
}

// JoinRoom 玩家加入房间
func (m *Manager) JoinRoom(playerID string, roomID string) bool {
	m.mu.Lock()
	defer m.mu.Unlock()

	room, exists := m.rooms[roomID]
	if !exists {
		return false
	}

	alreadyInRoom := room.GetPlayer(playerID) != nil
	if room.IsFull() && !alreadyInRoom {
		return false
	}

	// 如果玩家已在其他房间，先离开
	if oldRoomID, exists := m.playerRooms[playerID]; exists {
		if oldRoom, ok := m.rooms[oldRoomID]; ok {
			oldRoom.RemovePlayer(playerID)
		}
	}

	m.playerRooms[playerID] = roomID
	return true
}

// JoinPlayer 玩家对象加入房间，并由管理器维护房间成员和映射的一致性
func (m *Manager) JoinPlayer(p *player.Player, roomID string) bool {
	m.mu.Lock()
	defer m.mu.Unlock()

	room, exists := m.rooms[roomID]
	if !exists {
		return false
	}

	alreadyInTarget := room.GetPlayer(p.ID) != nil
	if !alreadyInTarget && !room.AddPlayer(p) {
		return false
	}

	if oldRoomID, exists := m.playerRooms[p.ID]; exists && oldRoomID != roomID {
		if oldRoom, ok := m.rooms[oldRoomID]; ok {
			oldRoom.RemovePlayer(p.ID)
		}
	}

	m.playerRooms[p.ID] = roomID
	return true
}

// LeaveRoom 玩家离开房间
func (m *Manager) LeaveRoom(playerID string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if roomID, exists := m.playerRooms[playerID]; exists {
		if room, ok := m.rooms[roomID]; ok {
			room.RemovePlayer(playerID)
			// 如果房间空了，移除房间
			if room.GetPlayerCount() == 0 {
				room.Close()
				delete(m.rooms, roomID)
			}
		}
		delete(m.playerRooms, playerID)
	}
}

// GetPlayerRoom 获取玩家所在房间
func (m *Manager) GetPlayerRoom(playerID string) *Room {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if roomID, exists := m.playerRooms[playerID]; exists {
		return m.rooms[roomID]
	}
	return nil
}

// GetRoomCount 获取房间数量
func (m *Manager) GetRoomCount() int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return len(m.rooms)
}

// GetTotalPlayerCount 获取所有房间内的玩家总数
func (m *Manager) GetTotalPlayerCount() int {
	m.mu.RLock()
	defer m.mu.RUnlock()

	count := 0
	for _, r := range m.rooms {
		count += r.GetPlayerCount()
	}
	return count
}

// GetAllRooms 获取所有房间
func (m *Manager) GetAllRooms() []*Room {
	m.mu.RLock()
	defer m.mu.RUnlock()

	rooms := make([]*Room, 0, len(m.rooms))
	for _, r := range m.rooms {
		rooms = append(rooms, r)
	}
	return rooms
}

// ListRooms 列出所有房间（简化信息）
func (m *Manager) ListRooms() []map[string]interface{} {
	m.mu.RLock()
	defer m.mu.RUnlock()

	result := make([]map[string]interface{}, 0, len(m.rooms))
	for _, r := range m.rooms {
		result = append(result, map[string]interface{}{
			"id":           r.ID,
			"name":         r.Name,
			"player_count": r.GetPlayerCount(),
			"max_size":     r.MaxSize,
		})
	}
	return result
}

// FindAvailableRoom 查找可用房间
func (m *Manager) FindAvailableRoom() *Room {
	m.mu.RLock()
	defer m.mu.RUnlock()

	for _, r := range m.rooms {
		if !r.IsFull() {
			return r
		}
	}
	return nil
}

func generateID() string {
	b := make([]byte, 4)
	if _, err := rand.Read(b); err != nil {
		return fmt.Sprintf("%x", time.Now().UnixNano())[:8]
	}
	return hex.EncodeToString(b)
}

// SetC4Planted 设置 C4 放置状态
func (r *Room) SetC4Planted(planted bool, planter string, pos player.Position) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.C4Planted = planted
	r.C4Planter = planter
	r.C4Position = pos
	r.C4PlantedAt = time.Now()
}

// IsC4Planted C4 是否已放置
func (r *Room) IsC4Planted() bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.C4Planted
}

// GetC4Position 获取 C4 位置
func (r *Room) GetC4Position() player.Position {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.C4Position
}

// GetC4Planter 获取放置 C4 的玩家
func (r *Room) GetC4Planter() string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.C4Planter
}

// GetC4TimeRemaining 获取 C4 剩余时间（秒）
func (r *Room) GetC4TimeRemaining() float64 {
	r.mu.RLock()
	defer r.mu.RUnlock()

	if !r.C4Planted {
		return 0
	}

	// C4 40 秒爆炸
	elapsed := time.Since(r.C4PlantedAt).Seconds()
	remaining := 40.0 - elapsed
	if remaining < 0 {
		return 0
	}
	return remaining
}

// SetGameMode 设置游戏模式
func (r *Room) SetGameMode(mode string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.GameMode = mode
}

// GetGameMode 获取游戏模式
func (r *Room) GetGameMode() string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.GameMode
}
