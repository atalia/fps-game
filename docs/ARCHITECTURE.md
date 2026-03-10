# FPS Game 架构设计

## 系统架构

```
┌──────────────────────────────────────────────────────────────┐
│                        Docker Compose                         │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Nginx     │  │   Redis     │  │   Game Server (Go)  │  │
│  │   :80/443   │  │   :6379     │  │   :8080 (WS)        │  │
│  │             │  │             │  │                     │  │
│  │ - 静态文件   │  │ - 房间缓存  │  │ - WebSocket 服务    │  │
│  │ - 反向代理   │  │ - 会话存储  │  │ - 游戏逻辑          │  │
│  │ - SSL 终止   │  │ - 排行榜    │  │ - 碰撞检测          │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                    │              │
│         └────────────────┼────────────────────┘              │
│                          │                                   │
│  ┌───────────────────────┴───────────────────────┐          │
│  │              Prometheus + Grafana              │          │
│  │              (监控和可视化)                     │          │
│  └───────────────────────────────────────────────┘          │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## 模块划分

### 1. 后端服务 (Go)

```
server/
├── cmd/
│   └── server/
│       └── main.go          # 入口
├── internal/
│   ├── config/              # 配置管理
│   ├── game/                # 游戏逻辑
│   │   ├── engine.go        # 游戏引擎
│   │   ├── collision.go     # 碰撞检测
│   │   └── physics.go       # 物理系统
│   ├── room/                # 房间管理
│   │   ├── manager.go       # 房间管理器
│   │   └── room.go          # 房间实体
│   ├── player/              # 玩家管理
│   │   ├── player.go        # 玩家实体
│   │   └── controller.go    # 玩家控制器
│   ├── weapon/              # 武器系统
│   │   ├── weapon.go        # 武器接口
│   │   ├── pistol.go        # 手枪
│   │   ├── rifle.go         # 步枪
│   │   └── shotgun.go       # 霰弹枪
│   ├── network/             # 网络通信
│   │   ├── server.go        # WebSocket 服务
│   │   ├── client.go        # 客户端连接
│   │   └── protocol.go      # 协议定义
│   ├── match/               # 匹配系统
│   │   ├── matcher.go       # 匹配器
│   │   └── queue.go         # 匹配队列
│   └── storage/             # 数据存储
│       ├── redis.go         # Redis 存储
│       └── memory.go        # 内存存储
├── pkg/
│   ├── log/                 # 日志
│   ├── metrics/             # 监控指标
│   └── utils/               # 工具函数
├── api/
│   └── openapi.yaml         # API 文档
├── configs/
│   └── config.yaml          # 配置文件
├── scripts/
│   └── init.sh              # 初始化脚本
├── Dockerfile
├── go.mod
└── go.sum
```

### 2. 前端 (Three.js)

```
client/
├── index.html               # 入口页面
├── css/
│   └── style.css            # 样式
├── js/
│   ├── main.js              # 主逻辑
│   ├── game.js              # 游戏逻辑
│   ├── player.js            # 玩家控制
│   ├── renderer.js          # 3D 渲染
│   ├── network.js           # 网络通信
│   ├── audio.js             # 音效管理
│   ├── ui.js                # UI 管理
│   └── utils.js             # 工具函数
├── assets/
│   ├── models/              # 3D 模型
│   ├── textures/            # 纹理
│   ├── sounds/              # 音效
│   └── maps/                # 地图数据
└── Dockerfile
```

### 3. 基础设施

```
docker/
├── nginx/
│   ├── nginx.conf           # Nginx 配置
│   └── ssl/                 # SSL 证书
├── prometheus/
│   └── prometheus.yml       # Prometheus 配置
└── grafana/
    └── dashboards/          # Grafana 仪表盘

docker-compose.yml           # Docker Compose 配置
.env.example                 # 环境变量示例
Makefile                     # 构建脚本
```

## 通信协议

### WebSocket 消息格式

```json
{
  "type": "message_type",
  "data": {},
  "timestamp": 1234567890,
  "seq": 1
}
```

### 消息类型

| 类型 | 方向 | 说明 |
|------|------|------|
| welcome | S→C | 欢迎消息 |
| join_room | C→S | 加入房间 |
| room_joined | S→C | 成功加入 |
| leave_room | C→S | 离开房间 |
| move | C→S | 位置更新 |
| player_moved | S→C | 玩家移动广播 |
| shoot | C→S | 射击事件 |
| player_shot | S→C | 射击广播 |
| hit | S→C | 命中事件 |
| die | S→C | 死亡事件 |
| respawn | S→C | 重生事件 |
| chat | C→S / S→C | 聊天消息 |
| match_start | S→C | 匹配开始 |
| match_end | S→C | 比赛结束 |
| scoreboard | S→C | 记分板更新 |

## 游戏机制

### 玩家属性

| 属性 | 默认值 | 说明 |
|------|--------|------|
| Health | 100 | 生命值 |
| Speed | 5 m/s | 移动速度 |
| JumpForce | 8 m/s | 跳跃力度 |
| Gravity | 20 m/s² | 重力加速度 |

### 武器系统

| 武器 | 伤害 | 射速 | 弹匣 | 后坐力 |
|------|------|------|------|--------|
| Pistol | 25 | 300ms | 12 | 低 |
| Rifle | 30 | 100ms | 30 | 中 |
| Shotgun | 15x8 | 800ms | 6 | 高 |
| Sniper | 100 | 1500ms | 5 | 极高 |

### 地图系统

- 基础地图：100x100 米竞技场
- 障碍物：箱子、墙壁、掩体
- 出生点：对称分布
- 补给点：弹药/血包刷新

## 部署架构

### 开发环境

```bash
# 一键启动所有服务
docker-compose up -d

# 访问
# - 游戏: http://localhost
# - API: http://localhost/api
# - 监控: http://localhost:9090 (Prometheus)
# - 仪表盘: http://localhost:3000 (Grafana)
```

### 生产环境

```bash
# 使用生产配置
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## 监控指标

| 指标 | 说明 |
|------|------|
| game_players_online | 在线玩家数 |
| game_rooms_active | 活跃房间数 |
| game_messages_total | 消息总量 |
| game_latency_ms | 网络延迟 |
| game_fps | 服务端帧率 |

## 后续规划

### v1.0 (基础)
- [x] WebSocket 连接
- [x] 房间系统
- [x] 玩家移动
- [x] 射击系统
- [ ] 命中检测
- [ ] Docker Compose

### v1.1 (完善)
- [ ] 多种武器
- [ ] 地图编辑器
- [ ] 音效系统
- [ ] 视觉特效

### v1.2 (竞技)
- [ ] 排位系统
- [ ] 匹配优化
- [ ] 观战模式
- [ ] 录像回放

### v2.0 (扩展)
- [ ] 多地图支持
- [ ] 技能系统
- [ ] 道具系统
- [ ] 成就系统
