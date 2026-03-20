# 网络层测试覆盖率完善设计

## 目标

将 `server/internal/network/server.go` 的测试覆盖率从 33.9% 提升到 90%+。

**验收命令**：
```bash
go test -coverprofile=cover.out ./server/internal/network/
go tool cover -func=cover.out | grep server.go
go test -race ./server/internal/network/...
```

**测试风格**：黑盒 WebSocket 测试，不直接操作 Hub/RoomManager 内部状态。

---

## 前置依赖

**假设**：`BroadcastToRoom(nil, ...)` 的 nil 检查已修复。

如未修复，需先执行以下生产修复：

```go
func (h *Hub) BroadcastToRoom(r *room.Room, msgType string, data interface{}, excludeID string) {
    if r == nil {
        return
    }
    // ... 原有逻辑
}
```

---

## 可观察语义定义

| 术语 | 定义 |
|------|------|
| `静默` | 100ms 内无 websocket 消息到达任何接收方 |
| `零值广播` | 广播发生，JSON 字段为 Go 零值 |
| `正常` | 期望的成功消息按断言合同到达 |
| `连接存活` | 发送 `join_room` 并收到 `room_joined`（创建新房间） |

---

## 测试工具接口

```go
const (
    readTimeout   = 2 * time.Second
    drainWindow   = 200 * time.Millisecond
    noMessageWait = 100 * time.Millisecond
)

// TestServer 测试服务器
type TestServer struct {
    Server      *httptest.Server
    Hub         *Hub
    RoomManager *room.Manager
    URL         string
}

// 职责：服务器生命周期
func NewTestServer(t *testing.T) *TestServer
func (s *TestServer) Close()

// 职责：连接管理
func Connect(t *testing.T, ts *TestServer) (*websocket.Conn, string)
func CreateRoom(t *testing.T, ts *TestServer) (*websocket.Conn, string, string)
func JoinRoom(t *testing.T, ts *TestServer, roomID string) (*websocket.Conn, string)
func CloseConn(t *testing.T, conn *websocket.Conn)

// 职责：消息收发
func Send(t *testing.T, conn *websocket.Conn, msgType string, data interface{})
func RecvType(t *testing.T, conn *websocket.Conn, wantType string) *Message
func RecvAll(t *testing.T, conn *websocket.Conn) []*Message
func Drain(t *testing.T, conn *websocket.Conn)
func NoMessage(t *testing.T, conn *websocket.Conn)

// 职责：辅助
func FillRoom(t *testing.T, ts *TestServer, roomID string, count int) []*websocket.Conn
func CountType(msgs []*Message, msgType string) int
```

---

## 消息行为规范表

### `join_room` 语义

| 输入 | 行为 |
|------|------|
| 无 room_id | 创建新房间（生成 room_id），加入 |
| 有 room_id 且存在 | 加入该房间 |
| 有 room_id 但不存在 | 创建新房间（**生成新 room_id**，不使用传入的 room_id） |
| 房间满 | 返回 error |

### 输入 → 输出规范

| 消息 | 发送者 | 其他人 | 无房间 | JSON失败 |
|------|-------|-------|-------|---------|
| `join_room` | `room_joined` | `player_joined` | 正常 | 静默 |
| `leave_room` | ❌ | `player_left` | 静默 | N/A |
| `move` | ❌ | `player_moved` | 静默 | 零值广播 |
| `chat` | `chat` | `chat` | 静默 | 静默 |
| `shoot` | ❌ | `player_shot` | 静默 | 零值广播 |
| `reload` | `reload` | ❌ | 正常 | N/A |
| `respawn` | `respawn` | `player_respawned` | 发送者正常+广播静默 | 零值广播 |
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

## 零值断言样例

### `move` 零值广播

```json
{
  "type": "player_moved",
  "data": {
    "player_id": "xxx",
    "position": {},
    "rotation": 0
  }
}
```

### `shoot` 零值广播

