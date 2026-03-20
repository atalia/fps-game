# 网络层测试覆盖率完善设计

## 目标

将 `server/internal/network` 包的测试覆盖率从 33.9% 提升到 90%+。

## 现状分析

### 当前覆盖率基线

| 函数/路径 | 当前覆盖 | 说明 |
|-----------|----------|------|
| `Hub.Run()` | 部分 | 注册/注销有测试，循环体未完全覆盖 |
| `Hub.Broadcast()` | 有 | `TestHub_Broadcast_Empty` |
| `Hub.BroadcastToRoom()` | 有 | `TestHub_BroadcastToRoom_Empty` |
| `Hub.GetClient()` | 有 | `TestHub_GetClient_NotFound` |
| `ServeWS()` | 无 | 需要集成测试 |
| `HandleConnection()` | 无 | 需要集成测试 |
| `readPump()` | 无 | 需要集成测试 |
| `writePump()` | 无 | 需要集成测试 |
| `handleMessage()` | 部分 | 各 handler 有单测，分发逻辑未覆盖 |
| 各 `handle*` 函数 | 有 | 现有单测覆盖 |

### 新增测试预期覆盖

| 测试 | 预期覆盖函数/路径 |
|------|------------------|
| 连接测试 | `ServeWS`, `HandleConnection`, `readPump`, `writePump` |
| 房间测试 | `handleJoinRoom`, `handleLeaveRoom` 的完整路径 |
| 广播测试 | `Broadcast`, `BroadcastToRoom` 的真实连接路径 |
| 异常测试 | 错误处理分支 |
| 并发测试 | 并发安全路径 |

---

## 范围界定

### 测试边界

**网络层职责**：消息分发与连接管理

| 测试重点 | 说明 |
|----------|------|
| 消息分发 | 输入 X 类型 → 触发正确 handler |
| 消息广播 | 发送者之外的其他客户端收到消息 |
| 连接管理 | 建立、注册、注销、断线清理 |
| 异常处理 | 无效输入不崩溃 |

**不测试的业务逻辑**（由 game/room/player 包负责）：
- 武器伤害计算
- 命中检测
- 技能效果
- C4 爆炸范围

**允许验证的业务副作用**（作为网络分发的确认）：
- 房间满员时拒绝加入（这是网络层的路由逻辑）
- 未在房间时忽略 move/shoot（这是前置条件检查）

---

## 文件结构

```
server/internal/network/
├── server.go                  # 现有代码（不修改）
├── server_test.go             # 现有单元测试（保留）
├── server_ws_test.go          # 真实 WebSocket 集成测试（新增）
└── KNOWN_GAPS.md              # 未覆盖代码说明（新增）
```

---

## 测试工具设计

### TestServer

```go
// TestServer 测试服务器
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
        RoomManager: room.NewManager(10, 10), // max 10 rooms, 10 players per room
    }
    
    go ts.Hub.Run()
    
    mux := http.NewServeMux()
    mux.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
        ServeWS(ts.Hub, ts.RoomManager, nil, w, r)
    })
    ts.Server = httptest.NewServer(mux)
    ts.URL = "ws" + strings.TrimPrefix(ts.Server.URL, "http") + "/ws"
    
    return ts
}

// Close 关闭服务器
func (s *TestServer) Close() {
    s.Server.Close()
}

// NewClient 创建 WebSocket 客户端并返回连接和 player_id
func (s *TestServer) NewClient(t *testing.T) (*websocket.Conn, string)

// JoinRoom 创建客户端并加入房间，返回连接和房间 ID
func (s *TestServer) JoinRoom(t *testing.T, roomID string) (*websocket.Conn, string, string)
```

### 断言工具

```go
// 默认超时
const defaultTimeout = 2 * time.Second

// AssertMessageType 断言收到指定类型消息
func AssertMessageType(t *testing.T, conn *websocket.Conn, wantType string) *Message

// AssertNoMessage 断言超时内无消息（默认 500ms）
func AssertNoMessage(t *testing.T, conn *websocket.Conn)

// SendMessage 发送消息
func SendMessage(t *testing.T, conn *websocket.Conn, msgType string, data interface{})
```

---

## 测试场景

### 1. 连接生命周期

#### TestWS_Connect

```
前置条件：无
输入：建立 WebSocket 连接
预期：
  - 收到 welcome 消息
  - 消息包含 player_id 字段
断言：
  - msg.Type == "welcome"
  - msg.Data.player_id 非空
```

#### TestWS_Disconnect_WithRoom

```
前置条件：
  - 客户端 A、B 都加入同一房间
输入：客户端 A 关闭连接
预期：
  - 客户端 B 收到 player_left 消息
断言：
  - 客户端 B 收到 type == "player_left"
  - player_id == A 的 ID
```

### 2. 房间操作

#### TestWS_JoinRoom_New

```
前置条件：无
输入：发送 join_room（无 room_id）
预期：
  - 收到 room_joined 消息
  - 消息包含新生成的 room_id
断言：
  - msg.Type == "room_joined"
  - msg.Data.room_id 非空
```

#### TestWS_JoinRoom_Existing

```
前置条件：
  - 客户端 A 创建房间，获取 room_id
输入：客户端 B 使用该 room_id 加入
预期：
  - 客户端 B 收到 room_joined
  - room_id 与 A 的房间相同
  - 客户端 A 收到 player_joined
断言：
  - B 收到 msg.Data.room_id == A 的 room_id
  - A 收到 msg.Type == "player_joined"
```

#### TestWS_JoinRoom_Full

```
前置条件：
  - 创建房间
  - 用 10 个客户端填满房间（MaxSize=10）
输入：第 11 个客户端尝试加入
预期：
  - 收到 error 消息
断言：
  - msg.Type == "error"
  - msg.Data.message == "Room is full"
```

