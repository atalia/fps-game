# 网络层测试覆盖率完善设计

## 目标

将 `server/internal/network` 包的测试覆盖率从 33.9% 提升到 90%+。

**范围**：仅 `server.go` 文件（包内无其他源文件）。

---

## 前置修复

以下问题需在测试前修复：

| 函数 | 问题 | 修复 |
|------|------|------|
| `handleWeaponChange` | 无 `c.Room == nil` 检查 | 添加检查，未入房直接 return |
| `handleRespawn` | 无 `c.Room == nil` 检查 | 添加检查，未入房直接 return |

---

## 协议真相表（目标行为）

### 统一规则

- 需要房间的消息 + 未入房 = **静默忽略**（不返回错误、不崩溃）
- `reload` 无需房间，直接返回

### 消息协议

| 输入 | 输出事件 | 需房间 | 发送者收到 | 其他收到 | 非法JSON | 其他前置 |
|------|----------|-------|-----------|---------|---------|---------|
| `join_room` | `room_joined` / `player_joined` | 否 | `room_joined` | `player_joined` | 忽略 | 房间满返回 error |
| `leave_room` | `player_left` | 是 | ❌ | ✅ | 忽略 | - |
| `move` | `player_moved` | 是 | ❌ | ✅ | 忽略 | - |
| `chat` | `chat` | 是 | ✅ | ✅ | 忽略 | - |
| `shoot` | `player_shot` | 是 | ❌ | ✅ | 忽略 | 不可射击时忽略 |
| `reload` | `reload` | **否** | ✅ | ❌ | 忽略 | - |
| `respawn` | `respawn` / `player_respawned` | 是 | `respawn` | `player_respawned` | 忽略 | - |
| `weapon_change` | `weapon_changed` | 是 | ✅ | ✅ | 忽略 | - |
| `voice_start` | `voice_start` | 是 | ❌ | ✅ | - | - |
| `voice_stop` | `voice_stop` | 是 | ❌ | ✅ | - | - |
| `voice_data` | `voice_data` | 是 | ❌ | ✅ | - | - |
| `team_join` | `team_changed` | 是 | ✅ | ✅ | 忽略 | - |
| `grenade_throw` | `grenade_thrown` | 是 | ✅ | ✅ | 忽略 | - |
| `c4_plant` | `c4_planted` | 是 | ✅ | ✅ | 忽略 | - |
| `c4_defuse` | `c4_defused` | 是 | ✅ | ✅ | 忽略 | 未种包时忽略 |
| `skill_use` | `skill_used` / `error` | 是 | ✅ | ✅ | 忽略 | 冷却时返回 error |
| `emote` | `emote` | 是 | ✅ | ✅ | 忽略 | - |
| `ping` | `ping` | 是 | ✅ | ✅ | 忽略 | - |

---

## 必测分支清单

### readPump

| 分支 | 测试 | 断言 |
|------|------|------|
| 正常读取 | 发送 chat | 收到 chat |
| JSON 解析失败 | 发送非法 JSON | 无消息，连接存活 |
| 连接关闭 | 客户端断开 | - |
| 房间内断开 | A,B 在房间，A 断开 | B 收到 player_left，Hub 移除 A |

### writePump

| 分支 | 测试 | 断言 |
|------|------|------|
| 正常写入 | 广播消息 | 收到消息 |
| 批量写入 | 快速发送多条 | 每条独立 JSON（换行分隔） |
| Ping 周期 | 等待 ping 周期 | 连接存活 |
| Send 关闭 | 客户端断开 | writePump 退出 |

### Hub.Run

| 分支 | 测试 | 断言 |
|------|------|------|
| register | 客户端连接 | playerID 非空 |
| unregister | 客户端断开 | 其他客户端收到 player_left |
| 并发注册 | 多客户端同时连接 | 无 race |

---

## 测试工具设计

### TestServer

```go
// NewTestServer 创建独立测试服务器
// 契约：
// 1. 创建独立 Hub 并启动 Run()
// 2. 创建 httptest.Server
func NewTestServer(t *testing.T) *TestServer

// Close 关闭服务器
// Hub goroutine 常驻，不阻塞
func (s *TestServer) Close()
```

### Helper 函数

```go
// Connect 连接，读取 welcome，返回 conn, playerID
func Connect(t *testing.T, ts *TestServer) (*websocket.Conn, string)

// CreateRoom 创建房间，返回 conn, playerID, roomID
func CreateRoom(t *testing.T, ts *TestServer) (*websocket.Conn, string, string)

// JoinRoom 加入已存在房间，返回 conn, playerID
func JoinRoom(t *testing.T, ts *TestServer, roomID string) (*websocket.Conn, string)

// FillRoom 填满房间（不含创建者），返回 []conn
func FillRoom(t *testing.T, ts *TestServer, roomID string, count int) []*websocket.Conn

// Drain 清空待处理消息
func Drain(t *testing.T, conn *websocket.Conn)

// CloseConn 关闭连接
func CloseConn(t *testing.T, conn *websocket.Conn)

// Send 发送消息
func Send(t *testing.T, conn *websocket.Conn, msgType string, data interface{})

// RecvType 接收并验证类型
func RecvType(t *testing.T, conn *websocket.Conn, wantType string) *Message

// RecvAll 接收所有消息（处理批量写入：单 frame 多 JSON 换行分隔）
func RecvAll(t *testing.T, conn *websocket.Conn, timeout time.Duration) []*Message

// NoMessage 验证超时内无消息
func NoMessage(t *testing.T, conn *websocket.Conn, timeout time.Duration)
```

