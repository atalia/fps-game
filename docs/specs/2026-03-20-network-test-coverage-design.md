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

### 测试边界

**本设计测试范围**：网络消息分发层

| 测试重点 | 说明 |
|----------|------|
| 消息是否正确分发 | 输入 X 类型消息，触发正确的 handler |
| 消息是否正确广播 | 发送者之外的其他客户端收到消息 |
| 连接生命周期 | 建立、注册、注销、断线清理 |
| 异常输入处理 | 无效 JSON、未知类型、非法参数 |

**状态变更验证**：仅作为副作用确认，不深入验证业务语义

- ✅ 验证：`join_room` 后 `room_joined` 响应包含正确房间 ID
- ✅ 验证：`shoot` 后 `player_shot` 广播到其他玩家
- ❌ 不验证：武器伤害计算、命中检测（由 game 包负责）

### 消息类型覆盖

| 消息类型 | 测试方式 | 说明 |
|----------|----------|------|
| `join_room` | 集成测试 | 核心流程 |
| `leave_room` | 集成测试 | 核心流程 |
| `move` | 集成测试 | 核心流程 |
| `chat` | 集成测试 | 核心流程 |
| `shoot` | 集成测试 | 核心流程 |
| `reload` | 集成测试 | 核心流程 |
| `respawn` | 现有单测 | `TestClient_handleRespawn` 已覆盖 |
| `weapon_change` | 现有单测 | `TestClient_handleWeaponChange` 已覆盖 |
| `voice_start/stop` | 现有单测 | `TestClient_handleVoiceStart/Stop` 已覆盖 |
| `voice_data` | 现有单测 | 无，但逻辑简单（直接转发） |
| `team_join` | 现有单测 | `TestClient_handleTeamJoin` 已覆盖 |
| `grenade_throw` | 现有单测 | `TestClient_handleGrenadeThrow` 已覆盖 |
| `c4_plant/defuse` | 现有单测 | `TestClient_handleC4Plant/Defuse` 已覆盖 |
| `skill_use` | 现有单测 | `TestClient_handleSkillUse` 已覆盖 |
| `emote` | 现有单测 | `TestClient_handleEmote` 已覆盖 |
| `ping` | 现有单测 | `TestClient_handlePing` 已覆盖 |

**现有单测已覆盖大部分 handler**，集成测试重点补充 WebSocket 连接、广播、断线清理等需要真实连接的场景。

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
    done        chan struct{} // Hub.Run() 退出信号
}

// NewTestServer 创建测试服务器
// 注意：Hub.Run() 是无限循环，无法优雅退出
// 测试结束时通过关闭 Server 来中断连接
func NewTestServer(t *testing.T) *TestServer {
    ts := &TestServer{
        Hub:         NewHub(),
        RoomManager: room.NewManager(10, 10),
        done:        make(chan struct{}),
    }
    
    // 启动 Hub（后台 goroutine，无法等待退出）
    go ts.Hub.Run()
    
    // 创建测试 HTTP 服务器
    mux := http.NewServeMux()
    mux.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
        ServeWS(ts.Hub, ts.RoomManager, nil, w, r)
    })
    ts.Server = httptest.NewServer(mux)
    ts.URL = "ws" + strings.TrimPrefix(ts.Server.URL, "http") + "/ws"
    
    return ts
}

// Close 关闭服务器
// 注意：Hub goroutine 会泄漏，但测试进程退出时会清理
func (s *TestServer) Close() {
    s.Server.Close()
}

// NewWSClient 创建 WebSocket 客户端连接
func (s *TestServer) NewWSClient(t *testing.T) *websocket.Conn

// CloseClient 关闭客户端
func CloseClient(t *testing.T, conn *websocket.Conn)

// ReadMessageTimeout 读取消息（带超时）
func ReadMessageTimeout(t *testing.T, conn *websocket.Conn, timeout time.Duration) (*Message, error)

// SendMessage 发送消息
func SendMessage(t *testing.T, conn *websocket.Conn, msgType string, data interface{})
```

#### 消息断言模板

```go
// AssertMessageType 验证消息类型
func AssertMessageType(t *testing.T, conn *websocket.Conn, wantType string, timeout time.Duration) *Message

