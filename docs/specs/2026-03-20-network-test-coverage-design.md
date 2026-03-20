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

## 前置修复（阻塞条件）

以下 handler 缺少 `c.Room == nil` 检查，会导致 panic：

| 函数 | 修复 |
|------|------|
| `handleRespawn` (line 472) | 添加 `if c.Room == nil { return }` |
| `handleWeaponChange` (line 493) | 添加 `if c.Room == nil { return }` |

其他 handler 已有 nil 检查：`handleMove`, `handleChat`, `handleShoot`, `handleVoiceStart/Stop/Data`, `handleTeamJoin`, `handleGrenadeThrow`, `handleC4Plant/Defuse`, `handleSkillUse`, `handleEmote`, `handlePing`。

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
// 每个测试独立创建，不复用
func NewTestServer(t *testing.T) *TestServer

// Close 关闭服务器
// Hub goroutine 常驻，测试进程退出时清理
// 接受 goroutine 泄漏（Hub 无 stop 机制）
func (s *TestServer) Close()
```

**隔离策略**：每个测试独立 TestServer，禁止并行测试。

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

// RecvAll 接收所有消息（按换行分隔解析）
func RecvAll(t *testing.T, conn *websocket.Conn) []*Message

// NoMessage 验证 500ms 内无消息
func NoMessage(t *testing.T, conn *websocket.Conn)

// CountType 统计消息类型数量
func CountType(msgs []*Message, msgType string) int
```

---

## 消息测试矩阵

| 发送类型 | 接收类型 | 需房间 | 发送者 | 其他 | 测试数据 | 无房间 | 非法data |
|----------|----------|-------|-------|------|----------|-------|---------|
| `join_room` | `room_joined`/`player_joined` | 否 | ✅ | ✅ | `{"name":"test"}` | 正常 | 静默 |
| `leave_room` | `player_left` | 是 | ❌ | ✅ | `{}` | 静默 | - |
| `move` | `player_moved` | 是 | ❌ | ✅ | `{"x":1,"y":2,"z":3,"rotation":0}` | 静默 | 静默 |
| `chat` | `chat` | 是 | ✅ | ✅ | `{"message":"hello"}` | 静默 | 静默 |
| `shoot` | `player_shot` | 是 | ❌ | ✅ | `{"position":{"x":0,"y":0,"z":0},"rotation":0}` | 静默 | 静默 |
| `reload` | `reload` | 否 | ✅ | ❌ | `{}` | 正常 | - |
| `respawn` | `respawn`/`player_respawned` | 是 | ✅ | ✅ | `{"x":0,"y":0,"z":0}` | **需修复** | 静默 |
| `weapon_change` | `weapon_changed` | 是 | ✅ | ✅ | `{"weapon":"rifle"}` | **需修复** | 静默 |
| `voice_start` | `voice_start` | 是 | ❌ | ✅ | `{}` | 静默 | - |
| `voice_stop` | `voice_stop` | 是 | ❌ | ✅ | `{}` | 静默 | - |
| `voice_data` | `voice_data` | 是 | ❌ | ✅ | `{"audio":"base64"}` | 静默 | - |
| `team_join` | `team_changed` | 是 | ✅ | ✅ | `{"team":"red"}` | 静默 | 静默 |
| `grenade_throw` | `grenade_thrown` | 是 | ✅ | ✅ | `{"type":"frag","position":{"x":0,"y":0,"z":0},"velocity":{"x":0,"y":0,"z":0}}` | 静默 | 静默 |
| `c4_plant` | `c4_planted` | 是 | ✅ | ✅ | `{"position":{"x":0,"y":0,"z":0}}` | 静默 | 静默 |
| `c4_defuse` | `c4_defused` | 是 | ✅ | ✅ | `{}` | 静默 | - |
| `skill_use` | `skill_used` | 是 | ✅ | ✅ | `{"skill_id":"heal"}` | 静默 | 静默 |
| `emote` | `emote` | 是 | ✅ | ✅ | `{"emote_id":"wave"}` | 静默 | 静默 |
| `ping` | `ping` | 是 | ✅ | ✅ | `{"type":"enemy","x":0,"y":0,"z":0,"message":""}` | 静默 | 静默 |

**说明**：
- 发送者 ✅ = 发送者收到广播
- 发送者 ❌ = 发送者不收到（excludeID 排除）
- `voice_data` 的 `audio` 字段：代码会将原始 data 直接塞入 `audio`，所以发送 `{"audio":"base64"}` 会收到 `{"audio":{"audio":"base64"}}`（嵌套）

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

#### TestWS_InvalidJSON
```
前置：A=Connect (不加入房间)
步骤：Send raw '{"invalid'
断言：NoMessage
验证：Send("join_room", {"name":"test"}) → 收到 room_joined
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

完整表驱动，每条消息验证：
- 接收类型正确
- 发送者/其他人接收符合预期
- 必要字段存在

### 4. JSON 解析失败测试（表驱动）

```go
handlers := []string{
    "join_room", "move", "chat", "shoot", "respawn", "weapon_change",
    "team_join", "grenade_throw", "c4_plant", "skill_use", "emote", "ping",
}

for _, msgType := range handlers {
    A = CreateRoom(ts)
    Drain(A)
    Send(A, msgType, json.RawMessage(`{invalid`))
    NoMessage(A)
    // 验证连接存活
}
```

### 5. 异常测试

#### TestWS_SkillOnCooldown
```
前置：A=CreateRoom, Drain
步骤：
  1. Send("skill_use", {"skill_id":"heal"})
  2. RecvType("skill_used")
  3. 立即再次 Send("skill_use", {"skill_id":"heal"})
断言：第二次收到 error "Skill on cooldown"
```

#### TestWS_InvalidSkill
```
前置：A=CreateRoom, Drain
步骤：Send("skill_use", {"skill_id":"unknown"})
断言：NoMessage（无效技能静默忽略）
```

#### TestWS_Shoot_Cooldown
```
前置：A=CreateRoom, B=JoinRoom, Drain
步骤：A 快速连续发送 5 次 shoot
断言：B 收到至少 1 次 player_shot（cooldown 限制后续）
```

#### TestWS_NoRoom_Operations
需要房间的消息：`leave_room`, `move`, `chat`, `shoot`, `respawn`, `weapon_change`, `voice_start`, `voice_stop`, `voice_data`, `team_join`, `grenade_throw`, `c4_plant`, `c4_defuse`, `skill_use`, `emote`, `ping`

```
for each msgType:
    A = Connect(ts)
    Drain(A)
    Send(A, msgType, validData)
    NoMessage(A)
    // 验证连接存活
    Send(A, "join_room", {"name":"test"})
    RecvType(A, "room_joined")
    CloseConn(A)
```

### 6. 并发测试

#### TestConcurrent_Broadcast
```
前置：5 客户端加入房间，全部 Drain
步骤：每人发送 5 条 chat
断言：
  - 无 panic、无死锁
  - 总消息数 >= 100（理论 125，chat 含发送者）
  - 所有连接存活
```

---

## 不测范围

| 内容 | 原因 |
|------|------|
| `ServeWS` upgrade 失败 | 入口错误分支，覆盖率通过 handler 分支达成 |
| `pongWait`/`writeWait` 超时 | 需特殊客户端 |
| Ping 周期 | 60s 太长 |
| `room.Manager` maxRooms 耗尽 | 非 network 职责 |
| `player.Player` 内部状态 | 跨层契约 |

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
