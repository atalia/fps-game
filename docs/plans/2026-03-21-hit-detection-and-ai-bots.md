# 命中判定系统与 AI 机器人实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 FPS 游戏添加精确命中判定系统和可配置难度的 AI 机器人

**Architecture:** 命中判定采用服务端射线检测 + 命中盒系统；AI 机器人使用状态机行为控制 + 难度配置。两个系统独立但共享玩家和房间管理基础设施。

**Tech Stack:** Go 1.22, gorilla/websocket, Three.js

---

## 文件结构

### 新增文件

```
server/internal/hitbox/
├── hitbox.go           # 命中盒定义和常量
├── detector.go         # 射线检测算法
└── detector_test.go    # 单元测试

server/internal/ai/
├── bot.go              # 机器人核心结构
├── config.go           # 难度配置
├── behavior.go         # 行为状态机
├── manager.go          # 机器人管理器
└── bot_test.go         # 单元测试

client/js/
├── hit-effects.js      # 命中反馈效果
└── ai-labels.js        # AI 名称标签渲染
```

### 修改文件

```
server/internal/player/player.go        # 添加 HitBoxes 字段
server/internal/network/server.go       # 添加命中检测和 AI 消息处理
server/internal/room/room.go            # 添加 Bots 字段和方法
client/js/main.js                       # 添加消息处理器
client/js/game.js                       # 添加伤害处理
client/js/renderer.js                   # 添加 AI 标签渲染
```

---

## Chunk 1: 命中判定系统

### Task 1: 命中盒数据结构

**Files:**
- Create: `server/internal/hitbox/hitbox.go`

- [ ] **Step 1: 创建命中盒模块**

```go
// server/internal/hitbox/hitbox.go
package hitbox

import "fps-game/server/internal/player"

// HitBoxType 命中盒类型
type HitBoxType string

const (
    HitBoxHead HitBoxType = "head"
    HitBoxBody HitBoxType = "body"
    HitBoxArm  HitBoxType = "arm"
    HitBoxLeg  HitBoxType = "leg"
)

// HitBox 命中盒定义
type HitBox struct {
    Type   HitBoxType
    Offset player.Position // 相对于玩家中心
    Radius float64         // 碰撞球半径
}

// DefaultHitBoxes 默认命中盒配置
var DefaultHitBoxes = []HitBox{
    {Type: HitBoxHead, Offset: player.Position{Y: 1.6}, Radius: 0.25},
    {Type: HitBoxBody, Offset: player.Position{Y: 1.0}, Radius: 0.4},
    {Type: HitBoxArm, Offset: player.Position{X: 0.3, Y: 1.0}, Radius: 0.15},
    {Type: HitBoxArm, Offset: player.Position{X: -0.3, Y: 1.0}, Radius: 0.15},
    {Type: HitBoxLeg, Offset: player.Position{X: 0.15, Y: 0.3}, Radius: 0.15},
    {Type: HitBoxLeg, Offset: player.Position{X: -0.15, Y: 0.3}, Radius: 0.15},
}

// DamageMultipliers 伤害倍率
var DamageMultipliers = map[HitBoxType]float64{
    HitBoxHead: 2.5,
    HitBoxBody: 1.0,
    HitBoxArm:  0.8,
    HitBoxLeg:  0.7,
}
```

- [ ] **Step 2: 验证编译**

Run: `cd /home/node/projects/fps-game/server && go build ./internal/hitbox/`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add server/internal/hitbox/hitbox.go
git commit -m "feat(hitbox): 添加命中盒数据结构"
```

---

### Task 2: 射线检测算法

**Files:**
- Create: `server/internal/hitbox/detector.go`
- Create: `server/internal/hitbox/detector_test.go`

- [ ] **Step 1: 编写射线检测测试**

```go
// server/internal/hitbox/detector_test.go
package hitbox

import (
    "math"
    "testing"

    "fps-game/server/internal/player"
)

func TestRaySphereIntersect_Hit(t *testing.T) {
    // 射线从原点沿 X 轴射向 (5, 0, 0) 的球体
    origin := player.Position{X: 0, Y: 0, Z: 0}
    direction := player.Position{X: 1, Y: 0, Z: 0}
    center := player.Position{X: 5, Y: 0, Z: 0}
    radius := 1.0

    if !RaySphereIntersect(origin, direction, center, radius) {
        t.Error("expected ray to intersect sphere")
    }
}

