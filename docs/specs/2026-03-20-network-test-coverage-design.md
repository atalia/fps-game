# 网络层测试覆盖率完善设计

## 目标

将 `server/internal/network` 包的测试覆盖率从 33.9% 提升到 90%+。

## 现状分析

### 当前覆盖率基线

| 函数 | 当前 | 目标 | 说明 |
|------|------|------|------|
| `ServeWS` | 0% | 100% | 集成测试 |
| `HandleConnection` | 0% | 100% | 集成测试 |
| `readPump` | 0% | 70% | 超时分支不测 |
| `writePump` | 0% | 70% | 超时分支不测 |
| `handleMessage` | 60% | 100% | 分发测试 |
| `Hub.Run` | 部分 | 80% | 注册/注销路径 |
| `Hub.Broadcast` | 有 | 维持 | |
| `Hub.BroadcastToRoom` | 有 | 维持 | |

### readPump/writePump 测试映射

| 分支 | 测试用例 |
|------|----------|
| 正常读取消息 | `TestWS_MessageDispatch` |
| 消息解析失败 | `TestWS_InvalidJSON` |
| 连接关闭 | `TestWS_Disconnect_InRoom` |
| 正常写入消息 | `TestWS_Broadcast_TwoClients` |
| 批量写入 | `TestWS_HighVolume` |
| Ping 发送 | `TestWS_KeepAlive` |
| `pongWait` 超时 | ❌ 不测 |
| `writeWait` 超时 | ❌ 不测 |

**预期总覆盖率**：90%+

---

## 文件结构

```
server/internal/network/
├── server.go              # 现有代码
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

// NewTestServer 创建测试服务器
func NewTestServer(t *testing.T) *TestServer

// Close 关闭服务器
// 契约：关闭 httptest.Server，Hub goroutine 会泄漏
func (s *TestServer) Close()
```

### Helper 函数及消息消费契约

| Helper | 消费的消息 | 返回值 | 副作用 |
|--------|-----------|--------|--------|
| `Connect(ts)` | `welcome` | `conn, playerID` | 注册到 Hub |
| `CreateRoom(ts)` | `welcome`, `room_joined` | `conn, playerID, roomID` | 创建并加入房间 |
| `JoinRoom(ts, roomID)` | `welcome`, `room_joined` | `conn, playerID` | 加入房间 |
| `FillRoom(ts, roomID, n)` | 各自的 `welcome`, `room_joined` | `[]conn` | n 人加入房间 |

```go
const (
    defaultTimeout = 2 * time.Second
    noMsgTimeout   = 500 * time.Millisecond
)

// Connect 连接并返回 playerID
func Connect(t *testing.T, ts *TestServer) (*websocket.Conn, string)

// CreateRoom 创建房间并加入
func CreateRoom(t *testing.T, ts *TestServer) (*websocket.Conn, string, string)

// JoinRoom 加入已存在房间
func JoinRoom(t *testing.T, ts *TestServer, roomID string) (*websocket.Conn, string)

// FillRoom 填满房间
func FillRoom(t *testing.T, ts *TestServer, roomID string, count int) []*websocket.Conn

// CloseConn 关闭连接
func CloseConn(t *testing.T, conn *websocket.Conn)

// Send 发送消息
func Send(t *testing.T, conn *websocket.Conn, msgType string, data interface{})

// Recv 接收消息
func Recv(t *testing.T, conn *websocket.Conn, timeout time.Duration) *Message

// RecvType 接收并验证类型
func RecvType(t *testing.T, conn *websocket.Conn, wantType string) *Message

// NoMessage 验证超时内无消息
func NoMessage(t *testing.T, conn *websocket.Conn)

// RecvAll 接收所有消息直到超时
// 契约：读到 noMsgTimeout 无消息为止
func RecvAll(t *testing.T, conn *websocket.Conn, timeout time.Duration) []*Message
```

---

## 消息类型矩阵（基于代码分析）

| 消息类型 | 需要房间 | excludeID | 发送者收到 | 其他玩家收到 |
|----------|---------|-----------|-----------|-------------|
| `join_room` | 否 | `c.Player.ID` | ❌ | ✅ `player_joined` |
| `leave_room` | 是 | `c.Player.ID` | ❌ | ✅ `player_left` |
| `move` | 是 | `c.Player.ID` | ❌ | ✅ `player_moved` |
| `chat` | 是 | `""` | ✅ | ✅ |
| `shoot` | 是 | `c.Player.ID` | ❌ | ✅ `player_shot` |
| `reload` | 是 | N/A | ✅ 直接 Send | ❌ |
| `respawn` | 是 | `c.Player.ID` | ✅ 直接 Send | ✅ `player_respawned` |
| `weapon_change` | 是 | `""` | ✅ | ✅ |
| `voice_start` | 是 | `c.Player.ID` | ❌ | ✅ |
| `voice_stop` | 是 | `c.Player.ID` | ❌ | ✅ |
| `voice_data` | 是 | `c.Player.ID` | ❌ | ✅ |
| `team_join` | 是 | `""` | ✅ | ✅ |
| `grenade_throw` | 是 | `""` | ✅ | ✅ |
| `c4_plant` | 是 | `""` | ✅ | ✅ |
| `c4_defuse` | 是 | `""` | ✅ | ✅ |
| `skill_use` | 是 | `""` | ✅ | ✅ |
| `emote` | 是 | `""` | ✅ | ✅ |
| `ping` | 是 | `""` | ✅ | ✅ |

