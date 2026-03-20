# 网络层测试覆盖率完善设计

## 目标

将 `server/internal/network` 包的测试覆盖率从 33.9% 提升到 90%+。

## 现状分析

### 当前覆盖率基线

| 函数 | 当前 | 目标 | 说明 |
|------|------|------|------|
| `ServeWS` | 0% | 100% | 集成测试 |
| `HandleConnection` | 0% | 100% | 集成测试 |
| `readPump` | 0% | 70% | 超时分支不测 |
| `writePump` | 0% | 70% | 超时分支不测 |
| `handleMessage` | 60% | 100% | 分发测试 |
| `Hub.Run` | 部分 | 80% | 注册/注销路径 |

### 已知代码风险

| 问题 | 代码位置 | 影响 | 本次处理 |
|------|----------|------|----------|
| `weapon_change` 未入房时 nil Room | `handleWeaponChange` | 潜在 panic | 先修复代码 |
| `respawn` 未入房时 nil Room | `handleRespawn` | 潜在 panic | 先修复代码 |

**决策**：在测试前先修复这些 nil Room 风险，添加 `c.Room == nil` 检查。

---

## 文件结构

```
server/internal/network/
├── server.go              # 修复 nil Room 风险
├── server_test.go         # 现有单元测试
└── server_ws_test.go      # 集成测试（新增）
```

---

## 消息类型矩阵（精确版）

| 输入消息 | 输出消息 | 需要房间 | excludeID | 发送者收到 | 其他收到 |
|----------|----------|---------|-----------|-----------|---------|
| `join_room` | `room_joined` / `player_joined` | 否 | `c.Player.ID` | ❌ | ✅ |
| `leave_room` | `player_left` | 是 | `c.Player.ID` | ❌ | ✅ |
| `move` | `player_moved` | 是 | `c.Player.ID` | ❌ | ✅ |
| `chat` | `chat` | 是 | `""` | ✅ | ✅ |
| `shoot` | `player_shot` | 是 | `c.Player.ID` | ❌ | ✅ |
| `reload` | `reload` | 是 | N/A | ✅ 直接 | ❌ |
| `respawn` | `respawn` / `player_respawned` | 是 | `c.Player.ID` | ✅ 直接 | ✅ |
| `weapon_change` | `weapon_changed` | 是 | `""` | ✅ | ✅ |
| `voice_start` | `voice_start` | 是 | `c.Player.ID` | ❌ | ✅ |
| `voice_stop` | `voice_stop` | 是 | `c.Player.ID` | ❌ | ✅ |
| `voice_data` | `voice_data` | 是 | `c.Player.ID` | ❌ | ✅ |
| `team_join` | `team_changed` | 是 | `""` | ✅ | ✅ |
| `grenade_throw` | `grenade_thrown` | 是 | `""` | ✅ | ✅ |
| `c4_plant` | `c4_planted` | 是 | `""` | ✅ | ✅ |
| `c4_defuse` | `c4_defused` | 是 | `""` | ✅ | ✅ |
| `skill_use` | `skill_used` | 是 | `""` | ✅ | ✅ |
| `emote` | `emote` | 是 | `""` | ✅ | ✅ |
| `ping` | `ping` | 是 | `""` | ✅ | ✅ |

---

## 测试工具设计

### TestServer

```go
type TestServer struct {
    Server      *httptest.Server
    Hub         *Hub
    RoomManager *room.Manager
    URL         string
}

// NewTestServer 创建测试服务器
func NewTestServer(t *testing.T) *TestServer

// Close 关闭服务器
// 契约：
// 1. 关闭 httptest.Server
// 2. Hub goroutine 会泄漏（无法优雅退出）
func (s *TestServer) Close()
```

### Helper 函数

```go
const (
    defaultTimeout = 2 * time.Second
    noMsgTimeout   = 500 * time.Millisecond
)

// Connect 连接并返回 playerID
// 消费：welcome
func Connect(t *testing.T, ts *TestServer) (*websocket.Conn, string)

// CreateRoom 创建房间并加入
// 消费：welcome, room_joined
// 返回：conn, playerID, roomID
func CreateRoom(t *testing.T, ts *TestServer) (*websocket.Conn, string, string)

// JoinRoom 加入已存在房间
// 消费：welcome, room_joined
// 返回：conn, playerID
func JoinRoom(t *testing.T, ts *TestServer, roomID string) (*websocket.Conn, string)

// FillRoom 填满房间
// 消费：各自的 welcome, room_joined
// 返回：[]conn（不包括创建者）
func FillRoom(t *testing.T, ts *TestServer, roomID string, count int) []*websocket.Conn

// CloseConn 关闭连接
func CloseConn(t *testing.T, conn *websocket.Conn)

// Drain 清空所有待处理消息
// 消费：直到 noMsgTimeout 无消息
func Drain(t *testing.T, conn *websocket.Conn)

// Send 发送消息
func Send(t *testing.T, conn *websocket.Conn, msgType string, data interface{})

// Recv 接收消息
func Recv(t *testing.T, conn *websocket.Conn, timeout time.Duration) *Message

// RecvType 接收并验证类型
func RecvType(t *testing.T, conn *websocket.Conn, wantType string) *Message

// NoMessage 验证超时内无消息
func NoMessage(t *testing.T, conn *websocket.Conn)
```

