# 测试指南

## 测试矩阵

| 测试类型 | 什么时候运行 | 覆盖范围 | 文件 |
|---------|-------------|---------|------|
| Pre-commit | 每次提交前 | 格式化、语法、关键测试 | `scripts/pre-commit.sh` |
| Pre-deploy | 部署前 | 配置一致性、文件存在 | `scripts/pre-deploy-check.sh` |
| Unit Tests | CI/本地 | 单个函数/模块 | `*_test.go`, `*.test.js` |
| Integration | CI | WebSocket Origin、部署场景 | `origin_test.go`, `connection.test.js` |
| E2E | CI | 完整用户流程 | `e2e/*.spec.ts` |

## 本地测试

```bash
# 完整 CI 检查
make ci

# 仅后端测试
cd server && go test -v ./...

# 仅前端测试
cd client && npm test

# WebSocket Origin 测试 (关键)
cd server && go test -v ./internal/network/... -run "Origin"

# 预部署检查
make pre-deploy
```

## 自动化流程

```
┌─────────────────────────────────────────────────────────────┐
│                     开发流程                                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  git commit ──→ pre-commit hook ──→ 格式检查 + 关键测试     │
│       │                                                     │
│       ↓                                                     │
│  git push ──→ GitHub Actions CI                             │
│       │           │                                         │
│       │           ├── pre-deploy check                      │
│       │           ├── backend tests (go test)               │
│       │           ├── frontend tests (vitest)               │
│       │           ├── lint (golangci-lint)                  │
│       │           ├── security scan (gosec)                 │
│       │           └── docker build                          │
│       │                                                     │
│       ↓                                                     │
│  main 分支 ──→ Auto Deploy ──→ SSH 到服务器                 │
│       │           │                                         │
│       │           ├── git pull                              │
│       │           ├── pre-deploy check                      │
│       │           ├── make prod                             │
│       │           └── health check                          │
│       │                                                     │
│       ↓                                                     │
│  完成 ✅                                                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 关键测试用例

### 1. WebSocket Origin 测试

**文件:** `server/internal/network/origin_test.go`

**场景:**
- ✅ localhost 访问
- ✅ 127.0.0.1 访问
- ✅ 服务器 IP (101.33.117.73) 访问
- ✅ HTTPS 访问
- ✅ 移动端 (无 Origin/file://)
- ✅ 白名单模式

**运行:**
```bash
cd server && go test -v ./internal/network/... -run "Origin"
```

### 2. 前端连接测试

**文件:** `client/tests/connection.test.js`

**场景:**
- ✅ URL 构造逻辑
- ✅ HTTP → WS 协议转换
- ✅ HTTPS → WSS 协议转换
- ✅ 移动端检测

**运行:**
```bash
cd client && npm test -- tests/connection.test.js
```

## 预防措施

### 问题: WebSocket 连接失败

**原因:** 服务器 Origin 检查配置错误

**预防:**
1. `origin_test.go` - 自动测试所有 Origin 场景
2. `pre-deploy-check.sh` - 检查服务器 IP 是否在白名单
3. CI 必须通过才能合并

### 问题: 移动端无法使用

**原因:** 缺少触控支持

**预防:**
1. `connection.test.js` - 测试移动端检测逻辑
2. `pre-deploy-check.sh` - 检查 mobile-controls.js 是否存在

## 快速修复指南

```bash
# 1. 发现问题
make pre-deploy  # 本地检查

# 2. 查看测试失败
cd server && go test -v ./internal/network/... -run "Origin"
cd client && npm test -- tests/connection.test.js

# 3. 修复后验证
make ci

# 4. 部署
make prod
```

## CI 状态徽章

在 README.md 添加:
```markdown
[![CI](https://github.com/atalia/fps-game/workflows/CI/badge.svg)](https://github.com/atalia/fps-game/actions)
```
