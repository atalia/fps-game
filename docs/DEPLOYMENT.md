# Deployment Guide - 部署指南

本文档描述 FPS Game 的部署流程和故障恢复。

## 架构概览

```
                    ┌─────────────────┐
                    │   Nginx (80)    │
                    │   反向代理       │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   Game Server   │ │    Redis        │ │   Prometheus    │
│   (8080)        │ │   (6379)        │ │   (9091)        │
└─────────────────┘ └─────────────────┘ └─────────────────┘
         │
         ▼
┌─────────────────┐
│    Grafana      │
│   (3000)        │
└─────────────────┘
```

## 快速部署

### 开发环境

```bash
# 克隆项目
git clone https://github.com/atalia/fps-game.git
cd fps-game

# 复制配置
cp .env.example .env

# 启动开发环境
make dev
```

访问地址：
- 游戏: http://localhost:8080
- Prometheus: http://localhost:9091
- Grafana: http://localhost:3000 (admin/admin)

### 生产环境

```bash
# 完整部署
make prod

# 或分步部署
make redis          # 启动 Redis
make game-server    # 启动游戏服务器
make nginx          # 启动 Nginx 反向代理
make monitoring     # 启动监控（可选）
```

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `SERVER_HOST` | `0.0.0.0` | 监听地址 |
| `SERVER_PORT` | `8080` | 服务端口 |
| `REDIS_URL` | `localhost:6379` | Redis 地址 |
| `CLIENT_PATH` | `./client` | 前端文件路径 |
| `CORS_ORIGINS` | `*` | CORS 允许来源 |

## 部署检查清单

### 部署前检查

```bash
# 运行预检脚本
./scripts/pre-deploy-check.sh

# 或手动检查
make ci
```

检查项：
- [ ] 代码编译通过
- [ ] 测试全部通过
- [ ] Lint 无错误
- [ ] Race detector 无警告
- [ ] 安全扫描通过

### 部署后验证

```bash
# 健康检查
curl http://localhost:8080/api/health

# 预期响应
{
  "status": "healthy",
  "timestamp": 1700000000,
  "version": "v1.0.0",
  "commit": "abc1234"
}

# 遥测检查
curl http://localhost:8080/api/metrics

# 平衡配置检查
curl http://localhost:8080/api/balance
```

## 服务管理

### 启动/停止

```bash
# 使用 Makefile
make dev          # 启动开发环境
make prod         # 启动生产环境
make stop         # 停止所有服务

# 手动管理
./start.sh        # 交互式启动脚本
```

### Docker 部署

```bash
# 构建镜像
docker build -t fps-game:latest .

# 运行容器
docker run -d \
  -p 8080:8080 \
  -e REDIS_URL=redis:6379 \
  --name fps-game \
  fps-game:latest

# 使用 docker-compose
docker-compose up -d
```

## 监控与日志

### Prometheus 指标

访问 http://localhost:9091 查看指标：

- `fps_connections_active`: 活跃连接数
- `fps_matches_started`: 对局开始数
- `fps_matches_completed`: 对局完成数
- `fps_kills_total`: 总击杀数
- `fps_headshots_total`: 爆头数

### Grafana 仪表盘

访问 http://localhost:3000：

1. 登录 (admin/admin)
2. 添加 Prometheus 数据源
3. 导入仪表盘配置

### 日志位置

```bash
# 服务日志
tail -f /var/log/fps-game/server.log

# Nginx 日志
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

## 故障恢复

### 常见问题

#### 1. 无法连接 WebSocket

**症状**: 浏览器控制台显示 `WebSocket connection failed`

**检查步骤**:
```bash
# 1. 检查服务状态
curl http://localhost:8080/api/health

# 2. 检查端口占用
netstat -tlnp | grep 8080

# 3. 检查防火墙
sudo ufw status
```

**解决方案**:
- 确保 Redis 运行: `redis-cli ping`
- 重启服务: `make prod`
- 检查 Nginx 配置: `nginx -t`

#### 2. 玩家无法加入房间

**症状**: 点击加入后无响应或报错

**检查步骤**:
```bash
# 1. 检查房间数量
curl http://localhost:8080/api/rooms

# 2. 检查日志
grep "join_room" /var/log/fps-game/server.log

# 3. 检查内存
free -h
```

**解决方案**:
- 清理过期房间: 重启服务
- 增加房间上限: 修改配置

#### 3. 高延迟/卡顿

**症状**: 游戏画面卡顿，移动不流畅

**检查步骤**:
```bash
# 1. 检查服务器负载
top
htop

# 2. 检查网络延迟
ping your-server.com

# 3. 检查 Redis 延迟
redis-cli --latency
```

**解决方案**:
- 减少 AI 机器人数
- 优化网络配置
- 升级服务器资源

#### 4. 内存泄漏

**症状**: 内存持续增长

**检查步骤**:
```bash
# 1. 查看内存使用
ps aux | grep fps-game

# 2. 启用 pprof
curl http://localhost:8080/debug/pprof/heap > heap.out
go tool pprof heap.out

# 3. 检查 goroutine 泄漏
curl http://localhost:8080/debug/pprof/goroutine?debug=1
```

**解决方案**:
- 重启服务
- 修复泄漏代码
- 增加内存限制

### 紧急恢复

```bash
# 紧急重启
make stop && make prod

# 清理 Redis 缓存
redis-cli FLUSHALL

# 回滚版本
git checkout <previous-stable-commit>
make prod
```

## 备份与恢复

### 数据备份

```bash
# Redis 数据备份
redis-cli BGSAVE
cp /var/lib/redis/dump.rdb /backup/redis-$(date +%Y%m%d).rdb

# 配置备份
tar -czf /backup/config-$(date +%Y%m%d).tar.gz .env configs/
```

### 数据恢复

```bash
# 恢复 Redis
redis-cli SHUTDOWN NOSAVE
cp /backup/redis-20260409.rdb /var/lib/redis/dump.rdb
redis-server &

# 恢复配置
tar -xzf /backup/config-20260409.tar.gz
```

## 升级指南

### 滚动升级

```bash
# 1. 拉取最新代码
git pull origin main

# 2. 运行测试
make ci

# 3. 构建新版本
make build

# 4. 优雅重启
make stop
make prod

# 5. 验证
curl http://localhost:8080/api/health
```

### 数据库迁移

FPS Game 使用 Redis，无需复杂迁移：

```bash
# 升级前备份
redis-cli BGSAVE

# 如需清理旧数据
redis-cli FLUSHALL

# 升级后验证
make dev
```

## 联系支持

- GitHub Issues: https://github.com/atalia/fps-game/issues
- 文档: `docs/` 目录
