# 网络层测试覆盖率完善设计

## 目标

将 `server/internal/network/server.go` 的测试覆盖率从 33.9% 提升到 90%+。

**验收命令**：
```bash
go test -coverprofile=cover.out ./server/internal/network/
go tool cover -func=cover.out | grep server.go
go test -race ./server/internal/network/...
```

---

## 前置修复（本 spec 包含）

修复 `BroadcastToRoom` 添加 nil 检查：

```go
func (h *Hub) BroadcastToRoom(r *room.Room, msgType string, data interface{}, excludeID string) {
    if r == nil {
        return
    }
    // ... 原有逻辑
}
```

**原因**：当前 `BroadcastToRoom(nil, ...)` 会 panic，这是需要修复的缺陷。

---

## 测试分层

| 层级 | 文件 | 内容 | 判定标准 |
|------|------|------|---------|
| 单元测试 | `server_test.go` | Hub 注册/注销、BroadcastToRoom 直接调用 | 不依赖 WebSocket |
| 集成测试 | `server_ws_test.go` | WebSocket 端到端 | 真实网络连接 |
| 并发冒烟 | `server_ws_test.go` | 多客户端稳定性 | 验证无竞态 |

---

## 测试工具稳定性合同

```go
const (
    readTimeout    = 2 * time.Second   // 单次读取超时
    drainWindow    = 200 * time.Millisecond  // 消息收集窗口
    noMessageWait  = 100 * time.Millisecond  // NoMessage 等待时间
)

// NoMessage 验证无消息
// 等待 noMessageWait，确保期间无消息到达
func NoMessage(t *testing.T, conn *websocket.Conn)

// RecvAll 接收所有消息
// 持续读取直到 drainWindow 内无新消息
func RecvAll(t *testing.T, conn *websocket.Conn) []*Message

// Drain 清空消息
// 持续读取直到 drainWindow 内无新消息
func Drain(t *testing.T, conn *websocket.Conn)
```

---

## 消息分类

### 1. 单播给发送者（不依赖房间）

| 类型 | 发送者 | 其他人 | 无房间 |
|------|-------|-------|-------|
| `reload` | `reload` | ❌ | 正常 |

### 2. 广播给其他人（不含发送者）

| 类型 | 无房间 |
|------|-------|
| `move` | 静默 |
| `shoot` | 静默 |
| `voice_start` | 静默 |
| `voice_stop` | 静默 |
| `voice_data` | 静默 |
| `leave_room` | 静默 |

### 3. 广播给全房间（含发送者）

| 类型 | 无房间 |
|------|-------|
| `join_room` | 正常 |
| `chat` | 静默 |
| `respawn` | 发送者正常 + 广播静默 |
| `weapon_change` | 发送者正常 + 广播静默 |
| `team_join` | 静默 |
| `grenade_throw` | 静默 |
| `c4_plant` | 静默 |
| `c4_defuse` | 静默 |
| `skill_use` | 静默 |
| `emote` | 静默 |
| `ping` | 静默 |

---

## 无房间场景精确清单

| 消息 | 预期行为 |
|------|---------|
| `join_room` | 正常执行，创建房间 |
| `reload` | 正常执行，发送者收到 `reload` |
| `leave_room` | 静默，无消息 |
| `move` | 静默，无消息 |
| `chat` | 静默，无消息 |
| `shoot` | 静默，无消息 |
| `respawn` | 发送者收到 `respawn`，广播静默 |
| `weapon_change` | 发送者收到 `weapon_changed`，广播静默 |
| `voice_start` | 静默，无消息 |
| `voice_stop` | 静默，无消息 |
| `voice_data` | 静默，无消息 |
| `team_join` | 静默，无消息 |
| `grenade_throw` | 静默，无消息 |
| `c4_plant` | 静默，无消息 |
| `c4_defuse` | 静默，无消息 |
| `skill_use` | 静默，无消息 |
| `emote` | 静默，无消息 |
| `ping` | 静默，无消息 |

---

## JSON 解析失败测试范围

### 需要测试（解析 data）

| Handler | 失败行为 |
|---------|---------|
| `join_room` | 静默 |
| `move` | 静默 |
| `chat` | 静默 |
| `shoot` | 静默 |
| `respawn` | 静默 |
| `weapon_change` | 静默 |
| `team_join` | 静默 |
| `grenade_throw` | 静默 |
| `c4_plant` | 静默 |
| `skill_use` | 静默 |
| `emote` | 静默 |
| `ping` | 静默 |

### 不需要测试（无 data 解析）

`reload`, `leave_room`, `voice_start`, `voice_stop`, `voice_data`, `c4_defuse`

---

## 错误消息关键字

| 场景 | 关键字 |
|------|-------|
| 房间满 | `full` |
| 技能冷却/无效 | `cooldown` |

---

## 最小断言合同

