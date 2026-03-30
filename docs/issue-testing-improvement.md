# 测试改进：协议契约 + E2E 双客户端 + 消息处理链

## 背景

当前项目缺少对**前后端协议一致性**和**多人真实交互**的测试覆盖。近期 Code Review 发现的问题（字段名不一致、缺少字段、事件链引用错误）都未被现有测试捕获。

## 目标

建立三层测试防御：
1. **协议契约测试** - 确保前后端消息字段一致
2. **Playwright E2E** - 验证真实多人交互场景
3. **消息处理链测试** - 验证客户端事件处理逻辑
4. **Fuzz 测试** - 验证异常输入鲁棒性

## Phase 1: 协议契约测试

- [ ] 创建 `shared/schemas/` 目录定义 JSON Schema
- [ ] 定义核心消息 schema：`room_joined`, `player_joined`, `player_shot`, `player_damaged`, `player_killed`, `weapon_changed`, `voice_*`
- [ ] Go 端使用 `gojsonschema` 校验
- [ ] JS 端使用 `zod` 校验
- [ ] CI 集成

## Phase 2: Playwright E2E

- [ ] 添加 Playwright 依赖
- [ ] 创建测试服务器启动脚本
- [ ] 测试场景：
  - [ ] 进房后双方能看到彼此
  - [ ] 开枪后另一端收到射击表现
  - [ ] 命中后血量变化和命中反馈
  - [ ] 击杀后死亡/重生 UI
  - [ ] 切枪后远端状态同步
  - [ ] 退房再进房不出错

## Phase 3: 消息处理链测试

- [ ] Mock `window.renderer`, `window.uiManager`, `window.audioManager`
- [ ] 测试 `player_damaged` → 血量更新 → UI 调用
- [ ] 测试 `player_shot` → 音效 → 弹道渲染
- [ ] 测试 `weapon_changed` → 武器状态同步

## Phase 4: Fuzz 测试

- [ ] `shoot` 消息 fuzz
- [ ] `voice_data` 消息 fuzz
- [ ] `weapon_change` 消息 fuzz
- [ ] `chat` 消息 fuzz

## 详细规划

见 `docs/testing-roadmap.md`

## 时间估算

| Phase | 工作量 |
|-------|--------|
| Phase 1 | 2-3 天 |
| Phase 2 | 3-4 天 |
| Phase 3 | 1-2 天 |
| Phase 4 | 1-2 天 |

## 标签

- enhancement
- testing
- priority-high