func TestRaySphereIntersect_Miss(t *testing.T) {
    // 射线从原点沿 X 轴，球体在 Y=5 处
    origin := player.Position{X: 0, Y: 0, Z: 0}
    direction := player.Position{X: 1, Y: 0, Z: 0}
    center := player.Position{X: 5, Y: 5, Z: 0}
    radius := 1.0

    if RaySphereIntersect(origin, direction, center, radius) {
        t.Error("expected ray to miss sphere")
    }
}

func TestCalculateDamage_Headshot(t *testing.T) {
    baseDamage := 40
    distance := 10.0
    weaponRange := 50.0

    damage := CalculateDamage(baseDamage, HitBoxHead, distance, weaponRange)

    expected := int(float64(baseDamage) * DamageMultipliers[HitBoxHead])
    if damage != expected {
        t.Errorf("expected %d, got %d", expected, damage)
    }
}

func TestCalculateDamage_DistanceFalloff(t *testing.T) {
    baseDamage := 40
    distance := 75.0  // 超出射程
    weaponRange := 50.0

    damage := CalculateDamage(baseDamage, HitBoxBody, distance, weaponRange)

    // 应该有衰减
    if damage >= baseDamage {
        t.Error("expected damage to be reduced due to distance falloff")
    }
}

func TestCalculateDamage_MinimumDamage(t *testing.T) {
    baseDamage := 40
    distance := 200.0  // 远超射程
    weaponRange := 50.0

    damage := CalculateDamage(baseDamage, HitBoxBody, distance, weaponRange)

    // 最小伤害应该是基础伤害的 30%
    minDamage := int(float64(baseDamage) * 0.3)
    if damage < minDamage {
        t.Errorf("expected minimum damage %d, got %d", minDamage, damage)
    }
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /home/node/projects/fps-game/server && go test ./internal/hitbox/ -v -run "TestRay|TestCalculate"`
Expected: FAIL - 函数未定义

- [ ] **Step 3: 实现射线检测**

```go
// server/internal/hitbox/detector.go
package hitbox

import (
    "math"

    "fps-game/server/internal/player"
)

// RaySphereIntersect 检测射线是否与球体相交
func RaySphereIntersect(origin, direction, center player.Position, radius float64) bool {
    // 射线方程: P = origin + t * direction
    // 球体方程: |P - center| = radius
    // 联立得: |origin + t*direction - center|^2 = radius^2
    // 展开为二次方程: a*t^2 + b*t + c = 0

    oc := player.Position{
        X: origin.X - center.X,
        Y: origin.Y - center.Y,
        Z: origin.Z - center.Z,
    }

    a := direction.X*direction.X + direction.Y*direction.Y + direction.Z*direction.Z
    b := 2 * (oc.X*direction.X + oc.Y*direction.Y + oc.Z*direction.Z)
    c := oc.X*oc.X + oc.Y*oc.Y + oc.Z*oc.Z - radius*radius

    discriminant := b*b - 4*a*c
    return discriminant >= 0
}

// CalculateDamage 计算最终伤害
func CalculateDamage(baseDamage int, hitBoxType HitBoxType, distance, weaponRange float64) int {
    // 1. 基础伤害
    damage := float64(baseDamage)

    // 2. 命中部位倍率
    if multiplier, ok := DamageMultipliers[hitBoxType]; ok {
        damage *= multiplier
    }

    // 3. 距离衰减 (超过射程后衰减到最小 30%)
    if distance > weaponRange {
        falloff := 1.0 - (distance-weaponRange)/weaponRange
        falloff = math.Max(0.3, falloff)
        damage *= falloff
    }

    return int(damage)
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd /home/node/projects/fps-game/server && go test ./internal/hitbox/ -v -run "TestRay|TestCalculate"`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add server/internal/hitbox/
git commit -m "feat(hitbox): 实现射线检测和伤害计算"
```

---

### Task 3: 玩家命中盒集成

**Files:**
- Modify: `server/internal/player/player.go`

- [ ] **Step 1: 添加命中盒字段**

在 `player.go` 的 `Player` 结构体中添加:

```go
// 在 Player 结构体中添加
HitBoxes []hitbox.HitBox `json:"hit_boxes"`
```

在 `NewPlayer` 函数中初始化:

```go
// 在 NewPlayer 函数中添加
HitBoxes: hitbox.DefaultHitBoxes,
```

- [ ] **Step 2: 验证编译**

Run: `cd /home/node/projects/fps-game/server && go build ./...`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add server/internal/player/player.go
git commit -m "feat(player): 添加命中盒数据"
```

---

### Task 4: 命中检测服务端处理

**Files:**
- Modify: `server/internal/network/server.go`

- [ ] **Step 1: 添加命中检测函数**

```go
// server/internal/network/server.go

// 在 handleShoot 函数后添加

// HitResult 命中结果
type HitResult struct {
    PlayerID   string
    HitBoxType hitbox.HitBoxType
    Distance   float64
}

// detectHit 检测射击命中
func (c *Client) detectHit(origin, direction player.Position, maxRange float64) *HitResult {
    room := c.Room
    if room == nil {
        return nil
    }

    var closestHit *HitResult
    minDistance := maxRange

    for playerID, p := range room.Players {
        if playerID == c.Player.ID {
            continue // 不打自己
        }

        for _, hb := range p.HitBoxes {
            // 计算命中盒世界坐标
            worldPos := player.Position{
                X: p.Position.X + hb.Offset.X,
                Y: p.Position.Y + hb.Offset.Y,
                Z: p.Position.Z + hb.Offset.Z,
            }

            // 射线检测
            if hitbox.RaySphereIntersect(origin, direction, worldPos, hb.Radius) {
                distance := math.Sqrt(
                    math.Pow(worldPos.X-origin.X, 2) +
                    math.Pow(worldPos.Y-origin.Y, 2) +
                    math.Pow(worldPos.Z-origin.Z, 2),
                )

                if distance < minDistance {
                    minDistance = distance
                    closestHit = &HitResult{
                        PlayerID:   playerID,
                        HitBoxType: hb.Type,
                        Distance:   distance,
                    }
                }
            }
        }
    }

    return closestHit
}
```

- [ ] **Step 2: 修改 handleShoot 处理命中**

修改 `handleShoot` 函数:

```go
func (c *Client) handleShoot(data json.RawMessage, roomManager *room.Manager) {
    var shootData struct {
        Origin    player.Position `json:"origin"`
        Direction player.Position `json:"direction"`
        WeaponID  string          `json:"weapon_id"`
    }
    if err := json.Unmarshal(data, &shootData); err != nil {
        return
    }

    // 获取武器配置
    weapon := c.Player.Weapon
    if weapon == nil {
        weapon = &weapon.DefaultWeapon{}
    }

    // 广播射击消息 (客户端即时反馈)
    c.hub.BroadcastToRoom(c.Room, "player_shot", map[string]interface{}{
        "player_id": c.Player.ID,
        "position":  shootData.Origin,
        "direction": shootData.Direction,
    })

    // 服务端命中检测
    hit := c.detectHit(shootData.Origin, shootData.Direction, weapon.Range())
    if hit != nil {
        // 计算伤害
        damage := hitbox.CalculateDamage(weapon.Damage(), hit.HitBoxType, hit.Distance, weapon.Range())

        // 获取被击中的玩家
        target := c.Room.GetPlayer(hit.PlayerID)
        if target != nil {
            target.TakeDamage(damage)

            // 广播受伤消息
            c.hub.BroadcastToRoom(c.Room, "player_damaged", map[string]interface{}{
                "player_id":        hit.PlayerID,
                "attacker_id":      c.Player.ID,
                "damage":           damage,
                "hitbox":           hit.HitBoxType,
                "remaining_health": target.Health,
                "position":         target.Position,
            })

            // 检查死亡
            if target.Health <= 0 {
                c.hub.BroadcastToRoom(c.Room, "player_killed", map[string]interface{}{
                    "victim_id":     hit.PlayerID,
                    "killer_id":     c.Player.ID,
                    "weapon_id":     weapon.ID(),
                    "hitbox":        hit.HitBoxType,
                    "is_headshot":   hit.HitBoxType == hitbox.HitBoxHead,
                    "kill_distance": hit.Distance,
                })

                // 重生逻辑 (根据游戏模式)
                go c.respawnPlayer(target)
            }
        }
    }
}

// respawnPlayer 重生玩家
func (c *Client) respawnPlayer(p *player.Player) {
    time.Sleep(3 * time.Second) // 3 秒重生延迟

    p.Health = p.MaxHealth
    p.Position = player.Position{X: 0, Y: 0, Z: 0} // TODO: 随机重生点

    c.hub.BroadcastToRoom(c.Room, "player_respawned", map[string]interface{}{
        "player_id": p.ID,
        "position":  p.Position,
        "health":    p.Health,
    })
}
```

- [ ] **Step 3: 验证编译**

Run: `cd /home/node/projects/fps-game/server && go build ./...`
Expected: 无错误

- [ ] **Step 4: 提交**

```bash
git add server/internal/network/server.go
git commit -m "feat(network): 集成命中检测到射击处理"
```

---

### Task 5: 前端命中反馈

**Files:**
- Create: `client/js/hit-effects.js`
- Modify: `client/js/main.js`
- Modify: `client/js/game.js`

- [ ] **Step 1: 创建命中效果模块**

```javascript
// client/js/hit-effects.js
class HitEffects {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.hitMarkers = [];
        this.damageNumbers = [];
    }

    // 显示命中标记
    showHitMarker(position, hitbox, damage) {
        const colors = {
            head: 0xff0000,
            body: 0xffffff,
            arm:  0xffff00,
            leg:  0x00ff00
        };

        // 创建命中标记 (十字准星)
        const markerGeometry = new THREE.RingGeometry(0.1, 0.15, 4);
        const markerMaterial = new THREE.MeshBasicMaterial({
            color: colors[hitbox] || 0xffffff,
            transparent: true,
            opacity: 1
        });
        const marker = new THREE.Mesh(markerGeometry, markerMaterial);
        marker.position.copy(position);
        marker.lookAt(this.camera.position);
        this.scene.add(marker);

        this.hitMarkers.push({
            mesh: marker,
            time: Date.now()
        });
    }

    // 显示伤害数字
    showDamageNumber(position, damage, isHeadshot) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 128;
        canvas.height = 64;

        ctx.font = 'bold 48px Arial';
        ctx.fillStyle = isHeadshot ? '#ff0000' : '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(damage.toString(), 64, 48);

        // TODO: 创建 3D 精灵显示伤害数字
    }

    // 更新效果
    update() {
        const now = Date.now();

        // 淡出命中标记
        for (let i = this.hitMarkers.length - 1; i >= 0; i--) {
            const elapsed = now - this.hitMarkers[i].time;
            if (elapsed > 500) {
                this.scene.remove(this.hitMarkers[i].mesh);
                this.hitMarkers.splice(i, 1);
            } else {
                this.hitMarkers[i].mesh.material.opacity = 1 - elapsed / 500;
            }
        }
    }
}

