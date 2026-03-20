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

## 前置修复（独立 PR，测试前必须完成）

### 唯一方案：修复 BroadcastToRoom

```go
func (h *Hub) BroadcastToRoom(r *room.Room, msgType string, data interface{}, excludeID string) {
    if r == nil {
        return  // nil-safe，所有调用点自动安全
    }
    msg := NewMessage(msgType, data)
    h.mu.RLock()
    defer h.mu.RUnlock()

    for playerID := range r.Players {
        if playerID == excludeID {
            continue
        }
        if client, ok := h.clientMap[playerID]; ok {
            select {
            case client.Send <- msg.ToJSON():
            default:
                // 缓冲区满，跳过（允许丢消息）
            }
        }
    }
}
```

**契约**：
- `r == nil`：静默返回
- `r.Players` 为空：遍历空 map，无效果
- `client.Send` 满或关闭：default 分支跳过
- `excludeID == ""`：所有玩家都收到（含发送者）
- `excludeID != ""`：排除指定玩家

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
// 契约：
// 1. 创建独立 Hub 和 RoomManager
// 2. 启动 Hub.Run()（一个独立 goroutine）
// 3. 创建 httptest.Server
// 4. 返回后立即可用
func NewTestServer(t *testing.T) *TestServer

// Close 关闭 httptest.Server
// 契约：
// - Hub goroutine 常驻（Hub 无 stop 机制）
// - 接受 goroutine leak，测试进程退出时清理
// - 每个测试独立 TestServer，无跨测试污染
func (s *TestServer) Close()
```

### Helper 函数契约

```go
const (
    defaultTimeout = 2 * time.Second
    drainTimeout   = 500 * time.Millisecond
)

// Connect 连接服务器
// 契约：
// 1. 建立 WebSocket 连接
// 2. 自动读取第一条消息，验证类型为 "welcome"
// 3. 返回 (conn, playerID)
func Connect(t *testing.T, ts *TestServer) (*websocket.Conn, string)

// CreateRoom 创建并加入房间
// 契约：
// 1. Connect
// 2. 发送 join_room（无 room_id）
// 3. 等待 room_joined
// 4. 返回 (conn, playerID, roomID)
func CreateRoom(t *testing.T, ts *TestServer) (*websocket.Conn, string, string)

// JoinRoom 加入已存在房间
// 契约：
// 1. Connect
// 2. 发送 join_room（指定 roomID）
// 3. 等待 room_joined
// 4. 返回 (conn, playerID)
func JoinRoom(t *testing.T, ts *TestServer, roomID string) (*websocket.Conn, string)

// FillRoom 填满房间（count + 创建者 <= 10）
func FillRoom(t *testing.T, ts *TestServer, roomID string, count int) []*websocket.Conn

// Drain 清空消息队列
// 契约：持续读取直到 drainTimeout 内无新消息
func Drain(t *testing.T, conn *websocket.Conn)

// Send 发送消息
func Send(t *testing.T, conn *websocket.Conn, msgType string, data interface{})

// RecvType 接收并验证类型
func RecvType(t *testing.T, conn *websocket.Conn, wantType string) *Message

// RecvAll 接收所有消息
// 契约：持续读取直到 defaultTimeout 内无新消息
// 兼容批量写入：单 frame 内多条 JSON 用 \n 分隔
func RecvAll(t *testing.T, conn *websocket.Conn) []*Message

// NoMessage 验证 drainTimeout 内无消息
func NoMessage(t *testing.T, conn *websocket.Conn)

