# 网络层测试覆盖率完善设计

## 目标

完成以下工作：
1. **生产修复**：`BroadcastToRoom` nil 检查
2. **测试实现**：`server.go` 覆盖率从 33.9% 提升到 90%+

**验收命令**：
```bash
go test -coverprofile=cover.out ./server/internal/network/
go tool cover -func=cover.out | grep server.go
go test -race ./server/internal/network/...
```

**覆盖率可达性**：`server.go` 约 740 行，未测分支（upgrade 失败、pump 超时、ping 周期）约 20 行，占比 < 3%，90% 目标可达。

---

## 单元划分

| 单元 | 内容 | 可独立提交 |
|------|------|----------|
| 单元 1 | 生产修复：`BroadcastToRoom` nil 检查 | ✅ 独立 PR |
| 单元 2 | 测试基础设施 | ✅ |
| 单元 3 | 连接与房间测试 | ✅ |
| 单元 4 | 消息分发测试 | ✅ |
| 单元 5 | 异常测试 | ✅ |
| 单元 6 | 并发测试 | ✅ |

---

## 单元 1：生产修复

### 修复内容

在 `BroadcastToRoom` 添加 nil 检查：

```go
func (h *Hub) BroadcastToRoom(r *room.Room, msgType string, data interface{}, excludeID string) {
    if r == nil {
        return
    }
    // ... 原有逻辑
}
```

### 影响的 handler

| Handler | 当前行为 | 修复后行为 |
|---------|---------|-----------|
| `handleRespawn` | 发送者收到 respawn，广播 panic | 发送者收到 respawn，广播静默 |
| `handleWeaponChange` | 设置武器后广播 panic | 设置武器后广播静默 |

---

## 单元 2：测试基础设施

### Helper 分层

**协议层**（纯 WebSocket 操作，无业务逻辑）：
- `Connect`, `CreateRoom`, `JoinRoom`, `CloseConn`
- `Send`, `RecvType`, `RecvAll`, `Drain`, `NoMessage`

**辅助层**（业务无关的便捷函数）：
- `FillRoom`, `CountType`

**断言层**（测试内联，不封装进 helper）：
- 业务断言在测试函数内直接实现，保持黑盒

### 黑盒规则

- `TestServer.Hub` 和 `TestServer.RoomManager` 仅用于服务器构造
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

### Helper 协议合同

```go
// Connect：建立 WebSocket 连接
// 协议：读取 1 条 welcome 消息，验证 type=="welcome"，提取 playerID
// 返回：(conn, playerID)
func Connect(t *testing.T, ts *TestServer) (*websocket.Conn, string)

// CreateRoom：创建房间
// 协议：读取 welcome + room_joined，验证类型
// 返回：(conn, playerID, roomID)
func CreateRoom(t *testing.T, ts *TestServer) (*websocket.Conn, string, string)

// JoinRoom：加入已存在房间
// 协议：读取 welcome + room_joined，验证类型
// 返回：(conn, playerID)
func JoinRoom(t *testing.T, ts *TestServer, roomID string) (*websocket.Conn, string)

// CloseConn：关闭连接
func CloseConn(t *testing.T, conn *websocket.Conn)

// Send：发送消息
// 编码规则：{"type":msgType,"data":data}
// - json.RawMessage 原样嵌入
// - 其他值 JSON 编码
func Send(t *testing.T, conn *websocket.Conn, msgType string, data interface{})

// RecvType：读取期望类型的消息
// 协议：读取 1 条消息，验证 type==wantType
func RecvType(t *testing.T, conn *websocket.Conn, wantType string) *Message

// RecvAll：读取所有消息
// 停止条件：连续 drainWindow 时间内无新消息到达
func RecvAll(t *testing.T, conn *websocket.Conn) []*Message

// Drain：丢弃所有消息
// 停止条件：连续 drainWindow 时间内无新消息到达
func Drain(t *testing.T, conn *websocket.Conn)

// NoMessage：验证静默
// 协议：等待 noMessageWait，若期间有消息到达，t.Fatalf
func NoMessage(t *testing.T, conn *websocket.Conn)

// FillRoom：填满房间
// 返回：所有连接（调用方负责关闭）
func FillRoom(t *testing.T, ts *TestServer, roomID string, count int) []*websocket.Conn

// CountType：统计消息类型数量
func CountType(msgs []*Message, msgType string) int
```

### 存活验证

**方式**：在同一连接上发送合法消息并验证响应。

**操作**：发送 `join_room{"name":"probe"}`，验证收到 `room_joined`。

**适用**：连接状态未明时验证连接仍存活。

---

## 测试前置状态

