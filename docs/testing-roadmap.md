# FPS Game 测试改进路线图

## 问题背景

当前项目是 Go 服务端 + 浏览器 JS + WebSocket 的多人游戏架构。现有测试覆盖了单元和基础集成，但最容易出问题的**前后端协议一致性**和**多人真实交互**没有被覆盖。

近期 Code Review 发现的问题都是这类：
- `playerId` vs `player_id` 字段名不一致
- 消息缺少字段（`weapon_id`、`attacker_position`）
- 事件处理链引用错误对象

## 测试分层策略

```
        ┌─────────────────────┐
        │   E2E (Playwright)  │  ← 双客户端真实交互
        └─────────────────────┘
       ┌───────────────────────┐
       │   消息处理链集成测试    │  ← mock renderer/UI，测事件链
       └───────────────────────┘
      ┌─────────────────────────┐
      │   协议契约测试 (Schema)  │  ← 字段名/类型一致性
      └─────────────────────────┘
     ┌───────────────────────────┐
     │   单元测试 + Fuzz         │  ← 现有基础 + 异常输入
     └───────────────────────────┘
```

## 实施计划

### Phase 1: 协议契约测试 ⭐ 最高优先级

**目标**: 确保前后端消息字段名、类型一致

**实现方式**:
1. 创建 `shared/schemas/` 目录，定义 JSON Schema
2. 核心消息定义：
   - `room_joined` - 加入房间成功
   - `player_joined` - 玩家加入
   - `player_shot` - 射击事件
   - `player_damaged` - 受伤事件
   - `player_killed` - 击杀事件
   - `player_respawned` - 重生事件
   - `weapon_changed` - 武器切换
   - `voice_start/voice_data/voice_stop` - 语音事件

3. Go 端：
   - 使用 `github.com/xeipuuv/gojsonschema` 校验
   - 测试文件：`server/internal/protocol/schema_test.go`

4. JS 端：
   - 使用 `zod` 定义 schema
   - 开发模式下校验收发消息
   - 测试文件：`client/js/__tests__/protocol.test.js`

**预期收益**: 提前捕获 `playerId` vs `player_id`、缺字段、类型错误

### Phase 2: Playwright 双客户端 E2E

**目标**: 验证真实多人交互场景

**实现方式**:
1. 添加 Playwright 依赖
2. 创建测试服务器（复用现有 `go run ./cmd/server`）
3. 核心测试场景：
   ```typescript
   // e2e/multiplayer.spec.ts
   test('进房后双方能看到彼此', async () => {
     const page1 = await browser.newPage()
     const page2 = await browser.newPage()
     // 两个页面加入同一房间，验证玩家列表
   })
   
   test('开枪后另一端收到远端射击表现', async () => {})
   test('命中后受伤方血量变化', async () => {})
   test('击杀后死亡/重生 UI 正常', async () => {})
   test('切枪后协议和远端状态同步', async () => {})
   test('退房再进房不出错', async () => {})
   ```

**预期收益**: 捕获"本地玩家 ID 未写回"、"渲染器生命周期"等问题

### Phase 3: 客户端消息处理链测试

**目标**: 验证 `main.js` 中的事件处理逻辑

**实现方式**:
1. 使用 Vitest + jsdom
2. Mock 全局对象：
   ```javascript
   // client/js/__tests__/handlers.test.js
   vi.stubGlobal('window', {
     renderer: { addPlayer: vi.fn(), clearPlayers: vi.fn() },
     uiManager: { updateHealth: vi.fn(), showMessage: vi.fn() },
     audioManager: { playShoot: vi.fn() },
     game: { player: { id: 'test-player' }, players: new Map() }
   })
   ```
3. 测试核心事件链：
   - `player_damaged` → 血量更新 → UI 调用
   - `player_shot` → 音效播放 → 弹道渲染
   - `weapon_changed` → 武器状态同步

**预期收益**: 捕获"事件处理链引用错误对象"问题

### Phase 4: 服务端 Fuzz 测试

**目标**: 验证 WebSocket 输入的鲁棒性

**实现方式**:
1. 使用 Go 原生 `testing/fuzz`
2. Fuzz 目标：
   ```go
   // server/internal/network/fuzz_test.go
   func FuzzHandleShoot(f *testing.F) {
       f.Add([]byte(`{"position":{"x":0,"y":0,"z":0}}`))
       f.Fuzz(func(t *testing.T, data []byte) {
           // 测试 malformed JSON 不导致 panic
       })
   }
   ```
3. 覆盖消息类型：
   - `shoot` - 位置/方向字段
   - `voice_data` - base64 音频
   - `weapon_change` - 武器 ID
   - `chat` - 聊天消息

**预期收益**: 防止恶意/异常输入导致服务崩溃

## 不建议优先做

| 类型 | 原因 |
|------|------|
| Three.js 像素级截图回归 | 太脆弱，维护成本高 |
| 纯单元测试扩展 | ROI 不如协议和 E2E |

## 时间估算

| Phase | 工作量 | 优先级 |
|-------|--------|--------|
| Phase 1 协议契约 | 2-3 天 | P0 |
| Phase 2 Playwright E2E | 3-4 天 | P0 |
| Phase 3 消息处理链 | 1-2 天 | P1 |
| Phase 4 Fuzz 测试 | 1-2 天 | P1 |

## 成功指标

1. 协议契约测试覆盖 10+ 核心消息
2. E2E 测试覆盖 6+ 核心场景
3. CI 中自动运行，PR 必须通过
4. 新增测试能捕获类似近期 Code Review 的问题

## 参考资料

- [JSON Schema](https://json-schema.org/)
- [Zod - TypeScript-first schema validation](https://zod.dev/)
- [Playwright - Fast and reliable web testing](https://playwright.dev/)
- [Go Fuzzing](https://go.dev/doc/tutorial/fuzz)
