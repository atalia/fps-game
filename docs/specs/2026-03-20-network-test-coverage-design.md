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

---

## 广播语义

**统一规则**：
- `BroadcastToRoom` 的 `excludeID` 参数决定是否排除发送者
- `excludeID != ""` 时：广播给其他人，发送者不收到
- `excludeID == ""` 时：广播给全房间，包含发送者

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

**位置**：`BroadcastToRoom` 函数

```go
func (h *Hub) BroadcastToRoom(r *room.Room, msgType string, data interface{}, excludeID string) {
    if r == nil {
        return
    }
    // ... 原有逻辑
}
```

**设计决策**：修复在 `BroadcastToRoom` 层面，**不修改** `handleRespawn` 或 `handleWeaponChange`。这两个 handler 在 `c.Room == nil` 时仍执行业务逻辑（设置位置/武器），只是广播被 nil 检查拦截。

**修复前行为**：
- `handleRespawn(nil)` → panic
- `handleWeaponChange(nil)` → panic

**修复后行为**：
- `handleRespawn(nil)` → 发送者收到 respawn，广播静默
- `handleWeaponChange(nil)` → 广播静默

---

## 单元 2：测试基础设施

### 黑盒规则

- 所有断言通过 WebSocket 消息完成
- 禁止读取或修改 Hub/RoomManager 状态

### 时序常量

```go
const (
    readTimeout   = 2 * time.Second
    drainWindow   = 200 * time.Millisecond
    noMessageWait = 100 * time.Millisecond
)
```

### Helper 协议

```go
// Connect：建立 WebSocket 连接
// 完成后状态：已读取并丢弃 welcome，连接处于"未入房间"状态
// 返回：(conn, playerID)
func Connect(t *testing.T, ts *TestServer) (*websocket.Conn, string)

// CreateRoom：创建房间
// 完成后状态：已读取并丢弃 welcome + room_joined，连接处于"在房间内"状态
// 返回：(conn, playerID, roomID)
func CreateRoom(t *testing.T, ts *TestServer) (*websocket.Conn, string, string)

// JoinRoom：加入已存在房间
// 完成后状态：已读取并丢弃 welcome + room_joined，连接处于"在房间内"状态
// 返回：(conn, playerID)
func JoinRoom(t *testing.T, ts *TestServer, roomID string) (*websocket.Conn, string)

// CloseConn：关闭连接
func CloseConn(t *testing.T, conn *websocket.Conn)

// Send：发送消息
func Send(t *testing.T, conn *websocket.Conn, msgType string, data interface{})

// RecvType：读取期望类型的消息
func RecvType(t *testing.T, conn *websocket.Conn, wantType string) *Message

// RecvAll：读取所有消息，直到 drainWindow 无新消息
func RecvAll(t *testing.T, conn *websocket.Conn) []*Message

// Drain：丢弃所有消息，直到 drainWindow 无新消息
func Drain(t *testing.T, conn *websocket.Conn)

// NoMessage：验证静默
func NoMessage(t *testing.T, conn *websocket.Conn)

// FillRoom：填满房间
// 完成后状态：所有连接处于"在房间内"状态
func FillRoom(t *testing.T, ts *TestServer, roomID string, count int) []*websocket.Conn

// CountType：统计消息类型数量
func CountType(msgs []*Message, msgType string) int
```

### 存活验证

**不使用存活验证**：所有测试通过明确的 Drain 和消息计数控制时序。

---

## 测试前置状态

| 状态 | 值 |
|------|---|
| 房间容量 | 10 |
| 技能冷却（heal） | 30s |
| 射击冷却 | 100ms |
| 初始弹药 | 30 |
| 初始血量 | 100 |

---

## 单元 3：连接与房间测试

| 测试 | 目标 handler |
|------|-------------|
| TestWS_Connect | `ServeWS` |
| TestWS_Disconnect_InRoom | `readPump` |
| TestWS_UnknownType | `readPump` 消息路由 |
| TestWS_InvalidTopLevelJSON | `readPump` JSON 解析 |
| TestWS_JoinRoom_NewRoom | `handleJoinRoom` |
| TestWS_JoinRoom_ExistingRoom | `handleJoinRoom` |
| TestWS_JoinRoom_Full | `handleJoinRoom` |
| TestWS_LeaveRoom | `handleLeaveRoom` |