window.HitEffects = HitEffects;
```

- [ ] **Step 2: 添加消息处理到 main.js**

在 `main.js` 的消息处理部分添加:

```javascript
// player_damaged 处理
window.network.on('player_damaged', (data) => {
    console.log(`Player ${data.player_id} took ${data.damage} damage (${data.hitbox})`);

    // 更新血量
    if (data.player_id === window.game.player.id) {
        window.game.player.health = data.remaining_health;
        window.uiManager.updateHealth(data.remaining_health);

        // 屏幕闪红
        window.uiManager.showDamageEffect();
    } else {
        // 显示命中标记
        if (data.attacker_id === window.game.player.id) {
            window.hitEffects.showHitMarker(
                new THREE.Vector3(data.position.x, data.position.y, data.position.z),
                data.hitbox,
                data.damage
            );
        }
    }
});

// player_killed 处理
window.network.on('player_killed', (data) => {
    console.log(`Player ${data.victim_id} killed by ${data.killer_id}`);

    // 更新击杀计数
    if (data.killer_id === window.game.player.id) {
        window.game.player.kills++;
        window.uiManager.updateKills(window.game.player.kills);
        window.uiManager.showKillFeed(`击杀 ${data.victim_id}${data.is_headshot ? ' (爆头)' : ''}`);
    }

    if (data.victim_id === window.game.player.id) {
        window.game.player.deaths++;
        window.uiManager.updateDeaths(window.game.player.deaths);
        window.uiManager.showDeathScreen();
    }
});

