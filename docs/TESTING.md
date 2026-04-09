# 测试指南

## 测试矩阵

| 测试类型 | 什么时候运行 | 覆盖范围 | 文件 |
|---------|-------------|---------|------|
| Pre-commit | 每次提交前 | 格式化、语法、关键测试 | `scripts/pre-commit.sh` |
| Deploy Precheck | CI/本地 | 配置一致性、关键资源、部署前门槛 | `scripts/pre-deploy-check.sh` |
| Unit Tests | CI/本地 | 后端非网络包 + 前端通用 Vitest 单测 | `*_test.go`, `client/tests/*.test.js`, `client/js/__tests__/*.test.js` |
| Race Detector | CI/本地 | Go 并发安全回归 | `go test -race ./...` |
| Integration Tests | CI/本地 | `cmd/server`、`internal/network`、连接配置测试 | `server/internal/network/*_test.go`, `server/cmd/server/main_test.go`, `client/tests/connection.test.js` |
| Mobile Tests | CI/本地 | 移动端交互与响应式行为 | `client/tests/mobile.test.js` |
| E2E | 按需手动运行 | 完整用户流程 | `e2e/*.spec.ts` |

## 本地测试

```bash
# 完整本地 CI 检查（对应阻断式 CI jobs）
make ci-local

# Unit tests
make test-unit

# Race detector
make test-race

# Integration tests
make test-integration

# Mobile tests
make test-mobile

# 所有阻断式测试
make test-all

# WebSocket / 网络集成测试
cd server && go test -count=1 -v ./cmd/server ./internal/network/...

# Mobile 测试
cd client && npm test -- --run tests/mobile.test.js --reporter=verbose --no-color

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
│       │           ├── deploy precheck                       │
│       │           ├── unit tests                            │
│       │           ├── race detector                         │
│       │           ├── integration tests                     │
│       │           ├── mobile tests                          │
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
make test-integration
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
make test-integration
```

### 3. Mobile 测试

**文件:** `client/tests/mobile.test.js`

**场景:**
- ✅ 触控检测
- ✅ 虚拟摇杆逻辑
- ✅ Look 区域旋转计算
- ✅ HUD 响应式布局

**运行:**
```bash
make test-mobile
```

## 预防措施

### 问题: WebSocket 连接失败

**原因:** 服务器 Origin 检查配置错误

**预防:**
1. `origin_test.go` - 自动测试所有 Origin 场景
2. `pre-deploy-check.sh` - 检查服务器 IP 是否在白名单
3. `integration-tests` 和 `race-detector` gate 必须通过才能合并

### 问题: 移动端无法使用

**原因:** 缺少触控支持

**预防:**
1. `connection.test.js` - 测试移动端检测逻辑
2. `mobile.test.js` - 专门覆盖触控和响应式回归
3. `pre-deploy-check.sh` - 检查 mobile-controls.js 是否存在

## 快速修复指南

```bash
# 1. 发现问题
make pre-deploy  # 本地检查

# 2. 查看测试失败
make test-unit
make test-race
make test-integration
make test-mobile

# 3. 修复后验证
make ci-local

# 4. 部署
make prod
```

## CI 状态徽章

在 README.md 添加:
```markdown
[![CI](https://github.com/atalia/fps-game/workflows/CI/badge.svg)](https://github.com/atalia/fps-game/actions)
```
