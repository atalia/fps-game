# FPS Game - 多人在线对战 FPS 游戏

多人在线第一人称射击游戏，基于 WebSocket 实时通信，Three.js 3D 渲染。

## 🚀 一键启动

### 开发环境

```bash
# 克隆项目
git clone https://github.com/YOUR_USERNAME/fps-game.git
cd fps-game

# 复制环境变量
cp .env.example .env

# 启动所有服务
make dev
```

访问:
- 🎮 游戏: http://localhost:8080
- 📊 监控: http://localhost:9091 (Prometheus)
- 📈 仪表盘: http://localhost:3000 (Grafana, admin/admin)

### 生产环境

```bash
make prod
```

## 📁 项目结构

```
fps-game/
├── server/                   # Go 后端
│   ├── cmd/server/           # 入口
│   ├── internal/
│   │   ├── config/           # 配置管理
│   │   ├── game/             # 游戏引擎 + 命中检测 + 排行榜
│   │   ├── room/             # 房间管理
│   │   ├── player/           # 玩家管理
│   │   ├── weapon/           # 武器系统
│   │   ├── match/            # 匹配系统
│   │   ├── storage/          # 存储层
│   │   └── network/          # WebSocket 服务
│   ├── pkg/utils/            # 工具函数
│   ├── configs/              # 配置文件
│   └── go.mod
├── client/                   # 前端
│   ├── index.html            # 游戏页面
│   ├── js/                   # Three.js 模块
│   │   ├── main.js           # 主逻辑
│   │   ├── game.js           # 游戏逻辑
│   │   ├── player.js         # 玩家控制
│   │   ├── renderer.js       # 3D 渲染
│   │   ├── network.js        # WebSocket
│   │   ├── audio.js          # 音效
│   │   ├── effects.js        # 视觉特效
│   │   └── ui.js             # UI 管理
│   └── tests/                # 前端测试
├── docker/
│   ├── nginx/                # Nginx 配置
│   ├── prometheus/           # Prometheus 配置
│   └── grafana/              # Grafana 配置
├── docs/                     # 文档
├── Dockerfile
├── docker-compose.yml
├── Makefile
└── .env.example
```

## 🎮 操作说明

| 按键 | 功能 |
|------|------|
| WASD | 移动 |
| 空格 | 跳跃 |
| 鼠标移动 | 视角控制 |
| 左键 | 射击 |
| R | 换弹 |
| 1-4 | 切换武器 |
| Tab | 记分板 |
| Enter | 聊天 |

## 🔧 常用命令

```bash
make build          # 本地构建
make run            # 本地运行
make test           # 运行测试
make cover          # 测试覆盖率
make lint           # Lint 检查
make docker-up      # 启动服务
make docker-down    # 停止服务
make docker-logs    # 查看日志
make ci             # 完整 CI 检查
```

## 📊 测试覆盖率

| 模块 | 覆盖率 | 状态 |
|------|--------|------|
| game | 87.8% | ✅ |
| room | 83.3% | ✅ |
| storage | 75.3% | ✅ |
| weapon | 92.9% | ✅ |
| player | 87.8% | ✅ |
| match | 92.6% | ✅ |
| network | 33.9% | ⬜ |
| utils | 57.1% | ⬜ |

## 🎯 游戏功能

### 已完成 ✅

- WebSocket 实时通信
- 房间系统
- 玩家移动/跳跃
- 第一人称视角
- 射击系统 + 命中检测
- 武器系统（手枪/步枪/霰弹枪/狙击枪）
- 聊天功能
- 记分板
- 排行榜
- 匹配系统
- 音效系统
- 视觉特效
- 小地图
- Docker Compose

### 进行中 🚧

- 网络层测试完善

### 最新视觉升级 ✅

- 竞技风 3D 场景重构：模块化墙体、掩体、边界和功能区
- 玩家模型重构：更清晰的人形轮廓、装备层次和队伍识别点
- 渲染统一：更克制的材质、灯光和竞技可读性优先的视觉语言

## 📝 架构

详见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## 🛠️ 技术栈

- **后端**: Go 1.22, gorilla/websocket
- **前端**: Three.js, WebSocket
- **存储**: Redis (可选)
- **监控**: Prometheus, Grafana
- **代理**: Nginx

## 📄 License

MIT

