# 网络层测试覆盖率完善设计

## 目标

将 `server/internal/network/server.go` 的测试覆盖率从 33.9% 提升到 90%+。

**验收命令**：
```bash
go test -coverprofile=cover.out ./server/internal/network/
go tool cover -func=cover.out | grep server.go
go test -race ./server/internal/network/...
```

---

## 前置修复（阻塞条件，先独立提交）

### 修复 BroadcastToRoom（推荐）

```go
func (h *Hub) BroadcastToRoom(r *room.Room, msgType string, data interface{}, excludeID string) {
    if r == nil {
        return  // nil-safe
    }
    // ... 原有逻辑
}
```

这样所有调用 `BroadcastToRoom(c.Room, ...)` 的 handler 都自动安全。

### 或：修复各 handler（备选）

| 函数 | 修复 |
|------|------|
| `handleRespawn` | 添加 `if c.Room == nil { return }` |
| `handleWeaponChange` | 添加 `if c.Room == nil { return }` |

**推荐修复 BroadcastToRoom**，这样更彻底。

---

## 测试分层

| 层级 | 内容 | 文件 |
|------|------|------|
| 单元测试 | Hub 注册/注销、BroadcastToRoom | server_test.go（已有） |
| 集成测试 | WebSocket 连接、消息分发、异常处理 | server_ws_test.go（新增） |
| 并发冒烟 | 广播稳定性 | server_ws_test.go |

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

// NewTestServer 创建独立测试服务器
// 生命周期：
// 1. 创建独立 Hub
// 2. 启动 Hub.Run()（一个独立 goroutine）
// 3. 创建 httptest.Server
func NewTestServer(t *testing.T) *TestServer

// Close 关闭 httptest.Server
// Hub goroutine 常驻（Hub 无 stop 机制）
// 每个测试独立 TestServer，不会有跨测试污染
func (s *TestServer) Close()
```

**隔离保证**：
- 每个测试调用 `NewTestServer` 创建独立实例
- 不调用 `t.Parallel()`（代码层面强制串行）
- Hub goroutine 在测试进程退出时清理

### Helper 函数

```go
// Connect 连接，消费 welcome，返回 (conn, playerID)
func Connect(t *testing.T, ts *TestServer) (*websocket.Conn, string)

// CreateRoom 创建房间，消费 welcome+room_joined，返回 (conn, playerID, roomID)
func CreateRoom(t *testing.T, ts *TestServer) (*websocket.Conn, string, string)

// JoinRoom 加入房间，消费 welcome+room_joined，返回 (conn, playerID)
func JoinRoom(t *testing.T, ts *TestServer, roomID string) (*websocket.Conn, string)

// FillRoom 填满房间（count + 创建者 <= 10）
func FillRoom(t *testing.T, ts *TestServer, roomID string, count int) []*websocket.Conn

// Drain 清空消息（500ms 无新消息）
func Drain(t *testing.T, conn *websocket.Conn)

// CloseConn 关闭连接
func CloseConn(t *testing.T, conn *websocket.Conn)

// Send 发送消息
func Send(t *testing.T, conn *websocket.Conn, msgType string, data interface{})

// RecvType 接收并验证类型
func RecvType(t *testing.T, conn *websocket.Conn, wantType string) *Message

// RecvAll 接收所有消息（兼容批量写入，按换行分隔解析）
func RecvAll(t *testing.T, conn *websocket.Conn) []*Message

// NoMessage 验证 500ms 内无消息
func NoMessage(t *testing.T, conn *websocket.Conn)

