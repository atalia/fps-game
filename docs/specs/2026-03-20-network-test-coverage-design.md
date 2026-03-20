# 网络层测试覆盖率完善设计

## 目标

将 `server/internal/network` 包的测试覆盖率从 33.9% 提升到 90%+。

## 现状分析

### 当前覆盖率基线

| 函数/路径 | 当前状态 | 说明 |
|-----------|----------|------|
| `Hub.Run()` | 部分 | 注册/注销有单测 |
| `Hub.Broadcast/ToRoom()` | 有单测 | 空房间场景 |
| `Hub.GetClient()` | 有单测 | |
| `ServeWS()` | 无 | 需要集成测试 |
| `HandleConnection()` | 无 | 需要集成测试 |
| `readPump()` | 无 | 需要集成测试 |
| `writePump()` | 无 | 需要集成测试 |
| `handleMessage()` | 部分 | 分发逻辑未完全覆盖 |
| 各 `handle*` 函数 | 有单测 | 现有 server_test.go |

### 覆盖率预算

| 函数 | 当前 | 目标 | 新增测试 |
|------|------|------|----------|
| `ServeWS` | 0% | 100% | 集成测试 |
| `HandleConnection` | 0% | 100% | 集成测试 |
| `readPump` | 0% | 70% | 集成测试（超时分支除外） |
| `writePump` | 0% | 70% | 集成测试（超时分支除外） |
| `handleMessage` | 60% | 100% | 消息分发测试 |
| 其他函数 | 80%+ | 维持 | 现有单测 |

**预期总覆盖率**：90%+

---

## 范围界定

### 网络层职责

| 测试重点 | 说明 |
|----------|------|
| 消息分发 | `handleMessage` 的 switch 分支覆盖 |
| 消息广播 | `Broadcast`/`BroadcastToRoom` 真实连接验证 |
| 连接管理 | `ServeWS`/`HandleConnection` 完整流程 |
| 异常处理 | 无效输入不崩溃 |

### 不测试的业务逻辑

由 game/room/player 包负责：
- 武器伤害、命中检测、技能效果、C4 爆炸范围

---

## 文件结构

```
server/internal/network/
├── server.go                  # 现有代码
├── server_test.go             # 现有单元测试
├── server_ws_test.go          # 集成测试（新增）
└── KNOWN_GAPS.md              # 未覆盖说明（新增）
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
// 注意：matcher 参数固定为 nil（当前实现未使用）
func NewTestServer(t *testing.T) *TestServer

// Close 关闭服务器
// 注意：Hub.Run() goroutine 会泄漏，测试进程退出时清理
func (s *TestServer) Close()
```

### 客户端工具

```go
const defaultTimeout = 2 * time.Second
const noMsgTimeout = 500 * time.Millisecond

// Connect 创建 WebSocket 连接
// 自动消费 welcome 消息，返回 player_id
func Connect(t *testing.T, ts *TestServer) (*websocket.Conn, string)

// CloseConn 关闭连接
func CloseConn(t *testing.T, conn *websocket.Conn)

// CreateRoom 创建房间并加入，返回 room_id
func CreateRoom(t *testing.T, ts *TestServer) (*websocket.Conn, string, string)

// JoinRoom 加入已存在的房间
func JoinRoom(t *testing.T, ts *TestServer, roomID string) (*websocket.Conn, string)

// FillRoom 填满房间（返回 N 个客户端连接）
func FillRoom(t *testing.T, ts *TestServer, roomID string, count int) []*websocket.Conn
```

### 消息工具

```go
// Send 发送消息
func Send(t *testing.T, conn *websocket.Conn, msgType string, data interface{})

// Recv 接收消息（带超时）
func Recv(t *testing.T, conn *websocket.Conn, timeout time.Duration) *Message

// RecvType 接收并验证类型
func RecvType(t *testing.T, conn *websocket.Conn, wantType string) *Message

// NoMessage 验证超时内无消息
func NoMessage(t *testing.T, conn *websocket.Conn)
```

**工具契约**：
- 每个连接只有一个 goroutine 读取消息
- `Connect` 自动消费 welcome
- 调用者负责 `CloseConn`

---

## 测试场景

### 1. 连接生命周期

#### TestWS_Connect

```
步骤：
  1. 调用 Connect(ts)
预期：
  - 返回非空 player_id
```

#### TestWS_Disconnect_WithRoom

```
前置：
  1. 客户端 A、B 加入同一房间
步骤：
  1. A 关闭连接
  2. B 等待消息
预期：
  - B 收到 player_left，player_id == A 的 ID
```

### 2. 房间操作

#### TestWS_JoinRoom_New

```
步骤：
  1. 调用 CreateRoom(ts)
预期：
  - 返回非空 room_id
```

#### TestWS_JoinRoom_Existing

```
前置：
  1. A 创建房间，获取 room_id
步骤：
  1. B 调用 JoinRoom(ts, room_id)
预期：
  - B 收到 room_joined，room_id 正确
  - A 收到 player_joined
```

#### TestWS_JoinRoom_Full

```
前置：
  1. 创建房间
  2. 填入 10 名玩家（房间满）
步骤：
  1. 第 11 名玩家尝试加入
预期：
  - 收到 error 消息，message == "Room is full"
```

