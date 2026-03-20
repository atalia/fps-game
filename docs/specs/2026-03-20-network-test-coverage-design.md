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
| `readPump` | 所有测试（消息读取） |
| `writePump` | 所有测试（消息发送） |
| `handleXxx` (16个) | 消息分发测试 |
| `BroadcastToRoom` | 广播测试 |
| `Hub.Run` | 所有测试（事件循环） |

**未覆盖分支**（约 5%）：
- `ServeWS` upgrade 失败
- `readPump` 超时关闭
- `writePump` ticker/ping（通过正常 ping-pong 路径部分覆盖）

---

## 广播语义

**规则**：`excludeID` 决定是否排除发送者。
- `excludeID != ""`：广播给其他人
- `excludeID == ""`：广播给全房间（含发送者）

---

## 单元划分

| 单元 | 内容 |
|------|------|
| 单元 1 | 生产修复：`BroadcastToRoom` nil 检查 |
| 单元 2 | 测试基础设施 |
| 单元 3 | 连接与房间测试 |
| 单元 4 | 消息分发测试（按消息类型组织，含正常/异常路径） |
| 单元 5 | 并发测试 |

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

**已知限制**：遍历 `r.Players` 未持锁，不在本次修复范围。

---

## 单元 2：测试基础设施

### TestServer 配置

```go
func NewTestServer(t *testing.T) *TestServer {
    hub := NewHub()
    go hub.Run()  // 事件循环
    
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

### Helper 协议（完整）

```go
// Connect：建立连接，读取 welcome
// 完成后：连接处于"未入房间"状态
func Connect(t *testing.T, ts *TestServer) (*websocket.Conn, string)

// CreateRoom：创建房间，读取 welcome + room_joined
// 完成后：连接处于"在房间内"状态
func CreateRoom(t *testing.T, ts *TestServer) (*websocket.Conn, string, string)

// JoinRoom：加入房间，读取 welcome + room_joined
// 完成后：连接处于"在房间内"状态
func JoinRoom(t *testing.T, ts *TestServer, roomID string) (*websocket.Conn, string)

// CloseConn：关闭连接
func CloseConn(t *testing.T, conn *websocket.Conn)

// Send：发送消息
// 编码为 {"type":msgType,"data":data}
func Send(t *testing.T, conn *websocket.Conn, msgType string, data interface{})

// RecvType：读取一条消息，验证类型
// 失败时 t.Fatalf
func RecvType(t *testing.T, conn *websocket.Conn, wantType string) *Message

// RecvAll：读取所有消息，直到 drainWindow 无新消息
func RecvAll(t *testing.T, conn *websocket.Conn) []*Message

// Drain：丢弃所有消息，直到 drainWindow 无新消息
func Drain(t *testing.T, conn *websocket.Conn)

// NoMessage：验证静默
func NoMessage(t *testing.T, conn *websocket.Conn)

