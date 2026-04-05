package ai

import (
	"math"
	"math/rand"
	"time"

	"fps-game/internal/player"
)

// Room 房间接口 (避免循环依赖)
type Room interface {
	GetPlayers() map[string]*player.Player
	GetBots() []*Bot
}

// Update 更新 AI 状态
func (b *Bot) Update(room Room, delta time.Duration) {
	// 检查决策间隔
	if time.Since(b.LastDecision) < b.Config.DecisionRate {
		return
	}
	b.LastDecision = time.Now()

	// 状态机处理
	switch b.State {
	case StatePatrol:
		b.patrol(room)
	case StateChase:
		b.chase(room)
	case StateAttack:
		b.attack(room)
	case StateCover:
		b.findCover(room)
	}
}

// patrol 巡逻行为
func (b *Bot) patrol(room Room) {
	// 随机移动
	if len(b.Path) == 0 {
		b.Path = b.generateRandomPath(3)
	}

	// 沿路径移动
	if len(b.Path) > 0 {
		b.moveToward(b.Path[0], 2.0)
		if b.reachedPosition(b.Path[0], 1.0) {
			b.Path = b.Path[1:]
		}
	}

	// 检测敌人
	if enemy := b.findNearestEnemy(room, 50.0); enemy != nil {
		b.Target = enemy
		b.State = StateChase
	}
}

// chase 追击行为
func (b *Bot) chase(room Room) {
	if b.Target == nil || !b.Target.IsAlive() {
		b.Target = nil
		b.State = StatePatrol
		return
	}

	distance := b.distanceTo(b.Target.Position)

	// 进入攻击范围
	if distance <= 30.0 {
		b.State = StateAttack
		return
	}

	// 追击
	b.moveToward(b.Target.Position, 3.0)

	// 失去目标
	if distance > 60.0 {
		b.Target = nil
		b.State = StatePatrol
	}
}

// attack 攻击行为
func (b *Bot) attack(room Room) {
	if b.Target == nil || !b.Target.IsAlive() {
		b.Target = nil
		b.State = StatePatrol
		return
	}

	distance := b.distanceTo(b.Target.Position)

	// 超出攻击范围
	if distance > 30.0 {
		b.State = StateChase
		return
	}

	// 血量低时寻找掩护
	if b.Player.Health < 30 && b.Config.EnableCover {
		b.State = StateCover
		return
	}

	// 瞄准并射击
	if time.Since(b.LastShot) >= b.Config.ReactionTime {
		b.shootAtTarget()
		b.LastShot = time.Now()
	}
}

// findCover 寻找掩护
func (b *Bot) findCover(room Room) {
	// 血量恢复后返回巡逻
	if b.Player.Health > 50 {
		b.State = StatePatrol
		return
	}

	// 简单后退
	if b.Target != nil {
		dir := player.Position{
			X: b.Position.X - b.Target.Position.X,
			Z: b.Position.Z - b.Target.Position.Z,
		}
		length := math.Sqrt(dir.X*dir.X + dir.Z*dir.Z)
		if length > 0 {
			dir.X /= length
			dir.Z /= length
		}

		b.Position.X += dir.X * 2
		b.Position.Z += dir.Z * 2
	}
}

// 辅助方法

func (b *Bot) moveToward(target player.Position, speed float64) {
	dx := target.X - b.Position.X
	dz := target.Z - b.Position.Z
	length := math.Sqrt(dx*dx + dz*dz)

	if length > 0 {
		b.Position.X += dx / length * speed
		b.Position.Z += dz / length * speed
	}
}

func (b *Bot) reachedPosition(target player.Position, threshold float64) bool {
	return b.distanceTo(target) < threshold
}

func (b *Bot) distanceTo(target player.Position) float64 {
	dx := b.Position.X - target.X
	dz := b.Position.Z - target.Z
	return math.Sqrt(dx*dx + dz*dz)
}

func (b *Bot) findNearestEnemy(room Room, maxDistance float64) *player.Player {
	var nearest *player.Player
	minDist := maxDistance

	consider := func(id string, candidate *player.Player) {
		if candidate == nil || id == b.ID || !candidate.IsAlive() {
			return
		}
		if b.Team != "" && candidate.GetTeam() != "" && candidate.GetTeam() == b.Team {
			return
		}

		dist := b.distanceTo(candidate.Position)
		if dist < minDist {
			minDist = dist
			nearest = candidate
		}
	}

	for id, p := range room.GetPlayers() {
		consider(id, p)
	}

	for _, bot := range room.GetBots() {
		if bot == nil || bot.Player == nil {
			continue
		}
		consider(bot.Player.ID, bot.Player)
	}

	return nearest
}

func (b *Bot) generateRandomPath(points int) []player.Position {
	path := make([]player.Position, points)
	for i := 0; i < points; i++ {
		path[i] = player.Position{
			X: b.Position.X + rand.Float64()*20 - 10,
			Z: b.Position.Z + rand.Float64()*20 - 10,
		}
	}
	return path
}

func (b *Bot) shootAtTarget() {
	if b.Target == nil {
		return
	}

	// 模拟射击 (实际命中由准度决定)
	if rand.Float64() < b.Config.Accuracy {
		// 计算伤害
		damage := 20 + rand.Intn(10)
		// 使用局部变量调用，避免 Target 被其他 goroutine 修改导致 nil 指针
		target := b.Target
		if target != nil {
			target.TakeDamage(damage)
		}
	}
}
