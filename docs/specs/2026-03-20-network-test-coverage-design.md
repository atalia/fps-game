# 网络层测试覆盖率完善设计

## 目标

完成以下工作：
1. **生产修复**：`BroadcastToRoom` nil 检查
2. **测试实现**：`server.go` 覆盖率从 33.9% 提升到 90%+

**验收命令**：
```bash
go test -coverprofile=cover.out ./server/internal/network/
go tool cover -func=cover.out | grep server.go
go test -race ./server/internal/network/...
```

**覆盖率目标说明**：90% 目标仅通过黑盒 WebSocket 测试达成。`readPump`/`writePump` 的 ticker/ping 分支通过正常运行路径覆盖，不单独构造超时场景。

---

## 广播语义

**统一规则**：
- `BroadcastToRoom` 的 `excludeID` 参数决定是否排除发送者
- `excludeID != ""` 时：广播给其他人，发送者不收到
- `excludeID == ""` 时：广播给全房间，包含发送者

---

## 单元划分

| 单元 | 内容 | 可独立提交 |
|------|------|----------|
| 单元 1 | 生产修复：`BroadcastToRoom` nil 检查 | ✅ 独立 PR |
| 单元 2 | 测试基础设施 | ✅ |
| 单元 3 | 连接与房间测试 | ✅ |
| 单元 4 | 消息分发测试 | ✅ |
| 单元 5 | 异常测试 | ✅ |
| 单元 6 | 并发测试 | ✅ |

---

## 单元 1：生产修复

### 修复内容

**位置**：`BroadcastToRoom` 函数

```go
func (h *Hub) BroadcastToRoom(r *room.Room, msgType string, data interface{}, excludeID string) {
    if r == nil {
        return
    }
    // ... 原有逻辑
}
```

**设计决策**：修复在 `BroadcastToRoom` 层面，**不修改** handler。无房间时 handler 仍执行业务逻辑（设置位置/武器），只是广播被 nil 检查拦截。

**已知限制**：`BroadcastToRoom` 遍历 `r.Players` 时未持有 `r.mu` 锁。当前测试场景不触发此问题，不在本次修复范围。

---

## 单元 2：测试基础设施

### 黑盒规则

- 所有断言通过 WebSocket 消息完成
- 禁止读取或修改 Hub/RoomManager 状态
- 每个 TestServer 启动独立的 `hub.Run` goroutine

### TestServer 配置

```go
type TestServer struct {
    Server      *httptest.Server
    Hub         *Hub
    RoomManager *room.Manager  // defaultSize = 10
    URL         string
}

func NewTestServer(t *testing.T) *TestServer {
    // 创建 Hub
    hub := NewHub()
    go hub.Run()  // 启动事件循环
    
    // 创建 RoomManager，房间容量 10
    rm := room.NewManager(10)
    
    // 创建 httptest.Server
    // ...
}
```

### 时序常量

```go
const (
    readTimeout   = 2 * time.Second
    drainWindow   = 200 * time.Millisecond
    noMessageWait = 100 * time.Millisecond
)
```

### 消息解析

**writePump 批量写入**：`writePump` 可能将多条消息合并到单个 WebSocket frame。helper 必须支持解析 newline-delimited JSON：

```go
// RecvAll 读取所有消息
// 处理单 frame 多消息情况（newline-delimited JSON）
func RecvAll(t *testing.T, conn *websocket.Conn) []*Message {
    // 设置读超时
    conn.SetReadDeadline(time.Now().Add(readTimeout))
    
    var msgs []*Message
    for {
        _, data, err := conn.ReadMessage()
        if err != nil {
            break
        }
        
        // 按换行分割处理多消息
        for _, line := range bytes.Split(data, []byte{'\n'}) {
            if len(line) == 0 {
                continue
            }
            var msg Message
            if json.Unmarshal(line, &msg) == nil {
                msgs = append(msgs, &msg)
            }
        }
        
        // 检查 drainWindow
        // ...
    }
    return msgs
}
```

### Helper 协议

```go
// Connect：建立连接
// 完成后状态：已读取 welcome，连接处于"未入房间"状态
func Connect(t *testing.T, ts *TestServer) (*websocket.Conn, string)

// CreateRoom：创建房间
// 完成后状态：已读取 welcome + room_joined，连接处于"在房间内"状态
func CreateRoom(t *testing.T, ts *TestServer) (*websocket.Conn, string, string)

// JoinRoom：加入已存在房间
// 完成后状态：已读取 welcome + room_joined，连接处于"在房间内"状态
func JoinRoom(t *testing.T, ts *TestServer, roomID string) (*websocket.Conn, string)

// Drain：丢弃所有消息，直到 drainWindow 无新消息
func Drain(t *testing.T, conn *websocket.Conn)

// NoMessage：验证静默
func NoMessage(t *testing.T, conn *websocket.Conn)
```