#### TestWS_LeaveRoom

```
前置：
  1. A、B 加入同一房间
步骤：
  1. A 发送 leave_room
预期：
  - B 收到 player_left
```

### 3. 消息分发测试

**目标**：覆盖 `handleMessage` 所有 case 分支

#### 表驱动测试：消息分发

```go
func TestWS_MessageDispatch(t *testing.T) {
    tests := []struct {
        name      string
        msgType   string
        data      interface{}
        wantReply string   // 期望的响应类型
        broadcast bool     // 是否广播给其他玩家
    }{
        {"move", "move", moveData, "player_moved", true},
        {"chat", "chat", chatData, "chat", true},
        {"shoot", "shoot", shootData, "player_shot", true},
        {"reload", "reload", nil, "reload", false},
        {"respawn", "respawn", respawnData, "respawn", false},
        {"weapon_change", "weapon_change", weaponData, "weapon_changed", true},
        {"voice_start", "voice_start", nil, "voice_start", true},
        {"voice_stop", "voice_stop", nil, "voice_stop", true},
        {"team_join", "team_join", teamData, "team_changed", true},
        {"grenade_throw", "grenade_throw", grenadeData, "grenade_thrown", true},
        {"c4_plant", "c4_plant", c4Data, "c4_planted", true},
        {"c4_defuse", "c4_defuse", nil, "c4_defused", true},
        {"skill_use", "skill_use", skillData, "skill_used", true},
        {"emote", "emote", emoteData, "emote", true},
        {"ping", "ping", pingData, "ping", true},
        {"voice_data", "voice_data", voiceData, "voice_data", true},
    }
    
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            // 1. 创建两个客户端并加入同一房间
            // 2. A 发送消息
            // 3. 验证 B 收到广播（如果 broadcast）
            // 4. 验证 A 收到响应（如果 wantReply）
        })
    }
}
```

### 4. 异常输入

#### TestWS_InvalidJSON

```
步骤：
  1. 连接后发送非法 JSON: '{"invalid'
  2. 等待 500ms
预期：
  - 无消息
  - 连接仍可用（发送正常消息能收到响应）
```

#### TestWS_UnknownType

```
步骤：
  1. 发送 {"type":"unknown","data":{}}
  2. 等待 500ms
预期：
  - 无消息
```

#### TestWS_NoRoom_Operations

```
步骤：
  1. 连接但不加入房间
  2. 发送 move, shoot, chat
  3. 每次等待 500ms
预期：
  - 均无消息（被忽略）
```

#### TestWS_JoinRoom_MissingName

```
前置：
  1. A 创建房间
步骤：
  1. B 加入房间（不提供 name）
  2. A 收到 player_joined
预期：
  - A 收到的消息中 name 为空字符串
```

### 5. 并发测试

#### TestConcurrent_JoinSameRoom

```
前置：
  1. A 创建房间，获取 room_id
步骤：
  1. 5 个客户端同时 JoinRoom(ts, room_id)
预期：
  - 全部成功加入
  - A 收到 5 个 player_joined
```

#### TestConcurrent_Broadcast

```
前置：
  1. 5 个客户端加入同一房间
步骤：
  1. 每个客户端同时发送 5 条 chat
预期：
  - 无崩溃、无死锁
  - 总消息数 = 5 * 5 * 4 = 100 条（每个广播给其他 4 个）
```

#### TestConcurrent_Disconnect

```
前置：
  1. 10 个客户端加入同一房间
步骤：
  1. 随机断开 5 个
  2. 剩余 5 个互相发消息
预期：
  - 无崩溃
  - 消息正常收发
```

---

## 未覆盖代码说明

创建 `KNOWN_GAPS.md`：

```markdown
# 网络层测试已知缺口

## 超时分支
- readPump pongWait 超时
- writePump writeWait 超时

## 极端错误
- websocket.CloseError 特定错误码
- json.Marshal 失败

## 心跳流程
- Ping/Pong 由 gorilla/websocket 自动处理

## Hub goroutine
- Hub.Run() 无 stop 机制，测试时会泄漏
- 依赖测试进程退出清理

## 原因
防御性代码，实际极少触发。需要修改生产代码或复杂 mock。
留待后续迭代。
```

---

## Hub Goroutine 处理策略

**现状**：`Hub.Run()` 是无限循环，无 stop 机制。

**策略**：
1. 接受测试时 goroutine 泄漏
2. 测试进程退出时自动清理
3. 每个测试创建独立 Hub，不共享状态
4. 在 KNOWN_GAPS.md 中记录

**未来改进**（不在本设计范围）：
- 为 Hub 添加 context/stop 机制
- 或使用 `runtime.SetFinalizer` 清理

---

## 成功标准

| 指标 | 目标 |
|------|------|
| 整体覆盖率 | ≥ 90% |
| 单元测试 | 100% 通过 |
| 集成测试 | 100% 通过 |
| 并发测试 | 100% 通过 |
| 竞态检测 | 无警告 |

---

## 时间估计

| 任务 | 时间 |
|------|------|
| 测试工具 | 1 小时 |
| 消息分发测试 | 1.5 小时 |
| 异常/并发测试 | 1 小时 |
| 调试优化 | 0.5 小时 |
| **总计** | **4 小时** |