// player_respawned 处理
window.network.on('player_respawned', (data) => {
    if (data.player_id === window.game.player.id) {
        window.game.player.health = data.health;
        window.game.player.position = data.position;
        window.uiManager.updateHealth(data.health);
        window.uiManager.hideDeathScreen();
    }

    window.renderer.updatePlayer(data.player_id, data.position, 0);
});
```

- [ ] **Step 3: 初始化命中效果系统**

在 `main.js` 的初始化部分添加:

```javascript
// 初始化命中效果
window.hitEffects = new HitEffects(window.renderer.scene, window.renderer.camera);

// 在游戏循环中更新
function gameLoop() {
    requestAnimationFrame(gameLoop);
    window.hitEffects.update();
    // ... 其他更新
}
```

- [ ] **Step 4: 提交**

```bash
git add client/js/hit-effects.js client/js/main.js client/js/game.js
git commit -m "feat(client): 添加命中反馈效果"
```

---

## Chunk 2: AI 机器人系统

### Task 6: AI 配置和核心结构

**Files:**
- Create: `server/internal/ai/config.go`
- Create: `server/internal/ai/bot.go`

- [ ] **Step 1: 创建难度配置**

```go
// server/internal/ai/config.go
package ai

import "time"

// Difficulty 难度等级
type Difficulty string

