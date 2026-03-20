# 网络层测试覆盖率完善设计

## 目标

将 `server/internal/network` 包的测试覆盖率从 33.9% 提升到 95%+。

## 背景

当前网络层是整个项目测试覆盖率最低的模块：
- 核心文件：`server.go` (741 行)
- 现有测试：`server_test.go` (618 行)
- 当前覆盖率：33.9%
- 目标覆盖率：95%+

## 设计原则

1. **分层测试**：单元测试 + 集成测试 + 并发测试
2. **混合策略**：Mock WebSocket + 真实 WebSocket 连接
3. **完整覆盖**：包含网络延迟、断线重连等异常场景

## 文件结构

```
server/internal/network/
├── server.go                  # 现有代码（不修改）
├── server_test.go             # 现有单元测试（保留）
├── mock_websocket_test.go     # Mock WebSocket 工具
├── server_ws_test.go          # 真实 WebSocket 集成测试
└── server_concurrent_test.go  # 并发 + 压力测试
```

## 模块设计

### 1. Mock WebSocket 工具 (`mock_websocket_test.go`)

**目的**: 单元测试隔离 WebSocket 依赖，快速验证 handler 逻辑。

```go
package network

import (
    "sync"
    "time"
    "errors"
)

// MockConn 实现 websocket.Conn 接口
type MockConn struct {
    SendChan   chan []byte
    RecvChan   chan []byte
    Closed     bool
    CloseError error
    mu         sync.Mutex
    
    // 调用记录
    ReadCalls  int
    WriteCalls int
}

func NewMockConn() *MockConn

// ReadMessage 模拟读取消息
func (m *MockConn) ReadMessage() (int, []byte, error)

// WriteMessage 模拟写入消息  
func (m *MockConn) WriteMessage(messageType int, data []byte) error

// Close 关闭连接
func (m *MockConn) Close() error

// SetReadDeadline 设置读取超时
func (m *MockConn) SetReadDeadline(t time.Time) error

// SetWriteDeadline 设置写入超时
func (m *MockConn) SetWriteDeadline(t time.Time) error

// SetReadLimit 设置读取限制
func (m *MockConn) SetReadLimit(limit int64)

// SetPongHandler 设置 Pong 处理器
func (m *MockConn) SetPongHandler(h func(string) error)

// NextWriter 获取下一个写入器
func (m *MockConn) NextWriter(messageType int) (WriteCloser, error)

// WriteCloser 接口
type WriteCloser interface {
    Write([]byte) (int, error)
    Close() error
}

// MockWriteCloser 实现 WriteCloser
type MockWriteCloser struct {
    buf []byte
}

func (m *MockWriteCloser) Write(data []byte) (int, error)
func (m *MockWriteCloser) Close() error
```

**覆盖率贡献**: ~10%（readPump/writePump 单元测试）

---

### 2. 真实 WebSocket 集成测试 (`server_ws_test.go`)

**目的**: 使用真实 WebSocket 连接验证完整流程。

#### 测试工具函数

```go
package network

import (
    "net/http/httptest"
    "testing"
    "time"
    "github.com/gorilla/websocket"
)

// TestServer 测试服务器
type TestServer struct {
    Server      *httptest.Server
    Hub         *Hub
    RoomManager *room.Manager
    URL         string
}

// NewTestServer 创建测试服务器
func NewTestServer(t *testing.T) *TestServer

// Close 关闭测试服务器
func (s *TestServer) Close()

// NewWSClient 创建 WebSocket 客户端
func (s *TestServer) NewWSClient(t *testing.T) *websocket.Conn

// WaitForMessage 等待消息（带超时）
func WaitForMessage(t *testing.T, conn *websocket.Conn, timeout time.Duration) *Message

// MustSendMessage 发送消息（失败则 Fatal）
func MustSendMessage(t *testing.T, conn *websocket.Conn, msgType string, data interface{})
```

#### 测试场景

| 测试函数 | 场景 | 验证内容 |
|----------|------|----------|
| `TestWebSocket_Connect` | 连接建立 | welcome 消息、玩家 ID 生成 |
| `TestWebSocket_JoinRoom` | 加入房间 | room_joined 响应、房间列表正确 |
| `TestWebSocket_LeaveRoom` | 离开房间 | player_left 广播、房间清理 |
| `TestWebSocket_Broadcast` | 消息广播 | 所有客户端收到消息 |
| `TestWebSocket_Move` | 移动同步 | 位置广播、坐标正确 |
| `TestWebSocket_Shoot` | 射击同步 | 射击事件广播、弹药减少 |
| `TestWebSocket_Chat` | 聊天功能 | 消息广播、发送者可见 |
| `TestWebSocket_WeaponChange` | 武器切换 | weapon_changed 广播 |
| `TestWebSocket_Reload` | 换弹 | 弹药恢复、通知客户端 |
| `TestWebSocket_Respawn` | 重生 | 位置重置、状态恢复 |
| `TestWebSocket_TeamJoin` | 队伍加入 | team_changed 广播 |
| `TestWebSocket_VoiceStart` | 语音开始 | voice_start 广播 |
| `TestWebSocket_VoiceStop` | 语音停止 | voice_stop 广播 |
| `TestWebSocket_GrenadeThrow` | 投掷物 | grenade_thrown 广播 |
| `TestWebSocket_C4Plant` | C4 放置 | c4_planted 广播、状态正确 |
| `TestWebSocket_C4Defuse` | C4 拆除 | c4_defused 广播 |
| `TestWebSocket_SkillUse` | 技能使用 | skill_used 广播、冷却生效 |
| `TestWebSocket_Emote` | 表情 | emote 广播 |
| `TestWebSocket_Ping` | 标记 | ping 广播 |
| `TestWebSocket_Disconnect` | 断线处理 | 自动离开房间、资源清理 |
| `TestWebSocket_Heartbeat` | 心跳机制 | Ping/Pong 正常 |
| `TestWebSocket_BufferOverflow` | 缓冲区满 | 消息丢弃、不阻塞 |
| `TestWebSocket_MultipleClients` | 多客户端 | 10 个客户端同时在线 |
| `TestWebSocket_RoomFull` | 房间满员 | error 消息、拒绝加入 |
| `TestWebSocket_InvalidJSON` | 无效 JSON | 忽略消息、不崩溃 |
| `TestWebSocket_UnknownMessageType` | 未知消息类型 | 忽略消息、不崩溃 |

