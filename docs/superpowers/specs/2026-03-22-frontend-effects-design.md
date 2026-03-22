# FPS 游戏前端特效增强设计

**日期**: 2026-03-22
**状态**: 设计确认
**作者**: Claw

---

## 概述

为 FPS 游戏添加全面的视觉特效系统，采用模块化分层架构，支持性能自适应降级。

### 设计目标

- **平衡模式**: 自动根据帧率调整特效复杂度
- **卡通风格**: 夸张的粒子效果、明亮的颜色、清晰的轮廓
- **全部均衡**: 各类特效都有实现，复杂度适中

---

## 架构设计

### 三层架构

```
┌─────────────────────────────────────────────┐
│              装饰层 (Decorative)            │
│  成就弹窗、屏幕震动、准星动画、弹药动画      │
│  FPS < 30 时关闭                            │
├─────────────────────────────────────────────┤
│              增强层 (Enhanced)              │
│  受击指示器、击杀信息、连杀提示              │
│  FPS < 20 时简化                            │
├─────────────────────────────────────────────┤
│              核心层 (Core)                  │
│  命中粒子、伤害数字、枪口火焰、血条          │
│  永不关闭                                   │
└─────────────────────────────────────────────┘
```

### 性能自适应

| FPS 范围 | 模式 | 核心层 | 增强层 | 装饰层 |
|----------|------|--------|--------|--------|
| ≥55 | 高性能 | 完整 | 完整 | 完整 |
| 30-55 | 平衡 | 完整 | 完整 | 简化 |
| 20-30 | 低性能 | 完整 | 简化 | 关闭 |
| <20 | 最低 | 简化 | 关闭 | 关闭 |

---

## 模块规格

### 1. 核心层 (Core Layer)

#### 1.1 命中粒子爆发

**触发条件**: 玩家击中敌人

**位置**: 命中点

**效果规格**:
```
粒子数量: 5-10 个
粒子大小: 0.1-0.2 单位
颜色:
  - 普通命中: 红色 (#ff3333)
  - 爆头命中: 橙色 (#ff8800)
动画:
  - 扩散速度: 3-5 单位/秒
  - 重力: -5 单位/秒²
  - 持续时间: 0.3 秒
  - 淡出: 线性淡出
```

**性能降级**:
- 高性能: 10 粒子
- 平衡: 6 粒子
- 低性能: 3 粒子
- 最低: 2 粒子

#### 1.2 伤害数字飘字

**触发条件**: 造成伤害时

**显示内容**: "-{damage}" 数字

**样式规格**:
```css
普通伤害:
  - 颜色: #ffffff
  - 字体大小: 18px
  - 字重: bold

爆头伤害:
  - 颜色: #ff4444
  - 字体大小: 24px
  - 附加标签: "HEADSHOT!"
  - 标签颜色: #ff0000
  - 标签大小: 14px

暴击伤害:
  - 颜色: #ff8800
  - 字体大小: 20px
  - 效果: 闪烁动画
```

**动画**:
```
初始位置: 敌人头顶 + 随机偏移 (-0.5 ~ 0.5 单位)
移动: 向上飘 50px
缩放: 1.0 → 1.2 → 0.0
持续时间: 1 秒
缓动: ease-out
```

**世界坐标转屏幕坐标**:
```javascript
worldToScreen(position, camera) {
  const vector = new THREE.Vector3(position.x, position.y, position.z);
  vector.project(camera);
  return {
    x: (vector.x + 1) / 2 * window.innerWidth,
    y: -(vector.y - 1) / 2 * window.innerHeight
  };
}
```

#### 1.3 枪口火焰

**触发条件**: 射击时

**位置**: 玩家前方 1.5 单位 + Y轴 1.5 单位

**效果规格**:
```
类型: 球形光晕 (SphereGeometry)
初始大小: 0.5 单位
颜色: 橙黄色 (#ffaa00)
材质: MeshBasicMaterial
  - transparent: true
  - opacity: 初始 1.0
动画:
  - 扩散: 0.5 → 1.0 单位 (0.05秒)
  - 淡出: opacity 1.0 → 0.0 (0.1秒)
光照:
  - PointLight 强度 2.0
  - 范围 10 单位
  - 持续 0.1 秒
```

