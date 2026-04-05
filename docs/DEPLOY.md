# 部署指南

## 自动部署

推送到 `main` 分支会自动触发部署流程。

## 手动部署

1. 访问 GitHub Actions
2. 选择 "Auto Deploy" workflow
3. 点击 "Run workflow"
4. 选择环境并运行

## 所需 GitHub Secrets

在仓库 Settings → Secrets and variables → Actions 中配置：

| Secret | 说明 | 示例 |
|--------|------|------|
| `SERVER_HOST` | 服务器 IP | `101.33.117.73` |
| `SERVER_USER` | SSH 用户名 | `lighthouse` |
| `SERVER_PORT` | SSH 端口 | `36000` |
| `SSH_PRIVATE_KEY` | SSH 私钥 | `-----BEGIN RSA PRIVATE KEY-----...` |

## 手动部署命令

```bash
# 在服务器上执行
cd ~/projects/fps-game
git pull origin main
docker compose --profile production build game-server
docker compose --profile production up -d
```

## 查看日志

```bash
# 查看服务日志
docker logs fps-game-server --tail 100 -f

# 查看所有容器状态
docker compose --profile production ps
```

## 回滚

```bash
# 回滚到上一个版本
git reset --hard HEAD~1
docker compose --profile production build game-server
docker compose --profile production up -d
```

## 服务地址

| 服务 | 地址 |
|------|------|
| 游戏 | http://101.33.117.73:8080 |
| WebSocket | ws://101.33.117.73:8080/ws |
| 健康检查 | http://101.33.117.73:8080/api/health |
