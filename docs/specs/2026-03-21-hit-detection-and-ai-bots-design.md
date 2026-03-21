# 命中判定系统与 AI 机器人设计文档

**版本**: 1.0
**日期**: 2026-03-21
**状态**: 待审核

---

## 1. 概述

### 1.1 目标

为 FPS 游戏添加两个核心功能：
1. **命中判定系统** - 精确的射击命中检测和伤害计算
2. **AI 机器人系统** - 可配置难度的 AI 对手

### 1.2 设计决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 命中精度 | 精确命中盒 | 支持爆头、不同部位伤害倍率 |
| 判定位置 | 混合模式 | 客户端即时反馈 + 服务端验证 |
| AI 难度 | 可配置 | 支持简单/普通/困难/噩梦四个等级 |
| AI 部署 | 自动+手动 | 自动填充空位 + 手动控制数量 |

---

## 2. 命中判定系统

### 2.1 命中盒结构

每个玩家包含多个命中盒，对应不同身体部位：

```
        ┌─────┐
        │ HEAD│  ← 爆头 2.5x 伤害
        └─────┘
       ┌───────┐
       │       │
       │ BODY  │  ← 身体 1.0x 伤害
       │       │
       └───────┘
      ┌──┐   ┌──┐
      │ARM│   │ARM│  ← 手臂 0.8x 伤害
      └──┘   └──┘
      ┌──┐   ┌──┐
      │LEG│   │LEG│  ← 腿部 0.7x 伤害
      └──┘   └──┘
```

### 2.2 数据结构

```go
// server/internal/hitbox/hitbox.go

type HitBoxType string

const (
    HitBoxHead HitBoxType = "head"
    HitBoxBody HitBoxType = "body"
    HitBoxArm  HitBoxType = "arm"
    HitBoxLeg  HitBoxType = "leg"
)

type HitBox struct {
    Type     HitBoxType
    Offset   Position  // 相对于玩家中心
    Radius   float64   // 碰撞球半径
}

// 默认命中盒配置
var DefaultHitBoxes = []HitBox{
    {Type: HitBoxHead, Offset: Position{X: 0, Y: 1.6, Z: 0}, Radius: 0.25},
    {Type: HitBoxBody, Offset: Position{X: 0, Y: 1.0, Z: 0}, Radius: 0.4},
    {Type: HitBoxArm,  Offset: Position{X: 0.3, Y: 1.0, Z: 0}, Radius: 0.15},
    {Type: HitBoxArm,  Offset: Position{X: -0.3, Y: 1.0, Z: 0}, Radius: 0.15},
    {Type: HitBoxLeg,  Offset: Position{X: 0.15, Y: 0.3, Z: 0}, Radius: 0.15},
    {Type: HitBoxLeg,  Offset: Position{X: -0.15, Y: 0.3, Z: 0}, Radius: 0.15},
}

// 伤害倍率
var DamageMultipliers = map[HitBoxType]float64{
    HitBoxHead: 2.5,
    HitBoxBody: 1.0,
    HitBoxArm:  0.8,
    HitBoxLeg:  0.7,
}
```

### 2.3 射线检测算法

```go
// Raycast 射线检测
func (h *HitDetector) Raycast(origin, direction Position, maxRange float64, shooterID string, room *Room) *HitResult {
    // 1. 遍历房间内其他玩家
    for playerID, player := range room.Players {
        if playerID == shooterID {
            continue // 不打自己
        }
        
        // 2. 检测每个命中盒
        for _, hitbox := range player.HitBoxes {
            worldPos := player.Position.Add(hitbox.Offset)
            
            // 3. 射线-球体相交检测
            if h.RaySphereIntersect(origin, direction, worldPos, hitbox.Radius) {
                distance := origin.Distance(worldPos)
                if distance <= maxRange {
                    return &HitResult{
                        PlayerID:   playerID,
                        HitBoxType: hitbox.Type,
                        Distance:   distance,
                    }
                }
            }
        }
    }
    return nil
}

// RaySphereIntersect 射线与球体相交检测
func (h *HitDetector) RaySphereIntersect(origin, direction, center Position, radius float64) bool {
    // 数学公式: |origin + t*direction - center| = radius
    // 简化为二次方程求解
    oc := origin.Sub(center)
    a := direction.Dot(direction)
    b := 2.0 * oc.Dot(direction)
    c := oc.Dot(oc) - radius*radius
    discriminant := b*b - 4*a*c
    return discriminant >= 0
}
```