---

## 测试前置状态

| 状态 | 值 |
|------|---|
| 房间容量 | 10（TestServer 配置） |
| 技能冷却（heal） | 30s |
| 射击冷却 | 100ms |
| 初始弹药 | 30 |
| 初始血量 | 100 |

---

## 单元 3：连接与房间测试

### TestWS_Connect
- 断言：收到 `welcome`，playerID 非空

### TestWS_Disconnect_InRoom
- 前置：A、B 在同一房间，Drain
- 步骤：关闭 A 连接
- 断言：B 收到 `player_left`，player_id == A.playerID

### TestWS_UnknownType
- 断言：静默

### TestWS_InvalidTopLevelJSON
- 断言：静默

### TestWS_JoinRoom_NewRoom
- 断言：收到 `room_joined`，room_id 非空

### TestWS_JoinRoom_ExistingRoom
- 断言：B 收到 `room_joined`，A 收到 `player_joined`

### TestWS_JoinRoom_Full
- 前置：房间 10 人（容量=10，TestServer 配置）
- 断言：第 11 人收到 `error` 包含 "full"

### TestWS_LeaveRoom
- 断言：A 发送 leave_room 后，B 收到 `player_left`

---

## 单元 4：消息分发测试

### 最小合法 payload

| 消息 | data 字段 |
|------|----------|
| `move` | `{"x":1,"y":2,"z":3,"rotation":0}` |
| `chat` | `{"message":"hello"}` |
| `shoot` | `{"position":{"x":1,"y":2,"z":3},"rotation":0}` |
| `reload` | `{}` |
| `respawn` | `{"x":0,"y":0,"z":0}` |
| `weapon_change` | `{"weapon":"rifle"}` |
| `voice_start` | `{}` |
| `voice_stop` | `{}` |
| `voice_data` | `"base64_audio"` |
| `team_join` | `{"team":"red"}` |
| `grenade_throw` | `{"type":"frag","position":{"x":1,"y":2,"z":3},"velocity":{"x":0,"y":0,"z":0}}` |
| `c4_plant` | `{"position":{"x":1,"y":2,"z":3}}` |
| `c4_defuse` | `{}` |
| `skill_use` | `{"skill_id":"heal","x":0,"y":0,"z":0}` |
| `emote` | `{"emote_id":"wave"}` |
| `ping` | `{"type":"enemy","x":1,"y":2,"z":3,"message":"here"}` |

### reload 测试步骤（修复）

```
1. CreateRoom（ammo 初始 30）
2. JoinRoom（第二人加入）
3. 全部 Drain
4. Send("shoot", {...})
5. Drain（第二人收到 player_shot）
6. Send("reload", {})
7. RecvType("reload")
8. 断言 ammo == 30
```

---

## 单元 5：异常测试

### 完整消息矩阵

| 消息 | 有房间正常 | 无房间 | 非法 JSON |
|------|-----------|-------|----------|
| `move` | 广播 `player_moved` | 静默 | 静默 |
| `chat` | 广播 `chat`（含发送者） | 静默 | 静默 |
| `shoot` | 广播 `player_shot` | 静默 | **零值广播**¹ |
| `reload` | 发送者收到 `reload` | **正常执行** | N/A |
| `respawn` | 发送者 `respawn` + 广播 `player_respawned` | 发送者 `respawn`²，广播静默 | **零值广播**¹ |
| `weapon_change` | 广播 `weapon_changed`（含发送者） | **本地更新³，广播静默** | 静默 |
| `voice_start` | 广播 `voice_start` | 静默 | N/A |
| `voice_stop` | 广播 `voice_stop` | 静默 | N/A |
| `voice_data` | 广播 `voice_data` | 静默 | **N/A（原样转发）** |
| `team_join` | 广播 `team_changed`（含发送者） | 静默 | 静默 |
| `grenade_throw` | 广播 `grenade_thrown` | 静默 | 静默 |
| `c4_plant` | 广播 `c4_planted` | 静默 | 静默 |
| `c4_defuse` | 广播 `c4_defused` | 静默 | N/A |
| `skill_use` | 广播 `skill_used`（含发送者） | 静默 | 静默 |
| `emote` | 广播 `emote`（含发送者） | 静默 | 静默 |
| `ping` | 广播 `ping`（含发送者） | 静默 | 静默 |