**覆盖率贡献**: ~50%

---

### 3. 并发测试 (`server_concurrent_test.go`)

**目的**: 验证高并发场景下的稳定性和正确性。

#### 测试场景

| 测试函数 | 场景 | 参数 | 验证内容 |
|----------|------|------|----------|
| `TestConcurrent_Connect` | 并发连接 | 100 客户端 | 全部成功连接 |
| `TestConcurrent_JoinRoom` | 并发加入房间 | 50 客户端 | 房间状态一致 |
| `TestConcurrent_Broadcast` | 并发广播 | 20 客户端 × 100 消息 | 消息不丢失 |
| `TestConcurrent_Shoot` | 并发射击 | 100 客户端同时射击 | 事件顺序正确 |
| `TestConcurrent_Move` | 并发移动 | 100 客户端持续移动 10s | 无竞态条件 |
| `TestConcurrent_Mixed` | 混合操作 | 50 客户端随机操作 | 无死锁/崩溃 |
| `TestConcurrent_WithRace` | 竞态检测 | 使用 `-race` 运行 | 无数据竞争 |
| `TestStress_Throughput` | 吞吐量测试 | 1000 消息/秒 | 延迟 < 10ms |
| `TestStress_Sustained` | 持续压力 | 100 客户端 × 60 秒 | 内存稳定 |
| `TestNetwork_Latency` | 网络延迟 | 模拟 100ms 延迟 | 消息正确 |
| `TestNetwork_DisconnectReconnect` | 断线重连 | 随机断开 20% 后重连 | 状态恢复 |
| `TestNetwork_PartialFailure` | 部分失败 | 10% 客户端异常断开 | 其他客户端不受影响 |

#### 并发测试辅助函数

```go
// RunConcurrent 并发执行函数
func RunConcurrent(t *testing.T, count int, fn func(i int))

// RunConcurrentWithTimeout 并发执行（带超时）
func RunConcurrentWithTimeout(t *testing.T, count int, timeout time.Duration, fn func(i int) error) error

// CollectErrors 收集并发错误
func CollectErrors(t *testing.T, count int, fn func(i int) error) []error

// SimulateLatency 模拟网络延迟
func SimulateLatency(conn *websocket.Conn, latency time.Duration)

// RandomDisconnect 随机断开部分连接
func RandomDisconnect(clients []*websocket.Conn, percent int) []*websocket.Conn
```

**覆盖率贡献**: ~35%

---

## 测试命令

```bash
# 运行所有网络层测试
go test -v ./server/internal/network/

# 运行带覆盖率
go test -cover -coverprofile=coverage.out ./server/internal/network/

# 运行竞态检测
go test -race ./server/internal/network/

# 运行压力测试
go test -v -run TestStress ./server/internal/network/

# 查看覆盖率详情
go tool cover -html=coverage.out
```

## 成功标准

| 指标 | 目标 |
|------|------|
| 整体覆盖率 | ≥ 95% |
| 单元测试通过 | 100% |
| 集成测试通过 | 100% |
| 并发测试通过 | 100% |
| 竞态检测 | 无警告 |
| 压力测试 | 1000 msg/s 无阻塞 |

## 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| WebSocket 测试不稳定 | 使用超时和重试机制 |
| 并发测试偶发失败 | 使用 `t.Parallel()` 和同步点 |
| 压力测试耗时 | 使用 `testing.Short()` 跳过 |

## 时间估计

| 任务 | 时间 |
|------|------|
| Mock WebSocket 工具 | 1 小时 |
| 集成测试 | 3 小时 |
| 并发测试 | 2 小时 |
| 调试与优化 | 1 小时 |
| **总计** | **7 小时** |

## 参考资料

- [gorilla/websocket 测试指南](https://github.com/gorilla/websocket/blob/main/client_test.go)
- [Go 并发测试最佳实践](https://go.dev/blog/race-detector)
- [项目现有测试模式](../server/internal/game/game_test.go)
