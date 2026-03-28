package storage

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"
)

// Storage 存储接口
type Storage interface {
	SavePlayer(ctx context.Context, playerID string, data interface{}) error
	GetPlayer(ctx context.Context, playerID string, dest interface{}) error
	DeletePlayer(ctx context.Context, playerID string) error
	SaveRoom(ctx context.Context, roomID string, data interface{}) error
	GetRoom(ctx context.Context, roomID string, dest interface{}) error
	DeleteRoom(ctx context.Context, roomID string) error
	IncrementScore(ctx context.Context, playerID string, delta int) (int, error)
	GetLeaderboard(ctx context.Context, limit int) ([]LeaderboardEntry, error)
	SetSession(ctx context.Context, sessionID string, data interface{}, ttl time.Duration) error
	GetSession(ctx context.Context, sessionID string, dest interface{}) error
	DeleteSession(ctx context.Context, sessionID string) error
	Lock(ctx context.Context, key string, ttl time.Duration) (bool, error)
	Unlock(ctx context.Context, key string) error
	HealthCheck(ctx context.Context) error
}

// LeaderboardEntry 排行榜条目
type LeaderboardEntry struct {
	Rank  int    `json:"rank"`
	GeoID string `json:"player_id"`
	Score int    `json:"score"`
}

// MemoryStorage 内存存储实现
type MemoryStorage struct {
	data     map[string]interface{}
	scores   map[string]int
	sessions map[string]interface{}
	locks    map[string]bool
	mu       sync.RWMutex
}

// NewMemoryStorage 创建内存存储
func NewMemoryStorage() *MemoryStorage {
	return &MemoryStorage{
		data:     make(map[string]interface{}),
		scores:   make(map[string]int),
		sessions: make(map[string]interface{}),
		locks:    make(map[string]bool),
	}
}

// SavePlayer 保存玩家数据
func (s *MemoryStorage) SavePlayer(ctx context.Context, playerID string, data interface{}) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.data["player:"+playerID] = data
	return nil
}

// GetPlayer 获取玩家数据
func (s *MemoryStorage) GetPlayer(ctx context.Context, playerID string, dest interface{}) error {
	s.mu.RLock()
	defer s.mu.RUnlock()
	data, ok := s.data["player:"+playerID]
	if !ok {
		return fmt.Errorf("player not found")
	}
	// 将存储的数据反序列化到 dest
	jsonData, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("failed to marshal player data: %w", err)
	}
	if err := json.Unmarshal(jsonData, dest); err != nil {
		return fmt.Errorf("failed to unmarshal player data: %w", err)
	}
	return nil
}

// DeletePlayer 删除玩家数据
func (s *MemoryStorage) DeletePlayer(ctx context.Context, playerID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.data, "player:"+playerID)
	return nil
}

// SaveRoom 保存房间数据
func (s *MemoryStorage) SaveRoom(ctx context.Context, roomID string, data interface{}) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.data["room:"+roomID] = data
	return nil
}

// GetRoom 获取房间数据
func (s *MemoryStorage) GetRoom(ctx context.Context, roomID string, dest interface{}) error {
	s.mu.RLock()
	defer s.mu.RUnlock()
	data, ok := s.data["room:"+roomID]
	if !ok {
		return fmt.Errorf("room not found")
	}
	// 将存储的数据反序列化到 dest
	jsonData, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("failed to marshal room data: %w", err)
	}
	if err := json.Unmarshal(jsonData, dest); err != nil {
		return fmt.Errorf("failed to unmarshal room data: %w", err)
	}
	return nil
}

// DeleteRoom 删除房间数据
func (s *MemoryStorage) DeleteRoom(ctx context.Context, roomID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.data, "room:"+roomID)
	return nil
}

// IncrementScore 增加玩家分数
func (s *MemoryStorage) IncrementScore(ctx context.Context, playerID string, delta int) (int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.scores[playerID] += delta
	return s.scores[playerID], nil
}

// GetLeaderboard 获取排行榜
func (s *MemoryStorage) GetLeaderboard(ctx context.Context, limit int) ([]LeaderboardEntry, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	entries := make([]LeaderboardEntry, 0)
	rank := 1
	for playerID, score := range s.scores {
		entries = append(entries, LeaderboardEntry{
			Rank:  rank,
			GeoID: playerID,
			Score: score,
		})
		rank++
		if rank > limit {
			break
		}
	}
	return entries, nil
}

// SetSession 设置会话
func (s *MemoryStorage) SetSession(ctx context.Context, sessionID string, data interface{}, ttl time.Duration) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.sessions[sessionID] = data
	return nil
}

// GetSession 获取会话
func (s *MemoryStorage) GetSession(ctx context.Context, sessionID string, dest interface{}) error {
	s.mu.RLock()
	defer s.mu.RUnlock()
	data, ok := s.sessions[sessionID]
	if !ok {
		return fmt.Errorf("session not found")
	}
	// 将存储的数据反序列化到 dest
	jsonData, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("failed to marshal session data: %w", err)
	}
	if err := json.Unmarshal(jsonData, dest); err != nil {
		return fmt.Errorf("failed to unmarshal session data: %w", err)
	}
	return nil
}

// DeleteSession 删除会话
func (s *MemoryStorage) DeleteSession(ctx context.Context, sessionID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.sessions, sessionID)
	return nil
}

// Lock 加锁
func (s *MemoryStorage) Lock(ctx context.Context, key string, ttl time.Duration) (bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.locks[key] {
		return false, nil
	}
	s.locks[key] = true
	return true, nil
}

// Unlock 解锁
func (s *MemoryStorage) Unlock(ctx context.Context, key string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.locks, key)
	return nil
}

// HealthCheck 健康检查
func (s *MemoryStorage) HealthCheck(ctx context.Context) error {
	return nil
}

// GetPlayerCount 获取在线玩家数
func (s *MemoryStorage) GetPlayerCount() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	count := 0
	for key := range s.data {
		if len(key) > 7 && key[:7] == "player:" {
			count++
		}
	}
	return count
}

// GetActiveRooms 获取活跃房间列表
func (s *MemoryStorage) GetActiveRooms() []string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	rooms := make([]string, 0)
	for key := range s.data {
		if len(key) > 5 && key[:5] == "room:" {
			rooms = append(rooms, key[5:])
		}
	}
	return rooms
}

// GetStats 获取统计信息
func (s *MemoryStorage) GetStats() map[string]interface{} {
	return map[string]interface{}{
		"players_online": s.GetPlayerCount(),
		"rooms_active":   len(s.GetActiveRooms()),
		"timestamp":      time.Now().Unix(),
	}
}

// Serialize 序列化数据
func Serialize(data interface{}) ([]byte, error) {
	return json.Marshal(data)
}

// Deserialize 反序列化数据
func Deserialize(data []byte, dest interface{}) error {
	return json.Unmarshal(data, dest)
}
