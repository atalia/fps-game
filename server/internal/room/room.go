package room

import (
	"crypto/rand"
	"encoding/hex"
	"sync"
	"time"

	"fps-game/internal/player"
)

// Room 游戏房间
type Room struct {
	ID        string
	Name      string
	MaxSize   int
	Players   map[string]*player.Player
	CreatedAt time.Time
	StartedAt time.Time
	mu        sync.RWMutex
}

// NewRoom 创建房间
func NewRoom(maxSize int) *Room {
	return &Room{
		ID:        generateID(),
		MaxSize:   maxSize,
		Players:   make(map[string]*player.Player),
		CreatedAt: time.Now(),
	}
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
	delete(r.Players, playerID)
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
	// 由 network 层实现
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
		delete(m.rooms, id)
	}
}

// JoinRoom 玩家加入房间
func (m *Manager) JoinRoom(playerID string, roomID string) bool {
	m.mu.Lock()
	defer m.mu.Unlock()

	room, exists := m.rooms[roomID]
	if !exists || room.IsFull() {
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

// LeaveRoom 玩家离开房间
func (m *Manager) LeaveRoom(playerID string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if roomID, exists := m.playerRooms[playerID]; exists {
		if room, ok := m.rooms[roomID]; ok {
			room.RemovePlayer(playerID)
			// 如果房间空了，移除房间
			if room.GetPlayerCount() == 0 {
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
	rand.Read(b)
	return hex.EncodeToString(b)
}