const (
    DifficultyEasy      Difficulty = "easy"
    DifficultyNormal    Difficulty = "normal"
    DifficultyHard      Difficulty = "hard"
    DifficultyNightmare Difficulty = "nightmare"
)

// Config AI 配置
type Config struct {
    Difficulty       Difficulty
    ReactionTime     time.Duration // 反应时间
    Accuracy         float64       // 准度 (0-1)
    DecisionRate     time.Duration // 决策频率
    EnableCover      bool          // 启用掩护行为
    EnablePrediction bool          // 启用预判射击
}

// DifficultyConfigs 各难度配置
var DifficultyConfigs = map[Difficulty]Config{
    DifficultyEasy: {
        Difficulty:   DifficultyEasy,
        ReactionTime: 800 * time.Millisecond,
        Accuracy:     0.3,
        DecisionRate: 1000 * time.Millisecond,
        EnableCover:  false,
    },
    DifficultyNormal: {
        Difficulty:   DifficultyNormal,
        ReactionTime: 500 * time.Millisecond,
        Accuracy:     0.5,
        DecisionRate: 500 * time.Millisecond,
        EnableCover:  true,
    },
    DifficultyHard: {
        Difficulty:   DifficultyHard,
        ReactionTime: 300 * time.Millisecond,
        Accuracy:     0.75,
        DecisionRate: 250 * time.Millisecond,
        EnableCover:  true,
    },
    DifficultyNightmare: {
        Difficulty:       DifficultyNightmare,
        ReactionTime:     150 * time.Millisecond,
        Accuracy:         0.9,
        DecisionRate:     100 * time.Millisecond,
        EnableCover:      true,
        EnablePrediction: true,
    },
}

// GetConfig 获取难度配置
func GetConfig(d Difficulty) Config {
    if cfg, ok := DifficultyConfigs[d]; ok {
        return cfg
    }
    return DifficultyConfigs[DifficultyNormal]
}
```

- [ ] **Step 2: 创建机器人核心结构**

```go
// server/internal/ai/bot.go
package ai

import (
    "math/rand"
    "time"

    "fps-game/server/internal/player"
)

// State AI 状态
type State string

const (
    StatePatrol State = "patrol"
    StateChase  State = "chase"
    StateAttack State = "attack"
    StateCover  State = "cover"
)

// Bot 机器人
type Bot struct {
    *player.Player
    Config       Config
    State        State
    Target       *player.Player
    Path         []player.Position
    LastDecision time.Time
    LastShot     time.Time
    Name         string
}

// NewBot 创建机器人
func NewBot(id string, difficulty Difficulty) *Bot {
    cfg := GetConfig(difficulty)

    return &Bot{
        Player: &player.Player{
            ID:     id,
            Health: 100,
            MaxHealth: 100,
            Position: player.Position{
                X: rand.Float64() * 100 - 50,
                Y: 0,
                Z: rand.Float64() * 100 - 50,
            },
        },
        Config: cfg,
        State:  StatePatrol,
        Name:   generateBotName(),
    }
}

// generateBotName 生成机器人名称
func generateBotName() string {
    prefixes := []string{"Alpha", "Beta", "Gamma", "Delta", "Echo", "Foxtrot"}
    suffixes := []string{"Bot", "AI", "Droid", "Unit"}

    return prefixes[rand.Intn(len(prefixes))] + "-" + suffixes[rand.Intn(len(suffixes))]
}
```

- [ ] **Step 3: 验证编译**

Run: `cd /home/node/projects/fps-game/server && go build ./internal/ai/`
Expected: 无错误

- [ ] **Step 4: 提交**

```bash
git add server/internal/ai/
git commit -m "feat(ai): 添加 AI 配置和核心结构"
```

---

### Task 7: AI 行为状态机

**Files:**
- Create: `server/internal/ai/behavior.go`

- [ ] **Step 1: 实现行为状态机**

```go
// server/internal/ai/behavior.go
package ai

import (
    "math"
    "math/rand"
    "time"

    "fps-game/server/internal/player"
)