```json
{
  "type": "player_shot",
  "data": {
    "player_id": "xxx",
    "position": null,
    "rotation": 0,
    "ammo": 30
  }
}
```

### `team_join` 零值广播

```json
{
  "type": "team_changed",
  "data": {
    "player_id": "xxx",
    "team": ""
  }
}
```

### `emote` 零值广播

```json
{
  "type": "emote",
  "data": {
    "player_id": "xxx",
    "emote_id": ""
  }
}
```

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
| `reload` | `ammo`, `ammo_reserve` | 与前值比较（减少/填充） |
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

## 连接测试验收合同

### TestWS_Connect

- 断言：收到 `welcome`，playerID 非空

### TestWS_Disconnect_InRoom

- 前置：A、B 在同一房间
- 步骤：关闭 A 连接
- 断言：B 收到 `player_left`，player_id == A.playerID

### TestWS_UnknownType

- 步骤：发送 `{"type":"unknown","data":{}}`
- 断言：静默
- 存活验证：发送 `join_room` 收到 `room_joined`

### TestWS_InvalidTopLevelJSON

- 步骤：发送原始 `{"invalid`
- 断言：静默
- 存活验证：发送 `join_room` 收到 `room_joined`

---

## 异常测试前置条件

### TestWS_SkillOnCooldown

- 前置：创建房间，Drain
- 技能冷却：`heal` = 30s
- 步骤：连续发送两次 `skill_use{"skill_id":"heal"}`
- 断言：第二次收到 `error` 包含 "cooldown"

### TestWS_Shoot_Cooldown

- 前置：创建房间，Drain
- 射击冷却：100ms
- 步骤：发送 `shoot`，等待 50ms，再发送 `shoot`
- 断言：只收到 1 次 `player_shot`

### TestWS_C4Defuse_NoC4

- 前置：创建房间，Drain（不种包）
- 步骤：发送 `c4_defuse`
- 断言：静默

---

## JSON 解析失败测试

### 格式化 payload

