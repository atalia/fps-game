package room

import (
	"time"
)

// GameState 游戏状态
type GameState int

const (
	StateWaiting GameState = iota
	StatePlaying
	StateEnding
)

// RoomWithState 带状态的房间
type RoomWithState struct {
	*Room
	state        GameState
	matchTime    time.Duration
	maxMatchTime time.Duration
	scoreTeam1   int
	scoreTeam2   int
}

// NewRoomWithState 创建带状态的房间
func NewRoomWithState(maxSize int) *RoomWithState {
	return &RoomWithState{
		Room:         NewRoom(maxSize),
		state:        StateWaiting,
		maxMatchTime: 5 * time.Minute,
	}
}

// StartGame 开始游戏
func (r *RoomWithState) StartGame() bool {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.state != StateWaiting {
		return false
	}

	if len(r.Players) < 2 {
		return false
	}

	r.state = StatePlaying
	r.StartedAt = time.Now()
	return true
}

// EndGame 结束游戏
func (r *RoomWithState) EndGame() {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.state = StateEnding
}

// Update 更新房间状态
func (r *RoomWithState) Update(dt time.Duration) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.state == StatePlaying {
		r.matchTime += dt

		// 检查游戏是否结束
		if r.matchTime >= r.maxMatchTime {
			r.state = StateEnding
		}
	}
}

// GetState 获取游戏状态
func (r *RoomWithState) GetState() GameState {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.state
}

// GetMatchTime 获取比赛时间
func (r *RoomWithState) GetMatchTime() time.Duration {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.matchTime
}

// AddScoreTeam1 队伍1加分
func (r *RoomWithState) AddScoreTeam1(score int) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.scoreTeam1 += score
}

// AddScoreTeam2 队伍2加分
func (r *RoomWithState) AddScoreTeam2(score int) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.scoreTeam2 += score
}

// GetScores 获取比分
func (r *RoomWithState) GetScores() (int, int) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.scoreTeam1, r.scoreTeam2
}

// ToMap 转换为 map
func (r *RoomWithState) ToMap() map[string]interface{} {
	r.mu.RLock()
	defer r.mu.RUnlock()

	return map[string]interface{}{
		"id":           r.ID,
		"name":         r.Name,
		"player_count": len(r.Players),
		"max_size":     r.MaxSize,
		"state":        int(r.state),
		"match_time":   r.matchTime.Seconds(),
		"score_team1":  r.scoreTeam1,
		"score_team2":  r.scoreTeam2,
	}
}
