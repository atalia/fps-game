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

---

## 测试工具稳定性合同

```go
const (
    readTimeout    = 2 * time.Second
    drainWindow    = 200 * time.Millisecond
    noMessageWait  = 100 * time.Millisecond
)
```

---

## 消息行为（基于代码）

### 1. 单播给发送者（不依赖房间）

| 类型 | 发送者 | 其他人 | 无房间 | JSON失败 |
|------|-------|-------|-------|---------|
| `reload` | `reload` | ❌ | 正常 | N/A |

### 2. 广播给其他人（不含发送者）

| 类型 | 无房间 | JSON失败 |
|------|-------|---------|
| `move` | 静默 | 零值广播 |
| `shoot` | 静默 | **零值广播**（继续执行） |
| `voice_start` | 静默 | N/A |
| `voice_stop` | 静默 | N/A |
| `voice_data` | 静默 | N/A |
| `leave_room` | 静默 | N/A |

### 3. 广播给全房间（含发送者）

| 类型 | 无房间 | JSON失败 |
|------|-------|---------|
| `join_room` | 正常（创建房间） | 静默 |
| `chat` | 静默 | 静默 |
| `respawn` | 发送者正常+广播静默 | 零值广播 |
| `weapon_change` | **完全静默**（广播被 nil check 拦截） | 静默 |
| `team_join` | 静默 | 零值广播 |
| `grenade_throw` | 静默 | 零值广播 |
| `c4_plant` | 静默 | 零值广播 |
| `c4_defuse` | 静默（无C4时也静默） | N/A |
| `skill_use` | 静默 | 静默 |
| `emote` | 静默 | 零值广播 |
| `ping` | 静默 | 零值广播 |

**关键发现**：
- `shoot` JSON 解析失败后会继续执行 `Shoot()` 并广播（零值 position）
- `weapon_change` 无房间时完全静默（修复后）
- `c4_defuse` 有额外检查 `!c.Room.IsC4Planted()` 会静默返回

---

## 异常测试行为

| 测试 | 输入 | 预期输出 |
|------|------|---------|
| `TestWS_SkillOnCooldown` | 连续两次 `skill_use` | 第二次收到 `error` 包含 "cooldown" |
| `TestWS_Shoot_Cooldown` | 冷却期内 `shoot` | 静默，其他人只收到之前的 `player_shot` |
| `TestWS_C4Defuse_NoC4` | 未种包时 `c4_defuse` | 静默 |

**删除的测试**：
- ~~`TestWS_InvalidSkill`~~：无效技能与冷却行为相同，无需单独测试

---

## JSON 解析失败测试范围

### 需要测试（解析 data）

| Handler | 失败行为 |
|---------|---------|
| `join_room` | 静默 |
| `move` | 零值广播 |
| `chat` | 静默 |
| `shoot` | **零值广播**（继续执行） |
| `respawn` | 零值广播 |
| `weapon_change` | 静默 |
| `team_join` | 零值广播 |
| `grenade_throw` | 零值广播 |
| `c4_plant` | 零值广播 |
| `skill_use` | 静默 |
| `emote` | 零值广播 |
| `ping` | 零值广播 |

### 不需要测试（无 data 解析）

`reload`, `leave_room`, `voice_start`, `voice_stop`, `voice_data`, `c4_defuse`

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
| `ping` | `player_id`, `type`, `position` | type 精确匹配（data 内的 type 字段） |
| `error` | `message` | 包含关键字 |

---

## 并发测试设计

### 时序

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
- 连接存活

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

**单播**：`reload`

**广播其他人**：`move`, `shoot`, `voice_start`, `voice_stop`, `voice_data`

**广播全房间**：`chat`, `respawn`, `weapon_change`, `team_join`, `grenade_throw`, `c4_plant`, `c4_defuse`, `skill_use`, `emote`, `ping`

### Phase 5：异常测试

- [ ] `TestWS_JSONParseFailure`（表驱动）
- [ ] `TestWS_NoRoom`（表驱动）
- [ ] `TestWS_SkillOnCooldown`
- [ ] `TestWS_Shoot_Cooldown`
- [ ] `TestWS_C4Defuse_NoC4`

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