**注**：
1. **零值广播**：这是当前实现行为（handler 不检查 Unmarshal 错误），**锁定为测试契约**。后续若修复为静默丢弃，需更新测试。
2. **发送者 respawn**：无房间时 `Player.Respawn()` 仍执行，发送者收到消息，广播被 nil 检查拦截。
3. **本地更新**：无房间时 `Player.SetWeapon()` 仍执行，广播被 nil 检查拦截。

### TestWS_SkillOnCooldown
- 断言：收到 `error`，message 包含 "cooldown"

### TestWS_Shoot_Cooldown
- 断言：第二人只收到 1 次 `player_shot`

### TestWS_C4Defuse_NoC4
- 断言：静默

### TestWS_JSONParseFailure

**payload**：`json.RawMessage("{invalid")`

**排除**：`voice_data`（原样转发，无 JSON 解析）

### TestWS_NoRoom

**分类**：
1. **静默**：`move`, `chat`, `shoot`, `voice_start`, `voice_stop`, `voice_data`, `team_join`, `grenade_throw`, `c4_plant`, `c4_defuse`, `skill_use`, `emote`, `ping`
2. **发送者收到消息**：`respawn`, `reload`
3. **本地更新 + 广播静默**：`weapon_change`

### error 关键字

| 场景 | 关键字 |
|------|-------|
| 房间满 | "full" |
| 技能冷却 | "cooldown" |

---

## 单元 6：并发测试

### TestConcurrent_Broadcast

**前置**：
- TestServer 已启动 `hub.Run` goroutine
- 不涉及连接关闭/离房

**阈值依据**：
- 5 客户端 × 5 条 chat × 5 接收者 = 125 条理论接收
- 允许 20% 丢失（25 条）作为 CI 稳定性容差
- 这不是产品语义，而是测试容忍度

**断言**：
- 总 chat 数 >= 100
- 每客户端至少收到 15 条

---

## 最小断言合同

| 消息 | 必验字段 |
|------|----------|
| `room_joined` | `room_id` 非空, `player_id` |
| `player_joined` | `player_id` |
| `player_left` | `player_id` 精确匹配 |
| `player_moved` | `player_id`, `position.x/y/z`, `rotation` |
| `chat` | `player_id`, `message` 精确匹配 |
| `player_shot` | `player_id`, `ammo`, `position`, `rotation` |
| `reload` | `ammo` > 0, `ammo_reserve` |
| `respawn` | `health`=100, `ammo` > 0, `position.x/y/z` |
| `player_respawned` | `player_id`, `position.x/y/z` |
| `weapon_changed` | `player_id`, `weapon` 精确匹配 |
| `voice_start` | `player_id` |
| `voice_stop` | `player_id` |
| `voice_data` | `player_id`, `audio` |
| `team_changed` | `player_id`, `team` 精确匹配 |
| `grenade_thrown` | `player_id`, `type` 精确匹配, `position.x/y/z` |
| `c4_planted` | `player_id`, `position.x/y/z`, `team` |
| `c4_defused` | `player_id`, `team` |
| `skill_used` | `player_id`, `skill_id` 精确匹配 |
| `emote` | `player_id`, `emote_id` 精确匹配 |
| `ping` | `player_id`, `type` 精确匹配, `position.x/y/z`, `message` |
| `error` | `message` 包含关键字（见上表） |

---

## 不测范围

| 内容 | 原因 |
|------|------|
| `ServeWS` upgrade 失败 | HTTP 层 |
| `readPump`/`writePump` 超时 | ticker/ping 通过正常路径覆盖 |
| Ping 周期 | 60s 太长 |
| `welcome` 消息内容 | 仅验证存在 |

---

## 成功标准

| 指标 | 目标 |
|------|------|
| 覆盖率 | server.go ≥ 90% |
| 测试通过 | 100% |
| 竞态检测 | 无 fail |

---

## 时间估计

| 单元 | 时间 |
|------|------|
| 单元 1：生产修复 | 0.5h |
| 单元 2：测试基础设施 | 1h |
| 单元 3：连接与房间 | 0.5h |
| 单元 4：消息分发 | 1.5h |
| 单元 5：异常测试 | 1h |
| 单元 6：并发测试 | 0.5h |
| **总计** | **5h** |
