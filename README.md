# FPS Game - 多人在线对战 FPS 游戏

多人在线第一人称射击游戏，基于 WebSocket 实时通信，Three.js 3D 渲染。

## 快速开始

### 1. 启动后端服务器

```bash
cd server
go mod tidy
go run main.go
```

服务器将在 `http://localhost:8080` 启动。

### 2. 访问游戏

打开浏览器访问 `http://localhost:8080`

## 操作说明

| 按键 | 功能 |
|------|------|
| WASD | 移动 |
| 空格 | 跳跃 |
| 鼠标移动 | 视角控制 |
| 左键 | 射击 |
| Tab | 记分板 |
| Enter | 聊天 |

## 项目结构

```
fps-game/
├── server/           # Go 后端
│   ├── main.go       # 入口
│   ├── network/      # WebSocket 通信
│   ├── room/         # 房间管理
│   └── player/       # 玩家管理
├── client/           # 前端
│   ├── index.html    # 入口页面
│   └── js/
│       ├── main.js   # 主逻辑
│       ├── game.js   # 游戏逻辑
│       ├── player.js # 玩家控制
│       ├── renderer.js # 3D 渲染
│       └── network.js  # 网络通信
└── docs/             # 文档
```

## 开发状态

### 已完成 ✅
- WebSocket 连接
- 房间系统
- 玩家移动/跳跃
- 视角控制
- 射击系统
- 聊天功能
- 记分板

### 待开发 🚧
- 命中检测
- 武器系统
- 地图编辑器
- 音效/特效
- 匹配系统

## License

MIT