### 2.4 伤害计算

```go
// CalculateDamage 计算最终伤害
func (h *HitDetector) CalculateDamage(baseDamage int, hitBoxType HitBoxType, distance float64, weapon Weapon) int {
    // 1. 基础伤害
    damage := float64(baseDamage)
    
    // 2. 命中部位倍率
    damage *= DamageMultipliers[hitBoxType]
    
    // 3. 距离衰减 (超过武器射程后衰减)
    if distance > weapon.Range() {
        falloff := 1.0 - (distance-weapon.Range())/weapon.Range()
        damage *= math.Max(0.3, falloff)
    }
    
    return int(damage)
}
```

### 2.5 消息协议

#### 射击消息 (客户端 → 服务端)

```json
{
    "type": "shoot",
    "data": {
        "origin": {"x": 0, "y": 1.7, "z": 0},
        "direction": {"x": 0.707, "y": 0, "z": 0.707},
        "weapon_id": "rifle"
    }
}
```

#### 命中反馈 (服务端 → 客户端)

```json
{
    "type": "player_damaged",
    "data": {
        "player_id": "abc123",
        "attacker_id": "def456",
        "damage": 35,
        "hitbox": "body",
        "remaining_health": 65,
        "position": {"x": 10, "y": 0, "z": 5}
    }
}
```

#### 击杀消息 (服务端 → 客户端)

```json
{
    "type": "player_killed",
    "data": {
        "victim_id": "abc123",
        "killer_id": "def456",
        "weapon_id": "rifle",
        "hitbox": "head",
        "is_headshot": true,
        "kill_distance": 25.5
    }
}
```

---

## 3. AI 机器人系统

### 3.1 难度配置

| 难度 | 反应时间 | 准度 | 决策频率 | 特殊能力 |
|------|----------|------|----------|----------|
| 简单 | 800ms | 30% | 1s | 无 |
| 普通 | 500ms | 50% | 500ms | 基础掩护 |
| 困难 | 300ms | 75% | 250ms | 战术移动 |
| 噩梦 | 150ms | 90% | 100ms | 预判射击 |

```go
// server/internal/ai/config.go

type AIDifficulty string

const (
    AIEasy      AIDifficulty = "easy"
    AINormal    AIDifficulty = "normal"
    AIHard      AIDifficulty = "hard"
    AINightmare AIDifficulty = "nightmare"
)

type AIConfig struct {
    Difficulty       AIDifficulty
    ReactionTime     time.Duration
    Accuracy         float64
    DecisionRate     time.Duration
    EnableCover      bool
    EnablePrediction bool
}

var DifficultyConfigs = map[AIDifficulty]AIConfig{
    AIEasy: {
        Difficulty:   AIEasy,
        ReactionTime: 800 * time.Millisecond,
        Accuracy:     0.3,
        DecisionRate: 1000 * time.Millisecond,
    },
    AINormal: {
        Difficulty:   AINormal,
        ReactionTime: 500 * time.Millisecond,
        Accuracy:     0.5,
        DecisionRate: 500 * time.Millisecond,
        EnableCover:  true,
    },
    AIHard: {
        Difficulty:   AIHard,
        ReactionTime: 300 * time.Millisecond,
        Accuracy:     0.75,
        DecisionRate: 250 * time.Millisecond,
        EnableCover:  true,
    },
    AINightmare: {
        Difficulty:       AINightmare,
        ReactionTime:     150 * time.Millisecond,
        Accuracy:         0.9,
        DecisionRate:     100 * time.Millisecond,
        EnableCover:      true,
        EnablePrediction: true,
    },
}
```

### 3.2 AI 状态机