**实现**:
```javascript
createMuzzleFlash(position, rotation) {
  // 创建光晕
  const geometry = new THREE.SphereGeometry(0.5, 8, 8);
  const material = new THREE.MeshBasicMaterial({
    color: 0xffaa00,
    transparent: true,
    opacity: 1.0
  });
  const mesh = new THREE.Mesh(geometry, material);
  
  // 放置位置
  const offset = 1.5;
  mesh.position.set(
    position.x + Math.sin(rotation) * offset,
    position.y + 1.5,
    position.z + Math.cos(rotation) * offset
  );
  
  // 动画
  this.animateMuzzleFlash(mesh);
  
  // 临时光照
  this.createTempLight(mesh.position, 0xffaa00, 2.0, 10, 0.1);
}
```

#### 1.4 敌人血条

**显示条件**:
- 满血时不显示
- 受伤后显示 3 秒
- 持续受伤保持显示

**位置**: 敌人头顶上方 0.5 单位

**样式规格**:
```
尺寸:
  - 宽度: 1.0 单位 (世界空间)
  - 高度: 0.1 单位
  - 边框: 0.02 单位黑色边框

颜色:
  - 底色: #333333 (深灰)
  - 红队血量: #ff4444
  - 蓝队血量: #4444ff
  - 无队伍: #44ff44 (绿色)

动画:
  - 受伤时: 短暂抖动 (±0.05 单位, 0.1秒)
  - 血量变化: 平滑过渡 (0.2秒)
```

**实现方式**:
- 使用 THREE.Sprite 或 CSS2DRenderer
- 每帧更新位置跟随敌人
- 根据相机距离自动缩放

---

### 2. 增强层 (Enhanced Layer)

#### 2.1 击杀信息升级 (Killfeed)

**位置**: 左下角

**显示容量**: 最多 5 条，超出时旧消息滑出

**样式规格**:
```
单条高度: 32px
内边距: 8px 12px
背景: rgba(0, 0, 0, 0.6)
圆角: 4px

格式:
  [击杀者头像] 玩家A [武器图标] 玩家B [死亡者头像]

武器图标:
  - 步枪: 🔫
  - 手枪: 🔫
  - 霰弹枪: 💥
  - 狙击枪: 🎯
  - 近战: 🔪

特殊标记:
  - 爆头: 💀 (红色)
  - 连杀: 🔥 + 数字
  - 自杀: 💀 自杀
```

**动画**:
```
入场:
  - 从左滑入 (translateX: -100% → 0)
  - 持续: 0.3秒
  - 缓动: ease-out

停留:
  - 时长: 3秒
  - 不透明度: 1.0

退场:
  - 向左滑出 + 淡出
  - 持续: 0.3秒
```

#### 2.2 受击指示器

**触发条件**: 玩家被击中

**位置**: 屏幕边缘，指向伤害来源方向

**计算逻辑**:
```javascript
calculateIndicatorPosition(enemyPos, playerPos, playerRotation) {
  // 计算敌人相对方向
  const dx = enemyPos.x - playerPos.x;
  const dz = enemyPos.z - playerPos.z;
  const angle = Math.atan2(dx, dz);
  
  // 转换为屏幕坐标
  const relativeAngle = angle - playerRotation;
  
  // 映射到屏幕边缘
  const screenX = Math.sin(relativeAngle) * screenWidth / 2;
  
  return { x: screenX, angle: relativeAngle };
}
```

**样式规格**:
```
类型: 三角形/箭头
大小: 
  - 小伤害 (<20): 20px
  - 中伤害 (20-50): 30px
  - 大伤害 (>50): 40px

颜色: #ff0000 (红色)
透明度: 0.8

动画:
  - 淡入: 0.1秒
  - 停留: 0.5秒
  - 淡出: 0.2秒
```

**多方向处理**:
- 同时最多显示 4 个指示器
- 相近方向合并显示
- 按伤害量排序

#### 2.3 击杀提示

**位置**: 屏幕中央偏上 (top: 30%)

**触发**: 玩家击杀敌人

