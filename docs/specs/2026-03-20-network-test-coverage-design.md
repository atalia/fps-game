# 网络层测试覆盖率完善设计

## 目标

将 `server/internal/network` 包的测试覆盖率从 33.9% 提升到 90%+。

## 当前可测性评估

### 现状分析

`server.go` 当前直接依赖 `*websocket.Conn` 具体类型，未提取接口。这意味着：

1. **可独立测试的部分**：所有 `handle*` 函数、`Hub` 逻辑、`Message` 序列化
2. **需要真实连接的部分**：`readPump`、`writePump`、`ServeWS`
3. **是否需要修改生产代码**：否，采用真实 WebSocket 测试覆盖 IO 路径

### 测试策略

| 层次 | 方法 | 修改生产代码 |
|------|------|-------------|
| Handler 单元测试 | 直接调用 handle* 函数 | 否 |
| 集成测试 | 真实 WebSocket 连接 | 否 |
| 并发测试 | 真实 WebSocket 连接 | 否 |

---

## 范围界定

### 网络层职责（本设计覆盖）

| 职责 | 说明 |
|------|------|
| 连接生命周期 | 建立、注册、注销、断线清理 |
| 消息解析 | JSON 反序列化、类型分发 |
| 消息广播 | Hub.Broadcast、BroadcastToRoom |
| 心跳机制 | Ping/Pong、超时检测 |
| 异常输入 | 无效 JSON、未知消息类型、非法参数 |
| 背压处理 | 缓冲区满、消息丢弃 |

### 游戏玩法语义（不在本设计范围）

以下功能由 `game`/`room`/`player` 包负责验证：
- 武器伤害计算
- C4 爆炸范围
- 技能效果
- 命中检测

**本设计仅验证**：消息是否正确分发、广播是否送达。

---

## 文件结构

```
server/internal/network/
├── server.go                  # 现有代码（不修改）
├── server_test.go             # 现有单元测试（保留）
├── server_ws_test.go          # 真实 WebSocket 集成测试
└── server_concurrent_test.go  # 并发测试
```

---

## 模块设计

### 1. 集成测试 (`server_ws_test.go`)

#### 测试工具

```go
// TestServer 测试服务器
type TestServer struct {
    Server      *httptest.Server
    Hub         *Hub
    RoomManager *room.Manager
    URL         string
}

// NewTestServer 创建测试服务器，启动 Hub.Run()
func NewTestServer(t *testing.T) *TestServer

// Close 关闭服务器，等待所有 goroutine 退出
func (s *TestServer) Close()

// NewWSClient 创建 WebSocket 客户端连接
func (s *TestServer) NewWSClient(t *testing.T) *websocket.Conn

// CloseClient 关闭客户端，确保连接清理
func CloseClient(t *testing.T, conn *websocket.Conn)
```

#### 消息断言模板

```go
// AssertMessage 验证收到的消息
func AssertMessage(t *testing.T, conn *websocket.Conn, wantType string, timeout time.Duration, validate func(data json.RawMessage)) {
    t.Helper()
    conn.SetReadDeadline(time.Now().Add(timeout))
    _, msg, err := conn.ReadMessage()
    require.NoError(t, err)
    
    var m Message
    require.NoError(t, json.Unmarshal(msg, &m))
    assert.Equal(t, wantType, m.Type)
    if validate != nil {
        validate(m.Data)
    }
}

// AssertNoMessage 验证在超时时间内没有消息
func AssertNoMessage(t *testing.T, conn *websocket.Conn, timeout time.Duration)
```

#### 测试场景

##### 连接生命周期

| 测试 | 输入 | 预期输出 | 预期状态变更 |
|------|------|----------|--------------|
| `TestWS_Connect` | 建立 WebSocket 连接 | `welcome` 消息含 `player_id` | `Hub.clients` 增加 1 |
| `TestWS_Disconnect` | 客户端关闭连接 | 其他客户端收到 `player_left` | `Hub.clients` 减少 1，`Room.Players` 减少 1 |
| `TestWS_Reconnect` | 同一客户端重连 | 新 `player_id` | 旧连接被清理，新连接正常 |

