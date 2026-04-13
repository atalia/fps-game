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

### 前端视觉架构（Phase 2 Tactical Upgrade）

- `client/js/assets/runtime-assets.js`
  - 负责运行时资产缓存与 graceful fallback
  - 真实外部资产缺失时不阻断游戏流程
- `client/js/assets/environment-kit.js`
  - 负责核心战区的环境套件拼装
  - 输出对象统一带 `userData.category`、`userData.zone`、`userData.visualProfile`
  - 与 `map-enhanced.js` 配合，保持核心战区升级、外围几何轻量
- `client/js/effects/map-enhanced.js`
  - 负责地图侧表现组合，是 no-texture visual polish 的主场景编排层
  - 拥有中路主体、掩体簇、边界节奏、地面程序化分区和功能性光源锚点
  - 目标是在不引入外部贴图的前提下，用几何层次、程序材质和有限灯光维持战术可读性
- `client/js/assets/character-kit.js`
  - 负责玩家轮廓组合，是角色侧 no-texture silhouette 层
  - 拥有 torso / armor / gear / accent 的材料分层，以及胸挂、腰封、背板、腿挂等装备 breakup
  - 保持共享原点和尺度，兼容测试环境 fallback mesh
- `client/js/renderer.js`
  - 负责总装配和呈现护栏，是场景创建、灯光配置、后处理配置的统一入口
  - 维护 `tacticalLightingProfile`、`localFunctionalLights`、`postProcessingProfile`
  - 保持 `renderer.addPlayer()/updatePlayer()` 兼容，不改调用方接口

#### 视觉护栏

- 真实感升级不能牺牲敌我识别、掩体识别和路线理解
- 后处理保持中等强度，可切换，不允许压住目标可见性
- 资产层只负责 kit 和 fallback，玩法逻辑不依赖外部模型是否成功加载

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

## 核心系统

### 团队系统 (Team System)

- 文件: `server/internal/team/`
- 功能: CT vs T 队伍对抗
- 消息: `team_join`, `team_updated`
- API: 自动平衡队伍人数

### 经济系统 (Economy System)

- 文件: `server/internal/economy/`
- 功能: 金钱系统、武器购买
- 配置: 起始金钱 $800，击杀奖励 $300
- API: 通过 `balance` 包可配置

### 回合系统 (Round System)

- 文件: `server/internal/room/round_manager.go`
- 功能: CS 风格回合制
- 阶段: waiting → freeze → live → ended → match_over
- 配置: 冻结时间 15s，回合时间 1m55s

### C4 爆破模式 (Bomb Defusal)

- 文件: `server/internal/network/c4_*.go`
- 功能: 安装/拆除 C4
- 消息: `c4_plant`, `c4_planted`, `c4_defuse`, `c4_defused`, `c4_exploded`
- 计时: 安装 3s，拆除 5s，爆炸 40s

### 语音系统 (Voice System)

- 文件: `client/js/voice.js`, `server/internal/network/voice.go`
- 功能: 团队语音通信
- 模式: Push-to-talk, Open-mic
- 隔离: 仅队伍内广播

### AI 机器人 (Bot System)

- 文件: `server/internal/ai/`
- 功能: 自动填充机器人玩家
- 难度: easy, normal, hard, nightmare
- 行为: 巡逻、追击、攻击、掩护

### 命中检测 (Hit Detection)

- 文件: `server/internal/hitbox/`
- 功能: 射线-球体相交检测
- 部位: head (2.5x), body (1.0x), arm (0.8x), leg (0.7x)
- 距离衰减: 最小 30% 伤害

### 遥测系统 (Telemetry)

- 文件: `server/pkg/metrics/`
- API: `GET /api/metrics`
- 指标: 连接率、断线率、对局时长、武器使用、平台分布

### 平衡系统 (Balance)

- 文件: `server/internal/balance/`
- API: 
  - `GET /api/balance` - 获取配置
  - `POST /api/balance/difficulty/{level}` - 设置难度
- 参数: 经济、武器、机器人、命中倍率

## API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/health` | GET | 健康检查 |
| `/api/stats` | GET | 游戏统计 |
| `/api/rooms` | GET | 房间列表 |
| `/api/metrics` | GET | 遥测数据 |
| `/api/balance` | GET | 平衡配置 |
| `/api/balance/difficulty/{level}` | POST | 设置难度 |
| `/ws` | WS | WebSocket 连接 |

## 测试覆盖

| 模块 | 覆盖率 |
|------|--------|
| config | 100% |
| utils | 98.9% |
| weapon | 95%+ |
| game | 92%+ |
| player | 85%+ |
| match | 87%+ |
| room | 78%+ |
| network | 88%+ |

运行测试:
```bash
make test         # 常规测试
make race-test    # 竞争检测
make coverage     # 覆盖率报告
```
