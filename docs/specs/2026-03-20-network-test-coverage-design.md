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

### readPump/writePump 可测分支

| 分支 | 可测性 | 说明 |
|------|--------|------|
| 正常读取消息 | ✅ 可测 | 集成测试 |
| 消息解析失败 | ✅ 可测 | 发送非法 JSON |
| 连接关闭 | ✅ 可测 | 客户端断开 |
| 正常写入消息 | ✅ 可测 | 广播消息 |
| 批量写入 | ✅ 可测 | 发送多条消息 |
| Ping 发送 | ✅ 可测 | 等待 ping 周期 |
| `pongWait` 超时 | ❌ 不测 | 需禁用客户端自动 pong |
| `writeWait` 超时 | ❌ 不测 | 需模拟慢客户端 |

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
func NewTestServer(t *testing.T) *TestServer {
    ts := &TestServer{
        Hub:         NewHub(),
        RoomManager: room.NewManager(10, 10),
    }
    go ts.Hub.Run()
    // ... HTTP 服务器配置
    return ts
}

// Close 关闭服务器
// 注意：Hub goroutine 无法优雅退出，测试进程退出时清理
func (s *TestServer) Close()
```

### Helper 函数及消息消费契约

| Helper | 消费的消息 | 返回值 | 状态变更 |
|--------|-----------|--------|----------|
| `Connect(ts)` | `welcome` | `conn, playerID` | 已注册到 Hub |
| `CreateRoom(ts)` | `welcome`, `room_joined` | `conn, playerID, roomID` | 已加入房间 |
| `JoinRoom(ts, roomID)` | `welcome`, `room_joined` | `conn, playerID` | 已加入房间 |
| `FillRoom(ts, roomID, n)` | 各自的 `welcome`, `room_joined` | `[]conn` | n 人加入房间 |

```go
const (
    defaultTimeout = 2 * time.Second
    noMsgTimeout   = 500 * time.Millisecond
)

// Connect 连接并返回 playerID
// 契约：消费 welcome 消息
func Connect(t *testing.T, ts *TestServer) (*websocket.Conn, string)

// CreateRoom 创建房间并加入
// 契约：消费 welcome + room_joined
func CreateRoom(t *testing.T, ts *TestServer) (*websocket.Conn, string, string)

// JoinRoom 加入已存在房间
// 契约：消费 welcome + room_joined
func JoinRoom(t *testing.T, ts *TestServer, roomID string) (*websocket.Conn, string)

// CloseConn 关闭连接
func CloseConn(t *testing.T, conn *websocket.Conn)
```

### 消息工具

```go
// Send 发送消息
func Send(t *testing.T, conn *websocket.Conn, msgType string, data interface{})

// Recv 接收消息（带超时）
func Recv(t *testing.T, conn *websocket.Conn, timeout time.Duration) *Message

// RecvType 接收并验证类型，返回消息
func RecvType(t *testing.T, conn *websocket.Conn, wantType string) *Message

// NoMessage 验证超时内无消息
func NoMessage(t *testing.T, conn *websocket.Conn)

// RecvAll 接收所有消息直到超时（用于并发测试）
func RecvAll(t *testing.T, conn *websocket.Conn, timeout time.Duration) []*Message
```

---

## 消息类型矩阵

| 消息类型 | 需要加入房间 | 发送者收到 | 其他玩家收到 | 验证内容 |
|----------|-------------|-----------|-------------|----------|
| `join_room` | 否 | `room_joined` | `player_joined` | 房间 ID、玩家列表 |
| `leave_room` | 是 | 无 | `player_left` | player_id |
| `move` | 是 | 无 | `player_moved` | 坐标、旋转 |
| `chat` | 是 | 无 | `chat` | 消息内容 |
| `shoot` | 是 | 无 | `player_shot` | 位置、弹药 |
| `reload` | 是 | `reload` | 无 | 弹药值 |
| `respawn` | 是 | `respawn` | `player_respawned` | 位置、血量 |
| `weapon_change` | 是 | 无 | `weapon_changed` | 武器类型 |
| `voice_start` | 是 | 无 | `voice_start` | player_id |
| `voice_stop` | 是 | 无 | `voice_stop` | player_id |
| `voice_data` | 是 | 无 | `voice_data` | audio 数据 |
| `team_join` | 是 | 无 | `team_changed` | 队伍 |
| `grenade_throw` | 是 | 无 | `grenade_thrown` | 类型、位置、速度 |
| `c4_plant` | 是 | 无 | `c4_planted` | 位置 |
| `c4_defuse` | 是 | 无 | `c4_defused` | player_id |
| `skill_use` | 是 | 无 | `skill_used` | 技能 ID |
| `emote` | 是 | 无 | `emote` | 表情 ID |
| `ping` | 是 | 无 | `ping` | 位置、类型 |

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
    // 所有消息类型的矩阵已在上方定义
    // 测试逻辑：
    // 1. A、B 加入同一房间
    // 2. A 发送消息
    // 3. 根据矩阵验证：
    //    - 如果"发送者收到"，A 应收到对应类型
    //    - 如果"其他玩家收到"，B 应收到对应类型
}
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
  - 步骤 3 能正常处理（连接仍存活）
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
  - 每个客户端收到 20 条 chat（其他 4 人 * 5 条）
  - 无自己发送的消息
```

#### TestConcurrent_Disconnect
```
前置：10 个客户端加入同一房间
步骤：
  1. 随机关闭 5 个连接
  2. 剩余 5 个互相发消息
断言：
  - 无崩溃
  - 消息正常收发
```

---

## 成功标准

| 指标 | 目标 | 说明 |
|------|------|------|
| 整体覆盖率 | ≥ 90% | |
| 单元测试 | 100% 通过 | |
| 集成测试 | 100% 通过 | |
| 并发测试 | 100% 通过 | 无死锁、无崩溃 |
| 竞态检测 | 基本通过 | 排除 Hub goroutine 泄漏影响 |

**竞态检测说明**：
- Hub goroutine 泄漏可能导致 `-race` 报告
- 解决方案：每个测试独立进程，或忽略残留 goroutine 的竞态报告
- 未来改进：为 Hub 添加 stop 机制（不在本设计范围）

---

## Hub Goroutine 策略

**现状**：`Hub.Run()` 是无限循环，无 stop 机制。

**接受策略**：
1. 每个测试创建独立 Hub
2. 测试结束时 Hub goroutine 继续运行
3. 依赖测试进程退出清理
4. 不共享 Hub 状态

**影响**：
- 并发测试仍可靠（独立 Hub）
- `-race` 可能报告残留 goroutine
- 生产代码无需修改

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
