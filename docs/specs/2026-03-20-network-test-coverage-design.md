# 网络层测试覆盖率完善设计

## 目标

将 `server/internal/network/server.go` 的测试覆盖率从 33.9% 提升到 90%+。

**覆盖率度量**：`go test -coverprofile=cover.out ./server/internal/network/`，统计 `server.go` 的覆盖率。

**范围决策**：
- ✅ `ServeWS`：覆盖（HTTP upgrade 成功路径）
- ✅ `HandleConnection`：覆盖
- ✅ `readPump`：覆盖主要路径
- ✅ `writePump`：覆盖主要路径
- ✅ `handleMessage` 及所有 `handle*`：覆盖
- ❌ `ServeWS` upgrade 失败：不测（需模拟 HTTP 错误）
- ❌ `room.Manager` maxRooms 耗尽：不测（非网络层职责）

---

## 前置修复（必须先完成）

在测试前需修复以下代码问题：

| 函数 | 问题 | 修复 |
|------|------|------|
| `handleRespawn` | `c.Room == nil` 时调用 `BroadcastToRoom(nil, ...)` 会 panic | 添加 `if c.Room == nil { return }` |
| `handleWeaponChange` | 同上 | 添加 `if c.Room == nil { return }` |

---

## 当前代码行为

### 输入校验

| 错误类型 | 行为 |
|----------|------|
| 非法 JSON | `json.Unmarshal` 失败 → return |
| 字段缺失 | Go 零值填充 |
| 未知消息类型 | 无匹配 → return |

### 房间容量

- 来源：`room.Manager.defaultSize`
- 默认值：10

### 技能列表

有效：`heal`, `speed`, `shield`, `teleport`, `scan`, `drone`, `smoke`, `flash`
无效：静默忽略

---

## 消息测试矩阵

| 输入 | 需房间 | 发送者收到 | 其他收到 | 测试数据 | 断言字段 |
|------|-------|-----------|---------|----------|----------|
| `join_room` | 否 | `room_joined` | `player_joined` | `{"name":"test"}` | `room_id`, `player_id` |
| `leave_room` | 是 | ❌ | `player_left` | `{}` | `player_id` |
| `move` | 是 | ❌ | `player_moved` | `{"x":1,"y":2,"z":3,"rotation":0}` | `position`, `rotation` |
| `chat` | 是 | ✅ | ✅ | `{"message":"hello"}` | `message`, `player_id` |
| `shoot` | 是 | ❌ | `player_shot` | `{"position":{"x":0,"y":0,"z":0},"rotation":0}` | `position`, `ammo` |
| `reload` | 否 | `reload` | ❌ | `{}` | `ammo`, `ammo_reserve` |
| `respawn` | 是 | `respawn` | `player_respawned` | `{"x":0,"y":0,"z":0}` | `position`, `health` |
| `weapon_change` | 是 | ✅ | ✅ | `{"weapon":"rifle"}` | `weapon`, `player_id` |
| `voice_start` | 是 | ❌ | ✅ | `{}` | `player_id` |
| `voice_stop` | 是 | ❌ | ✅ | `{}` | `player_id` |
| `voice_data` | 是 | ❌ | ✅ | `{}` | `player_id`, `audio` |
| `team_join` | 是 | ✅ | ✅ | `{"team":"red"}` | `team`, `player_id` |
| `grenade_throw` | 是 | ✅ | ✅ | `{"type":"frag","position":{"x":0,"y":0,"z":0},"velocity":{"x":0,"y":0,"z":0}}` | `type`, `position` |
| `c4_plant` | 是 | ✅ | ✅ | `{"position":{"x":0,"y":0,"z":0}}` | `position`, `player_id` |
| `c4_defuse` | 是 | ✅ | ✅ | `{}` | `player_id` |
| `skill_use` | 是 | ✅ | ✅ | `{"skill_id":"heal"}` | `skill_id`, `player_id` |
| `emote` | 是 | ✅ | ✅ | `{"emote_id":"wave"}` | `emote_id`, `player_id` |
| `ping` | 是 | ✅ | ✅ | `{"position":{"x":0,"y":0,"z":0},"type":"enemy"}` | `position`, `type` |

---

## 测试工具设计

### TestServer

```go
// NewTestServer 创建独立测试服务器
func NewTestServer(t *testing.T) *TestServer

// Close 关闭服务器（Hub goroutine 常驻）
func (s *TestServer) Close()
```

