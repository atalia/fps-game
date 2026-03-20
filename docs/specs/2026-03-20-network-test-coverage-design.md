# 网络层测试覆盖率完善设计

## 目标

将 `server/internal/network` 包的测试覆盖率从 33.9% 提升到 90%+。

**范围**：仅 `server.go` 文件。

---

## 当前代码行为（测试基准）

### 房间容量

- 来源：`room.Manager.defaultSize`
- 默认值：10
- 测试：使用 `room.NewManager(10, 10)` 创建

### 输入校验

| 错误类型 | 行为 |
|----------|------|
| 非法 JSON | `json.Unmarshal` 失败 → 静默 return |
| 字段缺失 | Go 零值填充（数值=0，字符串=""） |
| 未知消息类型 | `handleMessage` 无匹配 → 静默 return |

### 消息协议（当前实现）

| 输入 | 输出 | 需房间 | 发送者 | 其他 | 备注 |
|------|------|-------|-------|------|------|
| `join_room` | `room_joined` / `player_joined` | 否 | ✅ | ✅ | 房间满→error |
| `leave_room` | `player_left` | 是 | ❌ | ✅ | |
| `move` | `player_moved` | 是 | ❌ | ✅ | |
| `chat` | `chat` | 是 | ✅ | ✅ | |
| `shoot` | `player_shot` | 是 | ❌ | ✅ | 不可射击→忽略 |
| `reload` | `reload` | 否 | ✅ | ❌ | |
| `respawn` | `respawn` / `player_respawned` | **是** | ✅ | ✅ | **未入房会 panic** |
| `weapon_change` | `weapon_changed` | **是** | ✅ | ✅ | **未入房会 panic** |
| `voice_start` | `voice_start` | 是 | ❌ | ✅ | |
| `voice_stop` | `voice_stop` | 是 | ❌ | ✅ | |
| `voice_data` | `voice_data` | 是 | ❌ | ✅ | |
| `team_join` | `team_changed` | 是 | ✅ | ✅ | |
| `grenade_throw` | `grenade_thrown` | 是 | ✅ | ✅ | |
| `c4_plant` | `c4_planted` | 是 | ✅ | ✅ | |
| `c4_defuse` | `c4_defused` | 是 | ✅ | ✅ | |
| `skill_use` | `skill_used` / `error` | 是 | ✅ | ✅ | 冷却→error |
| `emote` | `emote` | 是 | ✅ | ✅ | |
| `ping` | `ping` | 是 | ✅ | ✅ | |

### 技能列表

有效技能 ID：`heal`, `speed`, `shield`, `teleport`, `scan`, `drone`, `smoke`, `flash`

无效技能：`CanUseSkill` 返回 false → `handleSkillUse` 静默 return

---

## 代码修复（测试前置）

| 函数 | 问题 | 修复 |
|------|------|------|
| `handleRespawn` | 未入房调用 `BroadcastToRoom(nil, ...)` 会 panic | 添加 `c.Room == nil` 检查 |
| `handleWeaponChange` | 同上 | 添加 `c.Room == nil` 检查 |

修复后行为：未入房时静默 return（不发送任何消息）。

---

## 测试工具设计

### TestServer

```go
// NewTestServer 创建测试服务器
func NewTestServer(t *testing.T) *TestServer

// Close 关闭服务器（Hub goroutine 常驻）
func (s *TestServer) Close()
```

### Helper 函数