// Update 更新 AI 状态
func (b *Bot) Update(room *Room, delta time.Duration) {
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
func (b *Bot) patrol(room *Room) {
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
func (b *Bot) chase(room *Room) {
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
func (b *Bot) attack(room *Room) {
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
func (b *Bot) findCover(room *Room) {
    // 血量恢复后返回巡逻
    if b.Player.Health > 50 {
        b.State = StatePatrol
        return
    }

    // TODO: 实现真正的掩护点查找
    // 目前简单后退
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

func (b *Bot) findNearestEnemy(room *Room, maxDistance float64) *player.Player {
    var nearest *player.Player
    minDist := maxDistance

    for id, p := range room.Players {
        if id == b.ID {
            continue
        }

        dist := b.distanceTo(p.Position)
        if dist < minDist {
            minDist = dist
            nearest = p
        }
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
        // 命中
        damage := 20 + rand.Intn(10)
        b.Target.TakeDamage(damage)
        // TODO: 广播射击和命中消息
    }
}
```

- [ ] **Step 2: 添加 Room 接口定义**

```go
// server/internal/ai/behavior.go 顶部添加

// Room 房间接口 (避免循环依赖)
type Room interface {
    GetPlayers() map[string]*player.Player
}
```

- [ ] **Step 3: 验证编译**

Run: `cd /home/node/projects/fps-game/server && go build ./internal/ai/`
Expected: 无错误

- [ ] **Step 4: 提交**

```bash
git add server/internal/ai/behavior.go
git commit -m "feat(ai): 实现行为状态机"
```

---

### Task 8: 机器人管理器

**Files:**
- Create: `server/internal/ai/manager.go`

- [ ] **Step 1: 创建机器人管理器**

```go
// server/internal/ai/manager.go
package ai

import (
    "fmt"
    "sync"

    "fps-game/server/internal/player"
)

// Manager 机器人管理器
type Manager struct {
    mu              sync.RWMutex
    bots            map[string]*Bot
    defaultDifficulty Difficulty
    autoFill        bool
    maxBots         int
}

// NewManager 创建管理器
func NewManager() *Manager {
    return &Manager{
        bots:             make(map[string]*Bot),
        defaultDifficulty: DifficultyNormal,
        autoFill:         true,
        maxBots:          10,
    }
}

// AddBot 添加机器人
func (m *Manager) AddBot(difficulty Difficulty, team string) *Bot {
    m.mu.Lock()
    defer m.mu.Unlock()

    if len(m.bots) >= m.maxBots {
        return nil
    }

    id := fmt.Sprintf("bot_%d", len(m.bots)+1)
    bot := NewBot(id, difficulty)
    if team != "" {
        bot.Team = team
    }

    m.bots[id] = bot
    return bot
}

// RemoveBot 移除机器人
func (m *Manager) RemoveBot(id string) {
    m.mu.Lock()
    defer m.mu.Unlock()
    delete(m.bots, id)
}

// GetBot 获取机器人
func (m *Manager) GetBot(id string) *Bot {
    m.mu.RLock()
    defer m.mu.RUnlock()
    return m.bots[id]
}

// GetAllBots 获取所有机器人
func (m *Manager) GetAllBots() []*Bot {
    m.mu.RLock()
    defer m.mu.RUnlock()

    bots := make([]*Bot, 0, len(m.bots))
    for _, b := range m.bots {
        bots = append(bots, b)
    }
    return bots
}

// AutoFill 自动填充机器人
func (m *Manager) AutoFill(room *Room, playerCount, targetCount int) []*Bot {
    if !m.autoFill {
        return nil
    }

    var added []*Bot
    botCount := len(m.bots)
    total := playerCount + botCount

    if total < targetCount && botCount < m.maxBots {
        needed := targetCount - total
        for i := 0; i < needed && botCount+i < m.maxBots; i++ {
            bot := m.AddBot(m.defaultDifficulty, "")
            if bot != nil {
                added = append(added, bot)
            }
        }
    }

    return added
}

// UpdateAll 更新所有机器人
func (m *Manager) UpdateAll(room *Room, delta float64) {
    m.mu.RLock()
    defer m.mu.RUnlock()

    for _, bot := range m.bots {
        bot.Update(room, time.Duration(delta*float64(time.Second)))
    }
}

// SetAutoFill 设置自动填充
func (m *Manager) SetAutoFill(enabled bool) {
    m.autoFill = enabled
}

// SetDefaultDifficulty 设置默认难度
func (m *Manager) SetDefaultDifficulty(d Difficulty) {
    m.defaultDifficulty = d
}
```

- [ ] **Step 2: 验证编译**

Run: `cd /home/node/projects/fps-game/server && go build ./internal/ai/`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add server/internal/ai/manager.go
git commit -m "feat(ai): 添加机器人管理器"
```

---

### Task 9: 集成 AI 到房间和服务器

**Files:**
- Modify: `server/internal/room/room.go`
- Modify: `server/internal/network/server.go`

- [ ] **Step 1: 修改房间添加 AI 管理**

在 `room.go` 中添加:

```go
// 在 Room 结构体中添加
BotManager *ai.Manager

// 在 NewRoom 函数中添加
BotManager: ai.NewManager(),
```

添加房间接口方法:

```go
// GetPlayers 实现 Room 接口
func (r *Room) GetPlayers() map[string]*player.Player {
    return r.Players
}

// AddBot 添加机器人
func (r *Room) AddBot(difficulty ai.Difficulty, team string) *ai.Bot {
    return r.BotManager.AddBot(difficulty, team)
}

// GetBots 获取所有机器人
func (r *Room) GetBots() []*ai.Bot {
    return r.BotManager.GetAllBots()
}
```

- [ ] **Step 2: 添加 AI 消息处理到服务器**

在 `server.go` 中添加:

```go
// 在 handleMessage switch 中添加
case "add_bot":
    c.handleAddBot(msg.Data)
case "remove_bot":
    c.handleRemoveBot(msg.Data)

// handleAddBot 处理添加机器人
func (c *Client) handleAddBot(data json.RawMessage) {
    var req struct {
        Difficulty string `json:"difficulty"`
        Team       string `json:"team"`
    }
    if err := json.Unmarshal(data, &req); err != nil {
        return
    }

    if c.Room == nil {
        return
    }

    difficulty := ai.Difficulty(req.Difficulty)
    if difficulty == "" {
        difficulty = ai.DifficultyNormal
    }

    bot := c.Room.AddBot(difficulty, req.Team)
    if bot == nil {
        return
    }

    // 广播机器人加入
    c.hub.BroadcastToRoom(c.Room, "player_joined", map[string]interface{}{
        "player_id": bot.ID,
        "name":      bot.Name,
        "position":  bot.Position,
        "is_bot":    true,
        "difficulty": bot.Config.Difficulty,
    })
}

// handleRemoveBot 处理移除机器人
func (c *Client) handleRemoveBot(data json.RawMessage) {
    var req struct {
        BotID string `json:"bot_id"`
    }
    if err := json.Unmarshal(data, &req); err != nil {
        return
    }

    if c.Room == nil {
        return
    }

    c.Room.BotManager.RemoveBot(req.BotID)

    // 广播机器人离开
    c.hub.BroadcastToRoom(c.Room, "player_left", map[string]interface{}{
        "player_id": req.BotID,
    })
}
```

- [ ] **Step 3: 验证编译**

Run: `cd /home/node/projects/fps-game/server && go build ./...`
Expected: 无错误

- [ ] **Step 4: 提交**

```bash
git add server/internal/room/room.go server/internal/network/server.go
git commit -m "feat: 集成 AI 机器人到房间和服务器"
```

---

### Task 10: 前端 AI 渲染

**Files:**
- Create: `client/js/ai-labels.js`
- Modify: `client/js/main.js`

- [ ] **Step 1: 创建 AI 标签渲染**

```javascript
// client/js/ai-labels.js
class AILabels {
    constructor() {
        this.botLabels = new Map();
    }

    // 难度颜色
    getDifficultyColor(difficulty) {
        const colors = {
            easy: '#00ff00',
            normal: '#ffff00',
            hard: '#ff8800',
            nightmare: '#ff0000'
        };
        return colors[difficulty] || '#ffffff';
    }

    // 创建机器人标签
    createLabel(botId, name, difficulty) {
        const label = document.createElement('div');
        label.className = 'ai-label';
        label.style.cssText = `
            position: absolute;
            color: ${this.getDifficultyColor(difficulty)};
            font-size: 12px;
            font-weight: bold;
            text-shadow: 1px 1px 2px black;
            pointer-events: none;
        `;
        label.textContent = `[BOT] ${name}`;
        document.body.appendChild(label);

        this.botLabels.set(botId, {
            element: label,
            difficulty: difficulty
        });

        return label;
    }

    // 更新标签位置
    updateLabel(botId, screenPos) {
        const label = this.botLabels.get(botId);
        if (label) {
            label.element.style.left = `${screenPos.x}px`;
            label.element.style.top = `${screenPos.y - 50}px`;
        }
    }

    // 移除标签
    removeLabel(botId) {
        const label = this.botLabels.get(botId);
        if (label) {
            label.element.remove();
            this.botLabels.delete(botId);
        }
    }
}

window.AILabels = AILabels;
```

- [ ] **Step 2: 添加消息处理到 main.js**

```javascript
// 在 main.js 中添加

// 初始化 AI 标签
window.aiLabels = new AILabels();

// player_joined 处理修改
window.network.on('player_joined', (data) => {
    console.log('Player joined:', data.name, 'is_bot:', data.is_bot);

    // 添加玩家
    window.renderer.addPlayer(data.player_id, data.position, false);

    // 如果是机器人，创建标签
    if (data.is_bot) {
        window.aiLabels.createLabel(data.player_id, data.name, data.difficulty);
    }

    // 更新击杀信息
    window.uiManager.addKillFeed(`${data.name} 加入了游戏`);
});

// player_left 处理
window.network.on('player_left', (data) => {
    window.renderer.removePlayer(data.player_id);
    window.aiLabels.removeLabel(data.player_id);
});
```

- [ ] **Step 3: 添加 AI 控制按钮到 UI**

在 `ui.js` 或 HTML 中添加:

```javascript
// 添加机器人按钮
addBotButton(difficulty) {
    window.network.send('add_bot', {
        difficulty: difficulty || 'normal',
        team: ''
    });
}

// 移除机器人按钮
removeBotButton(botId) {
    window.network.send('remove_bot', {
        bot_id: botId
    });
}
```

- [ ] **Step 4: 提交**

```bash
git add client/js/ai-labels.js client/js/main.js
git commit -m "feat(client): 添加 AI 机器人渲染和控制"
```

---

### Task 11: 集成测试

**Files:**
- Create: `server/internal/hitbox/integration_test.go`
- Create: `server/internal/ai/integration_test.go`

- [ ] **Step 1: 编写命中检测集成测试**

```go
// server/internal/hitbox/integration_test.go
// +build integration

package hitbox_test

import (
    "testing"

    "fps-game/server/internal/hitbox"
    "fps-game/server/internal/player"
)

func TestHitDetection_E2E(t *testing.T) {
    // 创建模拟玩家
    shooter := &player.Player{
        ID:       "shooter",
        Position: player.Position{X: 0, Y: 1.7, Z: 0},
    }

    target := &player.Player{
        ID:       "target",
        Position: player.Position{X: 10, Y: 0, Z: 0},
        HitBoxes: hitbox.DefaultHitBoxes,
    }

    // 射线沿 X 轴
    origin := player.Position{X: 0, Y: 1.0, Z: 0}  // 身体高度
    direction := player.Position{X: 1, Y: 0, Z: 0}

    // 检测命中
    for _, hb := range target.HitBoxes {
        worldPos := player.Position{
            X: target.Position.X + hb.Offset.X,
            Y: target.Position.Y + hb.Offset.Y,
            Z: target.Position.Z + hb.Offset.Z,
        }

        if hitbox.RaySphereIntersect(origin, direction, worldPos, hb.Radius) {
            t.Logf("Hit %s at distance ~10", hb.Type)

            damage := hitbox.CalculateDamage(40, hb.Type, 10, 50)
            t.Logf("Damage: %d", damage)
            return
        }
    }

    t.Error("Expected to hit target")
}
```

- [ ] **Step 2: 运行集成测试**

Run: `cd /home/node/projects/fps-game/server && go test ./internal/hitbox/ -v -tags=integration`
Expected: PASS

- [ ] **Step 3: 提交**

```bash
git add server/internal/hitbox/integration_test.go
git commit -m "test(hitbox): 添加集成测试"
```

---

### Task 12: 运行完整测试

- [ ] **Step 1: 运行所有测试**

Run: `cd /home/node/projects/fps-game/server && go test ./... -v`
Expected: PASS

- [ ] **Step 2: 运行 CI 检查**

Run: `cd /home/node/projects/fps-game && make ci`
Expected: 无错误

- [ ] **Step 3: 最终提交**

```bash
git add -A
git commit -m "feat: 完成命中判定和 AI 机器人系统"
git push origin main
```

---

## 实现顺序总结

1. **Chunk 1: 命中判定系统**
   - Task 1-5: 命中盒、射线检测、服务端处理、前端反馈

2. **Chunk 2: AI 机器人系统**
   - Task 6-10: 配置、行为、管理器、集成、前端

3. **测试验证**
   - Task 11-12: 集成测试、完整验证