##### 房间操作

| 测试 | 输入 | 预期输出 | 预期状态变更 |
|------|------|----------|--------------|
| `TestWS_JoinRoom_New` | `join_room` 无 room_id | `room_joined` 含新房间 ID | `Room` 创建，玩家加入 |
| `TestWS_JoinRoom_Existing` | `join_room` 指定 room_id | `room_joined` 含指定房间 ID | 加入已存在房间 |
| `TestWS_JoinRoom_Full` | 加入已满房间（10/10） | `error` 消息 "Room is full" | 不加入房间 |
| `TestWS_JoinRoom_NotFound` | `join_room` 指定不存在 ID | `room_joined` 含新房间 ID | 创建新房间（当前行为） |
| `TestWS_LeaveRoom` | `leave_room` | 其他玩家收到 `player_left` | `Room.Players` 减少 1 |
| `TestWS_LeaveRoom_NotInRoom` | `leave_room` 未加入房间 | 无消息、无错误 | 无状态变更 |

##### 消息广播

| 测试 | 输入 | 预期输出 | 预期状态变更 |
|------|------|----------|--------------|
| `TestWS_Broadcast_OneClient` | 2 客户端，1 个发消息 | 另 1 个收到消息 | 无 |
| `TestWS_Broadcast_ManyClients` | 10 客户端，1 个发消息 | 其他 9 个收到消息 | 无 |
| `TestWS_Broadcast_ExcludeSender` | `BroadcastToRoom` 排除发送者 | 发送者不收到自己消息 | 无 |

##### 核心消息类型（验证分发机制）

| 测试 | 输入 | 预期输出 | 预期状态变更 |
|------|------|----------|--------------|
| `TestWS_Move` | `move` x=10, y=5, z=20 | 其他玩家收到 `player_moved` 含坐标 | `Player.Position` 更新 |
| `TestWS_Chat` | `chat` message="hello" | 房间所有玩家收到 `chat` | 无 |
| `TestWS_Shoot` | `shoot` 含位置、旋转 | 其他玩家收到 `player_shot` | `Player.Ammo` 减少 1 |
| `TestWS_Reload` | `reload` | 收到 `reload` 含新弹药值 | `Player.Ammo` 恢复到 30 |

##### 异常输入

| 测试 | 输入 | 预期输出 | 预期状态变更 |
|------|------|----------|--------------|
| `TestWS_InvalidJSON` | 非法 JSON 字符串 | 无响应、无崩溃 | 无 |
| `TestWS_UnknownMessageType` | `{"type":"unknown","data":{}}` | 无响应、无崩溃 | 无 |
| `TestWS_MissingField` | `join_room` 缺少 name 字段 | 忽略消息或默认值 | 取决于当前实现 |
| `TestWS_MoveNotInRoom` | `move` 但未加入房间 | 无响应、无崩溃 | 无 |
| `TestWS_ShootNotInRoom` | `shoot` 但未加入房间 | 无响应、无崩溃 | 无 |

##### 心跳

| 测试 | 输入 | 预期输出 | 预期状态变更 |
|------|------|----------|--------------|
| `TestWS_PingPong` | 等待服务端 Ping | 收到 Ping 消息 | 连接保持 |
| `TestWS_Timeout` | 客户端不响应 Pong | 连接被关闭 | `Hub.clients` 减少 1 |

##### 缓冲区

| 测试 | 输入 | 预期输出 | 预期状态变更 |
|------|------|----------|--------------|
| `TestWS_BufferFull` | 发送 300 条消息（超缓冲区） | 部分消息丢弃，连接不断开 | 无崩溃 |

---

### 2. 并发测试 (`server_concurrent_test.go`)

#### 清理策略

```go
// 每个测试函数必须：
// 1. 使用 t.Cleanup() 注册清理函数
// 2. 关闭所有客户端连接
// 3. 等待 Hub goroutine 退出（使用 context 或 done channel）

func TestConcurrent_Example(t *testing.T) {
    ts := NewTestServer(t)
    defer ts.Close() // t.Cleanup 自动调用
    
    var clients []*websocket.Conn
    defer func() {
        for _, c := range clients {
            c.Close()
        }
        time.Sleep(100 * time.Millisecond) // 等待 goroutine 退出
    }()
    
    // 测试代码...
}
```

