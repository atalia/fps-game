# 网络层测试覆盖率完善设计

## 目标

完成以下工作：
1. **生产修复**：`BroadcastToRoom` nil 检查（**唯一允许的生产代码改动**）
2. **测试实现**：`server.go` 覆盖率从 33.9% 提升到 90%+

**验收命令**：
```bash
go test -coverprofile=cover.out ./server/internal/network/
go tool cover -func=cover.out | grep server.go
go test -race ./server/internal/network/...
```

**覆盖率可达性**：`server.go` 约 740 行，不可测分支约 10 行（HTTP upgrade 失败 5 行 + readPump 超时 5 行），占比约 1.4%，90% 目标稳妥。

---

## 与现有代码对齐

| 行为 | 当前代码 | 说明 |
|------|---------|------|
| `shoot`/`respawn` data 反序列化失败 | 继续执行，零值广播 | handler 不检查 Unmarshal 错误 |
| `weapon_change` 无房间 | 调用 `BroadcastToRoom(nil, ...)` | 修复后静默 |
| `reload` 无房间 | 正常执行，发送者收到 | 不依赖房间 |
| `skill_use` 未知技能 | 返回 "Skill on cooldown" | `CanUseSkill` 对未知技能返回 false |

---

## 广播语义

**规则**：`excludeID` 决定是否排除发送者。
- `excludeID != ""`：广播给其他人
- `excludeID == ""`：广播给全房间（含发送者）

---

## 入站消息 → 出站事件映射

| 入站消息 | 发送者收到 | 其他人收到 |
|---------|-----------|-----------|
| `move` | 无 | `player_moved` |
| `chat` | `chat` | `chat` |
| `shoot` | 无 | `player_shot` |
| `reload` | `reload` | **无（验证其他人不收到）** |
| `respawn` | `respawn` | `player_respawned` |
| `weapon_change` | `weapon_changed` | `weapon_changed` |
| `voice_start` | 无 | `voice_start` |
| `voice_stop` | 无 | `voice_stop` |
| `voice_data` | 无 | `voice_data` |
| `team_join` | `team_changed` | `team_changed` |
| `grenade_throw` | `grenade_thrown` | `grenade_thrown` |
| `c4_plant` | `c4_planted` | `c4_planted` |
| `c4_defuse` | `c4_defused` | `c4_defused` |
| `skill_use` | `skill_used` | `skill_used` |
| `emote` | `emote` | `emote` |
| `ping`（战术标记） | `ping` | `ping` |

> **注**：`ping` 是游戏内战术标记，非 WebSocket 保活 ping。

---

## 单元划分

| 单元 | 内容 | 文件 |
|------|------|------|
| 单元 1 | 生产修复 | `server.go` |
| 单元 2 | 测试基础设施 | `server_test.go` |
| 单元 3 | 连接与房间测试 | `server_test.go` |
| 单元 4a | Self 响应消息 | `message_test.go` |
| 单元 4b | Self+Others 广播 | `message_test.go` |
| 单元 4c | Others-only 广播 | `message_test.go` |
| 单元 4d | 冷却/错误路径 | `message_test.go` |
| 单元 5 | 并发测试 | `concurrent_test.go` |

---

## 单元 1：生产修复

```go
func (h *Hub) BroadcastToRoom(r *room.Room, msgType string, data interface{}, excludeID string) {
    if r == nil {
        return
    }
    // ...
}
```

**触发的调用路径**：
- `handleRespawn`：`c.Room == nil` 时仍调用广播
- `handleWeaponChange`：`c.Room == nil` 时仍调用广播

**修复后行为**：
- `handleRespawn(nil)`：发送者收到 `respawn`，广播静默
- `handleWeaponChange(nil)`：广播静默

**范围边界**：这是**唯一允许的生产代码改动**。测试过程中发现的其他问题不在本次修复范围。

---

## 单元 2：测试基础设施

### TestServer 配置

