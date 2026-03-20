# 网络层测试覆盖率完善设计

## 目标

将 `server/internal/network` 包的测试覆盖率从 33.9% 提升到 90%+。

**范围**：仅 `server.go` 文件（包内无其他源文件）。

---

## 行为契约

### 统一规则

| 场景 | 行为 |
|------|------|
| 需要房间的消息 + 未入房 | 静默忽略，不返回错误，不崩溃 |
| `reload` | 无需房间，直接返回弹药状态 |

### 消息类型行为

| 输入消息 | 需要房间 | 发送者收到 | 其他玩家收到 | 说明 |
|----------|---------|-----------|-------------|------|
| `join_room` | 否 | `room_joined` | `player_joined` | 创建或加入 |
| `leave_room` | 是 | ❌ | `player_left` | 排除发送者 |
| `move` | 是 | ❌ | `player_moved` | 排除发送者 |
| `chat` | 是 | ✅ | ✅ | 广播给全房间（含发送者） |
| `shoot` | 是 | ❌ | `player_shot` | 排除发送者 |
| `reload` | **否** | `reload` | ❌ | 仅发给自己 |
| `respawn` | 是 | `reload` + `player_respawned` | ✅ | 发给自己 + 广播 |
| `weapon_change` | 是 | ✅ | ✅ | **广播给全房间（含发送者），用于同步所有客户端** |
| `voice_*` | 是 | ❌ | ✅ | 排除发送者 |
| `team_join` | 是 | ✅ | ✅ | 广播给全房间 |
| `grenade_throw` | 是 | ✅ | ✅ | 广播给全房间 |
| `c4_*` | 是 | ✅ | ✅ | 广播给全房间 |
| `skill_use` | 是 | ✅ | ✅ | 广播给全房间 |
| `emote` | 是 | ✅ | ✅ | 广播给全房间 |
| `ping` | 是 | ✅ | ✅ | 广播给全房间 |

**`weapon_change` 设计理由**：武器切换是状态同步，需要所有客户端（包括发送者）收到通知以更新 UI。

---

## 必测分支清单

### readPump

| 分支 | 测试场景 | 必须 |
|------|----------|------|
| 正常读取消息 | 发送 chat 收到响应 | ✅ |
| JSON 解析失败 | 发送非法 JSON | ✅ |
| 连接关闭 | 客户端断开 | ✅ |
| 在房间内断开 | 离开房间后 unregister | ✅ |
| `pongWait` 超时 | - | ❌ |

### writePump

| 分支 | 测试场景 | 必须 |
|------|----------|------|
| 正常写入消息 | 广播消息 | ✅ |
| 批量写入 | 发送多条消息 | ✅ |
| Ping 周期 | 等待 ping | ✅ |
| `Send` 通道关闭 | 客户端断开后 | ✅ |
| `writeWait` 超时 | - | ❌ |

### Hub.Run

| 分支 | 测试场景 | 必须 |
|------|----------|------|
| register | 客户端连接 | ✅ |
| unregister | 客户端断开 | ✅ |
| 重复 unregister | - | ❌（不会发生） |
| `clientMap` 同步 | 并发连接 | ✅ |

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

// NewTestServer 创建独立测试服务器
// 契约：
// 1. 创建独立 Hub
// 2. 启动 Hub.Run()（后台 goroutine）
// 3. 创建 httptest.Server
// 返回后立即可用
func NewTestServer(t *testing.T) *TestServer

// Close 关闭服务器
// 契约：
// 1. 关闭 httptest.Server
// 2. Hub goroutine 常驻（不阻塞）
// 3. 不清理客户端连接
func (s *TestServer) Close()
```

**隔离策略**：每个测试创建独立 TestServer，不复用资源。

### Helper 函数

```go
const (
    defaultTimeout = 2 * time.Second
    noMsgTimeout   = 500 * time.Millisecond
)

// Connect 连接并返回 playerID
// 契约：
// 1. 建立 WebSocket 连接
// 2. 自动读取并验证 welcome 消息
// 3. 返回 playerID
func Connect(t *testing.T, ts *TestServer) (*websocket.Conn, string)

// CreateRoom 创建新房间并加入
// 契约：
// 1. 连接
// 2. 发送 join_room（无 room_id）
// 3. 读取并验证 room_joined
// 4. 返回 conn, playerID, roomID
func CreateRoom(t *testing.T, ts *TestServer) (*websocket.Conn, string, string)

