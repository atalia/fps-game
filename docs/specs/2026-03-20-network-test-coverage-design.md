# 网络层测试覆盖率完善设计

## 目标

将 `server/internal/network/server.go` 的测试覆盖率从 33.9% 提升到 90%+。

**验收命令**：
```bash
go test -coverprofile=cover.out ./server/internal/network/
go tool cover -func=cover.out | grep server.go
go test -race ./server/internal/network/...
```

**执行顺序**：先完成单元 1（生产修复），再依次完成单元 2-6（测试）。

**覆盖率可达性**：`server.go` 约 740 行，未测分支（upgrade 失败、pump 超时、ping 周期）占比 < 10%，90% 目标可达。

---

## 单元划分

| 单元 | 内容 | 前置依赖 |
|------|------|---------|
| 单元 1 | 生产修复：`BroadcastToRoom` nil 检查 | 无 |
| 单元 2 | 测试基础设施 | 单元 1 |
| 单元 3 | 连接与房间测试 | 单元 2 |
| 单元 4 | 消息分发测试 | 单元 2 |
| 单元 5 | 异常测试 | 单元 2 |
| 单元 6 | 并发测试 | 单元 2 |

---

## 单元 1：生产修复

**目标行为**：修复后 `BroadcastToRoom(nil, ...)` 静默返回，不 panic。

```go
func (h *Hub) BroadcastToRoom(r *room.Room, msgType string, data interface{}, excludeID string) {
    if r == nil {
        return
    }
    // ... 原有逻辑
}
```

**respawn 无房间行为**：修复后，`respawn` 在无房间时发送者收到 `respawn`，广播部分被 nil 检查拦截（静默）。

---

## 单元 2：测试基础设施

### 黑盒规则

- `TestServer.Hub` 和 `TestServer.RoomManager` 仅用于服务器初始化
- **禁止**在测试中读取或修改 Hub/RoomManager 状态
- 所有断言通过 WebSocket 消息完成

### 时序常量

```go
const (
    readTimeout   = 2 * time.Second       // 单次读取超时
    drainWindow   = 200 * time.Millisecond // 连续静默窗口
    noMessageWait = 100 * time.Millisecond // 静默判定窗口
)
```

### JSON 断言口径

| 术语 | Go 值 | JSON 编码 |
|------|-------|----------|
| `{}` | `map[string]interface{}{}` | `{}` |
| `null` | `nil` | `null` |
| 零值字符串 | `""` | `""` |
| 零值数字 | `0` | `0` |

### TestServer 接口

```go
type TestServer struct {
    Server      *httptest.Server
    Hub         *Hub        // 仅初始化用
    RoomManager *room.Manager // 仅初始化用
    URL         string
}

func NewTestServer(t *testing.T) *TestServer
func (s *TestServer) Close()
```

### Helper 协议合同