```go
func NewTestServer(t *testing.T) *TestServer {
    hub := NewHub()
    go hub.Run()
    
    // room.NewManager(maxRooms, defaultSize)
    rm := room.NewManager(100, 10)  // 最多100房间，每房间10人
    // ...
}
```

### 时序常量

```go
const (
    readTimeout   = 2 * time.Second
    drainWindow   = 200 * time.Millisecond
    noMessageWait = 100 * time.Millisecond
)
```

### 消息顺序策略

- `CreateRoom`/`JoinRoom`：`Drain` 清理背景消息
- 断言：`RecvType` 严格匹配，或 `RecvAll` + 统计

### Helper 协议

```go
func Connect(t *testing.T, ts *TestServer) (*websocket.Conn, string)
func CreateRoom(t *testing.T, ts *TestServer) (*websocket.Conn, string, string)
func JoinRoom(t *testing.T, ts *TestServer, roomID string) (*websocket.Conn, string)
func CloseConn(t *testing.T, conn *websocket.Conn)
func Send(t *testing.T, conn *websocket.Conn, msgType string, data interface{})
func SendRaw(t *testing.T, conn *websocket.Conn, raw string)  // 发送原始 JSON 字符串
func RecvType(t *testing.T, conn *websocket.Conn, wantType string) *Message
func RecvAll(t *testing.T, conn *websocket.Conn) []*Message
func Drain(t *testing.T, conn *websocket.Conn)
func NoMessage(t *testing.T, conn *websocket.Conn)
func FillRoom(t *testing.T, ts *TestServer, roomID string, count int) []*websocket.Conn
```

### 断言策略

- **附加字段**：允许
- **字段类型**：严格匹配
- **数值**：按合同规定

---

## 单元 3：连接与房间测试

### TestWS_Connect
- **步骤**：`Connect()`
- **断言**：收到 `welcome`，`player_id` 非空

### TestWS_Disconnect_InRoom
- **步骤**：
  1. A = CreateRoom()，Drain
  2. B = JoinRoom(A.roomID)，Drain
  3. CloseConn(A)
  4. Drain(B) 等待
- **断言**：B 收到 `player_left`，`player_id` == A.playerID

### TestWS_UnknownType
- **步骤**：Connect()，`SendRaw("{\"type\":\"unknown\",\"data\":{}}")`
- **断言**：`NoMessage`

### TestWS_InvalidTopLevelJSON
- **步骤**：Connect()，`SendRaw("{invalid")`
- **断言**：连接关闭或静默

### TestWS_JoinRoom_NewRoom
- **步骤**：Connect()，`Send("join_room", {"name":"test"})`
- **断言**：收到 `room_joined`，`room_id` 非空

### TestWS_JoinRoom_ExistingRoom
- **步骤**：
  1. A = CreateRoom()
  2. B = Connect()
  3. B.Send("join_room", {"name":A.roomID})
- **断言**：B 收到 `room_joined`，A 收到 `player_joined`

### TestWS_JoinRoom_Full
- **步骤**：
  1. A = CreateRoom()
  2. FillRoom(A.roomID, 9)（共 10 人）
  3. B = Connect()
  4. B.Send("join_room", {"name":A.roomID})
- **断言**：B 收到 `error`，`message` 包含 "full"

### TestWS_LeaveRoom
- **步骤**：
  1. A = CreateRoom()
  2. B = JoinRoom(A.roomID)
  3. Drain(both)
  4. A.Send("leave_room", {})
  5. Drain(B)
- **断言**：B 收到 `player_left`，`player_id` == A.playerID

---

## 单元 4a：Self 响应消息

### TestWS_Reload

**payload**：`{}`

**覆盖路径**：
1. **有房间**：
   - A = CreateRoom()，B = JoinRoom()
   - Drain(both)
   - A.Send("reload", {})
   - 断言：A 收到 `reload`，B `NoMessage`
