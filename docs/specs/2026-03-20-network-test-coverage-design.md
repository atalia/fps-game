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

**覆盖率可达性**：`server.go` 约 740 行，主要函数覆盖率来源：

| 函数 | 覆盖来源 |
|------|---------|
| `ServeWS` | 连接测试 |
| `readPump` | 所有测试 |
| `writePump` | 所有测试 |
| `handleXxx` (16个) | 消息分发测试 |
| `BroadcastToRoom` | 广播测试 |
| `Hub.Run` | 所有测试 |

**未覆盖**（约 5%）：`ServeWS` upgrade 失败、`readPump` 超时。

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
| `reload` | `reload` | 无 |
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
| `ping` | `ping` | `ping` |

---

## 单元划分

| 单元 | 内容 |
|------|------|
| 单元 1 | 生产修复：`BroadcastToRoom` nil 检查 |
| 单元 2 | 测试基础设施 |
| 单元 3 | 连接与房间测试 |
| 单元 4 | 消息分发测试 |
| 单元 5 | 并发测试 |

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

---

## 单元 2：测试基础设施

### TestServer 配置

```go
func NewTestServer(t *testing.T) *TestServer {
    hub := NewHub()
    go hub.Run()
    rm := room.NewManager(10)  // 房间容量 10
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

- `CreateRoom`/`JoinRoom`：使用 `Drain` 清理所有背景消息后再返回
- 测试断言：使用 `RecvType` 严格匹配目标消息，或 `RecvAll` + `CountType` 统计

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
```

### 断言策略

- **附加字段**：允许
- **字段类型**：严格匹配
- **数值**：按合同规定

---

## 单元 3：连接与房间测试

| 测试名 | 目标 |
|--------|------|
| TestWS_Connect | 连接建立 |
| TestWS_Disconnect_InRoom | 断开连接 |
| TestWS_UnknownType | 未知类型 |
| TestWS_InvalidTopLevelJSON | 顶层非法 JSON |
| TestWS_JoinRoom_NewRoom | 创建房间 |
| TestWS_JoinRoom_ExistingRoom | 加入房间 |
| TestWS_JoinRoom_Full | 房间满 |
| TestWS_LeaveRoom | 离开房间 |

---

## 单元 4：消息分发测试

### 完整 payload

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

### 非法 JSON 分类

| 类别 | 示例 | 触发路径 |
|------|------|---------|
| 顶层非法 | `{"invalid` | `readPump` 连接关闭或静默 |
| data 反序列化失败 | `{"type":"move","data":{invalid}` | handler 内部 `json.Unmarshal` |

**测试范围**：只测试 data 反序列化失败。

### 测试清单

| 测试名 | 入站消息 | 覆盖路径 |
|--------|---------|---------|
| TestWS_Move | `move` | 正常广播、无房间静默、非法JSON静默 |
| TestWS_Chat | `chat` | 正常广播、无房间静默、非法JSON静默 |
| TestWS_Shoot | `shoot` | 正常广播、无房间静默、非法JSON零值广播、冷却静默 |
| TestWS_Reload | `reload` | 正常有房间、正常无房间 |
| TestWS_Respawn | `respawn` | 正常广播、无房间发送者收到、非法JSON零值广播 |
| TestWS_WeaponChange | `weapon_change` | 正常广播、无房间广播静默、非法JSON静默 |
| TestWS_VoiceStart | `voice_start` | 正常广播、无房间静默 |
| TestWS_VoiceStop | `voice_stop` | 正常广播、无房间静默 |
| TestWS_VoiceData | `voice_data` | 正常广播、无房间静默 |
| TestWS_TeamJoin | `team_join` | 正常广播、无房间静默、非法JSON静默 |
| TestWS_GrenadeThrow | `grenade_throw` | 正常广播、无房间静默、非法JSON静默 |
| TestWS_C4Plant | `c4_plant` | 正常广播、无房间静默、非法JSON静默 |
| TestWS_C4Defuse | `c4_defuse` | 正常广播、无房间静默、无C4静默 |
| TestWS_SkillUse | `skill_use` | 正常广播、无房间静默、非法JSON静默、冷却error |
| TestWS_Emote | `emote` | 正常广播、无房间静默、非法JSON静默 |
| TestWS_Ping | `ping` | 正常广播、无房间静默、非法JSON静默 |

### 异常路径前置条件

#### shoot 冷却

```
1. 创建房间，第二人加入，Drain
2. Send("shoot", {...})  // 第一次，成功
3. Drain（等待 player_shot）
4. 等待 50ms（冷却 100ms）
5. Send("shoot", {...})  // 第二次，冷却中
6. NoMessage（第二人不应收到第二条 player_shot）
```

#### skill_use 冷却

```
1. 创建房间，Drain
2. Send("skill_use", {"skill_id":"heal"})  // 第一次，成功
3. Drain
4. Send("skill_use", {"skill_id":"heal"})  // 第二次，冷却中
5. RecvType("error")，断言 message 包含 "cooldown"
```

#### c4_defuse 无C4

```
1. 创建房间，Drain（不调用 c4_plant）
2. Send("c4_defuse", {})
3. NoMessage
```

### player_shot position 为 null 说明

**场景**：`shoot` 的非法 JSON（data 反序列化失败）时，`json.Unmarshal` 不报错继续执行。

**结果**：`pos.Position` 为 `nil`（map 零值），序列化为 JSON `null`。

**断言**：`position` 字段存在，值为 `null`。

---

## 单元 5：并发测试

### TestConcurrent_Broadcast

**系统可靠性**：广播使用非阻塞发送，缓冲区（256 条）满时允许丢失。

**稳定性约束**：
- 固定 5 客户端、每客户端 5 条 chat
- 发送完成后等待 2s
- 使用 `sync.WaitGroup` 同步发送
- 不涉及连接关闭/离房

**阈值**：
- 理论：5 × 5 × 5 = 125 条
- 允许 20% 丢失（测试稳定性容差）
- 断言：>= 100 条，每客户端 >= 15 条

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
| 技能冷却 | "cooldown" |

---

## 不测范围

| 内容 | 原因 |
|------|------|
| `ServeWS` upgrade 失败 | HTTP 层 |
| `readPump` 超时 | 需特殊构造 |

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
| 单元 4 | 2h |
| 单元 5 | 0.5h |
| **总计** | **4.5h** |