```go
// Connect：建立 WebSocket 连接
// 协议：读取 1 条 welcome 消息，验证 type=="welcome"，提取 playerID
// 异常：若收到的不是 welcome，t.Fatalf
// 返回：(conn, playerID)
func Connect(t *testing.T, ts *TestServer) (*websocket.Conn, string)

// CreateRoom：创建房间
// 协议：读取 welcome + room_joined，验证类型，提取 playerID 和 roomID
// 异常：若顺序不对或类型不对，t.Fatalf
// 返回：(conn, playerID, roomID)
func CreateRoom(t *testing.T, ts *TestServer) (*websocket.Conn, string, string)

// JoinRoom：加入已存在房间
// 协议：读取 welcome + room_joined，验证类型
// 异常：若顺序不对或类型不对，t.Fatalf
// 返回：(conn, playerID)
func JoinRoom(t *testing.T, ts *TestServer, roomID string) (*websocket.Conn, string)

// CloseConn：关闭连接
func CloseConn(t *testing.T, conn *websocket.Conn)

// Send：发送消息
// 编码规则：构造 {"type":msgType,"data":data}
// - 若 data 是 json.RawMessage，原样嵌入 data 字段（不二次编码）
// - 否则 JSON 编码 data
func Send(t *testing.T, conn *websocket.Conn, msgType string, data interface{})

// RecvType：读取期望类型的消息
// 协议：读取 1 条消息，验证 type==wantType
// 异常：若类型不匹配，t.Fatalf
func RecvType(t *testing.T, conn *websocket.Conn, wantType string) *Message

// RecvAll：读取所有消息
// 停止条件：连续 drainWindow 时间内无新消息到达
// 返回：所有收到的消息（按到达顺序）
func RecvAll(t *testing.T, conn *websocket.Conn) []*Message

// Drain：丢弃所有消息
// 停止条件：连续 drainWindow 时间内无新消息到达
func Drain(t *testing.T, conn *websocket.Conn)

// NoMessage：验证静默
// 协议：等待 noMessageWait，若期间有消息到达，t.Fatalf
func NoMessage(t *testing.T, conn *websocket.Conn)

// FillRoom：填满房间
// 协议：创建 count 个连接，全部加入 roomID
// 返回：所有连接（调用方负责关闭）
// 异常：若任一加入失败，清理已建连接后 t.Fatalf
func FillRoom(t *testing.T, ts *TestServer, roomID string, count int) []*websocket.Conn

// CountType：统计消息类型数量
func CountType(msgs []*Message, msgType string) int
```

### 存活验证

**适用场景**：验证连接仍能正常通信。

**操作**：新建连接，发送 `join_room{"name":"probe"}`，验证收到 `room_joined`。

---

## 测试前置状态

| 状态 | 来源 | 值 |
|------|------|---|
| 房间容量 | `room.MaxSize` | 10 |
| 技能冷却 | `player.SkillCooldowns["heal"]` | 30s |
| 射击冷却 | 代码常量 | 100ms |
| 初始弹药 | `player.Ammo` | 30 |
| 初始血量 | `player.Health` | 100 |

---

## 单元 3：连接与房间测试

### TestWS_Connect
- 断言：收到 `welcome`，playerID 非空

### TestWS_Disconnect_InRoom
- 前置：A、B 在同一房间
- 断言：关闭 A 后，B 收到 `player_left`

### TestWS_UnknownType
- 步骤：发送 `{"type":"unknown","data":{}}`
- 断言：静默 + 存活验证

### TestWS_InvalidTopLevelJSON
- 步骤：发送原始 `{"invalid`
- 断言：静默 + 存活验证

### TestWS_JoinRoom_NewRoom
- 断言：收到 `room_joined`，room_id 非空

### TestWS_JoinRoom_ExistingRoom
- 前置：A 创建房间
- 断言：B 加入后收到 `room_joined`，A 收到 `player_joined`

### TestWS_JoinRoom_Full
- 前置：创建房间，`FillRoom(9)`（共 10 人）
- 断言：第 11 人收到 `error` 包含 "full"

### TestWS_JoinRoom_MissingName
- 步骤：发送 `join_room{}`（无 name 字段）
- 断言：收到 `room_joined`（name 为空字符串）

### TestWS_LeaveRoom
- 前置：A、B 在同一房间
- 断言：A 发送 leave_room 后，B 收到 `player_left`

---

## 单元 4：消息分发测试

### 测试范围

每个消息验证：
1. 在房间内正常行为（发送者 + 其他人）
2. 无房间行为（按规范表）

### 消息行为规范

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

### 特殊消息说明

#### reload
- **无房间**：正常执行，发送者收到 `reload`
- **有房间**：发送者收到 `reload`，其他人不收（断言不收到）

#### respawn
- **无房间**：发送者收到 `respawn`，广播部分静默（`BroadcastToRoom(nil)` 被拦截）
- **归类**：需要房间才能完成完整功能

