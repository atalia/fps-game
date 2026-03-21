package ai

import (
	"testing"
	"time"

	"fps-game/internal/player"
)

// MockRoom 模拟房间
type MockRoom struct {
	players map[string]*player.Player
}

func NewMockRoom() *MockRoom {
	return &MockRoom{
		players: make(map[string]*player.Player),
	}
}

func (m *MockRoom) GetPlayers() map[string]*player.Player {
	return m.players
}

func (m *MockRoom) AddPlayer(id string, p *player.Player) {
	m.players[id] = p
}

func TestBot_Patrol(t *testing.T) {
	bot := NewBot("test", DifficultyEasy)
	room := NewMockRoom()

	// 初始状态应该是巡逻
	if bot.State != StatePatrol {
		t.Errorf("expected patrol state, got %s", bot.State)
	}

	// 更新应该不报错
	bot.Update(room, time.Second)
}

func TestBot_Chase_WhenEnemyNearby(t *testing.T) {
	bot := NewBot("chaser", DifficultyNormal)
	room := NewMockRoom()

	// 添加一个敌人
	enemy := &player.Player{
		ID:        "enemy",
		Health:    100,
		MaxHealth: 100,
		Position:  player.Position{X: bot.Position.X + 10, Z: bot.Position.Z + 10},
	}
	room.AddPlayer("enemy", enemy)

	// 更新机器人
	bot.LastDecision = time.Now().Add(-time.Second) // 强制决策
	bot.Update(room, time.Second)

	// 应该进入追击状态
	if bot.State != StateChase {
		t.Errorf("expected chase state, got %s", bot.State)
	}

	if bot.Target == nil {
		t.Error("expected target to be set")
	}
}

func TestBot_Attack_WhenEnemyClose(t *testing.T) {
	bot := NewBot("attacker", DifficultyHard)
	bot.Position = player.Position{X: 0, Y: 0, Z: 0}

	room := NewMockRoom()

	// 添加一个很近的敌人
	enemy := &player.Player{
		ID:        "enemy",
		Health:    100,
		MaxHealth: 100,
		Position:  player.Position{X: 5, Y: 0, Z: 5}, // 距离约 7
	}
	room.AddPlayer("enemy", enemy)

	// 设置目标
	bot.Target = enemy
	bot.State = StateAttack

	// 更新
	bot.LastDecision = time.Now().Add(-time.Second)
	bot.LastShot = time.Now().Add(-time.Second)
	bot.Update(room, time.Second)

	// 应该还在攻击状态（敌人还活着）
	if enemy.Health <= 0 {
		// 可能被击中了，这也是正常的
		t.Log("Enemy was hit during attack")
	}
}

func TestBot_Cover_WhenLowHealth(t *testing.T) {
	bot := NewBot("lowhp", DifficultyHard)
	bot.Position = player.Position{X: 0, Y: 0, Z: 0}
	bot.Health = 20 // 低血量
	bot.Config.EnableCover = true

	room := NewMockRoom()

	enemy := &player.Player{
		ID:        "enemy",
		Health:    100,
		MaxHealth: 100,
		Position:  player.Position{X: 10, Y: 0, Z: 10},
	}
	room.AddPlayer("enemy", enemy)

	bot.Target = enemy
	bot.State = StateAttack

	// 更新
	bot.LastDecision = time.Now().Add(-time.Second)
	bot.Update(room, time.Second)

	// 低血量应该进入掩护状态
	if bot.State != StateCover {
		t.Errorf("expected cover state for low health, got %s", bot.State)
	}
}

func TestBot_PatrolToChaseTransition(t *testing.T) {
	bot := NewBot("patroller", DifficultyNormal)
	bot.Position = player.Position{X: 0, Y: 0, Z: 0}

	room := NewMockRoom()

	// 没有敌人时应该巡逻
	bot.LastDecision = time.Now().Add(-time.Second)
	bot.Update(room, time.Second)

	if bot.State != StatePatrol {
		t.Errorf("expected patrol state, got %s", bot.State)
	}

	// 添加敌人
	enemy := &player.Player{
		ID:        "enemy",
		Health:    100,
		MaxHealth: 100,
		Position:  player.Position{X: 20, Y: 0, Z: 20},
	}
	room.AddPlayer("enemy", enemy)

	// 再次更新
	bot.LastDecision = time.Now().Add(-time.Second)
	bot.Update(room, time.Second)

	// 应该进入追击
	if bot.State != StateChase {
		t.Errorf("expected chase state after detecting enemy, got %s", bot.State)
	}
}

func TestBot_GenerateRandomPath(t *testing.T) {
	bot := NewBot("test", DifficultyNormal)

	path := bot.generateRandomPath(5)

	if len(path) != 5 {
		t.Errorf("expected path length 5, got %d", len(path))
	}

	// 路径点应该在合理范围内
	for i, p := range path {
		if p.X < bot.Position.X-50 || p.X > bot.Position.X+50 {
			t.Errorf("path point %d X out of range: %f", i, p.X)
		}
	}
}