**样式规格**:
```
普通击杀:
  - 文字: "击杀 {玩家名}"
  - 颜色: #ffffff
  - 大小: 24px
  - 背景: rgba(0, 0, 0, 0.5)
  - 内边距: 10px 20px

爆头击杀:
  - 文字: "爆头击杀 {玩家名}"
  - 颜色: #ff4444
  - 大小: 28px
  - 附加图标: 💀

连杀提示 (合并显示):
  - 文字: "双杀!" / "三杀!" / "四杀!" / "五连绝世!"
  - 颜色: 金色渐变 (#ffd700 → #ff8c00)
  - 大小: 32-48px (递增)
```

**动画**:
```
入场:
  - 缩放: 0.5 → 1.2 → 1.0
  - 持续: 0.3秒
  - 弹性缓动

停留: 2秒

退场:
  - 向上漂浮 + 淡出
  - 持续: 0.5秒
```

#### 2.4 连杀提示

**触发条件**: 短时间内连续击杀

**定义**:
```javascript
const KILLSTREAK_CONFIG = {
  double: { kills: 2, name: '双杀', timeout: 5000 },
  triple: { kills: 3, name: '三杀', timeout: 5000 },
  quad: { kills: 4, name: '四杀', timeout: 5000 },
  penta: { kills: 5, name: '五连绝世', timeout: 5000 },
  legendary: { kills: 6, name: '无人能挡', timeout: 5000 }
};
```

**效果规格**:
```
位置: 屏幕中央

样式:
  - 双杀: 金色, 36px
  - 三杀: 金色, 42px, 震动效果
  - 四杀: 橙色, 48px, 震动 + 光效
  - 五杀+: 红色, 56px, 震动 + 光效 + 音效

动画:
  - 入场: 缩放 + 震动
  - 持续: 1.5秒
  - 退场: 爆炸式淡出
```

**音效映射**:
```
双杀: killstreak_double.mp3
三杀: killstreak_triple.mp3
四杀: killstreak_quad.mp3
五杀: killstreak_penta.mp3
```

---

### 3. 装饰层 (Decorative Layer)

#### 3.1 屏幕震动

**触发条件**:
- 被击中 (强度 = 伤害 / 10)
- 爆炸附近 (固定强度 15)
- 连杀 (固定强度 5)

**实现**:
```javascript
shake(intensity = 10, duration = 100) {
  const gameContainer = document.getElementById('game-container');
  const startTime = performance.now();
  
  const animate = (currentTime) => {
    const elapsed = currentTime - startTime;
    
    if (elapsed < duration) {
      const progress = elapsed / duration;
      const decay = 1 - progress;
      
      const x = (Math.random() - 0.5) * intensity * decay;
      const y = (Math.random() - 0.5) * intensity * decay;
      
      gameContainer.style.transform = `translate(${x}px, ${y}px)`;
      requestAnimationFrame(animate);
    } else {
      gameContainer.style.transform = '';
    }
  };
  
  requestAnimationFrame(animate);
}
```

**设置**:
- 可通过设置面板关闭
- 默认开启

#### 3.2 成就弹窗

**位置**: 右下角

**队列系统**:
```javascript
class AchievementQueue {
  constructor() {
    this.queue = [];
    this.isShowing = false;
  }
  
  add(achievement) {
    this.queue.push(achievement);
    if (!this.isShowing) {
      this.showNext();
    }
  }
  
  showNext() {
    if (this.queue.length === 0) {
      this.isShowing = false;
      return;
    }
    
    this.isShowing = true;
    const achievement = this.queue.shift();
    this.display(achievement);
    
    setTimeout(() => {
      this.hide();
      setTimeout(() => this.showNext(), 300);
    }, 3000);
  }
}
```

**样式规格**:
```
尺寸: 300px × 80px
背景: rgba(0, 0, 0, 0.8)
边框: 2px solid #ffd700 (金色)

内容:
  - 图标: 48px × 48px
  - 标题: 16px, 金色, 粗体
  - 描述: 12px, 白色

动画:
  - 入场: 从右滑入 (translateX: 100% → 0)
  - 停留: 3秒
  - 退场: 向右滑出
```