#### ping
- **字段说明**：消息顶层 `type` 为 `"ping"`，payload 内也有 `type` 字段
- **断言**：验证 payload 内的 `type` 字段（data.type）

### 成功路径测试清单

| 消息 | 测试名称 |
|------|---------|
| `move` | TestWS_Move_InRoom |
| `chat` | TestWS_Chat_InRoom |
| `shoot` | TestWS_Shoot_InRoom |
| `reload` | TestWS_Reload_InRoom |
| `respawn` | TestWS_Respawn_InRoom |
| `weapon_change` | TestWS_WeaponChange_InRoom |
| `voice_start` | TestWS_VoiceStart_InRoom |
| `voice_stop` | TestWS_VoiceStop_InRoom |
| `voice_data` | TestWS_VoiceData_InRoom |
| `team_join` | TestWS_TeamJoin_InRoom |
| `grenade_throw` | TestWS_GrenadeThrow_InRoom |
| `c4_plant` | TestWS_C4Plant_InRoom |
| `c4_defuse` | TestWS_C4Defuse_InRoom |
| `skill_use` | TestWS_SkillUse_InRoom |
| `emote` | TestWS_Emote_InRoom |
| `ping` | TestWS_Ping_InRoom |

### 零值断言规则

| 消息 | 零值时断言 |
|------|-----------|
| `player_moved` | `player_id` 存在，`position` 为 `{}` |
| `player_shot` | `player_id` 存在，`position` 为 `null` |
| `player_respawned` | `player_id` 存在，`position` 为 `{}` |
| `team_changed` | `player_id` 存在，`team` 为 `""` |
| `grenade_thrown` | `player_id` 存在，`type` 为 `""` |
| `c4_planted` | `player_id` 存在，`position` 为 `{}` |
| `emote` | `player_id` 存在，`emote_id` 为 `""` |
| `ping` | `player_id` 存在，payload 内 `type` 为 `""` |
| `respawn`（发送者） | `player_id` 存在，`health`=0，`ammo`=0 |

---

## 单元 5：异常测试

### TestWS_SkillOnCooldown
- 前置：创建房间，Drain
- 步骤：连续发送 `skill_use{"skill_id":"heal"}` 两次
- 断言：第二次收到 `error` 包含 "cooldown"

### TestWS_Shoot_Cooldown
- 前置：创建房间，第二人加入，Drain
- 步骤：发送 `shoot`，Drain，等待 50ms，发送 `shoot`
- 断言：第二人只收到 1 次 `player_shot`

### TestWS_C4Defuse_NoC4
- 前置：创建房间，Drain
- 断言：发送 `c4_defuse` 后静默

### TestWS_JSONParseFailure（表驱动）

**输入构造**：`Send(conn, "move", json.RawMessage("{invalid"))`
- `Send` 将 `json.RawMessage` 原样嵌入 data 字段
- 顶层 `{"type":"move","data":{invalid}` 合法，data 内 `{invalid` 非法

| Handler | 在房间内 | 预期 |
|---------|---------|------|
| `join_room` | 否 | 静默 |
| `move` | 是 | 其他人收到零值 `player_moved` |
| `chat` | 是 | 静默 |
| `shoot` | 是 | 其他人收到零值 `player_shot` |
| `respawn` | 是 | 发送者收到零值 `respawn`，其他人收到零值 `player_respawned` |
| `weapon_change` | 是 | 静默 |
| `team_join` | 是 | 广播零值 `team_changed` |
| `grenade_throw` | 是 | 广播零值 `grenade_thrown` |
| `c4_plant` | 是 | 广播零值 `c4_planted` |
| `skill_use` | 是 | 静默 |
| `emote` | 是 | 广播零值 `emote` |
| `ping` | 是 | 广播零值 `ping` |

### TestWS_NoRoom（表驱动）

需要房间的消息：`leave_room`, `move`, `chat`, `shoot`, `respawn`, `weapon_change`, `voice_start`, `voice_stop`, `voice_data`, `team_join`, `grenade_throw`, `c4_plant`, `c4_defuse`, `skill_use`, `emote`, `ping`

