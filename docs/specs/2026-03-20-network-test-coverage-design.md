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

## 范围定义

**本 spec 包含**：
1. 生产修复：`BroadcastToRoom` nil 检查
2. 测试代码实现

**测试风格**：黑盒 WebSocket 测试。

**黑盒规则**：
- `TestServer.Hub` 和 `TestServer.RoomManager` 仅用于服务器初始化
- **禁止**在测试中读取或修改 Hub/RoomManager 状态
- 所有断言通过 WebSocket 消息完成

---

## 生产修复

```go
func (h *Hub) BroadcastToRoom(r *room.Room, msgType string, data interface{}, excludeID string) {
    if r == nil {
        return
    }
    // ... 原有逻辑
}
```

---

## 测试前置状态来源

| 状态 | 来源 | 值 |
|------|------|---|
| 房间容量 | `room.MaxSize` | 10 |
| 技能冷却 | `player.SkillCooldowns` | `heal`: 30s |
| 射击冷却 | `player.shootCooldown` | 100ms |
| 初始弹药 | `player.Ammo` | 30 |
| 初始血量 | `player.Health` | 100 |

**冷却时间注入**：测试不注入，直接使用生产常量。若常量变更，测试需同步更新。

---

## 时序常量

```go
const (
    // 读取超时（单次 websocket.ReadJSON）
    readTimeout = 2 * time.Second
    
    // drain 窗口（持续读取直到无新消息）
    drainWindow = 200 * time.Millisecond
    
    // no-message 判定窗口
    noMessageWait = 100 * time.Millisecond
    
    // race 模式放宽系数
    raceFactor = 2  // -race 时超时翻倍
)
```

---

## 可观察语义定义

| 术语 | 定义 |
|------|------|
| `静默` | noMessageWait 内无 websocket 消息到达 |
| `零值广播` | 广播发生，JSON 字段为 Go 零值 |
| `正常` | 期望的成功消息按断言合同到达 |
| `连接存活` | 发送 `join_room`（无 room_id）并收到 `room_joined` |

---

## 测试工具接口

```go
// TestServer 测试服务器
type TestServer struct {
    Server      *httptest.Server
    Hub         *Hub        // 仅用于初始化，禁止测试读取
    RoomManager *room.Manager  // 仅用于初始化，禁止测试读取
    URL         string
}

// 服务器生命周期
func NewTestServer(t *testing.T) *TestServer
func (s *TestServer) Close()

// 连接管理（返回 conn, playerID 或 roomID）
func Connect(t *testing.T, ts *TestServer) (*websocket.Conn, string)
func CreateRoom(t *testing.T, ts *TestServer) (*websocket.Conn, string, string)
func JoinRoom(t *testing.T, ts *TestServer, roomID string) (*websocket.Conn, string)
func CloseConn(t *testing.T, conn *websocket.Conn)

// 消息收发
func Send(t *testing.T, conn *websocket.Conn, msgType string, data interface{})
func RecvType(t *testing.T, conn *websocket.Conn, wantType string) *Message
func RecvAll(t *testing.T, conn *websocket.Conn) []*Message
func Drain(t *testing.T, conn *websocket.Conn)
func NoMessage(t *testing.T, conn *websocket.Conn)

// 辅助
func FillRoom(t *testing.T, ts *TestServer, roomID string, count int) []*websocket.Conn
func CountType(msgs []*Message, msgType string) int
```

### Message 结构

```go
type Message struct {
    Type      string          `json:"type"`
    Data      json.RawMessage `json:"data"`
    Timestamp int64           `json:"timestamp"`
}
```

---

## JSON 失败分类

### 1. 顶层 JSON 非法

**输入**：整个 websocket frame 不是合法 JSON