// CountType 统计消息类型数量
func CountType(msgs []*Message, msgType string) int
```

---

## 消息测试完整表

| 发送类型 | 输入 payload | 接收类型 | 需房间 | 发送者 | 其他 | 无房间 | 非法JSON |
|----------|-------------|----------|-------|-------|------|-------|---------|
| `join_room` | `{"name":"test"}` | `room_joined`/`player_joined` | 否 | ✅ | ✅ | 正常 | 静默 |
| `join_room` | `{"name":"test","room_id":"xxx"}` | `room_joined`/`player_joined` | 否 | ✅ | ✅ | 正常 | - |
| `leave_room` | `{}` | `player_left` | 是 | ❌ | ✅ | 静默 | - |
| `move` | `{"x":1,"y":2,"z":3,"rotation":0}` | `player_moved` | 是 | ❌ | ✅ | 静默 | 静默 |
| `chat` | `{"message":"hello"}` | `chat` | 是 | ✅ | ✅ | 静默 | 静默 |
| `shoot` | `{"position":{"x":0,"y":0,"z":0},"rotation":0}` | `player_shot` | 是 | ❌ | ✅ | 静默 | 静默 |
| `reload` | `{}` | `reload` | 否 | ✅ | ❌ | 正常 | - |
| `respawn` | `{"x":0,"y":0,"z":0}` | `respawn`/`player_respawned` | 是 | ✅ | ✅ | 静默 | 静默 |
| `weapon_change` | `{"weapon":"rifle"}` | `weapon_changed` | 是 | ✅ | ✅ | 静默 | 静默 |
| `voice_start` | `{}` | `voice_start` | 是 | ❌ | ✅ | 静默 | N/A |
| `voice_stop` | `{}` | `voice_stop` | 是 | ❌ | ✅ | 静默 | N/A |
| `voice_data` | `{"audio":"base64"}` | `voice_data` | 是 | ❌ | ✅ | 静默 | N/A |
| `team_join` | `{"team":"red"}` | `team_changed` | 是 | ✅ | ✅ | 静默 | 静默 |
| `grenade_throw` | `{"type":"frag","position":{"x":0,"y":0,"z":0},"velocity":{"x":0,"y":0,"z":0}}` | `grenade_thrown` | 是 | ✅ | ✅ | 静默 | 静默 |
| `c4_plant` | `{"position":{"x":0,"y":0,"z":0}}` | `c4_planted` | 是 | ✅ | ✅ | 静默 | 静默 |
| `c4_defuse` | `{}` | `c4_defused` | 是 | ✅ | ✅ | 静默 | N/A |
| `skill_use` | `{"skill_id":"heal"}` | `skill_used` | 是 | ✅ | ✅ | 静默 | 静默 |
| `emote` | `{"emote_id":"wave"}` | `emote` | 是 | ✅ | ✅ | 静默 | 静默 |
| `ping` | `{"type":"enemy","x":0,"y":0,"z":0,"message":""}` | `ping` | 是 | ✅ | ✅ | 静默 | 静默 |

**N/A 说明**：`voice_*` 和 `c4_defuse` 不解析 data 字段，无 JSON 解析失败分支。

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
| `respawn` | `health`, `ammo` | 发送者收到 |
| `player_respawned` | `player_id`, `position` | 其他人收到 |
| `weapon_changed` | `player_id`, `weapon` | weapon 精确匹配 |
| `voice_start` | `player_id` | 存在 |
| `voice_stop` | `player_id` | 存在 |
| `voice_data` | `player_id`, `audio` | audio 嵌套结构存在 |
| `team_changed` | `player_id`, `team` | team 精确匹配 |
| `grenade_thrown` | `player_id`, `type`, `position` | type 精确匹配 |
| `c4_planted` | `player_id`, `position` | position 有 x/y/z |
| `c4_defused` | `player_id` | 存在 |
| `skill_used` | `player_id`, `skill_id` | skill_id 精确匹配 |
| `emote` | `player_id`, `emote_id` | emote_id 精确匹配 |
| `ping` | `player_id`, `type`, `position` | data.type 精确匹配 |
| `error` | `message` | 包含预期文本 |

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
- `TestWS_JoinRoom_Full`：房间满返回 error
- `TestWS_LeaveRoom`：其他人收到 player_left

### 3. 消息分发测试（表驱动）

覆盖所有消息类型，验证：
- 接收类型正确
- 发送者/其他人接收符合预期
- 必验字段存在且精确匹配

**reload 单独测试**：无需房间场景。

### 4. JSON 解析失败测试

覆盖所有解析 data 的 handler：
`join_room`, `move`, `chat`, `shoot`, `respawn`, `weapon_change`, `team_join`, `grenade_throw`, `c4_plant`, `skill_use`, `emote`, `ping`

### 5. 异常测试

- `TestWS_SkillOnCooldown`：连续两次 → 第二次收到 error（断言：包含 "cooldown"）
- `TestWS_InvalidSkill`：无效技能 → 收到 error（断言：收到 error 类型即可）
- `TestWS_Shoot_Cooldown`：连续发送 → 至少收到 1 次（冒烟测试）
- `TestWS_NoRoom_Operations`：见下方完整列表

### 6. 无房间操作测试（完整列表）

需要房间的消息：`leave_room`, `move`, `chat`, `shoot`, `respawn`, `weapon_change`, `voice_start`, `voice_stop`, `voice_data`, `team_join`, `grenade_throw`, `c4_plant`, `c4_defuse`, `skill_use`, `emote`, `ping`

每个消息：
1. Connect（不加入房间）
2. 发送消息
3. NoMessage
4. 验证连接存活

### 7. 并发测试

- `TestConcurrent_Broadcast`：5 客户端各发 5 条 chat
- 断言：无 panic、无死锁、总消息 >= 100、连接存活

---

## 不测范围与覆盖率预算

| 排除内容 | 预估占比 | 说明 |
|----------|---------|------|
| `ServeWS` upgrade 失败 | ~2% | HTTP 错误分支 |
| `pongWait`/`writeWait` 超时 | ~3% | 超时分支 |
| Ping 周期 | ~1% | 时间相关 |
| **合计** | **~6%** | |

**可行性**：覆盖主要路径后，剩余 ~10% 裕度可吸收排除分支，90%+ 目标可达。

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
| 修复代码（独立 PR） | 0.5h |
| 测试工具 | 0.5h |
| 测试编写 | 2h |
| 调试 | 1h |
| **总计** | **4h** |