---

## 单元 4：消息分发测试

### 最小合法 payload

| 消息 | data 字段 |
|------|----------|
| `move` | `{"x":1,"y":2,"z":3,"rotation":0}` |
| `chat` | `{"message":"hello"}` |
| `shoot` | `{"position":{"x":1,"y":2,"z":3},"rotation":0}` |
| `reload` | `{}` |
| `respawn` | `{"x":0,"y":0,"z":0}` |
| `weapon_change` | `{"weapon":"rifle"}` |
| `voice_start` | `{}` |
| `voice_stop` | `{}` |
| `voice_data` | `"base64_audio"` |
| `team_join` | `{"team":"red"}` |
| `grenade_throw` | `{"type":"frag","position":{"x":1,"y":2,"z":3},"velocity":{"x":0,"y":0,"z":0}}` |
| `c4_plant` | `{"position":{"x":1,"y":2,"z":3}}` |
| `c4_defuse` | `{}` |
| `skill_use` | `{"skill_id":"heal","x":0,"y":0,"z":0}` |
| `emote` | `{"emote_id":"wave"}` |
| `ping` | `{"type":"enemy","x":1,"y":2,"z":3,"message":"here"}` |

### reload 测试步骤

```
1. CreateRoom（ammo 初始 30）
2. Drain
3. Send("shoot", {...})
4. Drain（等待 player_shot 消息到达）
5. Send("reload", {})
6. RecvType("reload")
7. 断言 ammo == 30
```

### 测试 → handler 映射

| 测试 | 目标 handler |
|------|-------------|
| TestWS_Move_InRoom | `handleMove` |
| TestWS_Chat_InRoom | `handleChat` |
| TestWS_Shoot_InRoom | `handleShoot` |
| TestWS_Reload_InRoom | `handleReload` |
| TestWS_Respawn_InRoom | `handleRespawn` |
| TestWS_WeaponChange_InRoom | `handleWeaponChange` |
| TestWS_VoiceStart_InRoom | `handleVoiceStart` |
| TestWS_VoiceStop_InRoom | `handleVoiceStop` |
| TestWS_VoiceData_InRoom | `handleVoiceData` |
| TestWS_TeamJoin_InRoom | `handleTeamJoin` |
| TestWS_GrenadeThrow_InRoom | `handleGrenadeThrow` |
| TestWS_C4Plant_InRoom | `handleC4Plant` |
| TestWS_C4Defuse_InRoom | `handleC4Defuse` |
| TestWS_SkillUse_InRoom | `handleSkillUse` |
| TestWS_Emote_InRoom | `handleEmote` |
| TestWS_Ping_InRoom | `handlePing` |

---

## 单元 5：异常测试

### 测试 → handler 映射

| 测试 | 目标 handler/分支 |
|------|------------------|
| TestWS_SkillOnCooldown | `handleSkillUse` 冷却分支 |
| TestWS_Shoot_Cooldown | `handleShoot` 冷却分支 |
| TestWS_C4Defuse_NoC4 | `handleC4Defuse` 无C4分支 |
| TestWS_JSONParseFailure | 各 handler JSON 解析分支 |
| TestWS_NoRoom | 各 handler 无房间分支 |

### 完整消息矩阵