**使用契约**：
- 测试开始时先用 helper 建立连接
- 验证广播前先 `Drain` 清空历史消息
- 测试结束时 `CloseConn`

---

## 测试场景

### 1. 连接生命周期

#### TestWS_Connect
```
步骤：Connect(ts)
断言：playerID 非空
```

#### TestWS_Disconnect_InRoom
```
前置：A、B 在同一房间
步骤：A 关闭连接
断言：B 收到 player_left
```

### 2. 房间操作

#### TestWS_JoinRoom_New
```
步骤：CreateRoom(ts)
断言：roomID 非空
```

#### TestWS_JoinRoom_Existing
```
前置：A 创建房间，Drain(A)
步骤：B = JoinRoom(ts, roomID)
断言：
  - B 收到 room_joined
  - A 收到 player_joined
```

#### TestWS_JoinRoom_Full
```
前置：
  - A 创建房间
  - FillRoom(ts, roomID, 9)
  - Drain(A)
步骤：第 11 人尝试 JoinRoom
断言：收到 error "Room is full"
```

### 3. 消息分发测试（表驱动）

#### TestWS_MessageDispatch
```go
func TestWS_MessageDispatch(t *testing.T) {
    tests := []struct {
        name       string
        msgType    string
        data       interface{}
        senderGets string   // 发送者收到的消息类型，空=不收到
        otherGets  string   // 其他玩家收到的消息类型
    }{
        {"move", "move", moveData, "", "player_moved"},
        {"chat", "chat", chatData, "chat", "chat"},
        {"shoot", "shoot", shootData, "", "player_shot"},
        {"reload", "reload", nil, "reload", ""},
        {"respawn", "respawn", respawnData, "respawn", "player_respawned"},
        {"weapon_change", "weapon_change", weaponData, "weapon_changed", "weapon_changed"},
        // ... 其他消息类型
    }
    
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            A, B 加入同一房间
            Drain(A); Drain(B)
            A 发送消息
            if tt.senderGets != "" {
                A 收到 tt.senderGets
            } else {
                A 无消息
            }
            if tt.otherGets != "" {
                B 收到 tt.otherGets
            }
        })
    }
}
```

#### TestWS_SkillOnCooldown
```
前置：A 在房间内，Drain(A)
步骤：
  1. A 发送 skill_use
  2. A 立即再次发送
断言：第二次收到 error "Skill on cooldown"
```

### 4. 异常输入

#### TestWS_NoRoom_Operations（表驱动）
```go
func TestWS_NoRoom_Operations(t *testing.T) {
    tests := []string{
        "move", "shoot", "chat", "leave_room",
        "voice_start", "voice_stop", "voice_data",
        "team_join", "grenade_throw", "c4_plant", "c4_defuse",
        "skill_use", "emote", "ping",
    }
    
    for _, msgType := range tests {
        t.Run(msgType, func(t *testing.T) {
            A = Connect(ts) // 不加入房间
            Drain(A)
            A 发送 msgType
            NoMessage(A, 500ms)
            // 验证连接仍可用
            A = JoinRoom(ts, "")
            Drain(A)
            A 发送 ping
            RecvType(A, "ping")
        })
    }
}
```

#### TestWS_InvalidJSON
```
前置：A 已连接
步骤：
  1. A 发送 '{"invalid'
  2. NoMessage(A, 500ms)
  3. A 发送正常消息
断言：步骤 3 能正常处理
```

### 5. 并发测试

#### TestConcurrent_JoinSameRoom
```
前置：A 创建房间，Drain(A)
步骤：5 个客户端同时 JoinRoom
断言：
  - 5 个客户端各自收到 room_joined
  - A 收到 5 个 player_joined
```

#### TestConcurrent_Broadcast
```
前置：5 个客户端加入同一房间，全部 Drain
步骤：每个客户端发送 5 条 chat
断言：
  - 无崩溃、无死锁
  - 每个客户端至少收到 10 条消息（允许丢消息）
```

#### TestConcurrent_Disconnect
```
前置：10 个客户端加入房间，编号 0-9
步骤：
  1. 关闭客户端 0, 2, 4, 6, 8
  2. 剩余 5 个互相发消息
断言：无崩溃，消息正常收发
```

---

## 成功标准

| 指标 | 目标 | 说明 |
|------|------|------|
| 整体覆盖率 | ≥ 90% | |
| 单元测试 | 100% 通过 | |
| 集成测试 | 100% 通过 | |
| 并发测试 | 100% 通过 | 无 panic、无死锁 |
| 竞态检测 | 通过 | 无 race fail |

**验收口径**：
- 测试必须 `go test` 全部通过
- `go test -race` 必须无 fail（允许 goroutine 泄漏警告，但不算失败）
- 已知 Hub goroutine 常驻是设计限制，不作为失败条件

---

## 实施步骤

1. **修复代码**：`handleWeaponChange` 和 `handleRespawn` 添加 nil Room 检查
2. **编写测试工具**：TestServer, Helper 函数
3. **编写测试**：按场景顺序
4. **运行覆盖率**：`go test -cover -race`
5. **调优**：补充遗漏分支

---

## 时间估计

| 任务 | 时间 |
|------|------|
| 修复代码 | 0.5 小时 |
| 测试工具 | 0.5 小时 |
| 测试编写 | 2 小时 |
| 调试优化 | 1 小时 |
| **总计** | **4 小时** |