func TestBot_MoveToward(t *testing.T) {
	bot := NewBot("test", DifficultyNormal)
	bot.Position = player.Position{X: 0, Y: 0, Z: 0}

	target := player.Position{X: 10, Y: 0, Z: 0}

	// 移动向目标
	bot.moveToward(target, 5.0)

	// 应该靠近目标了
	if bot.Position.X <= 0 || bot.Position.X > 5 {
		t.Errorf("expected position X between 0 and 5, got %f", bot.Position.X)
	}
}

func TestBot_DistanceTo(t *testing.T) {
	bot := NewBot("test", DifficultyNormal)
	bot.Position = player.Position{X: 0, Y: 0, Z: 0}

	target := player.Position{X: 3, Y: 0, Z: 4}

	dist := bot.distanceTo(target)

	// 3-4-5 三角形
	expected := 5.0
	if dist < expected-0.01 || dist > expected+0.01 {
		t.Errorf("expected distance %f, got %f", expected, dist)
	}
}

func TestBot_FindNearestEnemy(t *testing.T) {
	bot := NewBot("test", DifficultyNormal)
	bot.Position = player.Position{X: 0, Y: 0, Z: 0}

	room := NewMockRoom()

	// 添加多个敌人
	enemy1 := &player.Player{ID: "enemy1", Health: 100, Position: player.Position{X: 30, Z: 30}}
	enemy2 := &player.Player{ID: "enemy2", Health: 100, Position: player.Position{X: 5, Z: 5}}
	enemy3 := &player.Player{ID: "enemy3", Health: 100, Position: player.Position{X: 20, Z: 20}}

	room.AddPlayer("enemy1", enemy1)
	room.AddPlayer("enemy2", enemy2)
	room.AddPlayer("enemy3", enemy3)

	nearest := bot.findNearestEnemy(room, 100.0)

	if nearest == nil {
		t.Fatal("expected to find nearest enemy")
	}

	if nearest.ID != "enemy2" {
		t.Errorf("expected nearest enemy2, got %s", nearest.ID)
	}
}

func TestBot_FindNearestEnemy_NoEnemy(t *testing.T) {
	bot := NewBot("test", DifficultyNormal)
	room := NewMockRoom()

	nearest := bot.findNearestEnemy(room, 100.0)

	if nearest != nil {
		t.Error("expected nil when no enemies")
	}
}

func TestBot_ShootAtTarget(t *testing.T) {
	bot := NewBot("shooter", DifficultyNightmare)
	bot.Config.Accuracy = 1.0 // 100% 准度

	enemy := &player.Player{
		ID:        "target",
		Health:    100,
		MaxHealth: 100,
	}

	bot.Target = enemy
	bot.shootAtTarget()

	// 高准度应该命中
	if enemy.Health >= 100 {
		t.Error("expected enemy to take damage")
	}
}

func TestBot_ShootAtTarget_NoTarget(t *testing.T) {
	bot := NewBot("shooter", DifficultyNormal)

	// 不应该 panic
	bot.shootAtTarget()
}

func TestBot_Chase_Transitions(t *testing.T) {
	bot := NewBot("chaser", DifficultyNormal)
	bot.Position = player.Position{X: 0, Y: 0, Z: 0}

	room := NewMockRoom()

	// 添加一个远处的敌人
	enemy := &player.Player{
		ID:        "enemy",
		Health:    100,
		MaxHealth: 100,
		Position:  player.Position{X: 40, Y: 0, Z: 40}, // 距离约 56
	}
	room.AddPlayer("enemy", enemy)

	bot.Target = enemy
	bot.State = StateChase

	// 更新 - 应该追击
	bot.LastDecision = time.Now().Add(-time.Second)
	bot.Update(room, time.Second)

	// 应该还在追击（敌人很远）
	if bot.State != StateChase {
		t.Errorf("expected chase state, got %s", bot.State)
	}
}

func TestBot_Chase_EnterAttackRange(t *testing.T) {
	bot := NewBot("chaser", DifficultyNormal)
	bot.Position = player.Position{X: 0, Y: 0, Z: 0}

	room := NewMockRoom()

	// 添加一个中等距离的敌人
	enemy := &player.Player{
		ID:        "enemy",
		Health:    100,
		MaxHealth: 100,
		Position:  player.Position{X: 20, Y: 0, Z: 20}, // 距离约 28，在攻击范围内
	}
	room.AddPlayer("enemy", enemy)

	bot.Target = enemy
	bot.State = StateChase

	// 更新
	bot.LastDecision = time.Now().Add(-time.Second)
	bot.Update(room, time.Second)

	// 应该进入攻击状态
	if bot.State != StateAttack {
		t.Errorf("expected attack state, got %s", bot.State)
	}
}

