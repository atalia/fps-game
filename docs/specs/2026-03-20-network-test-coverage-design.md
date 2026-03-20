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

## Part 1：前置生产修复

### 修复内容

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

## Part 2：测试覆盖实现

### 可观察语义定义

| 术语 | 定义 |
|------|------|
| `静默` | 100ms 内无 websocket 消息到达任何接收方 |
| `零值广播` | 广播发生，JSON 字段为 Go 零值（数字=0，字符串=""，对象={}，数组=null） |
| `正常` | 期望的成功消息按断言合同到达 |
| `连接存活` | 发送 ping 并收到预期响应 |

### 测试工具接口

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

// NewTestServer 创建独立测试服务器
func NewTestServer(t *testing.T) *TestServer

// Close 关闭服务器
func (s *TestServer) Close()

// Connect 建立连接，消费 welcome，返回 (conn, playerID)
func Connect(t *testing.T, ts *TestServer) (*websocket.Conn, string)

// CreateRoom 创建房间，消费 welcome+room_joined，返回 (conn, playerID, roomID)
func CreateRoom(t *testing.T, ts *TestServer) (*websocket.Conn, string, string)

// JoinRoom 加入房间，消费 welcome+room_joined
func JoinRoom(t *testing.T, ts *TestServer, roomID string) (*websocket.Conn, string)

// CloseConn 关闭连接
func CloseConn(t *testing.T, conn *websocket.Conn)

// Send 发送消息
func Send(t *testing.T, conn *websocket.Conn, msgType string, data interface{})

// RecvType 接收并验证类型
func RecvType(t *testing.T, conn *websocket.Conn, wantType string) *Message

// RecvAll 接收所有消息（直到 drainWindow 内无新消息）
func RecvAll(t *testing.T, conn *websocket.Conn) []*Message

// Drain 清空消息队列
func Drain(t *testing.T, conn *websocket.Conn)

// NoMessage 验证 noMessageWait 内无消息
func NoMessage(t *testing.T, conn *websocket.Conn)

// FillRoom 填满房间
func FillRoom(t *testing.T, ts *TestServer, roomID string, count int) []*websocket.Conn