---

## 测试场景

### 1. 连接测试

#### TestWS_Connect
```
步骤：Connect(ts)
断言：playerID 非空（welcome 已由 helper 验证）
```

#### TestWS_Disconnect_InRoom
```
前置：A = CreateRoom, B = JoinRoom, Drain(A), Drain(B)
步骤：CloseConn(A)
断言：B 收到 player_left，player_id == A.playerID
```

### 2. 房间操作

#### TestWS_JoinRoom_Full
```
前置：A = CreateRoom, FillRoom(9), Drain(A)
步骤：第 11 人 JoinRoom
断言：收到 error "Room is full"
```

### 3. 消息分发（完整表驱动）

```go
type msgTest struct {
    name       string
    msgType    string
    data       interface{}
    needRoom   bool
    senderGets string   // 空表示不收到
    otherGets  string   // 空表示不收到
}

tests := []msgTest{
    // 无需房间
    {"reload_no_room", "reload", nil, false, "reload", ""},
    
    // 需要房间 - 发送者不收到
    {"move", "move", map[string]interface{}{"x":1,"y":2,"z":3,"rotation":0}, true, "", "player_moved"},
    {"shoot", "shoot", map[string]interface{}{"position":map[string]float64{"x":0,"y":0,"z":0},"rotation":0}, true, "", "player_shot"},
    {"leave_room", "leave_room", nil, true, "", "player_left"},
    {"voice_start", "voice_start", nil, true, "", "voice_start"},
    {"voice_stop", "voice_stop", nil, true, "", "voice_stop"},
    {"voice_data", "voice_data", json.RawMessage(`{}`), true, "", "voice_data"},
    
    // 需要房间 - 广播给全房间（含发送者）
    {"chat", "chat", map[string]string{"message":"hello"}, true, "chat", "chat"},
    {"weapon_change", "weapon_change", map[string]string{"weapon":"rifle"}, true, "weapon_changed", "weapon_changed"},
    {"team_join", "team_join", map[string]string{"team":"red"}, true, "team_changed", "team_changed"},
    {"grenade_throw", "grenade_throw", map[string]interface{}{"type":"frag","position":{"x":0,"y":0,"z":0},"velocity":{"x":0,"y":0,"z":0}}, true, "grenade_thrown", "grenade_thrown"},
    {"c4_plant", "c4_plant", map[string]interface{}{"position":{"x":0,"y":0,"z":0}}, true, "c4_planted", "c4_planted"},
    {"c4_defuse", "c4_defuse", nil, true, "c4_defused", "c4_defused"},
    {"skill_use", "skill_use", map[string]string{"skill_id":"dash"}, true, "skill_used", "skill_used"},
    {"emote", "emote", map[string]string{"emote_id":"wave"}, true, "emote", "emote"},
    {"ping", "ping", map[string]interface{}{"position":{"x":0,"y":0,"z":0},"type":"enemy"}, true, "ping", "ping"},
    
    // 特殊：双事件
    {"respawn", "respawn", map[string]float64{"x":0,"y":0,"z":0}, true, "respawn", "player_respawned"},
}
```

### 4. 异常分支

#### TestWS_InvalidJSON
```
前置：A = CreateRoom, Drain(A)
步骤：发送 '{"invalid'
断言：NoMessage，连接仍可用（发送 ping 收到响应）
```

#### TestWS_SkillOnCooldown
```
前置：A = CreateRoom, Drain(A)
步骤：
  1. Send("skill_use", ...)
  2. 立即再次 Send
断言：第二次收到 error "Skill on cooldown"
```

#### TestWS_Shoot_CannotShoot
```
前置：A = CreateRoom, Drain(A)
步骤：快速发送两次 shoot（模拟弹药耗尽）
断言：第二次可能静默忽略
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
    // ... 所有需要房间的消息
}

for _, tc := range needRoom {
    A = Connect(ts)
    Drain(A)
    Send(A, tc.msgType, tc.data)
    NoMessage(A, 500ms)
    
    // 验证连接可用
    Send(A, "join_room", map[string]string{"name":"test"})
    RecvType(A, "room_joined")
    CloseConn(A)
}
```

### 5. 并发测试

#### TestConcurrent_Broadcast
```
前置：5 客户端加入房间，全部 Drain
步骤：每个客户端发送 5 条 chat
断言：
  - 无崩溃、无死锁
  - 总接收数 >= 60（理论 125 = 5人 × 5条 × 5人，允许丢弃）
  - 所有连接可用（能 join_room 收到 room_joined）
```

**丢弃策略**：`writePump` 在 `Send` 通道满时跳过消息，这是设计决策。

---

## 不测范围

| 内容 | 原因 |
|------|------|
| `pongWait` 超时 | 需禁用客户端自动 pong |
| `writeWait` 超时 | 需模拟慢客户端 |
| 日志输出 | 非功能性行为 |
| 时间戳值 | 非确定性 |

---

## 实施步骤

1. **修复代码**：添加 nil Room 检查
2. **测试工具**：TestServer, Helper
3. **连接/房间测试**
4. **消息分发测试**
5. **异常分支测试**
6. **并发测试**
7. **覆盖率验证**

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
| 修复代码 | 0.5 小时 |
| 测试工具 | 0.5 小时 |
| 测试编写 | 2 小时 |
| 调试优化 | 1 小时 |
| **总计** | **4 小时** |
