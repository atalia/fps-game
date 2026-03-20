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

### 必须完成（阻塞所有测试）

修复 `BroadcastToRoom` 添加 nil 检查：

```go
func (h *Hub) BroadcastToRoom(r *room.Room, msgType string, data interface{}, excludeID string) {
    if r == nil {
        return
    }
    // ... 原有逻辑
}
```

**执行顺序**：先提交此修复，再运行任何测试。

---

## 测试分层

| 层级 | 测试类型 | 覆盖内容 |
|------|---------|---------|
| 单元测试 | `server_test.go`（已有） | Hub 注册/注销、Broadcast 空房间 |
| 集成测试 | `server_ws_test.go`（新增） | WebSocket 连接、消息分发、异常处理 |
| 并发冒烟 | `server_ws_test.go` | 广播稳定性 |

---

## 消息语义矩阵

| 发送类型 | 发送者收到 | 其他人收到 | 无房间时 | 非法JSON | 冷却/无效 |
|----------|-----------|-----------|---------|---------|---------|
| `join_room` | `room_joined` | `player_joined` | 正常执行 | 静默 | - |
| `leave_room` | ❌ | `player_left` | 静默 | N/A | - |
| `move` | ❌ | `player_moved` | 静默 | 静默 | - |
| `chat` | `chat` | `chat` | 静默 | 静默 | - |
| `shoot` | ❌ | `player_shot` | 静默 | 静默 | 静默 |
| `reload` | `reload` | ❌ | 正常执行 | N/A | - |
| `respawn` | `respawn` | `player_respawned` | 静默 | 静默 | - |
| `weapon_change` | `weapon_changed` | `weapon_changed` | 静默 | 静默 | - |
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

**术语说明**：
- "正常执行"：按正常流程处理，返回预期消息
- "静默"：无任何消息返回
- `❌`：不收到广播（被 excludeID 排除）

**期望条数公式**（n 人房间）：
- 含发送者：n 条（发送者 1 + 其他人 n-1）
- 不含发送者：n-1 条

---

## JSON 解析失败期望

| Handler | 失败时行为 | 连接状态 |
|---------|-----------|---------|
| `join_room` | 静默 | 存活 |
| `move` | 静默 | 存活 |
| `chat` | 静默 | 存活 |
| `shoot` | 静默 | 存活 |
| `respawn` | 静默 | 存活 |
| `weapon_change` | 静默 | 存活 |
| `team_join` | 静默 | 存活 |
| `grenade_throw` | 静默 | 存活 |
| `c4_plant` | 静默 | 存活 |
| `skill_use` | 静默 | 存活 |
| `emote` | 静默 | 存活 |
| `ping` | 静默 | 存活 |

---

## 错误消息匹配策略

| 场景 | 匹配方式 |
|------|---------|
| 房间满 | 包含 "full" |
| 技能冷却 | 包含 "cooldown" |
| 其他错误 | 验证收到 `error` 类型即可 |

---

## 测试工具设计

### TestServer

```go
type TestServer struct {
    Server      *httptest.Server
    Hub         *Hub
    RoomManager *room.Manager
    URL         string
}

// NewTestServer 创建独立测试服务器
func NewTestServer(t *testing.T) *TestServer

// Close 关闭 httptest.Server
// Hub goroutine 常驻（架构限制）
func (s *TestServer) Close()
```

### Helper 函数

```go
const (
    defaultTimeout = 2 * time.Second
    drainTimeout   = 500 * time.Millisecond
)

// Connect 连接，消费 welcome，返回 (conn, playerID)
func Connect(t *testing.T, ts *TestServer) (*websocket.Conn, string)

// CreateRoom 创建房间，消费 welcome+room_joined
func CreateRoom(t *testing.T, ts *TestServer) (*websocket.Conn, string, string)

// JoinRoom 加入房间，消费 welcome+room_joined
func JoinRoom(t *testing.T, ts *TestServer, roomID string) (*websocket.Conn, string)

// FillRoom 填满房间
func FillRoom(t *testing.T, ts *TestServer, roomID string, count int) []*websocket.Conn

// Drain 清空消息
func Drain(t *testing.T, conn *websocket.Conn)

// Send 发送消息
func Send(t *testing.T, conn *websocket.Conn, msgType string, data interface{})

// RecvType 接收并验证类型
func RecvType(t *testing.T, conn *websocket.Conn, wantType string) *Message

// RecvAll 接收所有消息（兼容当前实现的批量写入格式）
func RecvAll(t *testing.T, conn *websocket.Conn) []*Message

// NoMessage 验证无消息
func NoMessage(t *testing.T, conn *websocket.Conn)

// CountType 统计消息类型
func CountType(msgs []*Message, msgType string) int
```

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
| `voice_data` | `player_id`, `audio` | audio 存在 |
| `team_changed` | `player_id`, `team` | team 精确匹配 |
| `grenade_thrown` | `player_id`, `type`, `position` | type 精确匹配 |
| `c4_planted` | `player_id`, `position` | position 有 x/y/z |
| `c4_defused` | `player_id` | 存在 |
| `skill_used` | `player_id`, `skill_id` | skill_id 精确匹配 |
| `emote` | `player_id`, `emote_id` | emote_id 精确匹配 |
| `ping` | `player_id`, `type` (data内), `position` | type 精确匹配 |
| `error` | `message` | 包含关键字 |

---

## 测试场景

### 1. 连接测试

- `TestWS_Connect`：playerID 非空
- `TestWS_Disconnect_InRoom`：其他人收到 player_left
- `TestWS_UnknownType`：NoMessage + 连接存活
- `TestWS_InvalidTopLevelJSON`：NoMessage + 连接存活

### 2. 房间测试

- `TestWS_JoinRoom_NewRoom`：创建新房间
- `TestWS_JoinRoom_ExistingRoom`：加入已存在房间
- `TestWS_JoinRoom_Full`：房间满返回 error（包含 "full"）
- `TestWS_LeaveRoom`：其他人收到 player_left

### 3. 消息分发测试

覆盖所有消息类型（含 reload），按语义矩阵验证。

### 4. JSON 解析失败测试

覆盖所有解析 data 的 handler。

### 5. 异常测试

- `TestWS_SkillOnCooldown`：连续两次 → 第二次 error（包含 "cooldown"）
- `TestWS_InvalidSkill`：无效技能 → error
- `TestWS_Shoot_Cooldown`：快速连续发送 → 至少 1 次
- `TestWS_Reload_NoRoom`：无房间时 reload → 正常收到 reload

### 6. 无房间操作测试

需要房间的消息：`leave_room`, `move`, `chat`, `shoot`, `respawn`, `weapon_change`, `voice_start`, `voice_stop`, `voice_data`, `team_join`, `grenade_throw`, `c4_plant`, `c4_defuse`, `skill_use`, `emote`, `ping`

每个验证：NoMessage + 连接存活

### 7. 并发测试

- 5 客户端各发 5 条 chat
- 期望：5 × 5 × 5 = 125 条
- 断言：无 panic、>= 100 条（允许 20% 丢失，因发送通道满）、连接存活

---

## 不测范围

| 内容 | 原因 |
|------|------|
| `ServeWS` upgrade 失败 | HTTP 错误分支 |
| `pongWait`/`writeWait` 超时 | 需特殊客户端 |
| Ping 周期 | 60s 太长 |

**覆盖率可行性**：主要路径（handler 分发、广播、异常）覆盖后可达 90%+。

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