// CountType 统计消息类型数量
func CountType(msgs []*Message, msgType string) int
```

---

## 消息行为规范表

### `join_room` 语义

- 无 room_id：创建新房间并加入
- 有 room_id：加入已存在房间（不存在则创建）
- 房间满：返回 error

### 输入 → 输出规范

| 消息 | 输入示例 | 发送者收到 | 其他人收到 | 无房间 | JSON失败 |
|------|---------|-----------|-----------|-------|---------|
| `join_room` | `{"name":"test"}` | `room_joined` | `player_joined` | 正常（创建房间） | 静默 |
| `leave_room` | `{}` | ❌ | `player_left` | 静默 | N/A |
| `move` | `{"x":1,"y":2,"z":3,"rotation":0}` | ❌ | `player_moved` | 静默 | 零值广播 |
| `chat` | `{"message":"hello"}` | `chat` | `chat` | 静默 | 静默 |
| `shoot` | `{"position":{},"rotation":0}` | ❌ | `player_shot` | 静默 | 零值广播 |
| `reload` | `{}` | `reload` | ❌ | 正常 | N/A |
| `respawn` | `{"x":0,"y":0,"z":0}` | `respawn` | `player_respawned` | 发送者正常+广播静默 | 零值广播 |
| `weapon_change` | `{"weapon":"rifle"}` | `weapon_changed` | `weapon_changed` | 静默 | 静默 |
| `voice_start` | `{}` | ❌ | `voice_start` | 静默 | N/A |
| `voice_stop` | `{}` | ❌ | `voice_stop` | 静默 | N/A |
| `voice_data` | `{"audio":"base64"}` | ❌ | `voice_data` | 静默 | N/A |
| `team_join` | `{"team":"red"}` | `team_changed` | `team_changed` | 静默 | 零值广播 |
| `grenade_throw` | `{"type":"frag",...}` | `grenade_thrown` | `grenade_thrown` | 静默 | 零值广播 |
| `c4_plant` | `{"position":{}}` | `c4_planted` | `c4_planted` | 静默 | 零值广播 |
| `c4_defuse` | `{}` | `c4_defused` | `c4_defused` | 静默 | N/A |
| `skill_use` | `{"skill_id":"heal"}` | `skill_used` | `skill_used` | 静默 | 静默 |
| `emote` | `{"emote_id":"wave"}` | `emote` | `emote` | 静默 | 零值广播 |
| `ping` | `{"type":"enemy",...}` | `ping` | `ping` | 静默 | 零值广播 |

---

## JSON 解析失败测试

### 格式化 payload

```go
malformedPayload := json.RawMessage(`{invalid`)
```

### 零值形态说明

| 字段类型 | 零值 JSON 表现 |
|---------|---------------|
| 数字 | `0` |
| 字符串 | `""` |
| 对象 | `{}` |
| 数组/map | `null` 或 `{}` |

### 测试用例

| Handler | 预期行为 | 零值说明 |
|---------|---------|---------|
| `join_room` | 静默 | - |
| `move` | 其他人收到 `player_moved`，position 为 `{}` | 零值对象 |
| `chat` | 静默 | - |
| `shoot` | 其他人收到 `player_shot`，position 为 `null` | 零值 map |
| `respawn` | 发送者收到零值，其他人收到 `player_respawned` | 零值对象 |
| `weapon_change` | 静默 | - |
| `team_join` | 广播 `team_changed`，team 为 `""` | 零值字符串 |
| `grenade_throw` | 广播 `grenade_thrown`，字段为零值 | 零值混合 |
| `c4_plant` | 广播 `c4_planted`，position 为 `{}` | 零值对象 |
| `skill_use` | 静默 | - |
| `emote` | 广播 `emote`，emote_id 为 `""` | 零值字符串 |
| `ping` | 广播 `ping`，字段为零值 | 零值混合 |

---

## 最小断言合同

| 消息 | 必验字段 | 断言方式 |
|------|----------|----------|
| `room_joined` | `room_id`, `player_id` | room_id 非空 |
| `player_joined` | `player_id` | 存在 |
| `player_left` | `player_id` | 精确等于发送者ID |
| `player_moved` | `player_id` | 存在（position 可为零值） |
| `chat` | `player_id`, `message` | message 精确匹配 |
| `player_shot` | `player_id` | 存在（position 不验证） |
| `reload` | `ammo`, `ammo_reserve` | 数值 >= 0 |
| `respawn` | `health`, `ammo` | 发送者收到，值 >= 0 |
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

- 发送者收到 `welcome`，playerID 非空

### TestWS_Disconnect_InRoom

- 前置：A、B 在同一房间
- 步骤：关闭 A 连接
- 断言：B 收到 `player_left`，player_id == A.playerID

### TestWS_UnknownType

- 步骤：发送 `{"type":"unknown","data":{}}`
- 断言：静默 + 连接存活（发送 ping 收到响应）

### TestWS_InvalidTopLevelJSON

- 步骤：发送原始 `{"invalid`
- 断言：静默 + 连接存活（发送 ping 收到响应）

---

## 异常测试

| 测试 | 输入 | 预期 |
|------|------|------|
| `TestWS_SkillOnCooldown` | 连续两次 `skill_use` | 第二次收到 `error` 包含 "cooldown" |
| `TestWS_Shoot_Cooldown` | 冷却期内 `shoot` | 静默 |
| `TestWS_C4Defuse_NoC4` | 未种包时 `c4_defuse` | 静默 |

---

## 并发测试设计

### 时序

```
1. 创建房间，5 客户端加入
2. 全部 Drain
3. 并发发送（每人 5 条 chat）
4. 等待 2s
5. 统计 chat 消息
6. 验证连接存活：每人发送 ping，验证收到
```

### 断言

- 无 panic、无死锁
- 总消息 >= 100（理论 125 = 5客户端 × 5条 × 5接收者）
- 每个客户端能发送 ping 并收到响应

### 允许丢失原因

系统使用非阻塞发送，缓冲区满时跳过。因此允许 20% 丢失。

---

## 不测范围

| 内容 | 原因 |
|------|------|
| `ServeWS` upgrade 失败 | HTTP 错误分支，覆盖率通过其他路径达成 |
| `readPump`/`writePump` 超时 | 需特殊客户端 |
| Ping 周期 | 60s 太长 |

---

## 实施清单（可独立提交阶段）

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

- 单播：`reload`
- 广播其他人：`move`, `shoot`, `voice_start`, `voice_stop`, `voice_data`
- 广播全房间：`chat`, `respawn`, `weapon_change`, `team_join`, `grenade_throw`, `c4_plant`, `c4_defuse`, `skill_use`, `emote`, `ping`

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