#### 测试场景

##### 并发连接

| 测试 | 参数 | 验证方式 |
|------|------|----------|
| `TestConcurrent_Connect100` | 100 客户端同时连接 | 全部收到 `welcome`，`Hub.clients` == 100 |
| `TestConcurrent_Disconnect50` | 100 客户端，随机断开 50 个 | `Hub.clients` == 50，无 panic |

##### 并发消息

| 测试 | 参数 | 验证方式 |
|------|------|----------|
| `TestConcurrent_JoinRoom` | 50 客户端同时加入同一房间 | 全部成功或部分成功（房间满），无死锁 |
| `TestConcurrent_Broadcast` | 20 客户端，每个发送 50 条消息 | 消息不丢失（发送数 == 接收数总计） |

##### 竞态检测

```bash
# 运行方式（不是测试函数）
go test -race ./server/internal/network/
```

文档中不再单独写 `TestConcurrent_WithRace` 函数。

##### 压力测试（可选，使用 `-run TestStress` 手动运行）

| 测试 | 参数 | 验证方式 |
|------|------|----------|
| `TestStress_Throughput` | 50 客户端，每秒各发 20 条消息，持续 10 秒 | 消息不丢失，延迟 P99 < 100ms |
| `TestStress_Sustained` | 100 客户端，持续 60 秒随机操作 | 内存增长 < 50MB，无 goroutine 泄漏 |

**环境依赖**：压力测试结果受机器性能影响，仅作参考，不作为 CI 必须通过条件。

---

## 测试隔离与清理

### 必须遵守

1. **每个测试创建独立 TestServer**
2. **使用 `t.Cleanup()` 注册清理函数**
3. **关闭所有客户端连接**
4. **等待 100ms 让 goroutine 退出**
5. **不共享 Hub 或 RoomManager**

### 示例

```go
func TestWS_Example(t *testing.T) {
    // 1. 创建独立服务器
    ts := NewTestServer(t)
    
    // 2. 清理函数
    t.Cleanup(func() {
        ts.Close()
    })
    
    // 3. 创建客户端
    client := ts.NewWSClient(t)
    t.Cleanup(func() {
        client.Close()
    })
    
    // 4. 测试代码
    // ...
}
```

---

## 成功标准

| 指标 | 目标 | 备注 |
|------|------|------|
| 整体覆盖率 | ≥ 90% | 允许 10% 未覆盖（如超时分支、极端错误路径） |
| 单元测试 | 100% 通过 | |
| 集成测试 | 100% 通过 | |
| 并发测试 | 100% 通过 | |
| 竞态检测 | 无警告 | `go test -race` |
| 压力测试 | 参考指标 | 不阻塞 CI |

### 覆盖率计算说明

- 现有覆盖率：33.9%
- 新增集成测试预期覆盖：+40%（连接、消息、广播）
- 新增并发测试预期覆盖：+16%（并发路径）
- 预期总覆盖率：~90%

---

## 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| WebSocket 测试不稳定 | 使用确定性超时、重试机制、`t.Cleanup()` 清理 |
| 并发测试偶发失败 | 确定性同步点、统一超时、减少共享状态 |
| 压力测试环境依赖 | 标记为可选，不阻塞 CI |
| 未覆盖代码 | 记录到 `KNOWN_GAPS.md`，后续迭代补充 |

---

## 时间估计

| 任务 | 时间 |
|------|------|
| 测试工具函数 | 1 小时 |
| 连接/房间测试 | 1.5 小时 |
| 消息/异常测试 | 1.5 小时 |
| 并发测试 | 1.5 小时 |
| 调试与覆盖率调优 | 1 小时 |
| **总计** | **6.5 小时** |

---

## 参考资料

- [gorilla/websocket 测试指南](https://github.com/gorilla/websocket/blob/main/client_test.go)
- [Go 并发测试最佳实践](https://go.dev/blog/race-detector)
- 项目现有测试：`server/internal/game/game_test.go`、`server/internal/room/room_test.go`