| 消息 | 有房间正常 | 无房间 | 非法 JSON |
|------|-----------|-------|----------|
| `move` | 广播 `player_moved` | 静默 | 静默 |
| `chat` | 广播 `chat`（含发送者） | 静默 | 静默 |
| `shoot` | 广播 `player_shot` | 静默 | 零值广播 |
| `reload` | 发送者收到 `reload` | **正常执行** | N/A |
| `respawn` | 发送者 `respawn` + 广播 `player_respawned` | 发送者 `respawn`，广播静默 | 零值广播 |
| `weapon_change` | 广播 `weapon_changed`（含发送者） | 广播静默 | 静默 |
| `voice_start` | 广播 `voice_start` | 静默 | N/A |
| `voice_stop` | 广播 `voice_stop` | 静默 | N/A |
| `voice_data` | 广播 `voice_data` | 静默 | **N/A（原样转发）** |
| `team_join` | 广播 `team_changed`（含发送者） | 静默 | 静默 |
| `grenade_throw` | 广播 `grenade_thrown` | 静默 | 静默 |
| `c4_plant` | 广播 `c4_planted` | 静默 | 静默 |
| `c4_defuse` | 广播 `c4_defused` | 静默 | N/A |
| `skill_use` | 广播 `skill_used`（含发送者） | 静默 | 静默 |
| `emote` | 广播 `emote`（含发送者） | 静默 | 静默 |
| `ping` | 广播 `ping`（含发送者） | 静默 | 静默 |

### TestWS_JSONParseFailure

**payload**：`json.RawMessage("{invalid")`

**测试范围**：只测试有 JSON 解析逻辑的 handler。

**排除**：`voice_data`（原样转发，无 JSON 解析）

### TestWS_NoRoom

**reload 特殊说明**：`handleReload` 不检查房间，无房间时正常执行，发送者收到 `reload`。

---

## 单元 6：并发测试

### TestConcurrent_Broadcast

**系统可靠性模型**：广播使用非阻塞发送（`select default`），客户端发送缓冲区默认 256 条。当接收方处理慢时，缓冲区满会丢弃消息。

**阈值依据**：
- 5 客户端 × 5 条 chat × 5 接收者 = 125 条理论接收
- 允许 20% 丢失（25 条）作为 CI 稳定性容差
- 这不是产品语义，而是测试容忍度

**时序**：
```
1. 创建房间，5 客户端加入
2. 全部 Drain
3. sync.WaitGroup 启动 5 个 goroutine
4. 每人发送 5 条 chat
5. 等待发送完成
6. 等待 2s（消息传播）
7. 每客户端 RecvAll
8. 统计 chat 消息
```

**断言**：
- 总 chat 数 >= 100
- 每客户端至少收到 15 条

---

## 最小断言合同

| 消息 | 必验字段 | 边界说明 |
|------|----------|---------|
| `room_joined` | `room_id` 非空, `player_id` | |
| `player_joined` | `player_id` | |
| `player_left` | `player_id` 精确匹配 | |
| `player_moved` | `player_id`, `position.x/y/z`, `rotation` | |
| `chat` | `player_id`, `message` 精确匹配 | |
| `player_shot` | `player_id`, `ammo`, `position`, `rotation` | position 可为 null |
| `reload` | `ammo` > 0, `ammo_reserve` | |
| `respawn` | `health`=100, `ammo` > 0, `position.x/y/z` | |
| `player_respawned` | `player_id`, `position.x/y/z` | |
| `weapon_changed` | `player_id`, `weapon` 精确匹配 | |
| `voice_start` | `player_id` | |
| `voice_stop` | `player_id` | |
| `voice_data` | `player_id`, `audio` | audio 为原始字符串 |
| `team_changed` | `player_id`, `team` 精确匹配 | |
| `grenade_thrown` | `player_id`, `type` 精确匹配, `position.x/y/z` | |
| `c4_planted` | `player_id`, `position.x/y/z`, `team` | |
| `c4_defused` | `player_id`, `team` | |
| `skill_used` | `player_id`, `skill_id` 精确匹配 | |
| `emote` | `player_id`, `emote_id` 精确匹配 | |
| `ping` | `player_id`, `type` 精确匹配, `position.x/y/z`, `message` | |
| `error` | `message` 包含关键字 | |

---

## 不测范围

| 内容 | 原因 |
|------|------|
| `ServeWS` upgrade 失败 | HTTP 层 |
| `readPump`/`writePump` 超时 | 需特殊客户端 |
| Ping 周期 | 60s 太长 |
| `welcome` 消息内容 | 仅验证存在 |

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