| 状态 | 来源 | 值 |
|------|------|---|
| 房间容量 | `room.MaxSize` | 10 |
| 技能冷却 | `player.SkillCooldowns["heal"]` | 30s |
| 射击冷却 | 代码常量 | 100ms |
| 初始弹药 | `player.Ammo` | 30 |
| 初始血量 | `player.Health` | 100 |

**respawn 满血满弹**：`player.Respawn()` 会重置 Health=100, Ammo=30。

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

### TestWS_LeaveRoom
- 前置：A、B 在同一房间
- 断言：A 发送 leave_room 后，B 收到 `player_left`

---

## 单元 4：消息分发测试

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

**测试范围**：所有 handler 的非法 JSON payload 处理。

**精确 payload 构造**：
```go
rawPayload := json.RawMessage("{invalid")
Send(conn, "move", rawPayload)
// 发送：{"type":"move","data":{invalid}}
```

| Handler | 预期行为 |
|---------|---------|
| `move` | 静默 |
| `chat` | 静默 |
| `shoot` | 其他人收到 `player_shot`（position=null, rotation=0） |
| `respawn` | 发送者收到 `respawn`（零值位置 + 满血满弹），其他人收到 `player_respawned` |
| `weapon_change` | 静默 |
| `team_join` | 静默 |
| `grenade_throw` | 静默 |
| `c4_plant` | 静默 |
| `skill_use` | 静默 |
| `emote` | 静默 |
| `ping` | 静默 |

### TestWS_NoRoom（表驱动）

**需要房间的消息**：
- `move`, `chat`, `shoot`, `voice_start`, `voice_stop`, `voice_data`
- `team_join`, `grenade_throw`, `c4_plant`, `c4_defuse`, `skill_use`, `emote`, `ping`

**无 payload 的消息**（单独测试）：
- `leave_room`, `voice_start`, `voice_stop`, `c4_defuse`

**预期**：
- `respawn`：发送者收到 `respawn`，广播静默
- `weapon_change`：广播静默
- 其他：静默

---

## 单元 6：并发测试

### TestConcurrent_Broadcast

**系统可靠性模型**：广播使用非阻塞发送，缓冲区满时允许丢失。

**阈值依据**：
- 发送缓冲区默认 256 条
- 5 客户端 × 5 条 chat = 25 条总发送
- 每条广播给 5 人 = 125 条理论接收
- 允许 20% 丢失 = 100 条下限

**时序**：
```
1. 创建房间，5 客户端加入
2. 全部 Drain
3. 启动 5 个 goroutine，每人发送 5 条 chat
4. sync.WaitGroup 等待发送完成
5. 等待 2s
6. 每客户端 RecvAll
7. 统计 chat 消息
8. 存活验证
```

**断言**：
- 总 chat 数 >= 100
- 每客户端至少收到 15 条
- 存活验证通过

---

## 最小断言合同（完整）

| 消息 | 必验字段 | 断言方式 |
|------|----------|----------|
| `room_joined` | `room_id`, `player_id` | room_id 非空 |
| `player_joined` | `player_id` | 存在 |
| `player_left` | `player_id` | 精确等于发送者ID |
| `player_moved` | `player_id`, `position.x/y/z`, `rotation` | position 坐标存在 |
| `chat` | `player_id`, `message` | message 精确匹配 |
| `player_shot` | `player_id`, `ammo`, `position`, `rotation` | position 为对象或 null |
| `reload` | `ammo`, `ammo_reserve` | ammo > 0 |
| `respawn` | `health`, `ammo`, `position.x/y/z` | health=100, ammo>0 |
| `player_respawned` | `player_id`, `position.x/y/z` | position 坐标存在 |
| `weapon_changed` | `player_id`, `weapon` | weapon 精确匹配 |
| `voice_start` | `player_id` | 存在 |
| `voice_stop` | `player_id` | 存在 |
| `voice_data` | `player_id`, `audio` | audio 非空 |
| `team_changed` | `player_id`, `team` | team 精确匹配 |
| `grenade_thrown` | `player_id`, `type`, `position.x/y/z` | type 精确匹配 |
| `c4_planted` | `player_id`, `position.x/y/z`, `team` | position 坐标存在 |
| `c4_defused` | `player_id`, `team` | 存在 |
| `skill_used` | `player_id`, `skill_id` | skill_id 精确匹配 |
| `emote` | `player_id`, `emote_id` | emote_id 精确匹配 |
| `ping` | `player_id`, `type`, `position.x/y/z`, `message` | type 精确匹配 |
| `error` | `message` | 包含关键字 |

---

## 不测范围

| 内容 | 原因 | 行数 |
|------|------|------|
| `ServeWS` upgrade 失败 | HTTP 错误分支 | ~5 行 |
| `readPump`/`writePump` 超时 | 需特殊客户端 | ~10 行 |
| Ping 周期 | 60s 太长 | ~5 行 |

**总计**：约 20 行，< 3%。

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