**说明**：
- `excludeID == c.Player.ID`：发送者不收到广播
- `excludeID == ""`：发送者也收到广播
- 直接 `Send`：只发给发送者

### 错误分支

| 消息类型 | 错误条件 | 发送者收到 |
|----------|---------|-----------|
| `join_room` | 房间满 | ✅ `error` "Room is full" |
| `skill_use` | 技能冷却中 | ✅ `error` "Skill on cooldown" |

---

## 测试场景

### 1. 连接生命周期

#### TestWS_Connect
```
步骤：Connect(ts)
断言：playerID 非空
```

#### TestWS_Disconnect_InRoom
```
前置：A、B 在同一房间
步骤：A 关闭连接
断言：B 收到 player_left，player_id == A
```

### 2. 房间操作

#### TestWS_JoinRoom_New
```
步骤：CreateRoom(ts)
断言：roomID 非空
```

#### TestWS_JoinRoom_Existing
```
前置：A 创建房间，获取 roomID
步骤：B = JoinRoom(ts, roomID)
断言：
  - B 的 room_joined 中 roomID 正确
  - A 收到 player_joined
```

#### TestWS_JoinRoom_Full
```
前置：
  - A 创建房间
  - FillRoom(ts, roomID, 9) 填满（共 10 人）
步骤：第 11 人尝试 JoinRoom
断言：收到 error 消息 "Room is full"
```

#### TestWS_LeaveRoom
```
前置：A、B 在同一房间
步骤：A 发送 leave_room
断言：B 收到 player_left
```

### 3. 消息分发测试

#### TestWS_MessageDispatch（表驱动）

```go
func TestWS_MessageDispatch(t *testing.T) {
    // 根据消息矩阵验证每种消息类型
    // 测试逻辑：
    // 1. A、B 加入同一房间
    // 2. A 发送消息
    // 3. 根据矩阵验证：
    //    - 如果"发送者收到"，验证 A 收到
    //    - 如果"其他玩家收到"，验证 B 收到
}
```

#### TestWS_SkillOnCooldown
```
前置：A 在房间内
步骤：
  1. A 发送 skill_use
  2. A 立即再次发送 skill_use
断言：第二次收到 error "Skill on cooldown"
```

### 4. 异常输入

#### TestWS_InvalidJSON
```
前置：A 已连接
步骤：
  1. A 发送 '{"invalid'
  2. 等待 500ms，验证无消息
  3. A 发送正常消息（如 ping）
断言：
  - 步骤 2 无消息
  - 步骤 3 能正常处理
```

#### TestWS_UnknownType
```
前置：A 已连接
步骤：
  1. A 发送 {"type":"unknown","data":{}}
  2. 等待 500ms
  3. A 发送正常消息
断言：
  - 步骤 2 无消息
  - 步骤 3 能正常处理
```

#### TestWS_NoRoom_Operations
```
前置：A 已连接但未加入房间
步骤：A 发送 move, shoot, chat
断言：每次等待 500ms 无消息
后续：A 加入房间后能正常操作
```

### 5. 并发测试

#### TestConcurrent_JoinSameRoom
```
前置：A 创建房间
步骤：5 个客户端同时 JoinRoom(ts, roomID)
断言：
  - 5 个客户端各自收到 room_joined
  - A 收到 5 个 player_joined
```

#### TestConcurrent_Broadcast
```
前置：5 个客户端加入同一房间，等待所有 welcome/room_joined 被消费
步骤：
  1. 每个客户端发送 5 条 chat
  2. 等待 2 秒收集所有消息
断言：
  - 每个客户端收到 25 条 chat（5 人 * 5 条，包含自己）
```

#### TestConcurrent_Disconnect
```
前置：10 个客户端加入同一房间，编号 0-9
步骤：
  1. 关闭客户端 0, 2, 4, 6, 8（固定编号）
  2. 剩余 5 个互相发消息
断言：
  - 无崩溃
  - 消息正常收发
```

### 6. writePump 分支

#### TestWS_HighVolume
```
前置：A、B 在同一房间
步骤：A 快速发送 100 条 chat
断言：
  - 连接不断开
  - B 收到消息（允许部分丢失）
```

#### TestWS_KeepAlive
```
前置：A 已连接
步骤：等待 5 秒（超过 pingPeriod）
断言：连接仍可用
```

---

## Hub Goroutine 策略

**现状**：`Hub.Run()` 是无限循环，无 stop 机制。

**接受策略**：
- 每个测试创建独立 Hub
- 测试结束时 Hub goroutine 继续运行
- 依赖测试进程退出清理

**竞态检测**：
- 默认运行 `go test -race`
- 如果残留 goroutine 导致警告，记录但不阻塞
- 验收标准：无确定性 panic/死锁

---

## 成功标准

| 指标 | 目标 |
|------|------|
| 整体覆盖率 | ≥ 90% |
| 单元测试 | 100% 通过 |
| 集成测试 | 100% 通过 |
| 并发测试 | 100% 通过（无死锁） |
| 竞态检测 | 无确定性 panic |

---

## 时间估计

| 任务 | 时间 |
|------|------|
| 测试工具函数 | 1 小时 |
| 连接/房间测试 | 0.5 小时 |
| 消息分发测试 | 1 小时 |
| 异常/并发测试 | 1 小时 |
| 调试优化 | 0.5 小时 |
| **总计** | **4 小时** |
