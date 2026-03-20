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

## 前置修复

修复 `BroadcastToRoom` 添加 nil 检查：

```go
func (h *Hub) BroadcastToRoom(r *room.Room, msgType string, data interface{}, excludeID string) {
    if r == nil {
        return
    }
    // ... 原有逻辑
}
```

---

## 测试分层

| 层级 | 文件 | 内容 |
|------|------|------|
| 单元测试 | `server_test.go` | Hub 注册/注销、Broadcast 空房间 |
| 集成测试 | `server_ws_test.go` | WebSocket 连接、消息分发、异常 |
| 并发冒烟 | `server_ws_test.go` | 广播稳定性 |

---

## 消息分类

### 1. 单播给发送者（不依赖房间）

| 类型 | 说明 |
|------|------|
| `reload` | 发送者收到 `reload`，其他人不收到 |

### 2. 广播给其他人（不含发送者）

| 类型 | 说明 |
|------|------|
| `move` | 其他人收到 `player_moved` |
| `shoot` | 其他人收到 `player_shot` |
| `voice_start` | 其他人收到 `voice_start` |
| `voice_stop` | 其他人收到 `voice_stop` |
| `voice_data` | 其他人收到 `voice_data` |
| `leave_room` | 其他人收到 `player_left` |

### 3. 广播给全房间（含发送者）

| 类型 | 发送者收到 | 其他人收到 |
|------|-----------|-----------|
| `join_room` | `room_joined` | `player_joined` |
| `chat` | `chat` | `chat` |
| `respawn` | `respawn` | `player_respawned` |
| `weapon_change` | `weapon_changed` | `weapon_changed` |
| `team_join` | `team_changed` | `team_changed` |
| `grenade_throw` | `grenade_thrown` | `grenade_thrown` |
| `c4_plant` | `c4_planted` | `c4_planted` |
| `c4_defuse` | `c4_defused` | `c4_defused` |
| `skill_use` | `skill_used` | `skill_used` |
| `emote` | `emote` | `emote` |
| `ping` | `ping` | `ping` |

---

## 已知代码前提

### `CanUseSkill` 行为

```go
// player.go
func (p *Player) CanUseSkill(skillID string) bool {
    cooldown, exists := SkillCooldowns[skillID]
    if !exists {
        return false  // 无效技能返回 false
    }
    // ...
}
```

**结论**：无效技能 ID 会导致 `CanUseSkill` 返回 `false`，然后 `handleSkillUse` 发送 `error "Skill on cooldown"`。

### `CanShoot` 行为

```go
// server.go
func (c *Client) handleShoot(data json.RawMessage, roomManager *room.Manager) {
    if c.Room == nil || !c.Player.CanShoot() {
        return  // 冷却时静默返回，不发送任何消息
    }
    // ...
}
```

**结论**：射击冷却时静默丢弃，不发送 error。

---

## 消息语义矩阵

| 类型 | 发送者 | 其他人 | 无房间 | 非法JSON | 冷却/无效 |
|------|-------|-------|-------|---------|---------|
| `join_room` | `room_joined` | `player_joined` | 正常 | 静默 | - |
| `leave_room` | ❌ | `player_left` | 静默 | N/A | - |
| `move` | ❌ | `player_moved` | 静默 | 静默 | - |
| `chat` | `chat` | `chat` | 静默 | 静默 | - |
| `shoot` | ❌ | `player_shot` | 静默 | 静默 | 静默 |
| `reload` | `reload` | ❌ | 正常 | N/A | - |
| `respawn` | `respawn` | `player_respawned` | 发送者正常+广播静默 | 静默 | - |
| `weapon_change` | `weapon_changed` | `weapon_changed` | 发送者正常+广播静默 | 静默 | - |
| `voice_start` | ❌ | `voice_start` | 静默 | N/A | - |
| `voice_stop` | ❌ | `voice_stop` | 静默 | N/A | - |
| `voice_data` | ❌ | `voice_data` | 静默 | N/A | - |
| `team_join` | `team_changed` | `team_changed` | 静默 | 静默 | - |
| `grenade_throw` | `grenade_thrown` | `grenade_thrown` | 静默 | 静默 | - |
| `c4_plant` | `c4_planted` | `c4_planted` | 静默 | 静默 | - |
| `c4_defuse` | `c4_defused` | `c4_defused` | 静默 | N/A | - |
| `skill_use` | `skill_used`/`error` | `skill_used` | 静默 | 静默 | `error` |
| `emote` | `emote` | `emote` | 静默 | 静默 | - |
| `ping` | `ping` | `ping` | 静默 | 静默 | - |

**无房间时特殊行为**：
- `respawn`：发送者收到 `respawn`，广播给其他人部分因 `BroadcastToRoom(nil)` 静默
- `weapon_change`：同上

---

## 最小断言合同

