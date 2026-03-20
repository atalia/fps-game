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

### 修复后行为

修复后，所有调用 `BroadcastToRoom(nil, ...)` 的路径变为静默返回。

---

## Part 2：测试覆盖实现

### 可观察语义定义

| 术语 | 定义 |
|------|------|
| `静默` | 100ms 内无 websocket 消息到达 |
| `零值广播` | 广播发生，payload 字段为 Go 零值（如 position 为 `{}`） |
| `正常` | 期望的成功消息按断言合同到达 |
| `连接存活` | 发送 ping 并收到预期响应 |

### 测试工具接口

```go
// TestServer 测试服务器
type TestServer struct {
    Server      *httptest.Server
    Hub         *Hub
    RoomManager *room.Manager
    URL         string
}

// 创建/清理
func NewTestServer(t *testing.T) *TestServer
func (s *TestServer) Close()

// 连接管理
func Connect(t *testing.T, ts *TestServer) (*websocket.Conn, string)
func CreateRoom(t *testing.T, ts *TestServer) (*websocket.Conn, string, string)
func JoinRoom(t *testing.T, ts *TestServer, roomID string) (*websocket.Conn, string)
func CloseConn(t *testing.T, conn *websocket.Conn)

// 消息操作
func Send(t *testing.T, conn *websocket.Conn, msgType string, data interface{})
func RecvType(t *testing.T, conn *websocket.Conn, wantType string) *Message
func RecvAll(t *testing.T, conn *websocket.Conn) []*Message
func Drain(t *testing.T, conn *websocket.Conn)
func NoMessage(t *testing.T, conn *websocket.Conn)

// 房间填充
func FillRoom(t *testing.T, ts *TestServer, roomID string, count int) []*websocket.Conn

// 统计
func CountType(msgs []*Message, msgType string) int
```

### 超时常量

```go
const (
    readTimeout   = 2 * time.Second
    drainWindow   = 200 * time.Millisecond
    noMessageWait = 100 * time.Millisecond
)
```

---

## 消息行为（修复后）

### 1. 单播给发送者

| 类型 | 发送者 | 其他人 | 无房间 | JSON失败 |
|------|-------|-------|-------|---------|
| `reload` | `reload` | ❌ | 正常 | N/A |

### 2. 广播给其他人（不含发送者）

| 类型 | 无房间 | JSON失败 |
|------|-------|---------|
| `move` | 静默 | 零值广播 |
| `shoot` | 静默 | 零值广播 |
| `voice_start` | 静默 | N/A |
| `voice_stop` | 静默 | N/A |
| `voice_data` | 静默 | N/A |
| `leave_room` | 静默 | N/A |

### 3. 广播给全房间（含发送者）

| 类型 | 无房间 | JSON失败 |
|------|-------|---------|
| `join_room` | 正常（创建房间） | 静默 |
| `chat` | 静默 | 静默 |
| `respawn` | 发送者正常+广播静默 | 零值广播 |
| `weapon_change` | 静默 | 静默 |
| `team_join` | 静默 | 零值广播 |
| `grenade_throw` | 静默 | 零值广播 |
| `c4_plant` | 静默 | 零值广播 |
| `c4_defuse` | 静默（无C4时也静默） | N/A |
| `skill_use` | 静默 | 静默 |
| `emote` | 静默 | 零值广播 |
| `ping` | 静默 | 零值广播 |

---

## JSON 解析失败测试

### 格式化 payload

```go
malformedPayload := json.RawMessage(`{invalid`)
```

### 测试范围

| Handler | 预期 |
|---------|------|
| `join_room` | 静默 |
| `move` | 零值广播（其他人收到 `player_moved`，position 为 `{}`） |
| `chat` | 静默 |
| `shoot` | 零值广播（其他人收到 `player_shot`，position 为 `null`） |
| `respawn` | 零值广播（发送者收到 `respawn` 零值，其他人收到 `player_respawned`） |
| `weapon_change` | 静默 |
| `team_join` | 零值广播 |
| `grenade_throw` | 零值广播 |
| `c4_plant` | 零值广播 |
| `skill_use` | 静默 |
| `emote` | 零值广播 |
| `ping` | 零值广播 |

---

## 最小断言合同

| 消息 | 必验字段 | 断言方式 |
|------|----------|----------|
| `room_joined` | `room_id`, `player_id` | room_id 非空 |
| `player_joined` | `player_id` | 存在 |
| `player_left` | `player_id` | 精确等于发送者ID |
| `player_moved` | `player_id`, `position` | position 有 x/y/z（零值时为 `{}`） |
| `chat` | `player_id`, `message` | message 精确匹配 |
| `player_shot` | `player_id` | 存在 |
| `reload` | `ammo`, `ammo_reserve` | 数值 >= 0 |
| `respawn` | `health`, `ammo` | 发送者收到，值 >= 0 |
| `player_respawned` | `player_id`, `position` | 其他人收到 |
| `weapon_changed` | `player_id`, `weapon` | weapon 精确匹配 |
| `voice_start` | `player_id` | 存在 |
| `voice_stop` | `player_id` | 存在 |
| `voice_data` | `player_id` | 存在 |
| `team_changed` | `player_id`, `team` | team 精确匹配 |
| `grenade_thrown` | `player_id`, `type`, `position` | type 精确匹配 |
| `c4_planted` | `player_id`, `position` | position 有 x/y/z |
| `c4_defused` | `player_id` | 存在 |
| `skill_used` | `player_id`, `skill_id` | skill_id 精确匹配 |
| `emote` | `player_id`, `emote_id` | emote_id 精确匹配 |
| `ping` | `player_id`, `type`, `position` | type 精确匹配 |
| `error` | `message` | 包含关键字 |

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
- 总消息 >= 100（理论 125）
- 每个客户端能发送 ping 并收到响应

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
