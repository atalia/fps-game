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
│   │   ├── game/             # 游戏引擎
│   │   ├── room/             # 房间管理
│   │   ├── player/           # 玩家管理
│   │   ├── weapon/           # 武器系统
│   │   └── network/          # WebSocket 服务
│   ├── configs/              # 配置文件
│   └── go.mod
├── client/                   # 前端
│   ├── index.html            # 游戏页面
│   └── js/                   # Three.js 模块
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
| Tab | 记分板 |
| Enter | 聊天 |

## 🔧 常用命令

```bash
make build          # 本地构建
make run            # 本地运行
make test           # 运行测试
make docker-up      # 启动服务
make docker-down    # 停止服务
make docker-logs    # 查看日志
make status         # 查看状态
make clean          # 清理
```

## 📊 架构

详见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## 🛠️ 技术栈

- **后端**: Go 1.22, gorilla/websocket
- **前端**: Three.js, WebSocket
- **存储**: Redis
- **监控**: Prometheus, Grafana
- **代理**: Nginx

## 📝 开发状态

### v1.0 (进行中)
- [x] WebSocket 连接
- [x] 房间系统
- [x] 玩家移动
- [x] 射击系统
- [x] Docker Compose
- [ ] 命中检测
- [ ] 音效/特效

## 📄 License

MIT