| 消息 | 必验字段 | 断言方式 |
|------|----------|----------|
| `room_joined` | `room_id`, `player_id` | room_id 非空 |
| `player_joined` | `player_id` | 存在 |
| `player_left` | `player_id` | 精确等于发送者ID |
| `player_moved` | `player_id`, `position` | position 有 x/y/z |
| `chat` | `player_id`, `message` | message 精确匹配 |
| `player_shot` | `player_id` | 存在 |
| `reload` | `ammo`, `ammo_reserve` | 数值 >= 0 |
| `respawn` | `health`, `ammo` | 发送者收到，值 >= 0 |
| `player_respawned` | `player_id`, `position` | 其他人收到 |
| `weapon_changed` | `player_id`, `weapon` | weapon 精确匹配 |
| `voice_start` | `player_id` | 存在 |
| `voice_stop` | `player_id` | 存在 |
| `voice_data` | `player_id` | 存在 |
| `team_changed` | `player_id`, `team` | team 精确匹配 |
| `grenade_thrown` | `player_id`, `type`, `position` | type 精确匹配 |
| `c4_planted` | `player_id`, `position` | position 有 x/y/z |
| `c4_defused` | `player_id` | 存在 |
| `skill_used` | `player_id`, `skill_id` | skill_id 精确匹配 |
| `emote` | `player_id`, `emote_id` | emote_id 精确匹配 |
| `ping` | `player_id`, `data.type`, `position` | data.type 精确匹配 |
| `error` | `message` | 包含关键字 |

---

## 并发测试设计

### 系统设计说明

`BroadcastToRoom` 使用非阻塞发送：

```go
select {
case client.Send <- msg.ToJSON():
default:
    // 缓冲区满，跳过
}
```

**允许丢消息**：当接收方处理慢时，发送通道满会丢弃消息。

### 测试时序

```
1. 创建房间，5 客户端加入
2. 全部 Drain
3. 并发发送（每人 5 条 chat）
4. 等待 2s
5. 统计 chat 消息
```

### 断言

- 无 panic、无死锁
- 总消息 >= 100（理论 125，允许 20% 丢失）
- 每个客户端至少收到 80 条（保证公平性）
- 连接存活

---

## 不测范围

| 内容 | 原因 |
|------|------|
| `ServeWS` upgrade 失败 | HTTP 错误分支 |
| `pongWait`/`writeWait` 超时 | 需特殊客户端 |
| Ping 周期 | 60s 太长 |

---

## 覆盖率预算

| 函数 | 预计覆盖 | 说明 |
|------|---------|------|
| `ServeWS` | ~90% | upgrade 失败不测 |
| `readPump` | ~85% | 超时不测 |
| `writePump` | ~80% | ping/超时不测 |
| `handleXxx` | ~95% | 主要路径覆盖 |
| `BroadcastToRoom` | 100% | nil/空房间/正常 |
| **总体** | **≥90%** | |

---

## 实施清单

### Phase 1：基础设施

- [ ] 修复 `BroadcastToRoom` nil 检查
- [ ] 实现 `TestServer`
- [ ] 实现 helper 函数

### Phase 2：连接测试

- [ ] `TestWS_Connect`
- [ ] `TestWS_Disconnect_InRoom`
- [ ] `TestWS_UnknownType`
- [ ] `TestWS_InvalidTopLevelJSON`

### Phase 3：房间测试

- [ ] `TestWS_JoinRoom_NewRoom`
- [ ] `TestWS_JoinRoom_ExistingRoom`
- [ ] `TestWS_JoinRoom_Full`
- [ ] `TestWS_LeaveRoom`

### Phase 4：消息分发测试

**单播**：
- [ ] `reload`

**广播其他人**：
- [ ] `move`, `shoot`, `voice_start`, `voice_stop`, `voice_data`

**广播全房间**：
- [ ] `chat`, `respawn`, `weapon_change`, `team_join`
- [ ] `grenade_throw`, `c4_plant`, `c4_defuse`
- [ ] `skill_use`, `emote`, `ping`

### Phase 5：异常测试

- [ ] `TestWS_JSONParseFailure`（表驱动）
- [ ] `TestWS_NoRoom`（表驱动）
- [ ] `TestWS_SkillOnCooldown`
- [ ] `TestWS_InvalidSkill`
- [ ] `TestWS_Shoot_Cooldown`

### Phase 6：并发测试

- [ ] `TestConcurrent_Broadcast`

---

## 成功标准

| 指标 | 目标 |
|------|------|
| 覆盖率 | server.go ≥ 90% |
| 测试通过 | 100% |
| 竞态检测 | 无 fail |

---

## 时间估计

| 任务 | 时间 |
|------|------|
| 修复代码 | 0.5h |
| 测试工具 | 0.5h |
| 测试编写 | 2h |
| 调试 | 1h |
| **总计** | **4h** |