```go
// Connect 连接，已消费 welcome，返回 conn, playerID
func Connect(t *testing.T, ts *TestServer) (*websocket.Conn, string)

// CreateRoom 创建房间，已消费 welcome + room_joined，返回 conn, playerID, roomID
func CreateRoom(t *testing.T, ts *TestServer) (*websocket.Conn, string, string)

// JoinRoom 加入房间，已消费 welcome + room_joined
func JoinRoom(t *testing.T, ts *TestServer, roomID string) (*websocket.Conn, string)

// FillRoom 填满房间（不含创建者），count + 创建者 <= 10
func FillRoom(t *testing.T, ts *TestServer, roomID string, count int) []*websocket.Conn

// Drain 清空待处理消息（用于清空异步广播）
func Drain(t *testing.T, conn *websocket.Conn)

// CloseConn 关闭连接
func CloseConn(t *testing.T, conn *websocket.Conn)

// Send 发送消息
func Send(t *testing.T, conn *websocket.Conn, msgType string, data interface{})

// RecvType 接收并验证类型
func RecvType(t *testing.T, conn *websocket.Conn, wantType string) *Message

// RecvAll 接收所有消息（处理换行分隔的多条 JSON）
func RecvAll(t *testing.T, conn *websocket.Conn, timeout time.Duration) []*Message

// NoMessage 验证超时内无消息
func NoMessage(t *testing.T, conn *websocket.Conn, timeout time.Duration)

// CountType 统计消息类型数量
func CountType(msgs []*Message, msgType string) int
```

---

## 测试场景

### 1. 连接

#### TestWS_Connect
```
步骤：Connect(ts)
断言：playerID 非空
```

#### TestWS_Disconnect_InRoom
```
前置：A=CreateRoom, B=JoinRoom, Drain(A), Drain(B)
步骤：CloseConn(A)
断言：B 收到 player_left
```

#### TestWS_UnknownType
```
前置：A=CreateRoom, Drain(A)
步骤：Send("unknown", {})
断言：NoMessage，连接存活
```

### 2. 房间

#### TestWS_JoinRoom_Full
```
前置：A=CreateRoom, FillRoom(9), Drain(A)
步骤：第 11 人 JoinRoom
断言：收到 error "Room is full"
```

### 3. 消息分发

表驱动测试，覆盖所有消息类型。

测试数据使用合法值：
- `move`: `{"x":1,"y":2,"z":3,"rotation":0}`
- `chat`: `{"message":"hello"}`
- `skill_use`: `{"skill_id":"heal"}`（有效技能）
- 其他类似

### 4. 异常分支

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
  3. 立即再次 Send
断言：收到 error "Skill on cooldown"
```

#### TestWS_InvalidSkill
```
前置：A=CreateRoom, Drain(A)
步骤：Send("skill_use", {"skill_id":"invalid"})
断言：NoMessage（无效技能静默忽略）
```

#### TestWS_NoRoom_Operations
```go
needRoom := []struct {
    msgType string
    data    interface{}
}{
    {"move", map[string]interface{}{"x":1,"y":2,"z":3,"rotation":0}},
    {"chat", map[string]string{"message":"test"}},
    {"shoot", map[string]interface{}{"position":{"x":0,"y":0,"z":0},"rotation":0}},
    {"respawn", map[string]float64{"x":0,"y":0,"z":0}},
    {"weapon_change", map[string]string{"weapon":"rifle"}},
    // ... 其他需要房间的消息
}

for _, tc := range needRoom {
    A = Connect(ts)
    Drain(A)
    Send(A, tc.msgType, tc.data)
    NoMessage(A, 500ms)
    
    // 验证连接存活
    Send(A, "join_room", {"name":"test"})
    RecvType(A, "room_joined")
    CloseConn(A)
}
```

### 5. 并发

#### TestConcurrent_Broadcast
```
前置：5 客户端加入房间，全部 Drain
步骤：每人发送 5 条 chat
断言：
  - 无 panic、无死锁
  - 总消息数 >= 25（理论 125，允许丢弃）
  - 所有连接存活
```

---

## 不测范围

| 内容 | 原因 |
|------|------|
| `pongWait` 超时 | 需禁用客户端 pong |
| `writeWait` 超时 | 需慢客户端 |
| Ping 周期 | 60s 太长 |
| 日志输出 | 非功能 |

---

## 成功标准

| 指标 | 目标 |
|------|------|
| 覆盖率 | ≥ 90% |
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