// AssertMessageContains 验证消息包含指定字段
func AssertMessageContains(t *testing.T, conn *websocket.Conn, wantType string, fields map[string]interface{}, timeout time.Duration)

// AssertNoMessage 验证超时内无消息
func AssertNoMessage(t *testing.T, conn *websocket.Conn, timeout time.Duration)
```

#### 测试场景

##### 连接生命周期

| 测试 | 输入 | 预期输出 | 验证方式 |
|------|------|----------|----------|
| `TestWS_Connect` | 建立 WebSocket 连接 | `welcome` 消息含 `player_id` | 读取消息，断言 type==welcome |
| `TestWS_Disconnect` | 客户端关闭连接 | 无（无法直接观测 Hub 内部状态） | 不崩溃即可 |
| `TestWS_Disconnect_InRoom` | 客户端在房间内关闭连接 | 其他客户端收到 `player_left` | 用另一个客户端验证 |

##### 房间操作

| 测试 | 输入 | 预期输出 | 验证方式 |
|------|------|----------|----------|
| `TestWS_JoinRoom_New` | `join_room` 无 room_id | `room_joined` 含房间 ID | 断言 type==room_joined |
| `TestWS_JoinRoom_Existing` | `join_room` 指定 room_id | `room_joined` 含指定 ID | 断言 room_id 正确 |
| `TestWS_JoinRoom_Full` | 加入已满房间 | `error` 消息 | 断言 type==error |
| `TestWS_LeaveRoom` | `leave_room` | 其他玩家收到 `player_left` | 用另一个客户端验证 |

##### 消息广播

| 测试 | 输入 | 预期输出 | 验证方式 |
|------|------|----------|----------|
| `TestWS_Broadcast_TwoClients` | 2 客户端，1 个发 `chat` | 另 1 个收到 | 断言消息内容 |
| `TestWS_Broadcast_TenClients` | 10 客户端，1 个发 `chat` | 其他 9 个收到 | 计数验证 |
| `TestWS_Broadcast_ExcludeSender` | `shoot` 广播 | 发送者不收到自己消息 | 发送者无消息 |

##### 核心消息类型（验证分发）

| 测试 | 输入 | 预期输出 | 验证方式 |
|------|------|----------|----------|
| `TestWS_Move` | `move` x=10, y=5, z=20 | 其他玩家收到 `player_moved` | 断言坐标 |
| `TestWS_Chat` | `chat` message="hello" | 房间所有玩家收到 | 断言消息内容 |
| `TestWS_Shoot` | `shoot` 含位置 | 其他玩家收到 `player_shot` | 断言 type |
| `TestWS_Reload` | `reload` | 收到 `reload` 响应 | 断言 type |

##### 异常输入

| 测试 | 输入 | 预期输出 | 验证方式 |
|------|------|----------|----------|
| `TestWS_InvalidJSON` | `{"invalid` | 无响应，无崩溃 | 等待 500ms 无消息 |
| `TestWS_UnknownType` | `{"type":"unknown"}` | 无响应，无崩溃 | 等待 500ms 无消息 |
| `TestWS_Move_NotInRoom` | `move`（未加入房间） | 无响应，无崩溃 | 等待 500ms 无消息 |
| `TestWS_Shoot_NotInRoom` | `shoot`（未加入房间） | 无响应，无崩溃 | 等待 500ms 无消息 |
| `TestWS_JoinRoom_MissingName` | `join_room` 无 name | 使用默认值或忽略 | 取决于当前实现，先记录行为 |

##### 连接稳定性

| 测试 | 输入 | 预期输出 | 验证方式 |
|------|------|----------|----------|
| `TestWS_KeepAlive` | 连接保持 5 秒 | 连接仍然可用 | 5 秒后发送消息成功 |

**注意**：Ping/Pong 心跳由 gorilla/websocket 自动处理，无法在测试层直接观测。改用连接稳定性测试间接验证。

##### 缓冲区

| 测试 | 输入 | 预期输出 | 验证方式 |
|------|------|----------|----------|
| `TestWS_HighVolume` | 快速发送 100 条消息 | 连接不断开 | 最后一条消息后仍能收到响应 |

**注意**：由于 `writePump` 会持续消费，难以稳定触发缓冲区满。此测试验证高负载下连接稳定。

---

### 2. 并发测试 (`server_ws_test.go` 中)

并发测试与集成测试放同一文件，便于共享工具函数。

#### 测试场景

| 测试 | 参数 | 验证方式 |
|------|------|----------|
| `TestConcurrent_Connect10` | 10 客户端同时连接 | 全部收到 `welcome` |
| `TestConcurrent_JoinRoom10` | 10 客户端同时加入同一房间 | 全部成功（房间未满） |
| `TestConcurrent_Chat10` | 10 客户端各发 10 条 `chat` | 消息被广播，无崩溃 |
| `TestConcurrent_Disconnect5` | 10 客户端，随机断开 5 个 | 剩余 5 个仍能通信 |

**注意**：
- 广播允许在缓冲区满时丢弃消息（`default: // 跳过`）
- 测试不要求零丢失，只验证无死锁、无崩溃

#### 竞态检测

```bash
go test -race ./server/internal/network/
```

---

### 3. 未覆盖代码说明 (`KNOWN_GAPS.md`)

记录无法或不需要测试的代码路径。

```markdown
# 网络层测试已知缺口

## 超时分支
- `readPump` 中的 `pongWait` 超时：需要禁用客户端自动 Pong，难以实现
- `writePump` 中的 `writeWait` 超时：需要模拟慢客户端，耗时且不稳定

## 极端错误路径
- `websocket.CloseError` 处理：需要注入底层错误
- `json.Marshal` 失败：理论上不可能（所有数据都是可序列化的）

## 心跳机制
- Ping/Pong 完整流程：由 gorilla/websocket 库自动处理

## 原因
这些路径属于防御性代码，在实际运行中极少触发。如需覆盖，需要：
1. 修改生产代码（添加接口或依赖注入）
2. 编写复杂的 mock 基础设施

当前 ROI 不高，留待后续迭代。
```

---

## 测试隔离与清理

### 清理策略

```go
func TestWS_Example(t *testing.T) {
    ts := NewTestServer(t)
    defer ts.Close() // 关闭 HTTP 服务器
    
    client := ts.NewWSClient(t)
    defer client.Close() // 关闭 WebSocket 连接
    
    // 测试代码...
}
```

### 已知限制

1. **Hub goroutine 泄漏**：`Hub.Run()` 是无限循环，测试结束时 goroutine 不会退出。这是可接受的，因为测试进程退出时会清理所有资源。

2. **测试串扰风险**：每个测试创建独立 `TestServer`，不共享 Hub 或 RoomManager，避免串扰。

---

## 成功标准

| 指标 | 目标 | 备注 |
|------|------|------|
| 整体覆盖率 | ≥ 90% | 允许 10% 未覆盖（见 KNOWN_GAPS.md） |
| 单元测试 | 100% 通过 | |
| 集成测试 | 100% 通过 | |
| 并发测试 | 100% 通过 | 无死锁、无崩溃 |
| 竞态检测 | 无警告 | `go test -race` |

---

## 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| WebSocket 测试不稳定 | 使用确定性超时、共享工具函数 |
| Hub goroutine 泄漏 | 每个测试独立进程，退出时自动清理 |
| 覆盖率未达标 | 记录到 KNOWN_GAPS.md，后续迭代补充 |

---

## 时间估计

| 任务 | 时间 |
|------|------|
| 测试工具函数 | 1 小时 |
| 连接/房间测试 | 1 小时 |
| 消息/异常测试 | 1 小时 |
| 并发测试 | 1 小时 |
| 调试与覆盖率调优 | 1 小时 |
| **总计** | **5 小时** |

---

## 参考资料

- [gorilla/websocket 测试示例](https://github.com/gorilla/websocket/blob/main/client_test.go)
- [Go 测试最佳实践](https://go.dev/blog/testing)
- 项目现有测试：`server/internal/game/game_test.go`