#### 3.3 弹药动画

**显示位置**: HUD 右下角

**样式规格**:
```
当前弹药:
  - 字体: 48px, 粗体
  - 颜色: 白色
  - 动画: 射击时数字跳动 (scale: 1.0 → 1.1 → 1.0)

备弹:
  - 字体: 24px
  - 颜色: #888888
  - 格式: "/ {reserve}"

换弹进度条:
  - 宽度: 100px
  - 高度: 4px
  - 颜色: #44ff44 (绿)
  - 动画: 从左到右填充

警告状态:
  - 弹药 < 30%: 黄色闪烁
  - 弹药 = 0: 红色 "NO AMMO"
```

**换弹动画**:
```javascript
startReload(duration) {
  const progressBar = document.getElementById('reload-progress');
  progressBar.style.width = '0%';
  progressBar.style.transition = `width ${duration}ms linear`;
  
  requestAnimationFrame(() => {
    progressBar.style.width = '100%';
  });
  
  setTimeout(() => {
    progressBar.style.width = '0%';
    progressBar.style.transition = '';
  }, duration);
}
```

#### 3.4 准星样式

**动态准星**:
```javascript
class DynamicCrosshair {
  constructor() {
    this.baseSpread = 2;      // 基础扩散
    this.moveSpread = 5;      // 移动扩散
    this.shootSpread = 10;    // 射击扩散
    this.currentSpread = 2;
    this.recoverySpeed = 0.5;
  }
  
  update(isMoving, isShooting, deltaTime) {
    let targetSpread = this.baseSpread;
    
    if (isMoving) targetSpread += this.moveSpread;
    if (isShooting) targetSpread += this.shootSpread;
    
    // 平滑过渡
    this.currentSpread += (targetSpread - this.currentSpread) * this.recoverySpeed * deltaTime;
    
    this.render();
  }
}
```

**样式选项**:
```
样式类型:
  - 十字: 十字形
  - 圆点: 中心圆点
  - 十字圆圈: 十字 + 外圈
  - T形: 只有上左右三条线

颜色选项:
  - 白色: #ffffff
  - 绿色: #44ff44
  - 红色: #ff4444
  - 青色: #00ffff
  - 自定义: 颜色选择器

命中反馈:
  - 击中敌人: 准星变红 + 扩散
  - 击杀: 准星闪烁
```

**命中反馈实现**:
```javascript
showHitFeedback() {
  this.crosshairElement.classList.add('hit');
  setTimeout(() => {
    this.crosshairElement.classList.remove('hit');
  }, 100);
}
```

```css
.crosshair.hit {
  border-color: #ff0000;
  transform: scale(1.5);
}
```

---

### 4. 性能监控系统

#### 4.1 FPS 监控

```javascript
class PerformanceMonitor {
  constructor() {
    this.frames = [];
    this.lastTime = performance.now();
    this.fps = 60;
    this.level = 'high'; // high, balanced, low, minimal
    this.checkInterval = 1000; // 1秒检查一次
  }
  
  tick() {
    const now = performance.now();
    const delta = now - this.lastTime;
    this.lastTime = now;
    
    this.frames.push(1000 / delta);
    
    if (this.frames.length >= 60) {
      this.updateFPS();
      this.frames = [];
    }
  }
  
  updateFPS() {
    const avgFPS = this.frames.reduce((a, b) => a + b, 0) / this.frames.length;
    this.fps = Math.round(avgFPS);
    
    // 更新性能等级
    if (this.fps >= 55) {
      this.level = 'high';
    } else if (this.fps >= 30) {
      this.level = 'balanced';
    } else if (this.fps >= 20) {
      this.level = 'low';
    } else {
      this.level = 'minimal';
    }
    
    this.applyLevel();
  }
  
  applyLevel() {
    // 触发全局事件，让各模块响应
    window.dispatchEvent(new CustomEvent('performanceLevelChanged', {
      detail: { level: this.level, fps: this.fps }
    }));
  }
}
```

#### 4.2 降级配置

