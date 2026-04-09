# Protocol Flow - 消息协议文档

本文档描述 FPS Game 的 WebSocket 消息协议和核心游戏流程。

## 连接生命周期

```
Client                          Server
  |                               |
  |-------- WebSocket Connect --->|
  |                               |
  |<------- connected ------------|
  |                               |
  |-------- join_room ----------->|
  |                               |
  |<------- room_joined ----------|
  |<------- player_joined --------| (广播给房间内其他玩家)
  |                               |
  |        (游戏进行中)            |
  |                               |
  |-------- WebSocket Close ----->|
  |                               |
  |<------- player_left ----------| (广播给房间内其他玩家)
```

## 核心消息类型

### 连接与加入

#### `connected`
服务器确认连接建立。
```json
{
  "type": "connected",
  "data": {
    "player_id": "uuid-v4"
  }
}
```

#### `join_room`
客户端请求加入房间。
```json
{
  "type": "join_room",
  "data": {
    "room_id": "optional-room-id",
    "name": "PlayerName",
    "platform": "desktop|mobile"
  }
}
```

#### `room_joined`
服务器确认加入房间。
```json
{
  "type": "room_joined",
  "data": {
    "room_id": "room-uuid",
    "player_id": "player-uuid",
    "players": [...]
  }
}
```

#### `player_joined`
广播新玩家加入（发给房间内其他玩家）。
```json
{
  "type": "player_joined",
  "data": {
    "player_id": "uuid",
    "name": "PlayerName",
    "team": "ct|t",
    "is_bot": false
  }
}
```

### 移动与状态

#### `move`
客户端发送移动指令。
```json
{
  "type": "move",
  "data": {
    "position": {"x": 100, "y": 7, "z": -100},
    "rotation": 1.25
  }
}
```

#### `player_moved`
广播玩家位置更新。
```json
{
  "type": "player_moved",
  "data": {
    "player_id": "uuid",
    "position": {"x": 100, "y": 7, "z": -100},
    "rotation": 1.25
  }
}
```

### 战斗

#### `shoot`
客户端发送射击指令。
```json
{
  "type": "shoot",
  "data": {
    "direction": {"x": 0.5, "y": 0, "z": -0.866},
    "rotation": 1.25
  }
}
```

#### `player_shot`
广播玩家射击事件。
```json
{
  "type": "player_shot",
  "data": {
    "player_id": "uuid",
    "position": {"x": 100, "y": 7, "z": -100},
    "rotation": 1.25,
    "weapon_id": "rifle",
    "ammo": 29,
    "direction": {"x": 0.5, "y": 0, "z": -0.866}
  }
}
```

#### `player_damaged`
通知玩家受伤。
```json
{
  "type": "player_damaged",
  "data": {
    "player_id": "victim-uuid",
    "attacker_id": "attacker-uuid",
    "damage": 30,
    "health": 70,
    "hitbox": "body"
  }
}
```

#### `player_killed`
广播玩家击杀事件。
```json
{
  "type": "player_killed",
  "data": {
    "victim_id": "victim-uuid",
    "killer_id": "killer-uuid",
    "weapon_id": "rifle",
    "hitbox": "head",
    "is_headshot": true,
    "kill_distance": 45.5,
    "is_bot": false
  }
}
```

### 团队系统

#### `team_join`
客户端请求加入队伍。
```json
{
  "type": "team_join",
  "data": {
    "team": "ct|t"
  }
}
```

#### `team_updated`
广播队伍变更。
```json
{
  "type": "team_updated",
  "data": {
    "player_id": "uuid",
    "team": "ct",
    "teams": {
      "ct": {"score": 3, "players": [...]},
      "t": {"score": 2, "players": [...]}
    }
  }
}
```

### 语音系统

#### `voice_start`
玩家开始说话（广播给队友）。
```json
{
  "type": "voice_start",
  "data": {
    "player_id": "uuid"
  }
}
```

#### `voice_stop`
玩家停止说话。
```json
{
  "type": "voice_stop",
  "data": {
    "player_id": "uuid"
  }
}
```

#### `voice_data`
语音数据包（仅发给队友）。
```json
{
  "type": "voice_data",
  "data": {
    "player_id": "uuid",
    "audio": "base64-encoded-audio-data"
  }
}
```

### 回合系统

#### `round_started`
回合开始通知。
```json
{
  "type": "round_started",
  "data": {
    "round_number": 5,
    "phase": "freeze",
    "phase_ends_at": 1700000000,
    "teams": {...}
  }
}
```

#### `round_ended`
回合结束通知。
```json
{
  "type": "round_ended",
  "data": {
    "round_number": 5,
    "winner": "ct",
    "reason": "elimination|bomb_exploded|bomb_defused|time",
    "mvp": "player-uuid",
    "teams": {...}
  }
}
```

### C4 爆破模式

#### `c4_plant`
开始安装 C4。
```json
{
  "type": "c4_plant",
  "data": {}
}
```

#### `c4_planted`
C4 安装完成（广播）。
```json
{
  "type": "c4_planted",
  "data": {
    "planter_id": "uuid",
    "position": {"x": 100, "y": 7, "z": -100}
  }
}
```

#### `c4_defuse`
开始拆除 C4。
```json
{
  "type": "c4_defuse",
  "data": {}
}
```

#### `c4_defused`
C4 拆除成功（广播）。
```json
{
  "type": "c4_defused",
  "data": {
    "defuser_id": "uuid"
  }
}
```

#### `c4_exploded`
C4 爆炸（广播）。
```json
{
  "type": "c4_exploded",
  "data": {
    "position": {"x": 100, "y": 7, "z": -100}
  }
}
```

### 错误处理

#### `error`
错误消息。
```json
{
  "type": "error",
  "data": {
    "message": "Player name must be between 2 and 20 characters"
  }
}
```

## 消息流示例

### 完整战斗流程

```
Client A                Server                  Client B
   |                      |                        |
   |------ shoot -------->|                        |
   |                      |---- player_shot ------>|
   |                      |                        |
   |                      |<--- (命中检测) --------|
   |                      |                        |
   |                      |--- player_damaged ---> |
   |                      |                        |
   |                      |--- player_killed ----> |
   |<-- player_killed ----|                        |
```

### 团队语音流程

```
Client A (CT)           Server              Client B (CT)      Client C (T)
     |                    |                      |                   |
     |-- voice_start ---->|                      |                   |
     |                    |-- voice_start -----> |                   |
     |                    |                      |                   |
     |-- voice_data ----->|-- voice_data ------> |                   |
     |                    |                      |                   |
     |-- voice_stop ----->|-- voice_stop ------> |                   |
     |                    |                      |                   |
```

## 平台标识

前端在 `join_room` 时携带 `platform` 字段：

- `desktop`: 桌面浏览器
- `mobile`: 移动设备浏览器

检测逻辑：
```javascript
/Mobile|Android|iPhone|iPad/i.test(navigator.userAgent) ? "mobile" : "desktop"
```

## 版本兼容

消息格式变更遵循以下规则：

1. 新增字段向后兼容，旧客户端忽略未知字段
2. 删除字段需先标记为 `deprecated`，至少保留一个版本
3. 类型变更需创建新消息类型

当前协议版本：检查 `client/index.html` 中的 `?v=` 参数