// CountType 统计消息类型数量
func CountType(msgs []*Message, msgType string) int
```

---

## BroadcastToRoom 契约（修复后）

```go
func (h *Hub) BroadcastToRoom(r *room.Room, msgType string, data interface{}, excludeID string)
```

- `r == nil`：静默返回，无 panic
- `excludeID == ""`：所有房间玩家（含发送者）都收到
- `excludeID == c.Player.ID`：排除发送者

---

## 消息测试矩阵

| 发送类型 | 接收类型 | 需房间 | 发送者 | 其他 | 无房间 | 非法JSON |
|----------|----------|-------|-------|------|-------|---------|
| `join_room` | `room_joined`/`player_joined` | 否 | ✅ | ✅ | 正常 | 静默 |
| `leave_room` | `player_left` | 是 | ❌ | ✅ | 静默 | - |
| `move` | `player_moved` | 是 | ❌ | ✅ | 静默 | 静默 |
| `chat` | `chat` | 是 | ✅ | ✅ | 静默 | 静默 |
| `shoot` | `player_shot` | 是 | ❌ | ✅ | 静默 | 静默 |
| `reload` | `reload` | 否 | ✅ | ❌ | 正常 | - |
| `respawn` | `respawn`/`player_respawned` | 是 | ✅ | ✅ | 静默 | 静默 |
| `weapon_change` | `weapon_changed` | 是 | ✅ | ✅ | 静默 | 静默 |
| `voice_start` | `voice_start` | 是 | ❌ | ✅ | 静默 | - |
| `voice_stop` | `voice_stop` | 是 | ❌ | ✅ | 静默 | - |
| `voice_data` | `voice_data` | 是 | ❌ | ✅ | 静默 | - |
| `team_join` | `team_changed` | 是 | ✅ | ✅ | 静默 | 静默 |
| `grenade_throw` | `grenade_thrown` | 是 | ✅ | ✅ | 静默 | 静默 |
| `c4_plant` | `c4_planted` | 是 | ✅ | ✅ | 静默 | 静默 |
| `c4_defuse` | `c4_defused` | 是 | ✅ | ✅ | 静默 | - |
| `skill_use` | `skill_used`/`error` | 是 | ✅ | ✅ | 静默 | 静默 |
| `emote` | `emote` | 是 | ✅ | ✅ | 静默 | 静默 |
| `ping` | `ping` | 是 | ✅ | ✅ | 静默 | 静默 |

---

## 最小断言合同

| 消息 | 必验字段 | 说明 |
|------|----------|------|
| `room_joined` | `room_id`, `player_id` | room_id 非空 |
| `player_joined` | `player_id` | - |
| `player_left` | `player_id` | == 发送者ID |
| `player_moved` | `player_id`, `position` | - |
| `chat` | `player_id`, `message` | message 值验证 |
| `player_shot` | `player_id` | - |
| `reload` | `ammo`, `ammo_reserve` | - |
| `respawn` | `health`, `ammo` | 发送者收到 |
| `player_respawned` | `player_id`, `position` | 其他人收到 |
| `weapon_changed` | `player_id`, `weapon` | weapon 值验证 |
| `voice_start` | `player_id` | - |
| `voice_stop` | `player_id` | - |
| `voice_data` | `player_id`, `audio` | audio 嵌套结构 |
| `team_changed` | `player_id`, `team` | team 值验证 |
| `grenade_thrown` | `player_id`, `type`, `position` | - |
| `c4_planted` | `player_id`, `position` | - |
| `c4_defused` | `player_id` | - |
| `skill_used` | `player_id`, `skill_id` | skill_id 值验证 |
| `emote` | `player_id`, `emote_id` | emote_id 值验证 |
| `ping` | `player_id`, `type`, `position` | - |
| `error` | `message` | 特定文本 |

---

## 测试场景

### 1. 连接测试

#### TestWS_Connect
```
步骤：Connect(ts)
断言：playerID 非空
```

#### TestWS_Disconnect_InRoom
```
前置：A=CreateRoom, B=JoinRoom, Drain
步骤：CloseConn(A)
断言：B 收到 player_left，player_id == A.playerID
```

#### TestWS_UnknownType
```
前置：A=Connect (不加入房间)
步骤：Send("unknown", {})
断言：NoMessage
验证：Send("join_room", {"name":"test"}) → 收到 room_joined
```

#### TestWS_InvalidTopLevelJSON
```
前置：A=Connect (不加入房间)
步骤：Send raw '{"invalid'
断言：NoMessage
验证：连接存活
```

### 2. 房间测试

#### TestWS_JoinRoom_NewRoom
```
步骤：Send("join_room", {"name":"test"})
断言：收到 room_joined，room_id 非空
```

#### TestWS_JoinRoom_ExistingRoom
```
前置：A=CreateRoom, Drain(A)
步骤：B=JoinRoom(roomID)
断言：B 收到 room_joined，A 收到 player_joined
```

#### TestWS_JoinRoom_Full
```
前置：A=CreateRoom, FillRoom(9), Drain(A)
步骤：第 11 人 JoinRoom
断言：收到 error "Room is full"
```

#### TestWS_LeaveRoom
```
前置：A=CreateRoom, B=JoinRoom, Drain
步骤：A 发送 leave_room
断言：B 收到 player_left
```

### 3. 消息分发测试

完整表驱动，覆盖所有消息类型。

**reload 特殊处理**：单独测试，无需房间。

### 4. JSON 解析失败测试

表驱动覆盖所有接收 JSON data 的 handler：
`join_room`, `move`, `chat`, `shoot`, `respawn`, `weapon_change`, `team_join`, `grenade_throw`, `c4_plant`, `skill_use`, `emote`, `ping`

### 5. 异常测试

#### TestWS_SkillOnCooldown
```
前置：A=CreateRoom, Drain
步骤：连续两次 Send("skill_use", {"skill_id":"heal"})
断言：第一次 skill_used，第二次 error
```

#### TestWS_InvalidSkill
```
前置：A=CreateRoom, Drain
步骤：Send("skill_use", {"skill_id":"unknown"})
断言：收到 error（以 player.CanUseSkill 行为为准）
```

#### TestWS_Shoot_Cooldown
```
前置：A=CreateRoom, B=JoinRoom, Drain
步骤：A 连续发送 2 次 shoot（间隔 < 100ms）
断言：B 收到至少 1 次 player_shot
注意：cooldown 100ms，允许时间抖动，此为冒烟测试
```

#### TestWS_NoRoom_Operations
需要房间的消息列表，每个单独验证：
- 发送消息 → NoMessage
- 验证连接存活

### 6. 并发测试

#### TestConcurrent_Broadcast
```
前置：5 客户端加入房间，全部 Drain
步骤：每人发送 5 条 chat
断言：
  - 无 panic、无死锁
  - 总消息数 >= 100（理论 125）
  - 允许丢消息（发送通道满时 default drop）
  - 所有连接存活
```

---

## 不测范围

| 内容 | 原因 | 覆盖率影响 |
|------|------|-----------|
| `ServeWS` upgrade 失败 | 入口错误分支 | 小 |
| `pongWait`/`writeWait` 超时 | 需特殊客户端 | 小 |
| Ping 周期 | 60s 太长 | 小 |
| 时间精确匹配 | 允许抖动 | - |

**覆盖率可行性**：上述排除分支占比小，主要路径覆盖后可达 90%+。

---

## 成功标准

| 指标 | 目标 |
|------|------|
| 覆盖率 | server.go ≥ 90% |
| 测试通过 | 100% |
| 竞态检测 | 无 fail |

---

## 时间估计

| 任务 | 时间 |
|------|------|
| 修复代码 | 0.5h |
| 测试工具 | 0.5h |
| 测试编写 | 2h |
| 调试 | 1h |
| **总计** | **4h** |
