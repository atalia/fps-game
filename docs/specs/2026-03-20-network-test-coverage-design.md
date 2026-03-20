# 网络层测试覆盖率完善设计

## 目标

将 `server/internal/network` 包的测试覆盖率从 33.9% 提升到 90%+。

**范围**：仅 `server.go` 文件。

---

## 协议定义

### 输入校验约定

| 错误类型 | 行为 | 示例 |
|----------|------|------|
| 非法 JSON | 静默忽略 | `{"invalid` |
| 合法 JSON 但 schema 不匹配 | 静默忽略 | `{"type":"move","data":{}}` 缺少必要字段 |
| 业务前置条件不满足 | 静默忽略或返回 error | 未入房、技能冷却 |
| 未知消息类型 | 静默忽略 | `{"type":"unknown"}` |

### 房间容量

- 最大人数：10（常量 `MaxPlayersPerRoom`）
- 测试硬编码此值

### 消息协议

| 输入 | 输出事件 | 需房间 | 发送者 | 其他 | 非法JSON | 字段缺失 | 业务失败 |
|------|----------|-------|-------|------|---------|---------|---------|
| `join_room` | `room_joined` / `player_joined` | 否 | `room_joined` | `player_joined` | 忽略 | 忽略 | 房间满→error |
| `leave_room` | `player_left` | 是 | ❌ | ✅ | 忽略 | - | 未入房→忽略 |
| `move` | `player_moved` | 是 | ❌ | ✅ | 忽略 | 忽略 | 未入房→忽略 |
| `chat` | `chat` | 是 | ✅ | ✅ | 忽略 | 忽略 | 未入房→忽略 |
| `shoot` | `player_shot` | 是 | ❌ | ✅ | 忽略 | 忽略 | 未入房/不可射击→忽略 |
| `reload` | `reload` | 否 | ✅ | ❌ | 忽略 | - | - |
| `respawn` | `respawn` / `player_respawned` | 是 | `respawn` | `player_respawned` | 忽略 | 忽略 | 未入房→忽略 |
| `weapon_change` | `weapon_changed` | 是 | ✅ | ✅ | 忽略 | 忽略 | 未入房→忽略 |
| `voice_start` | `voice_start` | 是 | ❌ | ✅ | 忽略 | - | 未入房→忽略 |
| `voice_stop` | `voice_stop` | 是 | ❌ | ✅ | 忽略 | - | 未入房→忽略 |
| `voice_data` | `voice_data` | 是 | ❌ | ✅ | 忽略 | - | 未入房→忽略 |
| `team_join` | `team_changed` | 是 | ✅ | ✅ | 忽略 | 忽略 | 未入房→忽略 |
| `grenade_throw` | `grenade_thrown` | 是 | ✅ | ✅ | 忽略 | 忽略 | 未入房→忽略 |
| `c4_plant` | `c4_planted` | 是 | ✅ | ✅ | 忽略 | 忽略 | 未入房→忽略 |
| `c4_defuse` | `c4_defused` | 是 | ✅ | ✅ | 忽略 | - | 未入房/未种包→忽略 |
| `skill_use` | `skill_used` / `error` | 是 | ✅ | ✅ | 忽略 | 忽略 | 未入房→忽略，冷却→error |
| `emote` | `emote` | 是 | ✅ | ✅ | 忽略 | 忽略 | 未入房→忽略 |
| `ping` | `ping` | 是 | ✅ | ✅ | 忽略 | 忽略 | 未入房→忽略 |
| 未知类型 | - | - | ❌ | ❌ | 忽略 | - | - |

### 特殊消息详解

**reload**：
- 无需房间
- 发送者收到 `{"type":"reload","data":{"ammo":X,"ammo_reserve":Y}}`
- 这是 ACK 消息，不是心跳响应

**skill_use 冷却**：
- 首次成功：收到 `skill_used`
- 冷却中：收到 `{"type":"error","data":{"message":"Skill on cooldown"}}`
- 测试策略：连续发送两次，验证第二次收到 error

**shoot 不可射击**：
- 条件：`!c.Player.CanShoot()`（弹药耗尽或冷却中）
- 行为：静默忽略
- 测试策略：不验证具体次数，只验证无崩溃

**ping**：
- 房间内广播消息，用于标记位置
- 不是心跳响应

---

## 前置修复

| 函数 | 修复 |
|------|------|
| `handleWeaponChange` | 添加 `c.Room == nil` 检查 |
| `handleRespawn` | 添加 `c.Room == nil` 检查 |

---

## 测试工具设计

### TestServer

