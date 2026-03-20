# 网络层测试覆盖率完善设计

## 目标

将 `server/internal/network` 包的测试覆盖率从 33.9% 提升到 90%+。

## 行为契约

### 统一规则

**"需要房间"的消息在 `c.Room == nil` 时一律静默忽略**，不返回错误、不崩溃。

### 消息分类

| 类型 | 需要房间 | 未入房行为 |
|------|---------|-----------|
| `join_room` | 否 | 正常执行 |
| `leave_room` | 是 | 静默忽略 |
| `move` | 是 | 静默忽略 |
| `chat` | 是 | 静默忽略 |
| `shoot` | 是 | 静默忽略 |
| `reload` | **否** | 正常执行（发给自己） |
| `respawn` | 是 | **需修复**：静默忽略 |
| `weapon_change` | 是 | **需修复**：静默忽略 |
| `voice_*` | 是 | 静默忽略 |
| `team_join` | 是 | 静默忽略 |
| `grenade_throw` | 是 | 静默忽略 |
| `c4_*` | 是 | 静默忽略 |
| `skill_use` | 是 | 静默忽略 |
| `emote` | 是 | 静默忽略 |
| `ping` | 是 | 静默忽略 |

### 需修复的代码

| 函数 | 问题 | 修复方案 |
|------|------|----------|
| `handleWeaponChange` | 无 `c.Room == nil` 检查 | 添加检查，未入房直接 return |
| `handleRespawn` | 无 `c.Room == nil` 检查 | 添加检查，未入房直接 return |

---

## 覆盖率目标

| 函数 | 当前 | 目标 | 覆盖方式 |
|------|------|------|----------|
| `ServeWS` | 0% | 100% | 集成测试 |
| `HandleConnection` | 0% | 100% | 集成测试 |
| `readPump` | 0% | 70% | 集成测试（超时分支除外） |
| `writePump` | 0% | 70% | 集成测试（超时分支除外） |
| `handleMessage` | 60% | 100% | 集成测试 |
| `Hub.Run` | 部分 | 80% | 集成测试 |

### 单元测试 vs 集成测试分工

| 测试内容 | 单元测试 (server_test.go) | 集成测试 (server_ws_test.go) |
|----------|---------------------------|------------------------------|
| Hub 注册/注销 | ✅ 已有 | - |
| Broadcast 空房间 | ✅ 已有 | - |
| handle* 边界条件 | ✅ 已有 | 补充完整 |
| WebSocket 连接 | - | ✅ 新增 |
| 消息分发 | - | ✅ 新增 |
| 广播验证 | - | ✅ 新增 |
| 并发安全 | - | ✅ 新增 |

---

## 文件结构

```
server/internal/network/
├── server.go              # 修复 nil Room
├── server_test.go         # 现有单元测试
└── server_ws_test.go      # 集成测试（新增）
```

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

// NewTestServer 创建测试服务器（独立 Hub，不复用）
func NewTestServer(t *testing.T) *TestServer

// Close 关闭服务器
// 契约：关闭 httptest.Server，Hub goroutine 常驻（不阻塞测试）
func (s *TestServer) Close()
```

### Helper 函数

```go
const (
    defaultTimeout = 2 * time.Second
    noMsgTimeout   = 500 * time.Millisecond
)

// Connect 连接并返回 playerID
// 消费：welcome
func Connect(t *testing.T, ts *TestServer) (*websocket.Conn, string)

// CreateRoom 创建新房间并加入
// 消费：welcome, room_joined
// 返回：conn, playerID, roomID
func CreateRoom(t *testing.T, ts *TestServer) (*websocket.Conn, string, string)

// JoinRoom 加入已存在的房间
// 消费：welcome, room_joined
// 参数：roomID 必须是已存在的房间 ID
func JoinRoom(t *testing.T, ts *TestServer, roomID string) (*websocket.Conn, string)

// FillRoom 填满房间
// 消费：各自的 welcome, room_joined
func FillRoom(t *testing.T, ts *TestServer, roomID string, count int) []*websocket.Conn

// Drain 清空所有待处理消息
// 消费：直到 noMsgTimeout 无消息
func Drain(t *testing.T, conn *websocket.Conn)

// CloseConn 关闭连接
func CloseConn(t *testing.T, conn *websocket.Conn)

// Send 发送消息
func Send(t *testing.T, conn *websocket.Conn, msgType string, data interface{})

// Recv 接收消息
func Recv(t *testing.T, conn *websocket.Conn, timeout time.Duration) *Message

// RecvType 接收并验证类型
func RecvType(t *testing.T, conn *websocket.Conn, wantType string) *Message