**预期**：
- `respawn`：发送者收到 `respawn`，无广播
- 其他：静默

---

## 单元 6：并发测试

### TestConcurrent_Broadcast

**系统可靠性模型**：广播使用非阻塞发送（`select default`），缓冲区满时允许丢失。

**时序**：
```
1. 创建房间，5 客户端加入
2. 全部 Drain
3. 启动 5 个 goroutine，每人发送 5 条 chat
4. 使用 sync.WaitGroup 等待所有发送完成
5. 等待 2s
6. 每客户端 RecvAll
7. 统计 chat 消息
8. 新建连接做存活验证
```

**chat 回显说明**：`chat` 消息广播给全房间含发送者，每条 chat 会被 5 人收到。

**统计口径**：
- 理论值：5 客户端 × 5 条 × 5 接收者 = 125 条
- 只统计 `type="chat"` 消息
- 每客户端分别统计后汇总

**断言**：
- 总 chat 数 >= 100（理论 125，允许 20% 丢失）
- 每客户端至少收到 15 条（理论 25）
- 存活验证：新连接创建房间成功

**不可验证项**：
- "无 panic"：测试框架自动捕获
- "无死锁"：超时后测试失败

---

## 最小断言合同（完整）

| 消息 | 必验字段 | 断言方式 |
|------|----------|----------|
| `room_joined` | `room_id`, `player_id` | room_id 非空 |
| `player_joined` | `player_id` | 存在 |
| `player_left` | `player_id` | 精确等于发送者ID |
| `player_moved` | `player_id`, `position` | position 为对象 |
| `chat` | `player_id`, `message` | message 精确匹配 |
| `player_shot` | `player_id`, `ammo` | 存在 |
| `reload` | `ammo`, `ammo_reserve` | ammo > 0 |
| `respawn` | `health`, `ammo` | health=100, ammo>0 |
| `player_respawned` | `player_id`, `position` | position 为对象 |
| `weapon_changed` | `player_id`, `weapon` | weapon 精确匹配 |
| `voice_start` | `player_id` | 存在 |
| `voice_stop` | `player_id` | 存在 |
| `voice_data` | `player_id`, `audio` | 存在 |
| `team_changed` | `player_id`, `team` | team 精确匹配 |
| `grenade_thrown` | `player_id`, `type`, `position` | type 精确匹配 |
| `c4_planted` | `player_id`, `position` | position 为对象 |
| `c4_defused` | `player_id` | 存在 |
| `skill_used` | `player_id`, `skill_id` | skill_id 精确匹配 |
| `emote` | `player_id`, `emote_id` | emote_id 精确匹配 |
| `ping` | `player_id`, payload 内 `type`, `position` | type 精确匹配 |
| `error` | `message` | 包含关键字 |

---

## 不测范围

| 内容 | 原因 | 影响评估 |
|------|------|---------|
| `ServeWS` upgrade 失败 | HTTP 错误分支 | < 5 行 |
| `readPump`/`writePump` 超时 | 需特殊客户端 | < 10 行 |
| Ping 周期 | 60s 太长 | < 5 行 |

**总计未覆盖**：< 20 行，占比 < 3%，90% 目标可达。

---

## 成功标准

| 指标 | 目标 |
|------|------|
| 覆盖率 | server.go ≥ 90% |
| 测试通过 | 100% |
| 竞态检测 | 无 fail |

---

## 时间估计

| 单元 | 时间 |
|------|------|
| 单元 1：生产修复 | 0.5h |
| 单元 2：测试基础设施 | 0.5h |
| 单元 3：连接与房间 | 0.5h |
| 单元 4：消息分发 | 1.5h |
| 单元 5：异常测试 | 1h |
| 单元 6：并发测试 | 0.5h |
| **总计** | **4.5h** |
