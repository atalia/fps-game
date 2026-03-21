// Match Manager - 匹配系统
package match

import (
	"container/heap"
	"sync"
	"time"
)

// PlayerInfo 玩家匹配信息
type PlayerInfo struct {
	ID          string
	Rating      int       // 玩家评分（MMR）
	JoinedAt    time.Time // 加入时间
	Region      string    // 地区
	Preferences MatchPreferences
}

// MatchPreferences 匹配偏好
type MatchPreferences struct {
	GameMode string   // 游戏模式
	MaxPing  int      // 最大延迟 ms
	TeamSize int      // 队伍大小
	Excluded []string // 排除的玩家
}

// Match 匹配结果
type Match struct {
	ID        string
	Players   []string
	Team1     []string
	Team2     []string
	CreatedAt time.Time
	Region    string
	GameMode  string
}

// PriorityQueue 优先队列（按等待时间）
type PriorityQueue []*PlayerInfo

func (pq PriorityQueue) Len() int { return len(pq) }

func (pq PriorityQueue) Less(i, j int) bool {
	// 等待时间长的优先
	return pq[i].JoinedAt.Before(pq[j].JoinedAt)
}

func (pq PriorityQueue) Swap(i, j int) {
	pq[i], pq[j] = pq[j], pq[i]
}

func (pq *PriorityQueue) Push(x interface{}) {
	item := x.(*PlayerInfo)
	*pq = append(*pq, item)
}

func (pq *PriorityQueue) Pop() interface{} {
	old := *pq
	n := len(old)
	item := old[n-1]
	*pq = old[0 : n-1]
	return item
}

// Matcher 匹配器
type Matcher struct {
	queue      PriorityQueue
	matches    map[string]*Match
	teamSize   int
	maxWait    time.Duration
	mu         sync.Mutex
}

// NewMatcher 创建匹配器
func NewMatcher(teamSize int, maxWait time.Duration) *Matcher {
	return &Matcher{
		queue:    make(PriorityQueue, 0),
		matches:  make(map[string]*Match),
		teamSize: teamSize,
		maxWait:  maxWait,
	}
}

// Join 加入匹配队列
func (m *Matcher) Join(player *PlayerInfo) {
	m.mu.Lock()
	defer m.mu.Unlock()

	player.JoinedAt = time.Now()
	heap.Push(&m.queue, player)
}

// Leave 离开匹配队列
func (m *Matcher) Leave(playerID string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	// 从队列中移除
	for i, p := range m.queue {
		if p.ID == playerID {
			m.queue = append(m.queue[:i], m.queue[i+1:]...)
			break
		}
	}
}

// TryMatch 尝试匹配
func (m *Matcher) TryMatch() *Match {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.queue.Len() < m.teamSize*2 {
		return nil
	}

	// 取出玩家
	players := make([]*PlayerInfo, 0, m.teamSize*2)
	for i := 0; i < m.teamSize*2 && m.queue.Len() > 0; i++ {
		players = append(players, heap.Pop(&m.queue).(*PlayerInfo))
	}

	if len(players) < m.teamSize*2 {
		// 人数不够，放回队列
		for _, p := range players {
			heap.Push(&m.queue, p)
		}
		return nil
	}

	// 创建匹配
	match := &Match{
		ID:        generateMatchID(),
		Players:   make([]string, 0, m.teamSize*2),
		Team1:     make([]string, 0, m.teamSize),
		Team2:     make([]string, 0, m.teamSize),
		CreatedAt: time.Now(),
		Region:    players[0].Region,
		GameMode:  players[0].Preferences.GameMode,
	}

	// 分配队伍（按评分平衡）
	for i, p := range players {
		match.Players = append(match.Players, p.ID)
		if i < m.teamSize {
			match.Team1 = append(match.Team1, p.ID)
		} else {
			match.Team2 = append(match.Team2, p.ID)
		}
	}

	m.matches[match.ID] = match
	return match
}

// GetQueueLength 获取队列长度
func (m *Matcher) GetQueueLength() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.queue.Len()
}

// GetWaitTime 获取玩家等待时间
func (m *Matcher) GetWaitTime(playerID string) time.Duration {
	m.mu.Lock()
	defer m.mu.Unlock()

	for _, p := range m.queue {
		if p.ID == playerID {
			return time.Since(p.JoinedAt)
		}
	}
	return 0
}

// RemoveMatch 移除匹配
func (m *Matcher) RemoveMatch(matchID string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.matches, matchID)
}

// AutoMatch 自动匹配循环
func (m *Matcher) AutoMatch(interval time.Duration, callback func(*Match)) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for range ticker.C {
		if match := m.TryMatch(); match != nil {
			callback(match)
		}
	}
}

func generateMatchID() string {
	return time.Now().Format("20060102150405") + randomString(4)
}

func randomString(n int) string {
	const letters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, n)
	for i := range b {
		b[i] = letters[time.Now().Nanosecond()%len(letters)]
	}
	return string(b)
}
