package game

import (
	"math"
	"sync"
	"time"

	"fps-game/internal/room"
)

// Engine 游戏引擎
type Engine struct {
	rooms    map[string]*room.Room
	mu       sync.RWMutex
	tickRate int
	ticker   *time.Ticker
	stopCh   chan struct{}
}

// NewEngine 创建游戏引擎
func NewEngine(tickRate int) *Engine {
	return &Engine{
		rooms:    make(map[string]*room.Room),
		tickRate: tickRate,
		stopCh:   make(chan struct{}),
	}
}

// Start 启动游戏引擎
func (e *Engine) Start() {
	e.ticker = time.NewTicker(time.Second / time.Duration(e.tickRate))
	go e.gameLoop()
}

// Stop 停止游戏引擎
func (e *Engine) Stop() {
	close(e.stopCh)
	if e.ticker != nil {
		e.ticker.Stop()
	}
}

// gameLoop 游戏主循环
func (e *Engine) gameLoop() {
	for {
		select {
		case <-e.ticker.C:
			e.tick()
		case <-e.stopCh:
			return
		}
	}
}

// tick 游戏帧
func (e *Engine) tick() {
	e.mu.RLock()
	defer e.mu.RUnlock()

	for _, r := range e.rooms {
		if r.IsActive() {
			r.Update()
		}
	}
}

// AddRoom 添加房间
func (e *Engine) AddRoom(r *room.Room) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.rooms[r.ID] = r
}

// RemoveRoom 移除房间
func (e *Engine) RemoveRoom(id string) {
	e.mu.Lock()
	defer e.mu.Unlock()
	delete(e.rooms, id)
}

// GetRoom 获取房间
func (e *Engine) GetRoom(id string) *room.Room {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return e.rooms[id]
}

// GetActiveRoomCount 获取活跃房间数
func (e *Engine) GetActiveRoomCount() int {
	e.mu.RLock()
	defer e.mu.RUnlock()
	count := 0
	for _, r := range e.rooms {
		if r.IsActive() {
			count++
		}
	}
	return count
}

// Collision 碰撞检测
type Collision struct {
	MapSize float64
}

// NewCollision 创建碰撞检测器
func NewCollision(mapSize float64) *Collision {
	return &Collision{MapSize: mapSize}
}

// CheckBoundary 边界检测
func (c *Collision) CheckBoundary(x, z float64) (float64, float64) {
	half := c.MapSize / 2
	if x < -half {
		x = -half
	} else if x > half {
		x = half
	}
	if z < -half {
		z = -half
	} else if z > half {
		z = half
	}
	return x, z
}

// CheckHit 命中检测 (射线检测)
func (c *Collision) CheckHit(shooterPos, targetPos [3]float64, shooterRot float64, maxDistance float64) bool {
	// 射线方向
	dirX := math.Sin(shooterRot)
	dirZ := math.Cos(shooterRot)

	// 目标相对位置
	dx := targetPos[0] - shooterPos[0]
	dz := targetPos[2] - shooterPos[2]

	// 距离
	distance := math.Sqrt(dx*dx + dz*dz)
	if distance > maxDistance {
		return false
	}

	// 射线方向与目标方向的夹角
	dot := (dx*dirX + dz*dirZ) / distance
	angle := math.Acos(dot)

	// 如果夹角小于某个阈值，认为命中
	// 这里简化处理，实际应该考虑玩家碰撞体大小
	return angle < 0.2 // 约 11.5 度
}

// Physics 物理系统
type Physics struct {
	Gravity float64
}

// NewPhysics 创建物理系统
func NewPhysics() *Physics {
	return &Physics{
		Gravity: 20.0, // m/s²
	}
}

// ApplyGravity 应用重力
func (p *Physics) ApplyGravity(velocity *float64, dt float64) {
	*velocity -= p.Gravity * dt
}

// IsOnGround 检测是否在地面
func (p *Physics) IsOnGround(y float64) bool {
	return y <= 0
}