2. **无房间**：
   - A = Connect()
   - A.Send("reload", {})
   - 断言：A 收到 `reload`

---

## 单元 4b：Self+Others 广播消息

| 消息 | 测试名 | 正常广播 | 无房间 | 非法JSON |
|------|--------|---------|-------|----------|
| `chat` | TestWS_Chat | ✓ | 静默 | 静默 |
| `respawn` | TestWS_Respawn | ✓ | 发送者收到 | 零值广播 |
| `weapon_change` | TestWS_WeaponChange | ✓ | 广播静默 | 静默 |
| `team_join` | TestWS_TeamJoin | ✓ | 静默 | 静默 |
| `grenade_throw` | TestWS_GrenadeThrow | ✓ | 静默 | 静默 |
| `c4_plant` | TestWS_C4Plant | ✓ | 静默 | 静默 |
| `c4_defuse` | TestWS_C4Defuse | ✓ | 静默 | N/A |
| `skill_use` | TestWS_SkillUse | ✓ | 静默 | 静默 |
| `emote` | TestWS_Emote | ✓ | 静默 | 静默 |
| `ping` | TestWS_Ping | ✓ | 静默 | 静默 |

### respawn 无房间说明

**场景**：发送者不在房间，调用 `handleRespawn`。

**行为**：
- 发送者收到 `respawn`（`Player.Respawn()` 正常执行）
- 其他人不收到 `player_respawned`（`BroadcastToRoom(nil)` 静默）

**断言**：发送者收到，其他人 `NoMessage`。

### weapon_change 无房间说明

**场景**：发送者不在房间，调用 `handleWeaponChange`。

**行为**：广播静默（`BroadcastToRoom(nil)` 静默，无自回显）。

**断言**：发送者和其他人 `NoMessage`。

---

## 单元 4c：Others-only 广播消息

| 消息 | 测试名 | 正常广播 | 无房间 | 非法JSON |
|------|--------|---------|-------|----------|
| `move` | TestWS_Move | ✓ | 静默 | 静默 |
| `shoot` | TestWS_Shoot | ✓ | 静默 | 零值广播 |
| `voice_start` | TestWS_VoiceStart | ✓ | 静默 | N/A |
| `voice_stop` | TestWS_VoiceStop | ✓ | 静默 | N/A |
| `voice_data` | TestWS_VoiceData | ✓ | 静默 | N/A |

---

## 单元 4d：冷却/错误路径

### TestWS_Shoot_Cooldown

```
1. A = CreateRoom()，B = JoinRoom()
2. Drain(both)
3. A.Send("shoot", {...})
4. Drain(B)（收到 player_shot）
5. 等待 50ms（冷却 100ms）
6. A.Send("shoot", {...})
7. NoMessage(B)（不应收到第二条）
```

### TestWS_SkillUse_Cooldown

```
1. A = CreateRoom()
2. Drain
3. A.Send("skill_use", {"skill_id":"heal"})
4. Drain
5. A.Send("skill_use", {"skill_id":"heal"})
6. RecvType("error")，断言 message 包含 "cooldown"
```

### TestWS_SkillUse_UnknownSkill

```
1. A = CreateRoom()
2. Drain
3. A.Send("skill_use", {"skill_id":"unknown"})
4. RecvType("error")，断言 message 包含 "cooldown"
```

**说明**：当前 `CanUseSkill` 对未知技能返回 false，错误消息为 "Skill on cooldown"。接受此现状。

### TestWS_C4Defuse_NoC4

```
1. A = CreateRoom()
2. Drain（不调用 c4_plant）
3. A.Send("c4_defuse", {})
4. NoMessage
```

---

## 完整 payload