```go
malformedPayload := json.RawMessage(`{invalid`)
```

### 测试用例

| Handler | 预期行为 |
|---------|---------|
| `join_room` | 静默 |
| `move` | 零值广播 |
| `chat` | 静默 |
| `shoot` | 零值广播 |
| `respawn` | 零值广播 |
| `weapon_change` | 静默 |
| `team_join` | 零值广播 |
| `grenade_throw` | 零值广播 |
| `c4_plant` | 零值广播 |
| `skill_use` | 静默 |
| `emote` | 零值广播 |
| `ping` | 零值广播 |

---

## 并发测试设计

### 时序

```
1. 创建房间，5 客户端加入
2. 全部 Drain（排除 welcome/join 背景）
3. 并发发送（每人 5 条 chat）
4. 等待 2s
5. 统计 chat 消息（排除非 chat）
6. 验证连接存活：每人发送 join_room 创建新房间
```

### 统计口径

- 只统计 `type: "chat"` 消息
- 排除 welcome、player_joined 等背景消息

### 断言

- 无 panic、无死锁
- 总 chat 消息 >= 100（理论 125 = 5客户端 × 5条 × 5接收者，允许 20% 丢失）
- 每个客户端能创建新房间

### 允许丢失原因

系统使用非阻塞发送，缓冲区满时跳过。

---

## Phase 5：消息分发测试矩阵

| 消息 | 回自己 | 广播他人 | 无房间 | JSON失败 | 断言字段 |
|------|-------|---------|-------|---------|---------|
| `reload` | ✅ | ❌ | 正常 | N/A | ammo, ammo_reserve |
| `move` | ❌ | ✅ | 静默 | 零值 | player_id |
| `shoot` | ❌ | ✅ | 静默 | 零值 | player_id |
| `voice_start` | ❌ | ✅ | 静默 | N/A | player_id |
| `voice_stop` | ❌ | ✅ | 静默 | N/A | player_id |
| `voice_data` | ❌ | ✅ | 静默 | N/A | player_id |
| `chat` | ✅ | ✅ | 静默 | 静默 | player_id, message |
| `respawn` | ✅ | ✅ | 发送者正常 | 零值 | health, ammo |
| `weapon_change` | ✅ | ✅ | 静默 | 静默 | weapon |
| `team_join` | ✅ | ✅ | 静默 | 零值 | team |
| `grenade_throw` | ✅ | ✅ | 静默 | 零值 | type |
| `c4_plant` | ✅ | ✅ | 静默 | 零值 | player_id |
| `c4_defuse` | ✅ | ✅ | 静默 | N/A | player_id |
| `skill_use` | ✅ | ✅ | 静默 | 静默 | skill_id |
| `emote` | ✅ | ✅ | 静默 | 零值 | emote_id |
| `ping` | ✅ | ✅ | 静默 | 零值 | type |

---

## 覆盖率预算

| 函数/区域 | 预计覆盖 | 说明 |
|----------|---------|------|
| `handleJoinRoom` | 100% | 正常/满房/JSON失败 |
| `handleLeaveRoom` | 100% | 正常/无房间 |
| `handleMove` | 95% | 正常/无房间/JSON失败 |
| `handleChat` | 95% | 正常/无房间/JSON失败 |
| `handleShoot` | 90% | 正常/无房间/冷却/JSON失败 |
| `handleReload` | 100% | 正常 |
| `handleRespawn` | 90% | 正常/无房间/JSON失败 |
| `handleWeaponChange` | 90% | 正常/无房间/JSON失败 |
| `handleVoiceXxx` | 90% | 正常/无房间 |
| `handleTeamJoin` | 90% | 正常/无房间/JSON失败 |
| `handleGrenadeThrow` | 90% | 正常/无房间/JSON失败 |
| `handleC4Plant` | 90% | 正常/无房间/JSON失败 |
| `handleC4Defuse` | 90% | 正常/无房间/无C4 |
| `handleSkillUse` | 90% | 正常/无房间/冷却/JSON失败 |
| `handleEmote` | 90% | 正常/无房间/JSON失败 |
| `handlePing` | 90% | 正常/无房间/JSON失败 |
| `BroadcastToRoom` | 100% | nil/空房间/正常 |
| `ServeWS` | 85% | 升级失败不测 |
| `readPump` | 80% | 超时不测 |
| `writePump` | 75% | ping/超时不测 |
| **总体** | **≥90%** | |

---

## 不测范围

| 内容 | 原因 |
|------|------|
| `ServeWS` upgrade 失败 | HTTP 错误分支 |
| `readPump`/`writePump` 超时 | 需特殊客户端 |
| Ping 周期 | 60s 太长 |

---

## 实施清单

### Phase 1：生产修复

- [ ] 修复 `BroadcastToRoom` nil 检查

### Phase 2：测试工具

- [ ] 实现 `TestServer`
- [ ] 实现 helper 函数

### Phase 3：连接测试

- [ ] `TestWS_Connect`
- [ ] `TestWS_Disconnect_InRoom`
- [ ] `TestWS_UnknownType`
- [ ] `TestWS_InvalidTopLevelJSON`

### Phase 4：房间测试

- [ ] `TestWS_JoinRoom_NewRoom`
- [ ] `TestWS_JoinRoom_ExistingRoom`
- [ ] `TestWS_JoinRoom_Full`
- [ ] `TestWS_LeaveRoom`

### Phase 5：消息分发测试

按 Phase 5 矩阵表驱动实现。

### Phase 6：异常测试

- [ ] `TestWS_JSONParseFailure`（表驱动）
- [ ] `TestWS_NoRoom`（表驱动）
- [ ] `TestWS_SkillOnCooldown`
- [ ] `TestWS_Shoot_Cooldown`
- [ ] `TestWS_C4Defuse_NoC4`

### Phase 7：并发测试

- [ ] `TestConcurrent_Broadcast`

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