```go
// 发送方式
conn.WriteMessage(websocket.TextMessage, []byte(`{"invalid`))
```

**预期**：连接关闭或静默丢弃

**测试**：`TestWS_InvalidTopLevelJSON`

### 2. Payload JSON 非法

**输入**：顶层 JSON 合法，但 `data` 字段不是合法 JSON

```go
// 发送方式
Send(conn, "move", json.RawMessage(`{invalid`))
```

**预期**：handler 静默返回或零值广播

**测试**：`TestWS_JSONParseFailure`

---

## 消息行为规范

### 输入 → 输出规范

| 消息 | 发送者 | 其他人 | 无房间 | Payload非法 |
|------|-------|-------|-------|------------|
| `join_room` | `room_joined` | `player_joined` | 正常 | 静默 |
| `leave_room` | ❌ | `player_left` | 静默 | N/A |
| `move` | ❌ | `player_moved` | 静默 | 零值广播 |
| `chat` | `chat` | `chat` | 静默 | 静默 |
| `shoot` | ❌ | `player_shot` | 静默 | 零值广播 |
| `reload` | `reload` | ❌ | 正常 | N/A |
| `respawn` | `respawn` | `player_respawned` | 发送者正常 | 零值广播 |
| `weapon_change` | `weapon_changed` | `weapon_changed` | 静默 | 静默 |
| `voice_start` | ❌ | `voice_start` | 静默 | N/A |
| `voice_stop` | ❌ | `voice_stop` | 静默 | N/A |
| `voice_data` | ❌ | `voice_data` | 静默 | N/A |
| `team_join` | `team_changed` | `team_changed` | 静默 | 零值广播 |
| `grenade_throw` | `grenade_thrown` | `grenade_thrown` | 静默 | 零值广播 |
| `c4_plant` | `c4_planted` | `c4_planted` | 静默 | 零值广播 |
| `c4_defuse` | `c4_defused` | `c4_defused` | 静默 | N/A |
| `skill_use` | `skill_used` | `skill_used` | 静默 | 静默 |
| `emote` | `emote` | `emote` | 静默 | 零值广播 |
| `ping` | `ping` | `ping` | 静默 | 零值广播 |

---

## 最小断言合同

| 消息 | 必验字段 | 断言方式 |
|------|----------|----------|
| `room_joined` | `room_id`, `player_id` | room_id 非空 |
| `player_joined` | `player_id` | 存在 |
| `player_left` | `player_id` | 精确等于发送者ID |
| `player_moved` | `player_id` | 存在 |
| `chat` | `player_id`, `message` | message 精确匹配 |
| `player_shot` | `player_id` | 存在 |
| `reload` | `ammo` | ammo > 0（从 0 填充后） |
| `respawn` | `health`, `ammo` | health == 100, ammo > 0 |
| `player_respawned` | `player_id` | 其他人收到 |
| `weapon_changed` | `player_id`, `weapon` | weapon 精确匹配 |
| `voice_start` | `player_id` | 存在 |
| `voice_stop` | `player_id` | 存在 |
| `voice_data` | `player_id` | 存在 |
| `team_changed` | `player_id`, `team` | team 精确匹配 |
| `grenade_thrown` | `player_id`, `type` | type 精确匹配 |
| `c4_planted` | `player_id` | 存在 |
| `c4_defused` | `player_id` | 存在 |
| `skill_used` | `player_id`, `skill_id` | skill_id 精确匹配 |
| `emote` | `player_id`, `emote_id` | emote_id 精确匹配 |
| `ping` | `player_id`, `type` | type 精确匹配 |
| `error` | `message` | 包含关键字 |

---

## 连接测试

### TestWS_Connect

- 断言：收到 `welcome`，playerID 非空

### TestWS_Disconnect_InRoom

- 前置：A、B 在同一房间
- 步骤：关闭 A 连接
- 断言：B 收到 `player_left`，player_id == A.playerID

### TestWS_UnknownType

- 步骤：发送 `{"type":"unknown","data":{}}`
- 断言：静默 + 存活验证（join_room → room_joined）

### TestWS_InvalidTopLevelJSON

- 步骤：发送原始 `{"invalid`
- 断言：静默 + 存活验证（join_room → room_joined）

---

## 房间测试

### TestWS_JoinRoom_NewRoom

- 断言：收到 `room_joined`，room_id 非空

### TestWS_JoinRoom_ExistingRoom

- 前置：A 创建房间
- 步骤：B 加入该 room_id
- 断言：B 收到 `room_joined`，A 收到 `player_joined`

### TestWS_JoinRoom_Full

- 前置：创建房间，`FillRoom(9)`（共 10 人）
- 步骤：第 11 人加入
- 断言：收到 `error` 包含 "full"

### TestWS_LeaveRoom

- 前置：A、B 在同一房间
- 步骤：A 发送 `leave_room`
- 断言：B 收到 `player_left`

---

## 异常测试

### TestWS_SkillOnCooldown

- 前置：创建房间，Drain
- 步骤：连续发送 `skill_use{"skill_id":"heal"}` 两次
- 断言：第二次收到 `error` 包含 "cooldown"

### TestWS_Shoot_Cooldown

- 前置：创建房间，第二人加入，Drain
- 步骤：发送 `shoot`，等待 50ms，再发送 `shoot`
- 断言：第二人只收到 1 次 `player_shot`

### TestWS_C4Defuse_NoC4

- 前置：创建房间，Drain
- 步骤：发送 `c4_defuse`
- 断言：静默

---

## JSON 失败测试

### TestWS_JSONParseFailure（表驱动）

**维度**：消息类型 × 在房间内

**payload**：`json.RawMessage("{invalid")`

| Handler | 在房间内 | 预期 |
|---------|---------|------|
| `join_room` | 否 | 静默 |
| `move` | 是 | 其他人收到 `player_moved`（position={}） |
| `chat` | 是 | 静默 |
| `shoot` | 是 | 其他人收到 `player_shot`（position=null） |
| `respawn` | 是 | 发送者收到 `respawn`（零值），其他人收到 `player_respawned` |
| `weapon_change` | 是 | 静默 |
| `team_join` | 是 | 广播 `team_changed`（team=""） |
| `grenade_throw` | 是 | 广播 `grenade_thrown`（零值） |
| `c4_plant` | 是 | 广播 `c4_planted`（position={}） |
| `skill_use` | 是 | 静默 |
| `emote` | 是 | 广播 `emote`（emote_id=""） |
| `ping` | 是 | 广播 `ping`（零值） |

---

## 无房间测试

### TestWS_NoRoom（表驱动）

需要房间的消息：`leave_room`, `move`, `chat`, `shoot`, `respawn`, `weapon_change`, `voice_start`, `voice_stop`, `voice_data`, `team_join`, `grenade_throw`, `c4_plant`, `c4_defuse`, `skill_use`, `emote`, `ping`

**维度**：消息类型

**预期**：
- `respawn`：发送者收到 `respawn`，无广播
- 其他：静默

---

## 并发测试

### TestConcurrent_Broadcast

**时序**：
```
1. 创建房间，5 客户端加入
2. 全部 Drain
3. 并发发送（每人 5 条 chat）
4. 等待 2s
5. 每客户端 RecvAll
6. 统计 chat 消息（只统计 type="chat"）
7. 每客户端发送 join_room（无 room_id）验证存活
```

**统计口径**：
- 每客户端分别统计收到的 `chat` 消息数
- 汇总：总 chat 数 = 所有客户端 chat 数之和

**断言**：
- 无 panic、无死锁
- 总 chat 数 >= 100（理论 125）
- 每客户端至少收到 15 条 chat（理论 25）
- 每客户端存活验证通过

**允许丢失原因**：非阻塞发送，缓冲区满时跳过。

---

## Phase 5：消息分发测试矩阵

**维度**：
- 消息类型
- 在房间内（是/否）
- JSON 失败（是/否）
- 接收方（发送者/其他人）

| 消息 | 在房间 | JSON失败 | 发送者 | 其他人 |
|------|-------|---------|-------|-------|
| `reload` | 否 | N/A | ✅ `reload` | ❌ |
| `reload` | 是 | N/A | ✅ `reload` | ❌ |
| `move` | 是 | 否 | ❌ | ✅ `player_moved` |
| `move` | 是 | 是 | ❌ | ✅ 零值 |
| `move` | 否 | - | ❌ 静默 | ❌ |
| `shoot` | 是 | 否 | ❌ | ✅ `player_shot` |
| `shoot` | 是 | 是 | ❌ | ✅ 零值 |
| `shoot` | 否 | - | ❌ 静默 | ❌ |
| ... | ... | ... | ... | ... |

（完整矩阵按此模式展开）

---

## 不测范围

| 内容 | 原因 |
|------|------|
| `ServeWS` upgrade 失败 | HTTP 错误分支 |
| `readPump`/`writePump` 超时 | 需特殊客户端 |
| Ping 周期 | 60s 太长 |

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