```
                 ┌──────────────┐
                 │    PATROL    │
                 │  随机巡逻    │
                 └──────┬───────┘
                        │ 发现敌人
                        ▼
                 ┌──────────────┐
           ┌─────│    CHASE     │─────┐
           │     │   追击敌人    │     │
           │     └──────┬───────┘     │
           │ 失去目标    │             │ 进入射程
           │            ▼             │
           │     ┌──────────────┐     │
           │     │    ATTACK    │◄────┘
           │     │   攻击敌人    │
           │     └──────┬───────┘
           │            │ 受伤/低血量
           │            ▼
           │     ┌──────────────┐
           └────►│    COVER     │
                 │   寻找掩护    │
                 └──────┬───────┘
                        │ 血量恢复
                        ▼
                 ┌──────────────┐
                 │    PATROL    │
                 └──────────────┘
```

```go
// server/internal/ai/bot.go

type AIState string

const (
    StatePatrol AIState = "patrol"
    StateChase  AIState = "chase"
    StateAttack AIState = "attack"
    StateCover  AIState = "cover"
)

type Bot struct {
    ID           string
    Name         string
    Config       AIConfig
    State        AIState
    Target       *Player
    Path         []Position
    LastDecision time.Time
    LastShot     time.Time
}

// Update AI 更新循环
func (b *Bot) Update(room *Room, delta time.Duration) {
    // 1. 检查决策间隔
    if time.Since(b.LastDecision) < b.Config.DecisionRate {
        return
    }
    b.LastDecision = time.Now()
    
    // 2. 状态机处理
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
```

### 3.3 AI 行为实现

#### 巡逻行为

```go
func (b *Bot) patrol(room *Room) {
    // 1. 随机移动
    if len(b.Path) == 0 {
        b.Path = b.generateRandomPath(room)
    }
    
    // 2. 沿路径移动
    if len(b.Path) > 0 {
        b.moveToward(b.Path[0])
        if b.reachedPosition(b.Path[0]) {
            b.Path = b.Path[1:]
        }
    }
    
    // 3. 检测敌人
    if enemy := b.findNearestEnemy(room); enemy != nil {
        b.Target = enemy
        b.State = StateChase
    }
}
```

#### 攻击行为

```go
func (b *Bot) attack(room *Room) {
    if b.Target == nil || !b.Target.IsAlive() {
        b.State = StatePatrol
        return
    }
    
    // 1. 瞄准目标 (加入随机误差模拟准度)
    aimPoint := b.calculateAimPoint(b.Target)
    
    // 2. 检查射程和视野
    distance := b.Position.Distance(b.Target.Position)
    if distance > b.Weapon.Range() {
        b.State = StateChase
        return
    }
    
    // 3. 射击 (受反应时间和准度限制)
    if time.Since(b.LastShot) >= b.Config.ReactionTime {
        if rand.Float64() < b.Config.Accuracy {
            b.shoot(aimPoint)
        }
        b.LastShot = time.Now()
    }
}
```

### 3.4 自动填充逻辑

```go
// server/internal/room/bot_manager.go

type BotManager struct {
    minPlayers     int  // 最少真人玩家
    maxBots        int  // 最大机器人数量
    autoFill       bool // 自动填充开关
    defaultDifficulty AIDifficulty
}

// AutoFillBots 自动填充机器人
func (bm *BotManager) AutoFillBots(room *Room) {
    if !bm.autoFill {
        return
    }
    
    playerCount := room.GetPlayerCount()
    botCount := room.GetBotCount()
    totalPlayers := playerCount + botCount
    
    // 目标: 房间至少有一半是真人或机器人
    targetCount := room.MaxSize / 2
    
    if totalPlayers < targetCount && botCount < bm.maxBots {
        needed := targetCount - totalPlayers
        for i := 0; i < needed && botCount+i < bm.maxBots; i++ {
            room.AddBot(bm.createBot())
        }
    }
}
```

### 3.5 消息协议

#### 添加机器人 (客户端 → 服务端)

```json
{
    "type": "add_bot",
    "data": {
        "difficulty": "normal",
        "team": "red"
    }
}
```