```go
// NewTestServer 创建独立测试服务器
// 契约：Hub 独立，httptest.Server 独立
func NewTestServer(t *testing.T) *TestServer

// Close 关闭服务器
// 契约：关闭 httptest.Server，Hub goroutine 常驻
// 隔离策略：每个测试独立 TestServer，不复用
func (s *TestServer) Close()
```

### Helper 函数

```go
// Connect 连接，读取 welcome，返回 conn, playerID
func Connect(t *testing.T, ts *TestServer) (*websocket.Conn, string)

// CreateRoom 创建房间，返回 conn, playerID, roomID
func CreateRoom(t *testing.T, ts *TestServer) (*websocket.Conn, string, string)

// JoinRoom 加入已存在房间
func JoinRoom(t *testing.T, ts *TestServer, roomID string) (*websocket.Conn, string)

// FillRoom 填满房间（不含创建者）
// count + 创建者 = 总人数，上限 10
func FillRoom(t *testing.T, ts *TestServer, roomID string, count int) []*websocket.Conn

// Drain 清空待处理消息
func Drain(t *testing.T, conn *websocket.Conn)

// CloseConn 关闭连接
func CloseConn(t *testing.T, conn *websocket.Conn)

// Send 发送消息
func Send(t *testing.T, conn *websocket.Conn, msgType string, data interface{})

// RecvType 接收并验证类型
func RecvType(t *testing.T, conn *websocket.Conn, wantType string) *Message

// RecvAll 接收所有消息（处理批量写入）
func RecvAll(t *testing.T, conn *websocket.Conn, timeout time.Duration) []*Message

// NoMessage 验证超时内无消息
func NoMessage(t *testing.T, conn *websocket.Conn, timeout time.Duration)

// CountType 统计消息类型数量
func CountType(msgs []*Message, msgType string) int
```

---

## 必测分支清单

### readPump

| 分支 | 测试 | 断言 |
|------|------|------|
| 正常读取 | 发送 chat | 收到 chat |
| JSON 解析失败 | 非法 JSON | 无消息，连接存活 |
| 未知类型 | unknown | 无消息，连接存活 |
| 连接关闭 | 客户端断开 | - |
| 房间内断开 | A,B 房间，A 断开 | B 收到 player_left |

### writePump

| 分支 | 测试 | 断言 |
|------|------|------|
| 正常写入 | 广播 | 收到消息 |
| 批量写入 | 快速发送多条 | 每条独立 JSON |
| Ping 周期 | 等待 | 连接存活 |
| Send 关闭 | 断开连接 | writePump 退出（无崩溃） |

### Hub.Run

| 分支 | 测试 | 断言 |
|------|------|------|
| register | 连接 | playerID 非空 |
| unregister | 断开 | 其他收到 player_left |
| 并发 | 多连接 | 无 race |

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
前置：A=CreateRoom, B=JoinRoom, Drain
步骤：CloseConn(A)
断言：B 收到 player_left
```

#### TestWS_UnknownType
```
前置：A=Connect
步骤：Send("unknown", {})
断言：NoMessage，连接存活（能 join_room）
```

### 2. 房间

#### TestWS_JoinRoom_Full
```
前置：A=CreateRoom, FillRoom(9), Drain(A)
步骤：第 11 人 JoinRoom
断言：收到 error "Room is full"
```

### 3. 消息分发

完整表驱动测试，覆盖所有消息类型（见协议表）。

### 4. 异常分支

#### TestWS_InvalidJSON
```
前置：A=CreateRoom, Drain
步骤：Send raw '{"invalid'
断言：NoMessage，连接存活
```

#### TestWS_FieldMissing
```
前置：A=CreateRoom, Drain
步骤：Send("move", {})  // 缺少必要字段
断言：NoMessage，连接存活
```

#### TestWS_SkillOnCooldown
```
前置：A=CreateRoom, Drain
步骤：
  1. Send("skill_use", {"skill_id":"dash"})
  2. 立即再次 Send
断言：
  - 第一次收到 skill_used
  - 第二次收到 error "Skill on cooldown"
```

#### TestWS_NoRoom_Operations
```go
needRoom := []struct {
    msgType string
    data    interface{}
}{
    {"move", map[string]interface{}{"x":1,"y":2,"z":3,"rotation":0}},
    {"chat", map[string]string{"message":"test"}},
    // ... 所有需要房间的消息
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
前置：5 客户端加入房间，Drain
步骤：每人发送 5 条 chat
断言：
  - 无 panic、无死锁
  - 每连接收到消息数 >= 10（理论 25，允许丢弃）
  - 所有连接存活
```

---

## 不测范围

| 内容 | 原因 |
|------|------|
| `pongWait` 超时 | 需禁用客户端 pong |
| `writeWait` 超时 | 需慢客户端 |
| 日志输出 | 非功能 |
| 时间戳值 | 非确定 |

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