### Helper 函数

```go
const (
    defaultTimeout = 2 * time.Second
    drainTimeout   = 500 * time.Millisecond
)

// Connect 连接，已消费 welcome
func Connect(t *testing.T, ts *TestServer) (*websocket.Conn, string)

// CreateRoom 创建房间，已消费 welcome + room_joined
func CreateRoom(t *testing.T, ts *TestServer) (*websocket.Conn, string, string)

// JoinRoom 加入房间，已消费 welcome + room_joined
func JoinRoom(t *testing.T, ts *TestServer, roomID string) (*websocket.Conn, string)

// FillRoom 填满房间（count + 创建者 <= 10）
func FillRoom(t *testing.T, ts *TestServer, roomID string, count int) []*websocket.Conn

// Drain 清空消息，等待 drainTimeout 无新消息
func Drain(t *testing.T, conn *websocket.Conn)

// CloseConn 关闭连接
func CloseConn(t *testing.T, conn *websocket.Conn)

// Send 发送消息
func Send(t *testing.T, conn *websocket.Conn, msgType string, data interface{})

// RecvType 接收并验证类型
func RecvType(t *testing.T, conn *websocket.Conn, wantType string) *Message

// RecvAll 接收所有消息，直到 defaultTimeout 无新消息
// 处理换行分隔的多条 JSON
func RecvAll(t *testing.T, conn *websocket.Conn) []*Message

// NoMessage 验证 drainTimeout 内无消息
func NoMessage(t *testing.T, conn *websocket.Conn)

// CountType 统计消息类型数量
func CountType(msgs []*Message, msgType string) int
```

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
前置：A=CreateRoom, B=JoinRoom, Drain(A), Drain(B)
步骤：CloseConn(A)
断言：B 收到 player_left，player_id == A.playerID
```

#### TestWS_UnknownType
```
前置：A=CreateRoom, Drain(A)
步骤：Send("unknown", {})
断言：NoMessage，连接存活（能 join_room）
```

### 2. 房间测试

#### TestWS_JoinRoom_Full
```
前置：A=CreateRoom, FillRoom(9), Drain(A)
步骤：第 11 人 JoinRoom
断言：收到 error "Room is full"
```

#### TestWS_LeaveRoom
```
前置：A=CreateRoom, B=JoinRoom, Drain(A), Drain(B)
步骤：A 发送 leave_room
断言：B 收到 player_left
```

### 3. 消息分发测试

完整表驱动测试，覆盖消息矩阵中所有消息类型。

### 4. 异常测试

#### TestWS_InvalidJSON
```
前置：A=CreateRoom, Drain(A)
步骤：Send raw '{"invalid'
断言：NoMessage，连接存活
```

#### TestWS_SkillOnCooldown
```
前置：A=CreateRoom, Drain(A)
步骤：
  1. Send("skill_use", {"skill_id":"heal"})
  2. RecvType("skill_used")
  3. Send("skill_use", {"skill_id":"heal"})
断言：收到 error "Skill on cooldown"
```

#### TestWS_InvalidSkill
```
前置：A=CreateRoom, Drain(A)
步骤：Send("skill_use", {"skill_id":"invalid"})
断言：NoMessage
```

#### TestWS_NoRoom_Operations
需要房间的消息列表：
```go
needRoom := []string{
    "leave_room", "move", "chat", "shoot",
    "respawn", "weapon_change",
    "voice_start", "voice_stop", "voice_data",
    "team_join", "grenade_throw", "c4_plant", "c4_defuse",
    "skill_use", "emote", "ping",
}
```

测试逻辑：
```
for each msgType in needRoom:
    A = Connect(ts)
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
  - 总消息数 >= 100（理论 125）
  - 所有连接存活
```

---

## 不测范围

| 内容 | 原因 |
|------|------|
| `ServeWS` upgrade 失败 | 需模拟 HTTP 错误 |
| `pongWait`/`writeWait` 超时 | 需特殊客户端 |
| Ping 周期 | 60s 太长 |
| `room.Manager` maxRooms 耗尽 | 非 network 职责 |
| 日志输出 | 非功能 |

---

## 实施步骤

1. **修复代码**：添加 nil Room 检查
2. **测试工具**：TestServer, Helper
3. **连接测试**
4. **房间测试**
5. **消息分发测试**
6. **异常测试**
7. **并发测试**
8. **覆盖率验证**

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