// NoMessage 验证超时内无消息
// 参数：timeout 如 500 * time.Millisecond
func NoMessage(t *testing.T, conn *websocket.Conn, timeout time.Duration)
```

**使用契约**：
- 每个测试创建独立 TestServer
- 验证广播前先 Drain 清空历史消息
- 测试结束时 CloseConn

---

## 消息类型矩阵

| 输入 | 输出消息 | 需房间 | excludeID | 发送者收到 | 其他收到 |
|------|----------|-------|-----------|-----------|---------|
| `join_room` | `room_joined` / `player_joined` | 否 | `c.Player.ID` | ❌ | ✅ |
| `leave_room` | `player_left` | 是 | `c.Player.ID` | ❌ | ✅ |
| `move` | `player_moved` | 是 | `c.Player.ID` | ❌ | ✅ |
| `chat` | `chat` | 是 | `""` | ✅ | ✅ |
| `shoot` | `player_shot` | 是 | `c.Player.ID` | ❌ | ✅ |
| `reload` | `reload` | **否** | N/A | ✅ 直接 | ❌ |
| `respawn` | `respawn` / `player_respawned` | 是 | `c.Player.ID` | ✅ 直接 | ✅ |
| `weapon_change` | `weapon_changed` | 是 | `""` | ✅ | ✅ |
| `voice_start` | `voice_start` | 是 | `c.Player.ID` | ❌ | ✅ |
| `voice_stop` | `voice_stop` | 是 | `c.Player.ID` | ❌ | ✅ |
| `voice_data` | `voice_data` | 是 | `c.Player.ID` | ❌ | ✅ |
| `team_join` | `team_changed` | 是 | `""` | ✅ | ✅ |
| `grenade_throw` | `grenade_thrown` | 是 | `""` | ✅ | ✅ |
| `c4_plant` | `c4_planted` | 是 | `""` | ✅ | ✅ |
| `c4_defuse` | `c4_defused` | 是 | `""` | ✅ | ✅ |
| `skill_use` | `skill_used` | 是 | `""` | ✅ | ✅ |
| `emote` | `emote` | 是 | `""` | ✅ | ✅ |
| `ping` | `ping` | 是 | `""` | ✅ | ✅ |

---

## 测试场景

### 1. 连接测试

#### TestWS_Connect
```
步骤：Connect(ts)
断言：playerID 非空
```

#### TestWS_Disconnect_InRoom
```
前置：A、B 在同一房间，Drain(A), Drain(B)
步骤：CloseConn(A)
断言：B 收到 player_left
```

### 2. 房间操作

#### TestWS_JoinRoom_New
```
步骤：CreateRoom(ts)
断言：roomID 非空
```

#### TestWS_JoinRoom_Existing
```
前置：A 创建房间，Drain(A)
步骤：B = JoinRoom(ts, roomID)
断言：
  - B 收到 room_joined
  - A 收到 player_joined
```

#### TestWS_JoinRoom_Full
```
前置：A 创建房间，FillRoom(9)，Drain(A)
步骤：第 11 人尝试 JoinRoom
断言：收到 error "Room is full"
```

### 3. 消息分发

#### TestWS_MessageDispatch（表驱动）
```go
tests := []struct {
    name       string
    msgType    string
    data       interface{}
    needRoom   bool     // 是否需要房间
    senderGets string   // 发送者收到的类型
    otherGets  string   // 其他玩家收到的类型
}{
    {"move", "move", moveData, true, "", "player_moved"},
    {"chat", "chat", chatData, true, "chat", "chat"},
    {"shoot", "shoot", shootData, true, "", "player_shot"},
    {"reload", "reload", nil, false, "reload", ""},  // 无需房间
    {"respawn", "respawn", respawnData, true, "respawn", "player_respawned"},
    {"weapon_change", "weapon_change", weaponData, true, "weapon_changed", "weapon_changed"},
    // ... 其他
}
```

### 4. 未入房操作

#### TestWS_NoRoom_Operations
```go
// 测试所有需要房间的消息在未入房时静默忽略
needRoom := []string{
    "move", "shoot", "chat", "leave_room",
    "voice_start", "voice_stop", "voice_data",
    "team_join", "grenade_throw", "c4_plant", "c4_defuse",
    "skill_use", "emote", "ping",
    "respawn", "weapon_change",  // 修复后测试
}

for _, msgType := range needRoom {
    A = Connect(ts)  // 不加入房间
    Drain(A)
    Send(A, msgType, data)
    NoMessage(A, noMsgTimeout)
    // 验证连接仍可用
    _, _ = CreateRoom(ts)  // 能正常创建房间
}
```

#### TestWS_Reload_NoRoom
```go
// reload 不需要房间
A = Connect(ts)  // 不加入房间
Drain(A)
Send(A, "reload", nil)
RecvType(A, "reload")  // 应该收到
```

### 5. 并发测试

#### TestConcurrent_Broadcast
```
前置：5 客户端加入房间，全部 Drain
步骤：每个客户端发送 5 条 chat
断言：
  - 无崩溃、无死锁
  - 总消息数 >= 50（允许丢消息，记录原因）
  - 所有连接仍可用
```

#### TestConcurrent_Disconnect
```
前置：10 客户端加入房间，编号 0-9
步骤：关闭 0,2,4,6,8，剩余 5 个发消息
断言：无崩溃，消息正常收发
```

---

## 实施步骤

1. **修复代码**：`handleWeaponChange` 和 `handleRespawn` 添加 nil 检查
2. **编写测试工具**：TestServer, Helper
3. **编写测试**：连接 → 房间 → 消息 → 异常 → 并发
4. **运行覆盖率**：`go test -cover ./...`
5. **竞态检测**：`go test -race ./...`

---

## 成功标准

| 指标 | 目标 |
|------|------|
| 覆盖率 | ≥ 90% |
| 测试通过 | 100% |
| 竞态检测 | 无 fail |
| Goroutine | 接受 Hub 常驻，不纳入泄漏检测 |

---

## 时间估计

| 任务 | 时间 |
|------|------|
| 修复代码 | 0.5 小时 |
| 测试工具 | 0.5 小时 |
| 测试编写 | 2 小时 |
| 调试优化 | 1 小时 |
| **总计** | **4 小时** |
