# FPS Game - 多人在线对战 FPS 游戏

多人在线第一人称射击游戏，支持房间对战、实时同步。

## 技术栈

### 后端
- Go 1.22+
- WebSocket (gorilla/websocket)
- Redis（可选，用于分布式）

### 前端
- Three.js（3D 渲染）
- WebSocket
- 现代浏览器

## 项目结构

```
fps-game/
├── server/           # 后端服务
│   ├── main.go       # 入口
│   ├── game/         # 游戏逻辑
│   ├── room/         # 房间管理
│   ├── player/       # 玩家管理
│   ├── network/      # 网络通信
│   └── config/       # 配置
├── client/           # 前端
│   ├── index.html    # 入口页面
│   ├── js/           # JavaScript
│   │   ├── main.js   # 主逻辑
│   │   ├── game.js   # 游戏逻辑
│   │   ├── player.js # 玩家控制
│   │   ├── network.js# 网络通信
│   │   └── renderer.js# 渲染
│   └── assets/       # 资源文件
│       ├── models/   # 3D 模型
│       ├── textures/ # 纹理
│       └── sounds/   # 音效
├── docs/             # 文档
└── README.md
```

## 快速开始

### 启动后端
```bash
cd server
go mod tidy
go run main.go
```

### 启动前端
```bash
cd client
# 使用任意 HTTP 服务器
python -m http.server 8080
# 或
npx serve .
```

访问 http://localhost:8080

## 游戏功能

### 核心
- [x] WebSocket 连接
- [ ] 玩家移动/跳跃
- [ ] 射击/命中检测
- [ ] 房间系统
- [ ] 匹配系统

### 地图
- [ ] 基础地图
- [ ] 障碍物
- [ ] 出生点

### 武器
- [ ] 手枪
- [ ] 步枪
- [ ] 霰弹枪

### UI
- [ ] 血量显示
- [ ] 弹药显示
- [ ] 记分板
- [ ] 小地图

## 开发状态

🚧 开发中...

## License

MIT