#### TestWS_LeaveRoom

```
前置条件：
  - 客户端 A、B 都加入同一房间
输入：客户端 A 发送 leave_room
预期：
  - 客户端 B 收到 player_left
断言：
  - B 收到 msg.Type == "player_left"
```

### 3. 消息广播

#### TestWS_Broadcast_TwoClients

```
前置条件：
  - 客户端 A、B 加入同一房间
输入：A 发送 chat {"message": "hello"}
预期：
  - B 收到 chat 消息
  - A 不收到自己的消息
断言：
  - B 收到 msg.Type == "chat"
  - B 收到 msg.Data.message == "hello"
  - A 在 500ms 内无消息
```

#### TestWS_Broadcast_TenClients

```
前置条件：
  - 10 个客户端加入同一房间
输入：客户端 1 发送 chat
预期：
  - 其他 9 个客户端收到消息
断言：
  - 9 个客户端各收到 1 条 chat 消息
```

### 4. 核心消息分发

#### TestWS_Move

```
前置条件：
  - 客户端 A、B 加入同一房间
输入：A 发送 move {"x":10,"y":5,"z":20,"rotation":1.57}
预期：
  - B 收到 player_moved
断言：
  - msg.Type == "player_moved"
  - msg.Data.position.x == 10
```

#### TestWS_Chat

```
前置条件：
  - 客户端 A、B 加入同一房间
输入：A 发送 chat {"message":"hello"}
预期：
  - B 收到 chat
断言：
  - msg.Type == "chat"
  - msg.Data.message == "hello"
```

#### TestWS_Shoot

```
前置条件：
  - 客户端 A、B 加入同一房间
输入：A 发送 shoot {"position":{"x":0,"y":0,"z":0},"rotation":0}
预期：
  - B 收到 player_shot
断言：
  - msg.Type == "player_shot"
```

#### TestWS_Reload

```
前置条件：
  - 客户端 A 加入房间
输入：A 发送 reload
预期：
  - A 收到 reload 响应
断言：
  - msg.Type == "reload"
  - msg.Data.ammo == 30
```

#### TestWS_VoiceData

```
前置条件：
  - 客户端 A、B 加入同一房间
输入：A 发送 voice_data {"audio":"base64..."}
预期：
  - B 收到 voice_data
断言：
  - msg.Type == "voice_data"
  - msg.Data.player_id == A 的 ID
```

### 5. 异常输入

#### TestWS_InvalidJSON

```
前置条件：客户端已连接
输入：发送 '{"invalid'
预期：无响应，连接保持
断言：
  - 500ms 内无消息
  - 后续消息仍可正常收发
```

#### TestWS_UnknownType

```
前置条件：客户端已连接
输入：发送 {"type":"unknown","data":{}}
预期：无响应，连接保持
断言：
  - 500ms 内无消息
```

#### TestWS_Move_NotInRoom

```
前置条件：客户端已连接但未加入房间
输入：发送 move
预期：无响应，连接保持
断言：
  - 500ms 内无消息
```

#### TestWS_JoinRoom_MissingName

```
前置条件：无
输入：发送 join_room 无 name 字段
预期：使用空字符串作为 name（当前实现行为）
断言：
  - 收到 room_joined
  - 后续 player_joined 消息中 name 为空
```

### 6. 并发测试

#### TestConcurrent_Connect10

```
前置条件：无
输入：10 个客户端同时连接
预期：全部收到 welcome
断言：
  - 10 个客户端各收到 1 条 welcome
```

#### TestConcurrent_JoinRoom10

```
前置条件：无
输入：10 个客户端同时 join_room（无 room_id）
预期：
  - 全部成功加入（可能在不同房间）
断言：
  - 每个客户端收到 room_joined
```

#### TestConcurrent_Chat10

```
前置条件：
  - 10 个客户端加入同一房间
输入：每个客户端各发 10 条 chat
预期：
  - 无崩溃、无死锁
  - 连接仍可通信
断言：
  - 所有发送完成
  - 之后发送一条消息能收到响应
```

#### TestConcurrent_Disconnect5

```
前置条件：
  - 10 个客户端加入同一房间
输入：随机断开 5 个客户端
预期：
  - 剩余 5 个仍能正常通信
断言：
  - 剩余客户端能发送并收到消息
```

---

## 未覆盖代码说明

创建 `KNOWN_GAPS.md`：

```markdown
# 网络层测试已知缺口

## 超时分支
- `readPump` 中的 `pongWait` 超时：需要禁用客户端自动 Pong
- `writePump` 中的 `writeWait` 超时：需要模拟慢客户端

## 极端错误路径
- `websocket.CloseError` 特定错误码处理
- `json.Marshal` 失败（理论上不可能）

## 心跳完整流程
- Ping/Pong 由 gorilla/websocket 库自动处理

## 原因
这些路径属于防御性代码，实际极少触发。如需覆盖需要：
1. 修改生产代码（添加接口/依赖注入）
2. 编写复杂 mock 基础设施

当前 ROI 不高，留待后续迭代。
```

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

## 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| WebSocket 测试不稳定 | 确定性超时、共享工具函数 |
| Hub goroutine 泄漏 | 测试进程退出时自动清理 |
| 覆盖率未达标 | 记录到 KNOWN_GAPS.md |

---

## 时间估计

| 任务 | 时间 |
|------|------|
| 测试工具函数 | 1 小时 |
| 连接/房间测试 | 1 小时 |
| 消息/异常测试 | 1 小时 |
| 并发测试 | 1 小时 |
| 调试与覆盖率 | 1 小时 |
| **总计** | **5 小时** |
