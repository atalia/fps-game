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

**示例**：
- `chat`：`excludeID=""` → 发送者和其他人都收到
- `player_moved`：`excludeID=发送者ID` → 只有其他人收到

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

```go
func (h *Hub) BroadcastToRoom(r *room.Room, msgType string, data interface{}, excludeID string) {
    if r == nil {
        return
    }
    // ... 原有逻辑
}
```

**影响的 handler**：`handleRespawn`、`handleWeaponChange`

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
func Connect(t *testing.T, ts *TestServer) (*websocket.Conn, string)
func CreateRoom(t *testing.T, ts *TestServer) (*websocket.Conn, string, string)
func JoinRoom(t *testing.T, ts *TestServer, roomID string) (*websocket.Conn, string)
func CloseConn(t *testing.T, conn *websocket.Conn)
func Send(t *testing.T, conn *websocket.Conn, msgType string, data interface{})
func RecvType(t *testing.T, conn *websocket.Conn, wantType string) *Message
func RecvAll(t *testing.T, conn *websocket.Conn) []*Message
func Drain(t *testing.T, conn *websocket.Conn)
func NoMessage(t *testing.T, conn *websocket.Conn)
func FillRoom(t *testing.T, ts *TestServer, roomID string, count int) []*websocket.Conn
func CountType(msgs []*Message, msgType string) int
```

### 存活验证

**方式**：在同一连接上发送 `join_room{"name":"probe"}`，验证收到 `room_joined`。

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

| 消息 | data 字段 | 说明 |
|------|----------|------|
| `move` | `{"x":1,"y":2,"z":3,"rotation":0}` | 位置 |
| `chat` | `{"message":"hello"}` | 聊天 |
| `shoot` | `{"position":{"x":1,"y":2,"z":3},"rotation":0}` | 射击 |
| `reload` | `{}` | 无参数 |
| `respawn` | `{"x":0,"y":0,"z":0}` | 重生点 |
| `weapon_change` | `{"weapon":"rifle"}` | 武器名 |
| `voice_start` | `{}` | 无参数 |
| `voice_stop` | `{}` | 无参数 |
| `voice_data` | `"base64_audio"` | 音频数据 |
| `team_join` | `{"team":"red"}` | 队伍名 |
| `grenade_throw` | `{"type":"frag","position":{"x":1,"y":2,"z":3},"velocity":{"x":0,"y":0,"z":0}}` | 投掷物 |
| `c4_plant` | `{"position":{"x":1,"y":2,"z":3}}` | 位置 |
| `c4_defuse` | `{}` | 无参数 |
| `skill_use` | `{"skill_id":"heal","x":0,"y":0,"z":0}` | 技能ID |
| `emote` | `{"emote_id":"wave"}` | 表情ID |
| `ping` | `{"type":"enemy","x":1,"y":2,"z":3,"message":"here"}` | 标记 |

### reload 前置条件

```go
// 测试步骤：
// 1. 创建房间
// 2. 发送 shoot 消耗弹药（ammo 从 30 → 29）
// 3. 发送 reload
// 4. 验证 ammo 恢复到 30
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

### TestWS_JSONParseFailure

**payload**：`json.RawMessage("{invalid")`

| Handler | 预期行为 | 断言说明 |
|---------|---------|---------|
| `move` | 静默 | Unmarshal 失败后 return |
| `chat` | 静默 | Unmarshal 失败后 return |
| `shoot` | 其他人收到 `player_shot` | Unmarshal 失败后继续，position=null |
| `respawn` | 发送者收到 `respawn`，其他人收到 `player_respawned` | Unmarshal 失败后继续，position=零值，**Respawn() 会恢复满血满弹** |
| `weapon_change` | 静默 | Unmarshal 失败后 return |
| `team_join` | 静默 | Unmarshal 失败后 return |
| `grenade_throw` | 静默 | Unmarshal 失败后 return |
| `c4_plant` | 静默 | Unmarshal 失败后 return |
| `skill_use` | 静默 | Unmarshal 失败后 return |
| `emote` | 静默 | Unmarshal 失败后 return |
| `ping` | 静默 | Unmarshal 失败后 return |

**注意**：`shoot` 和 `respawn` 的零值行为是 handler 不检查 Unmarshal 错误的结果，这是当前实现行为，测试锁定此行为。

### TestWS_NoRoom

**按是否需要 data payload 分组**：

**有 data payload 的消息**：
- `move`, `chat`, `shoot`, `team_join`, `grenade_throw`, `c4_plant`, `skill_use`, `emote`, `ping`

**无 data payload 的消息**：
- `leave_room`, `voice_start`, `voice_stop`, `c4_defuse`

**预期**：
- `respawn`：发送者收到 `respawn`，广播静默（nil 检查生效）
- `weapon_change`：广播静默（nil 检查生效）
- 其他：静默（handler 内 Room nil 检查生效）

---

## 单元 6：并发测试

### TestConcurrent_Broadcast

**广播语义**：`chat` 的 `excludeID=""`，发送者和其他人都收到。

**理论接收数**：
- 5 客户端 × 5 条 chat × 5 接收者（含发送者）= 125 条

**阈值**：
- 总 chat 数 >= 100（允许 20% 丢失）
- 每客户端至少收到 15 条

---

## 最小断言合同

| 消息 | 必验字段 |
|------|----------|
| `room_joined` | `room_id` 非空, `player_id` |
| `player_joined` | `player_id` |
| `player_left` | `player_id` 精确匹配 |
| `player_moved` | `player_id`, `position.x/y/z`, `rotation` |
| `chat` | `player_id`, `message` 精确匹配 |
| `player_shot` | `player_id`, `ammo`, `position`, `rotation` |
| `reload` | `ammo` > 0, `ammo_reserve` |
| `respawn` | `health`=100, `ammo` > 0, `position.x/y/z` |
| `player_respawned` | `player_id`, `position.x/y/z` |
| `weapon_changed` | `player_id`, `weapon` 精确匹配 |
| `voice_start` | `player_id` |
| `voice_stop` | `player_id` |
| `voice_data` | `player_id`, `audio` |
| `team_changed` | `player_id`, `team` 精确匹配 |
| `grenade_thrown` | `player_id`, `type` 精确匹配, `position.x/y/z` |
| `c4_planted` | `player_id`, `position.x/y/z`, `team` |
| `c4_defused` | `player_id`, `team` |
| `skill_used` | `player_id`, `skill_id` 精确匹配 |
| `emote` | `player_id`, `emote_id` 精确匹配 |
| `ping` | `player_id`, `type` 精确匹配, `position.x/y/z`, `message` |
| `error` | `message` 包含关键字 |

---

## 不测范围

| 内容 | 原因 |
|------|------|
| `ServeWS` upgrade 失败 | HTTP 层 |
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

| 单元 | 时间 |
|------|------|
| 单元 1：生产修复 | 0.5h |
| 单元 2：测试基础设施 | 0.5h |
| 单元 3：连接与房间 | 0.5h |
| 单元 4：消息分发 | 1.5h |
| 单元 5：异常测试 | 1h |
| 单元 6：并发测试 | 0.5h |
| **总计** | **4.5h** |
