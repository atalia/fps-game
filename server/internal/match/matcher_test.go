package match

import (
	"container/heap"
	"testing"
	"time"
)

func TestNewMatcher(t *testing.T) {
	m := NewMatcher(5, 30*time.Second)

	if m.teamSize != 5 {
		t.Errorf("teamSize = %d, want 5", m.teamSize)
	}
	if m.maxWait != 30*time.Second {
		t.Errorf("maxWait = %v, want 30s", m.maxWait)
	}
}

func TestMatcher_Join(t *testing.T) {
	m := NewMatcher(5, 30*time.Second)

	p := &PlayerInfo{
		ID:     "player1",
		Rating: 1000,
		Region: "cn",
	}

	m.Join(p)

	if m.GetQueueLength() != 1 {
		t.Errorf("Queue length = %d, want 1", m.GetQueueLength())
	}
}

func TestMatcher_Leave(t *testing.T) {
	m := NewMatcher(5, 30*time.Second)

	p := &PlayerInfo{ID: "player1"}
	m.Join(p)
	m.Leave("player1")

	if m.GetQueueLength() != 0 {
		t.Errorf("Queue length = %d, want 0", m.GetQueueLength())
	}
}

func TestMatcher_TryMatch_NotEnough(t *testing.T) {
	m := NewMatcher(5, 30*time.Second)

	// 只加入 5 个玩家，不够 10 个
	for i := 0; i < 5; i++ {
		m.Join(&PlayerInfo{ID: string(rune('A' + i))})
	}

	match := m.TryMatch()
	if match != nil {
		t.Error("Should not match with insufficient players")
	}
}

func TestMatcher_TryMatch_Success(t *testing.T) {
	m := NewMatcher(5, 30*time.Second)

	// 加入 10 个玩家
	for i := 0; i < 10; i++ {
		m.Join(&PlayerInfo{
			ID:     string(rune('A' + i)),
			Rating: 1000 + i*10,
			Region: "cn",
			Preferences: MatchPreferences{
				GameMode: "team_deathmatch",
				TeamSize: 5,
			},
		})
	}

	match := m.TryMatch()
	if match == nil {
		t.Error("Should match with enough players")
		return
	}

	if len(match.Players) != 10 {
		t.Errorf("Match players = %d, want 10", len(match.Players))
	}
	if len(match.Team1) != 5 {
		t.Errorf("Team1 size = %d, want 5", len(match.Team1))
	}
	if len(match.Team2) != 5 {
		t.Errorf("Team2 size = %d, want 5", len(match.Team2))
	}
}

func TestMatcher_GetWaitTime(t *testing.T) {
	m := NewMatcher(5, 30*time.Second)

	p := &PlayerInfo{ID: "player1"}
	m.Join(p)

	time.Sleep(100 * time.Millisecond)

	waitTime := m.GetWaitTime("player1")
	if waitTime < 100*time.Millisecond {
		t.Errorf("Wait time = %v, should be at least 100ms", waitTime)
	}

	// 不存在的玩家
	waitTime = m.GetWaitTime("nonexistent")
	if waitTime != 0 {
		t.Errorf("Wait time for nonexistent = %v, want 0", waitTime)
	}
}

func TestMatcher_RemoveMatch(t *testing.T) {
	m := NewMatcher(5, 30*time.Second)

	// 创建匹配
	for i := 0; i < 10; i++ {
		m.Join(&PlayerInfo{ID: string(rune('A' + i))})
	}
	match := m.TryMatch()

	if match == nil {
		t.Fatal("Match should not be nil")
	}

	// 移除匹配
	m.RemoveMatch(match.ID)

	if _, exists := m.matches[match.ID]; exists {
		t.Error("Match should be removed")
	}
}

func TestMatcher_Priority(t *testing.T) {
	m := NewMatcher(2, 30*time.Second)

	// 按顺序加入
	p1 := &PlayerInfo{ID: "first"}
	p2 := &PlayerInfo{ID: "second"}
	p3 := &PlayerInfo{ID: "third"}
	p4 := &PlayerInfo{ID: "fourth"}

	m.Join(p1)
	time.Sleep(10 * time.Millisecond)
	m.Join(p2)
	time.Sleep(10 * time.Millisecond)
	m.Join(p3)
	time.Sleep(10 * time.Millisecond)
	m.Join(p4)

	// 应该优先匹配先加入的玩家
	match := m.TryMatch()
	if match == nil {
		t.Fatal("Match should not be nil")
	}

	// 第一个匹配应该包含 first 和 second
	found := false
	for _, id := range match.Players {
		if id == "first" {
			found = true
			break
		}
	}
	if !found {
		t.Error("First player should be matched")
	}
}

func TestPriorityQueue(t *testing.T) {
	pq := make(PriorityQueue, 0)

	p1 := &PlayerInfo{ID: "p1", JoinedAt: time.Now()}
	time.Sleep(1 * time.Millisecond)
	p2 := &PlayerInfo{ID: "p2", JoinedAt: time.Now()}
	time.Sleep(1 * time.Millisecond)
	p3 := &PlayerInfo{ID: "p3", JoinedAt: time.Now()}

	heap.Push(&pq, p3)
	heap.Push(&pq, p1)
	heap.Push(&pq, p2)

	if pq.Len() != 3 {
		t.Errorf("Queue length = %d, want 3", pq.Len())
	}

	// 应该按时间顺序弹出
	first := heap.Pop(&pq).(*PlayerInfo)
	if first.ID != "p1" {
		t.Errorf("First popped = %s, want p1", first.ID)
	}
}