```javascript
const EFFECTS_CONFIG = {
  high: {
    particles: { max: 100, hitBurst: 10 },
    healthBars: { always: true },
    screenShake: true,
    killfeed: { animated: true },
    achievements: { animated: true },
    crosshair: { dynamic: true }
  },
  balanced: {
    particles: { max: 60, hitBurst: 6 },
    healthBars: { always: false, onDamage: true },
    screenShake: true,
    killfeed: { animated: true },
    achievements: { animated: true },
    crosshair: { dynamic: true }
  },
  low: {
    particles: { max: 30, hitBurst: 3 },
    healthBars: { always: false, onDamage: true },
    screenShake: false,
    killfeed: { animated: false },
    achievements: { animated: false },
    crosshair: { dynamic: false }
  },
  minimal: {
    particles: { max: 10, hitBurst: 2 },
    healthBars: { always: false, onDamage: false },
    screenShake: false,
    killfeed: { animated: false },
    achievements: { animated: false },
    crosshair: { dynamic: false }
  }
};
```

---

## 文件结构

```
client/js/
├── effects/
│   ├── index.js           # 入口，初始化所有特效模块
│   ├── core.js            # 核心层：命中粒子、枪口火焰
│   ├── damage-number.js   # 伤害数字飘字
│   ├── health-bar.js      # 血条系统
│   ├── hit-indicator.js   # 受击指示器
│   ├── killfeed.js        # 击杀信息（重构现有）
│   ├── kill-notice.js     # 击杀提示
│   ├── killstreak.js      # 连杀提示（重构现有）
│   ├── achievements.js    # 成就弹窗（重构现有）
│   ├── screen-effects.js  # 屏幕震动、闪红等
│   ├── crosshair.js       # 准星系统
│   ├── ammo-display.js    # 弹药动画
│   └── performance.js     # 性能监控和降级
├── effects.js             # 保留，作为向后兼容入口
└── damage-display.js      # 标记为 deprecated，指向 effects/damage-number.js
```

---

## 实现计划

### Phase 1: 基础设施 (1h)

1. 创建 effects/ 目录结构
2. 实现性能监控系统
3. 创建配置系统和事件系统

### Phase 2: 核心层 (2h)

1. 命中粒子爆发
2. 伤害数字飘字
3. 枪口火焰
4. 敌人血条

### Phase 3: 增强层 (3h)

1. 击杀信息升级
2. 受击指示器
3. 击杀提示
4. 连杀提示重构

### Phase 4: 装饰层 (2h)

1. 屏幕震动
2. 成就弹窗
3. 弹药动画
4. 准星系统

### Phase 5: 整合测试 (1h)

1. 与现有代码整合
2. 性能测试
3. 降级测试
4. 清理废弃代码

**总预计: 9 小时**

---

## 依赖关系

```
performance.js (无依赖)
    ↓
core.js, health-bar.js, damage-number.js (依赖 performance.js)
    ↓
hit-indicator.js, killfeed.js, kill-notice.js, killstreak.js (依赖 core.js)
    ↓
achievements.js, screen-effects.js, crosshair.js, ammo-display.js (无特定依赖)
    ↓
index.js (整合所有模块)
```

---

## 测试策略

### 单元测试

- 性能监控 FPS 计算
- 世界坐标转屏幕坐标
- 连杀判定逻辑

### 集成测试

- 特效触发与网络消息同步
- 性能降级自动触发
- 多个特效同时显示

### 性能测试

- 基准帧率 vs 特效开启后帧率
- 大量粒子场景测试
- 内存使用监控

---

## 向后兼容

- 保留 `effects.js` 和 `damage-display.js` 的 API
- 通过 `window.EffectsManager` 和 `window.DamageDisplay` 暴露
- 控制台输出 deprecation 警告

```javascript
// effects.js (保留文件)
console.warn('[DEPRECATED] effects.js is deprecated. Use effects/core.js instead.');
window.EffectsManager = require('./effects/core.js').EffectsManager;
window.ScreenEffects = require('./effects/screen-effects.js').ScreenEffects;
```

---

## 成功标准

1. ✅ 所有特效正确触发和显示
2. ✅ FPS < 30 时自动降级
3. ✅ 不影响现有游戏功能
4. ✅ 代码模块化，易于维护
5. ✅ 向后兼容现有 API