#### 机器人列表 (服务端 → 客户端)

```json
{
    "type": "bot_list",
    "data": {
        "bots": [
            {
                "id": "bot_001",
                "name": "Bot-Alpha",
                "difficulty": "normal",
                "team": "red",
                "kills": 5,
                "deaths": 3
            }
        ]
    }
}
```

---

## 4. 前端实现

### 4.1 命中反馈

```javascript
// client/js/hitbox.js

class HitEffectSystem {
    constructor() {
        this.hitMarkers = [];
    }
    
    // 显示命中标记
    showHitMarker(position, hitbox, damage) {
        const colors = {
            head: '#ff0000',   // 爆头红色
            body: '#ffffff',   // 身体白色
            arm: '#ffff00',    // 手臂黄色
            leg: '#00ff00'     // 腿部绿色
        };
        
        this.hitMarkers.push({
            position,
            color: colors[hitbox] || '#ffffff',
            damage,
            time: Date.now()
        });
    }
    
    // 显示伤害数字
    showDamageNumber(position, damage) {
        // 浮动伤害数字效果
    }
}
```

### 4.2 AI 机器人渲染

```javascript
// client/js/ai-renderer.js

class AIRenderer {
    // 机器人名称颜色区分
    getBotColor(difficulty) {
        return {
            easy: '#00ff00',      // 绿色
            normal: '#ffff00',    // 黄色
            hard: '#ff8800',      // 橙色
            nightmare: '#ff0000'  // 红色
        }[difficulty];
    }
    
    // 显示机器人名称标签
    renderBotLabel(bot) {
        // 名称格式: [BOT] Bot-Alpha
        // 颜色根据难度变化
    }
}
```

---

## 5. 文件结构

### 5.1 新增文件

```
server/internal/
├── hitbox/
│   ├── hitbox.go        # 命中盒定义
│   ├── detector.go      # 射线检测
│   └── hitbox_test.go   # 单元测试
├── ai/
│   ├── bot.go           # 机器人核心
│   ├── config.go        # 难度配置
│   ├── behavior.go      # 行为状态机
│   └── bot_test.go      # 单元测试
└── room/
    └── bot_manager.go   # 机器人管理

client/js/
├── hitbox.js            # 命中反馈
└── ai-renderer.js       # AI 渲染
```

### 5.2 修改文件

```
server/internal/network/
├── server.go            # 添加 handleShoot 命中检测
└── server_test.go       # 添加命中测试

server/internal/player/
└── player.go            # 添加命中盒数据

client/js/
├── main.js              # 添加消息处理
├── game.js              # 添加伤害处理
└── player.js            # 添加命中盒
```

---

## 6. 测试计划

### 6.1 单元测试

| 测试项 | 文件 | 说明 |
|--------|------|------|
| 射线-球体相交 | hitbox_test.go | 验证检测算法正确性 |
| 伤害计算 | hitbox_test.go | 验证部位倍率和距离衰减 |
| AI 状态转换 | bot_test.go | 验证状态机逻辑 |
| AI 射击准度 | bot_test.go | 验证准度配置生效 |

### 6.2 集成测试

| 测试项 | 说明 |
|--------|------|
| 命中检测端到端 | WebSocket 客户端模拟射击 → 验证伤害消息 |
| AI 行为端到端 | 机器人加入房间 → 验证行为和射击 |

---

## 7. 实现顺序

1. **阶段一：命中判定系统**
   - 命中盒数据结构
   - 射线检测算法
   - 伤害计算
   - 消息协议
   - 前端反馈

2. **阶段二：AI 机器人系统**
   - 机器人数据结构
   - 难度配置
   - 基础行为 (巡逻/追击/攻击)
   - 自动填充
   - 前端渲染

3. **阶段三：优化完善**
   - 高级行为 (掩护/预判)
   - 性能优化
   - 测试覆盖

---

## 8. 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| 服务端计算压力大 | 命中检测限频、房间分区处理 |
| AI 行为不自然 | 参数可调、行为平滑过渡 |
| 客户端作弊 | 服务端验证、异常检测 |