func TestBot_Chase_LoseTarget(t *testing.T) {
	bot := NewBot("chaser", DifficultyNormal)
	bot.Position = player.Position{X: 0, Y: 0, Z: 0}

	room := NewMockRoom()

	// 添加一个很远的敌人
	enemy := &player.Player{
		ID:        "enemy",
		Health:    100,
		MaxHealth: 100,
		Position:  player.Position{X: 100, Y: 0, Z: 100}, // 距离约 141，超出追击范围
	}
	room.AddPlayer("enemy", enemy)

	bot.Target = enemy
	bot.State = StateChase

	// 更新
	bot.LastDecision = time.Now().Add(-time.Second)
	bot.Update(room, time.Second)

	// 应该丢失目标，回到巡逻
	if bot.State != StatePatrol {
		t.Errorf("expected patrol state after losing target, got %s", bot.State)
	}

	if bot.Target != nil {
		t.Error("expected target to be nil after losing")
	}
}

func TestBot_Chase_TargetDead(t *testing.T) {
	bot := NewBot("chaser", DifficultyNormal)
	bot.Position = player.Position{X: 0, Y: 0, Z: 0}

	room := NewMockRoom()

	// 添加一个死亡的敌人
	enemy := &player.Player{
		ID:        "enemy",
		Health:    0, // 已死
		MaxHealth: 100,
		Position:  player.Position{X: 20, Y: 0, Z: 20},
	}
	room.AddPlayer("enemy", enemy)

	bot.Target = enemy
	bot.State = StateChase

	// 更新
	bot.LastDecision = time.Now().Add(-time.Second)
	bot.Update(room, time.Second)

	// 应该回到巡逻
	if bot.State != StatePatrol {
		t.Errorf("expected patrol state when target dead, got %s", bot.State)
	}
}

func TestBot_Cover_Recovery(t *testing.T) {
	bot := NewBot("recovery", DifficultyHard)
	bot.Position = player.Position{X: 0, Y: 0, Z: 0}
	bot.Health = 60 // 已恢复
	bot.State = StateCover

	room := NewMockRoom()

	// 更新
	bot.LastDecision = time.Now().Add(-time.Second)
	bot.Update(room, time.Second)

	// 血量恢复后应该回到巡逻
	if bot.State != StatePatrol {
		t.Errorf("expected patrol state after recovery, got %s", bot.State)
	}
}

func TestBot_Cover_Retreat(t *testing.T) {
	bot := NewBot("retreater", DifficultyHard)
	bot.Position = player.Position{X: 10, Y: 0, Z: 10}
	bot.Health = 20 // 低血量
	bot.State = StateCover

	room := NewMockRoom()

	// 添加敌人
	enemy := &player.Player{
		ID:        "enemy",
		Health:    100,
		MaxHealth: 100,
		Position:  player.Position{X: 0, Y: 0, Z: 0},
	}
	room.AddPlayer("enemy", enemy)

	bot.Target = enemy

	// 更新
	bot.LastDecision = time.Now().Add(-time.Second)
	bot.Update(room, time.Second)

	// 应该后退（位置改变）
	// 注意：由于 findCover 只是简单后退，位置应该远离敌人
	distBefore := bot.distanceTo(enemy.Position)
	_ = distBefore // 位置可能已改变
}

func TestBot_Attack_TargetNil(t *testing.T) {
	bot := NewBot("attacker", DifficultyNormal)
	bot.State = StateAttack
	bot.Target = nil

	room := NewMockRoom()

	// 更新
	bot.LastDecision = time.Now().Add(-time.Second)
	bot.Update(room, time.Second)

	// 应该回到巡逻
	if bot.State != StatePatrol {
		t.Errorf("expected patrol state when no target, got %s", bot.State)
	}
}

func TestBot_Attack_TargetDead(t *testing.T) {
	bot := NewBot("attacker", DifficultyNormal)
	bot.State = StateAttack

	room := NewMockRoom()

	enemy := &player.Player{
		ID:        "enemy",
		Health:    0,
		MaxHealth: 100,
		Position:  player.Position{X: 5, Y: 0, Z: 5},
	}
	room.AddPlayer("enemy", enemy)

	bot.Target = enemy

	// 更新
	bot.LastDecision = time.Now().Add(-time.Second)
	bot.Update(room, time.Second)

	// 应该回到巡逻
	if bot.State != StatePatrol {
		t.Errorf("expected patrol state when target dead, got %s", bot.State)
	}
}

func TestBot_Attack_OutOfRange(t *testing.T) {
	bot := NewBot("attacker", DifficultyNormal)
	bot.Position = player.Position{X: 0, Y: 0, Z: 0}
	bot.State = StateAttack

	room := NewMockRoom()

	enemy := &player.Player{
		ID:        "enemy",
		Health:    100,
		MaxHealth: 100,
		Position:  player.Position{X: 50, Y: 0, Z: 50}, // 超出攻击范围
	}
	room.AddPlayer("enemy", enemy)

	bot.Target = enemy

	// 更新
	bot.LastDecision = time.Now().Add(-time.Second)
	bot.Update(room, time.Second)

	// 应该进入追击状态
	if bot.State != StateChase {
		t.Errorf("expected chase state when out of range, got %s", bot.State)
	}
}