// FillRoom：填满房间
func FillRoom(t *testing.T, ts *TestServer, roomID string, count int) []*websocket.Conn
```

### 断言策略

- **附加字段**：允许（不验证未列出的字段）
- **字段类型**：严格匹配
- **数值**：按合同规定（精确值/范围/非零）

---

## 单元 3：连接与房间测试

| 测试名 | 目标 |
|--------|------|
| TestWS_Connect | 连接建立，welcome 消息 |
| TestWS_Disconnect_InRoom | 断开连接，player_left 广播 |
| TestWS_UnknownType | 未知消息类型 |
| TestWS_InvalidTopLevelJSON | 非法 JSON |
| TestWS_JoinRoom_NewRoom | 创建新房间 |
| TestWS_JoinRoom_ExistingRoom | 加入已存在房间 |
| TestWS_JoinRoom_Full | 房间满 |
| TestWS_LeaveRoom | 离开房间 |

---

## 单元 4：消息分发测试

### 按消息类型组织（含正常/异常路径）

| 消息 | 测试名 | 覆盖路径 |
|------|--------|---------|
| `move` | TestWS_Move | 正常广播、无房间静默、非法JSON静默 |
| `chat` | TestWS_Chat | 正常广播（含发送者）、无房间静默、非法JSON静默 |
| `shoot` | TestWS_Shoot | 正常广播、无房间静默、非法JSON零值广播、冷却 |
| `reload` | TestWS_Reload | 正常（有/无房间）、 |
| `respawn` | TestWS_Respawn | 正常广播、无房间（发送者收到）、非法JSON零值广播 |
| `weapon_change` | TestWS_WeaponChange | 正常广播、无房间广播静默、非法JSON静默 |
| `voice_start` | TestWS_VoiceStart | 正常广播、无房间静默 |
| `voice_stop` | TestWS_VoiceStop | 正常广播、无房间静默 |
| `voice_data` | TestWS_VoiceData | 正常广播、无房间静默 |
| `team_join` | TestWS_TeamJoin | 正常广播、无房间静默、非法JSON静默 |
| `grenade_throw` | TestWS_GrenadeThrow | 正常广播、无房间静默、非法JSON静默 |
| `c4_plant` | TestWS_C4Plant | 正常广播、无房间静默、非法JSON静默 |
| `c4_defuse` | TestWS_C4Defuse | 正常广播、无房间静默、无C4静默 |
| `skill_use` | TestWS_SkillUse | 正常广播、无房间静默、非法JSON静默、冷却 |
| `emote` | TestWS_Emote | 正常广播、无房间静默、非法JSON静默 |
| `ping` | TestWS_Ping | 正常广播、无房间静默、非法JSON静默 |

### 最小合法 payload

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
| `grenade_throw` | `{"type":"frag","position":{...},"velocity":{...}}` |
| `c4_plant` | `{"position":{...}}` |
| `c4_defuse` | `{}` |
| `skill_use` | `{"skill_id":"heal","x":0,"y":0,"z":0}` |
| `emote` | `{"emote_id":"wave"}` |
| `ping` | `{"type":"enemy","x":1,"y":2,"z":3,"message":"here"}` |

### weapon_change 无房间行为

**黑盒限制**：本地状态更新（`SetWeapon`）在黑盒测试中不可直接验证。

**测试策略**：仅验证广播静默。若需验证本地状态，需后续增加白盒测试或通过其他消息间接验证。

---

## 单元 5：并发测试

### TestConcurrent_Broadcast

**系统可靠性**：广播使用非阻塞发送，缓冲区满时允许丢失。这是产品语义。

**阈值依据**：
- 5 客户端 × 5 条 × 5 接收者 = 125 条
- 允许 20% 丢失（25 条）作为 **测试稳定性容差**（非产品语义）
- 理论丢失原因：发送方缓冲区满

**断言**：
- 总 chat 数 >= 100
- 每客户端 >= 15 条

---

## 最小断言合同

| 消息 | 必验字段 | 断言方式 |
|------|----------|---------|
| `welcome` | `player_id` | 非空 |
| `room_joined` | `room_id`, `player_id` | room_id 非空 |
| `player_joined` | `player_id` | 非空 |
| `player_left` | `player_id` | 精确匹配 |
| `player_moved` | `player_id`, `position.x/y/z`, `rotation` | 存在 |
| `chat` | `player_id`, `message` | 精确匹配 |
| `player_shot` | `player_id`, `ammo`, `position`, `rotation` | 存在（position 可 null） |
| `reload` | `ammo`, `ammo_reserve` | ammo > 0 |
| `respawn` | `health`, `ammo`, `position.x/y/z` | health=100, ammo>0 |
| `player_respawned` | `player_id`, `position.x/y/z` | 存在 |
| `weapon_changed` | `player_id`, `weapon` | 精确匹配 |
| `voice_start` | `player_id` | 非空 |
| `voice_stop` | `player_id` | 非空 |
| `voice_data` | `player_id`, `audio` | 非空 |
| `team_changed` | `player_id`, `team` | 精确匹配 |
| `grenade_thrown` | `player_id`, `type`, `position.x/y/z` | type 精确匹配 |
| `c4_planted` | `player_id`, `position.x/y/z`, `team` | 存在 |
| `c4_defused` | `player_id`, `team` | 非空 |
| `skill_used` | `player_id`, `skill_id` | 精确匹配 |
| `emote` | `player_id`, `emote_id` | 精确匹配 |
| `ping` | `player_id`, `type`, `position.x/y/z`, `message` | type 精确匹配 |
| `error` | `message` | 包含关键字 |

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
| `welcome` 消息详细内容 | 仅验证 playerID |

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
| 单元 2：测试基础设施 | 1h |
| 单元 3：连接与房间 | 0.5h |
| 单元 4：消息分发 | 2h |
| 单元 5：并发测试 | 0.5h |
| **总计** | **4.5h** |