// JoinRoom 加入已存在的房间
// 契约：
// 1. 连接
// 2. 发送 join_room（指定 roomID）
// 3. 读取并验证 room_joined
// 4. 返回 conn, playerID
func JoinRoom(t *testing.T, ts *TestServer, roomID string) (*websocket.Conn, string)

// Drain 清空所有待处理消息
// 契约：读取直到 noMsgTimeout 无消息
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
func NoMessage(t *testing.T, conn *websocket.Conn, timeout time.Duration)
```

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
前置：
  - A = CreateRoom(ts), Drain(A)
  - B = JoinRoom(ts, roomID), Drain(B)
步骤：CloseConn(A)
断言：B 收到 player_left
```

### 2. 房间操作

#### TestWS_JoinRoom_Full
```
前置：
  - A = CreateRoom(ts)
  - clients = FillRoom(ts, roomID, 9)
  - Drain(A), Drain(clients)
步骤：第 11 人 JoinRoom
断言：收到 error "Room is full"
```

### 3. 消息分发（表驱动）

```go
type testCase struct {
    name       string
    msgType    string
    data       interface{}  // 最小合法 payload
    needRoom   bool
    senderGets string
    otherGets  string
}

tests := []testCase{
    {"move", "move", map[string]float64{"x":1,"y":2,"z":3,"rotation":0}, true, "", "player_moved"},
    {"chat", "chat", map[string]string{"message":"hello"}, true, "chat", "chat"},
    {"shoot", "shoot", map[string]interface{}{"position":{"x":0,"y":0,"z":0},"rotation":0}, true, "", "player_shot"},
    {"reload", "reload", nil, false, "reload", ""},
    // ... 其他
}

// 测试逻辑：
// 1. A, B 加入房间，Drain
// 2. A 发送消息
// 3. 验证 A 是否收到（senderGets）
// 4. 验证 B 是否收到（otherGets）
```

### 4. 未入房操作

#### TestWS_NoRoom_Operations
```go
type noRoomCase struct {
    msgType string
    data    interface{}
}

needRoom := []noRoomCase{
    {"move", map[string]float64{"x":1,"y":2,"z":3,"rotation":0}},
    {"shoot", map[string]interface{}{"position":{"x":0,"y":0,"z":0},"rotation":0}},
    {"chat", map[string]string{"message":"test"}},
    {"leave_room", nil},
    // ... 所有需要房间的消息，使用合法 data
}

for _, tc := range needRoom {
    A = Connect(ts)
    Drain(A)
    Send(A, tc.msgType, tc.data)
    NoMessage(A, noMsgTimeout)
    
    // 验证连接仍可用：发送 join_room 能收到 room_joined
    Send(A, "join_room", map[string]string{"name":"test"})
    RecvType(A, "room_joined")
    CloseConn(A)
}
```

#### TestWS_Reload_NoRoom
```go
A = Connect(ts)  // 不加入房间
Drain(A)
Send(A, "reload", nil)
RecvType(A, "reload")  // 应该收到
CloseConn(A)
```

### 5. 并发测试

#### TestConcurrent_Broadcast
```
前置：5 客户端加入房间，全部 Drain
步骤：每个客户端发送 5 条 chat
断言：
  - 无崩溃、无死锁
  - 总接收数 >= 50（理论 100，允许丢弃）
  - 所有连接仍可用（能发送 ping 收到响应）
```

**丢弃策略说明**：`writePump` 在 `Send` 通道满时跳过消息，这是设计决策而非 bug。

---

## 实施步骤

1. **修复代码**：`handleWeaponChange` 和 `handleRespawn` 添加 `c.Room == nil` 检查
2. **编写测试工具**：TestServer, Helper
3. **编写测试**：按顺序
4. **运行覆盖率**：`go test -cover ./server/internal/network/`
5. **竞态检测**：`go test -race ./server/internal/network/`

---

## 成功标准

| 指标 | 目标 |
|------|------|
| 覆盖率 | ≥ 90% |
| 测试通过 | 100% |
| 竞态检测 | 无 fail |
| Goroutine | 接受 Hub 常驻 |

---

## 时间估计

| 任务 | 时间 |
|------|------|
| 修复代码 | 0.5 小时 |
| 测试工具 | 0.5 小时 |
| 测试编写 | 2 小时 |
| 调试优化 | 1 小时 |
| **总计** | **4 小时** |