| 消息 | 必验字段 | 断言方式 |
|------|----------|----------|
| `room_joined` | `room_id`, `player_id` | room_id 非空 |
| `player_joined` | `player_id` | 存在 |
| `player_left` | `player_id` | 精确等于发送者ID |
| `player_moved` | `player_id`, `position` | position 有 x/y/z |
| `chat` | `player_id`, `message` | message 精确匹配 |
| `player_shot` | `player_id` | 存在 |
| `reload` | `ammo`, `ammo_reserve` | 数值 >= 0 |
| `respawn` | `health`, `ammo` | 发送者收到，值 >= 0 |
| `player_respawned` | `player_id`, `position` | 其他人收到 |
| `weapon_changed` | `player_id`, `weapon` | weapon 精确匹配 |
| `voice_start` | `player_id` | 存在 |
| `voice_stop` | `player_id` | 存在 |
| `voice_data` | `player_id` | 存在（audio 字段结构不验证） |
| `team_changed` | `player_id`, `team` | team 精确匹配 |
| `grenade_thrown` | `player_id`, `type`, `position` | type 精确匹配 |
| `c4_planted` | `player_id`, `position` | position 有 x/y/z |
| `c4_defused` | `player_id` | 存在 |
| `skill_used` | `player_id`, `skill_id` | skill_id 精确匹配 |
| `emote` | `player_id`, `emote_id` | emote_id 精确匹配 |
| `ping` | `player_id`, `data.type`, `position` | data.type 精确匹配 |
| `error` | `message` | 包含关键字 |

---

## 测试工具设计

```go
type TestServer struct {
    Server      *httptest.Server
    Hub         *Hub
    RoomManager *room.Manager
    URL         string
}

// NewTestServer 创建独立测试服务器
func NewTestServer(t *testing.T) *TestServer

// Close 关闭服务器
func (s *TestServer) Close()

// Connect 连接，消费 welcome
func Connect(t *testing.T, ts *TestServer) (*websocket.Conn, string)

// CreateRoom 创建房间
func CreateRoom(t *testing.T, ts *TestServer) (*websocket.Conn, string, string)

// JoinRoom 加入房间
func JoinRoom(t *testing.T, ts *TestServer, roomID string) (*websocket.Conn, string)

// FillRoom 填满房间
func FillRoom(t *testing.T, ts *TestServer, roomID string, count int) []*websocket.Conn

// Drain 清空消息
func Drain(t *testing.T, conn *websocket.Conn)

// Send 发送消息
func Send(t *testing.T, conn *websocket.Conn, msgType string, data interface{})

// RecvType 接收并验证类型
func RecvType(t *testing.T, conn *websocket.Conn, wantType string) *Message

// RecvAll 接收所有消息
func RecvAll(t *testing.T, conn *websocket.Conn) []*Message

// NoMessage 验证无消息
func NoMessage(t *testing.T, conn *websocket.Conn)

// CountType 统计消息类型
func CountType(msgs []*Message, msgType string) int
```

---

## 测试场景

### 1. 连接测试

- `TestWS_Connect`：playerID 非空
- `TestWS_Disconnect_InRoom`：其他人收到 player_left
- `TestWS_UnknownType`：NoMessage + 连接存活
- `TestWS_InvalidTopLevelJSON`：NoMessage + 连接存活

### 2. 房间测试

- `TestWS_JoinRoom_NewRoom`
- `TestWS_JoinRoom_ExistingRoom`
- `TestWS_JoinRoom_Full`：error 包含 "full"
- `TestWS_LeaveRoom`

### 3. 消息分发测试

按分类覆盖所有消息类型，验证：
- 单播：发送者收到，其他人不收到
- 广播其他人：发送者不收到，其他人收到
- 广播全房间：所有人都收到

### 4. JSON 解析失败测试

所有解析 data 的 handler：静默 + 连接存活

### 5. 异常测试

- `TestWS_SkillOnCooldown`：error 包含 "cooldown"
- `TestWS_InvalidSkill`：error 包含 "cooldown"（无效技能也报这个）
- `TestWS_Shoot_Cooldown`：其他人只收到 1 次 `player_shot`
- `TestWS_Reload_NoRoom`：发送者收到 `reload`

### 6. 无房间操作测试

需要房间的消息：`leave_room`, `move`, `chat`, `shoot`, `respawn`, `weapon_change`, `voice_start`, `voice_stop`, `voice_data`, `team_join`, `grenade_throw`, `c4_plant`, `c4_defuse`, `skill_use`, `emote`, `ping`

每个验证：NoMessage（或发送者正常 + 广播静默）

### 7. 并发测试

```
时序：
1. 创建房间，5 客户端加入
2. 全部 Drain
3. 并发发送（每人 5 条 chat）
4. 等待 2s
5. 统计 chat 消息

断言：
- 无 panic、无死锁
- 总消息 >= 100（理论 125，允许 20% 丢失）
- 连接存活
```

---

## 不测范围

| 内容 | 原因 |
|------|------|
| `ServeWS` upgrade 失败 | HTTP 错误分支 |
| `pongWait`/`writeWait` 超时 | 需特殊客户端 |
| Ping 周期 | 60s 太长 |

---

## 覆盖率预算

| 函数 | 预计覆盖 | 说明 |
|------|---------|------|
| `ServeWS` | ~90% | upgrade 失败不测 |
| `readPump` | ~85% | 超时不测 |
| `writePump` | ~80% | ping/超时不测 |
| `handleXxx` | ~95% | 主要路径覆盖 |
| `BroadcastToRoom` | 100% | nil/空房间/正常 |
| **总体** | **≥90%** | |

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
