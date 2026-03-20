# 网络层测试覆盖率完善设计

## 目标

将 `server/internal/network/server.go` 的测试覆盖率从 33.9% 提升到 90%+。

**覆盖率度量**：`go test -coverprofile=cover.out ./server/internal/network/`

---

## 前置修复（阻塞条件）

**必须先完成以下修复才能开始测试：**

| 函数 | 问题 | 修复 |
|------|------|------|
| `handleRespawn` | `c.Room == nil` 时 panic | 添加 `if c.Room == nil { return }` |
| `handleWeaponChange` | 同上 | 添加 `if c.Room == nil { return }` |

未修复前：`TestWS_NoRoom_Operations` 会 panic，无法执行。

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
func (s *TestServer) Close()
```

**隔离策略**：每个测试独立 TestServer，禁止并行测试（`t.Parallel()`）。

### Helper 函数

```go
// Connect 连接，消费 welcome，返回 (conn, playerID)
func Connect(t *testing.T, ts *TestServer) (*websocket.Conn, string)

// CreateRoom 创建房间，消费 welcome+room_joined，返回 (conn, playerID, roomID)
func CreateRoom(t *testing.T, ts *TestServer) (*websocket.Conn, string, string)

// JoinRoom 加入房间，消费 welcome+room_joined，返回 (conn, playerID)
func JoinRoom(t *testing.T, ts *TestServer, roomID string) (*websocket.Conn, string)

// FillRoom 填满房间，返回 []conn（count + 创建者 <= 10）
func FillRoom(t *testing.T, ts *TestServer, roomID string, count int) []*websocket.Conn

// Drain 清空消息（500ms 无新消息）
func Drain(t *testing.T, conn *websocket.Conn)

// CloseConn 关闭连接
func CloseConn(t *testing.T, conn *websocket.Conn)

// Send 发送消息
func Send(t *testing.T, conn *websocket.Conn, msgType string, data interface{})

// RecvType 接收并验证类型
func RecvType(t *testing.T, conn *websocket.Conn, wantType string) *Message

// RecvAll 接收所有消息（按换行分隔解析多条 JSON）
// 返回解析后的消息列表（按条数统计，非 frame 数）
func RecvAll(t *testing.T, conn *websocket.Conn) []*Message

// NoMessage 验证 500ms 内无消息
func NoMessage(t *testing.T, conn *websocket.Conn)

// CountType 统计消息类型数量
func CountType(msgs []*Message, msgType string) int
```

---

## 消息测试矩阵

| 输入 | 需房间 | 发送者 | 其他 | 测试数据 | 断言字段 |
|------|-------|-------|------|----------|----------|
| `join_room` | 否 | `room_joined` | `player_joined` | `{"name":"test"}` | `room_id` |
| `leave_room` | 是 | ❌ | `player_left` | `{}` | `player_id` |
| `move` | 是 | ❌ | `player_moved` | `{"x":1,"y":2,"z":3,"rotation":0}` | `position` |
| `chat` | 是 | ✅ | ✅ | `{"message":"hello"}` | `message` |
| `shoot` | 是 | ❌ | `player_shot` | `{"position":{"x":0,"y":0,"z":0},"rotation":0}` | `player_id` |
| `shoot_cant` | 是 | ❌ | ❌ | 连续发送耗尽弹药 | 无消息 |
| `reload` | 否 | `reload` | ❌ | `{}` | `ammo` |
| `respawn` | 是 | `respawn` | `player_respawned` | `{"x":0,"y":0,"z":0}` | `health` |
| `weapon_change` | 是 | ✅ | ✅ | `{"weapon":"rifle"}` | `weapon` |
| `voice_start` | 是 | ❌ | ✅ | `{}` | `player_id` |
| `voice_stop` | 是 | ❌ | ✅ | `{}` | `player_id` |
| `voice_data` | 是 | ❌ | ✅ | `{"audio":"base64data"}` | `audio` |
| `team_join` | 是 | ✅ | ✅ | `{"team":"red"}` | `team` |
| `grenade_throw` | 是 | ✅ | ✅ | `{"type":"frag","position":{"x":0,"y":0,"z":0},"velocity":{"x":0,"y":0,"z":0}}` | `type` |
| `c4_plant` | 是 | ✅ | ✅ | `{"position":{"x":0,"y":0,"z":0}}` | `position` |
| `c4_defuse` | 是 | ✅ | ✅ | `{}` | `player_id` |
| `skill_use` | 是 | ✅ | ✅ | `{"skill_id":"heal"}` | `skill_id` |
| `skill_invalid` | 是 | ❌ | ❌ | `{"skill_id":"unknown"}` | 无消息 |
| `emote` | 是 | ✅ | ✅ | `{"emote_id":"wave"}` | `emote_id` |
| `ping` | 是 | ✅ | ✅ | `{"type":"enemy","x":0,"y":0,"z":0,"message":""}` | `type` |

**注意**：`ping` 使用顶层 `x/y/z`，不是嵌套 `position`。

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
断言：B 收到 player_left
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

#### TestWS_JoinRoom_Full
```
前置：A=CreateRoom, FillRoom(9), Drain
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

完整表驱动，覆盖所有消息类型（见矩阵）。

### 4. 异常分支测试

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
断言：NoMessage
```

#### TestWS_Shoot_CannotShoot
```
前置：A=CreateRoom, B=JoinRoom, Drain
步骤：A 连续发送 100 次 shoot
断言：前几次 B 收到 player_shot，后续静默（弹药耗尽）
```

#### TestWS_NoRoom_Operations
需要房间的消息：`leave_room`, `move`, `chat`, `shoot`, `respawn`, `weapon_change`, `voice_start`, `voice_stop`, `voice_data`, `team_join`, `grenade_throw`, `c4_plant`, `c4_defuse`, `skill_use`, `emote`, `ping`

```
for each msgType:
    A = Connect(ts)  // 不加入房间
    Drain(A)
    Send(A, msgType, validData)
    NoMessage(A)
    
    // 验证连接存活
    Send(A, "join_room", {"name":"test"})
    RecvType(A, "room_joined")
    CloseConn(A)
```

### 5. 并发测试

#### TestConcurrent_Broadcast
```
前置：5 客户端加入房间，全部 Drain
步骤：每人发送 5 条 chat
断言：
  - 无 panic、无死锁
  - 总消息数 >= 100（理论 125，按消息条数统计）
  - 所有连接存活
```

---

## 不测范围

| 内容 | 原因 |
|------|------|
| `ServeWS` upgrade 失败 | 非 websocket 层职责 |
| `pongWait`/`writeWait` 超时 | 需特殊客户端 |
| Ping 周期 | 60s 太长 |
| `room.Manager` maxRooms 耗尽 | 非 network 职责 |
| `player.Player` 内部状态 | 依赖跨层契约 |

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