| 消息 | data |
|------|------|
| `move` | `{"x":1,"y":2,"z":3,"rotation":0}` |
| `chat` | `{"message":"hello"}` |
| `shoot` | `{"position":{"x":1,"y":2,"z":3},"rotation":0}` |
| `reload` | `{}` |
| `respawn` | `{"x":0,"y":0,"z":0}` |
| `weapon_change` | `{"weapon":"rifle"}` |
| `voice_start` | `{}` |
| `voice_stop` | `{}` |
| `voice_data` | `"base64"` |
| `team_join` | `{"team":"red"}` |
| `grenade_throw` | `{"type":"frag","position":{"x":1,"y":2,"z":3},"velocity":{"x":0,"y":0,"z":0}}` |
| `c4_plant` | `{"position":{"x":1,"y":2,"z":3}}` |
| `c4_defuse` | `{}` |
| `skill_use` | `{"skill_id":"heal","x":0,"y":0,"z":0}` |
| `emote` | `{"emote_id":"wave"}` |
| `ping` | `{"type":"enemy","x":1,"y":2,"z":3,"message":"here"}` |

---

## 非法 JSON 分类

| 类别 | 示例 | 测试位置 |
|------|------|---------|
| 顶层非法 | `{invalid` | 单元 3：TestWS_InvalidTopLevelJSON |
| data 反序列化失败 | `{"type":"move","data":{invalid}` | 单元 4：SendRaw 发送 |

### data 反序列化失败行为总表

| 消息 | 期望行为 |
|------|---------|
| `move` | 静默 |
| `chat` | 静默 |
| `shoot` | 零值广播 |
| `respawn` | 零值广播 |
| `weapon_change` | 静默 |
| `team_join` | 静默 |
| `grenade_throw` | 静默 |
| `c4_plant` | 静默 |
| `skill_use` | 静默 |
| `emote` | 静默 |
| `ping` | 静默 |

**零值广播说明**：`shoot` 和 `respawn` 的 handler 不检查 `json.Unmarshal` 错误，零值字段继续执行。

---

## 单元 5：并发测试

### TestConcurrent_Broadcast

**前提**：`chat` 使用 `excludeID == ""`，发送者也会收到广播。

**计算**：
- 5 客户端每人发 5 条 chat = 25 条发送
- 每条广播给全房间 5 人 = 125 条接收

**系统可靠性**：广播使用非阻塞发送，缓冲区（256 条）满时允许丢失。这是产品语义。

**阈值说明**：
- 理论：125 条
- 允许 20% 丢失（**测试稳定性容差**，非业务标准）
- 丢失原因：发送方缓冲区满、测试读取窗口限制

**稳定性约束**：
- 固定 5 客户端、每客户端 5 条
- 发送完成后等待 2s
- 使用 `sync.WaitGroup` 同步
- 不涉及连接关闭/离房

**断言**：
- 总 chat 数 >= 100
- 每客户端 >= 15 条

---

## 最小断言合同

| 出站事件 | 必验字段 |
|---------|---------|
| `welcome` | `player_id` 非空 |
| `room_joined` | `room_id` 非空, `player_id` |
| `player_joined` | `player_id` |
| `player_left` | `player_id` 精确匹配 |
| `player_moved` | `player_id`, `position.x/y/z`, `rotation` |
| `chat` | `player_id`, `message` 精确匹配 |
| `player_shot` | `player_id`, `ammo`, `position`（可为 null）, `rotation` |
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

### error 关键字

| 场景 | 关键字 |
|------|-------|
| 房间满 | "full" |
| 技能冷却/未知技能 | "cooldown" |

---

## 不测范围

| 内容 | 原因 | 行数 |
|------|------|------|
| `ServeWS` upgrade 失败 | HTTP 层 | ~5 行 |
| `readPump` 超时 | 需特殊构造 | ~5 行 |

**覆盖率容差**：不可测分支约 10 行，占比约 1.4%，90% 目标稳妥。

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
| 单元 1 | 0.5h |
| 单元 2 | 1h |
| 单元 3 | 0.5h |
| 单元 4a-4d | 2h |
| 单元 5 | 0.5h |
| **总计** | **4.5h** |
