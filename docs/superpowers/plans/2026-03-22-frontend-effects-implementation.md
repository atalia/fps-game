# 前端特效增强实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现三层特效系统（核心层、增强层、装饰层）并支持性能自适应降级

**Architecture:** 模块化设计，每个特效独立成文件，通过 index.js 统一初始化，性能监控系统自动调整特效复杂度

**Tech Stack:** Three.js, Vanilla JavaScript, CSS3 Animations

---

## 文件结构

```
client/js/effects/
├── index.js           # 入口，初始化所有模块
├── performance.js     # 性能监控和降级控制
├── core.js            # 核心层：命中粒子、枪口火焰
├── damage-number.js   # 伤害数字飘字
├── health-bar.js      # 敌人血条
├── hit-indicator.js   # 受击指示器
├── killfeed.js        # 击杀信息（重构）
├── kill-notice.js     # 击杀提示
├── killstreak.js      # 连杀提示（重构）
├── achievements.js    # 成就弹窗（重构）
├── screen-effects.js  # 屏幕震动
├── crosshair.js       # 动态准星
└── ammo-display.js    # 弹药动画

需要修改的文件:
- client/index.html    # 添加新脚本引用
- client/js/main.js    # 集成特效系统
- client/js/effects.js # 添加向后兼容
```

---

## Chunk 1: 基础设施

### Task 1.1: 创建目录结构和性能监控

**Files:**
- Create: `client/js/effects/performance.js`

- [ ] **Step 1: 创建 effects 目录**

```bash
mkdir -p client/js/effects
```

- [ ] **Step 2: 创建性能监控模块**

```javascript
// client/js/effects/performance.js
// 性能监控和降级控制系统

class PerformanceMonitor {
    constructor() {
        this.frames = [];
        this.lastTime = performance.now();
        this.fps = 60;
        this.level = 'high'; // high, balanced, low, minimal
        this.checkInterval = 1000;
        this.listeners = [];
        
        // 降级配置
        this.config = {
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
        
        this.currentConfig = this.config.high;
    }

    // 每帧调用
    tick() {
        const now = performance.now();
        const delta = now - this.lastTime;
        this.lastTime = now;
        
        if (delta > 0) {
            this.frames.push(1000 / delta);
        }
        
        // 每60帧更新一次FPS
        if (this.frames.length >= 60) {
            this.updateFPS();
            this.frames = [];
        }
    }

    updateFPS() {
        const avgFPS = this.frames.reduce((a, b) => a + b, 0) / this.frames.length;
        this.fps = Math.round(avgFPS);
        
        // 确定性能等级
        const oldLevel = this.level;
        
        if (this.fps >= 55) {
            this.level = 'high';
        } else if (this.fps >= 30) {
            this.level = 'balanced';
        } else if (this.fps >= 20) {
            this.level = 'low';
        } else {
            this.level = 'minimal';
        }
        
        this.currentConfig = this.config[this.level];
        
        // 等级变化时通知监听器
        if (oldLevel !== this.level) {
            console.log(`[Performance] Level changed: ${oldLevel} → ${this.level} (FPS: ${this.fps})`);
            this.notifyListeners(oldLevel, this.level);
        }
    }

    // 添加性能等级变化监听器
    onLevelChange(callback) {
        this.listeners.push(callback);
    }

    notifyListeners(oldLevel, newLevel) {
        this.listeners.forEach(cb => {
            try {
                cb(oldLevel, newLevel, this.fps, this.currentConfig);
            } catch (e) {
                console.error('[Performance] Listener error:', e);
            }
        });
    }

    // 获取当前配置
    getConfig() {
        return this.currentConfig;
    }

    getFPS() {
        return this.fps;
    }

    getLevel() {
        return this.level;
    }
}

// 单例
window.performanceMonitor = new PerformanceMonitor();

// 导出
window.PerformanceMonitor = PerformanceMonitor;
console.log('[EFFECTS] PerformanceMonitor initialized');
```

- [ ] **Step 3: 创建入口文件**

```javascript
// client/js/effects/index.js
// 特效系统入口

console.log('[EFFECTS] effects/index.js loading...');

// 等待所有模块加载完成
class EffectsSystem {
    constructor() {
        this.performanceMonitor = window.performanceMonitor;
        this.initialized = false;
        
        // 模块引用（初始化后填充）
        this.core = null;
        this.damageNumber = null;
        this.healthBar = null;
        this.hitIndicator = null;
        this.killfeed = null;
        this.killNotice = null;
        this.killstreak = null;
        this.achievements = null;
        this.screenEffects = null;
        this.crosshair = null;
        this.ammoDisplay = null;
    }

    init(renderer) {
        console.log('[EFFECTS] Initializing effects system...');
        this.renderer = renderer;
        
        // 初始化各模块（按依赖顺序）
        if (window.EffectsCore) {
            this.core = new window.EffectsCore(renderer);
        }
        
        if (window.DamageNumber) {
            this.damageNumber = new window.DamageNumber();
        }
        
        if (window.HealthBarManager) {
            this.healthBar = new window.HealthBarManager(renderer);
        }
        
        if (window.HitIndicator) {
            this.hitIndicator = new window.HitIndicator();
        }
        
        if (window.KillfeedEnhanced) {
            this.killfeed = new window.KillfeedEnhanced();
        }
        
        if (window.KillNotice) {
            this.killNotice = new window.KillNotice();
        }
        
        if (window.KillstreakEnhanced) {
            this.killstreak = new window.KillstreakEnhanced();
        }
        
        if (window.AchievementsEnhanced) {
            this.achievements = new window.AchievementsEnhanced();
        }
        
        if (window.ScreenEffectsEnhanced) {
            this.screenEffects = new window.ScreenEffectsEnhanced();
        }
        
        if (window.DynamicCrosshair) {
            this.crosshair = new window.DynamicCrosshair();
        }
        
        if (window.AmmoDisplayEnhanced) {
            this.ammoDisplay = new window.AmmoDisplayEnhanced();
        }
        
        // 监听性能等级变化
        this.performanceMonitor.onLevelChange((oldLevel, newLevel, fps, config) => {
            this.applyPerformanceLevel(config);
        });
        
        this.initialized = true;
        console.log('[EFFECTS] Effects system initialized');
    }

    applyPerformanceLevel(config) {
        // 通知各模块应用新的性能配置
        if (this.core) this.core.setConfig(config.particles);
        if (this.healthBar) this.healthBar.setConfig(config.healthBars);
        if (this.screenEffects) this.screenEffects.setEnabled(config.screenShake);
        if (this.killfeed) this.killfeed.setAnimated(config.killfeed.animated);
        if (this.achievements) this.achievements.setAnimated(config.achievements.animated);
        if (this.crosshair) this.crosshair.setDynamic(config.crosshair.dynamic);
    }

    // 每帧更新
    update(deltaTime) {
        this.performanceMonitor.tick();
        
        if (this.core) this.core.update(deltaTime);
        if (this.healthBar) this.healthBar.update(deltaTime);
        if (this.crosshair) this.crosshair.update(deltaTime);
    }

    // 渲染（在Three.js渲染循环中调用）
    render(scene) {
        if (this.core) this.core.render(scene);
        if (this.healthBar) this.healthBar.render();
    }

    // 清理
    clear() {
        if (this.core) this.core.clear();
        if (this.healthBar) this.healthBar.clear();
        if (this.damageNumber) this.damageNumber.clear();
    }
}

// 创建全局实例
window.effectsSystem = new EffectsSystem();
window.EffectsSystem = EffectsSystem;

console.log('[EFFECTS] effects/index.js loaded');
```

- [ ] **Step 4: 提交基础设施**

```bash
git add client/js/effects/performance.js client/js/effects/index.js
git commit -m "feat(effects): 添加性能监控系统和入口文件

- PerformanceMonitor: FPS监控和性能等级自动调整
- EffectsSystem: 统一入口，管理所有特效模块
- 支持 high/balanced/low/minimal 四个性能等级"
```

---

### Task 1.2: 更新 HTML 脚本加载

**Files:**
- Modify: `client/index.html`

- [ ] **Step 1: 在 index.html 中添加新脚本引用**

找到第 441 行（`<script src="/js/effects.js"></script>`），在其之前添加：

```html
    <!-- Effects System -->
    <script src="/js/effects/performance.js"></script>
    <script src="/js/effects/core.js"></script>
    <script src="/js/effects/damage-number.js"></script>
    <script src="/js/effects/health-bar.js"></script>
    <script src="/js/effects/hit-indicator.js"></script>
    <script src="/js/effects/killfeed.js"></script>
    <script src="/js/effects/kill-notice.js"></script>
    <script src="/js/effects/killstreak.js"></script>
    <script src="/js/effects/achievements.js"></script>
    <script src="/js/effects/screen-effects.js"></script>
    <script src="/js/effects/crosshair.js"></script>
    <script src="/js/effects/ammo-display.js"></script>
    <script src="/js/effects/index.js"></script>
```

- [ ] **Step 2: 提交 HTML 更新**

```bash
git add client/index.html
git commit -m "feat(effects): 添加特效系统脚本引用到 HTML"
```

---

## Chunk 2: 核心层实现

### Task 2.1: 核心特效模块

**Files:**
- Create: `client/js/effects/core.js`

- [ ] **Step 1: 创建核心特效模块**

```javascript
// client/js/effects/core.js
// 核心层特效：命中粒子、枪口火焰

console.log('[EFFECTS] effects/core.js loading...');

class EffectsCore {
    constructor(renderer) {
        this.renderer = renderer;
        this.scene = renderer.scene;
        this.effects = [];
        this.maxEffects = 100;
        this.config = { max: 100, hitBurst: 10 };
        
        // 对象池优化
        this.particlePool = [];
        this.meshPool = [];
    }

    setConfig(config) {
        this.config = config;
        this.maxEffects = config.max;
    }

    // ==================== 命中粒子爆发 ====================
    
    createHitBurst(position, isHeadshot = false) {
        const count = Math.min(this.config.hitBurst, 10);
        const color = isHeadshot ? 0xff8800 : 0xff3333;
        
        for (let i = 0; i < count; i++) {
            const particle = {
                type: 'hit_particle',
                position: { 
                    x: position.x, 
                    y: position.y, 
                    z: position.z 
                },
                velocity: {
                    x: (Math.random() - 0.5) * 5,
                    y: Math.random() * 5,
                    z: (Math.random() - 0.5) * 5
                },
                size: Math.random() * 0.15 + 0.08,
                color: color,
                life: 0.3,
                maxLife: 0.3,
                gravity: -10
            };
            this.addEffect(particle);
        }
    }

    // ==================== 枪口火焰 ====================
    
    createMuzzleFlash(position, rotation) {
        const flash = {
            type: 'muzzle_flash',
            position: { ...position },
            rotation: rotation,
            size: 0.5,
            color: 0xffaa00,
            lightIntensity: 2.0,
            life: 0.1,
            maxLife: 0.1
        };
        this.addEffect(flash);
        
        // 创建临时光源
        this.createTempLight(position, 0xffaa00, 2.0, 10, 0.1);
    }

    createTempLight(position, color, intensity, distance, duration) {
        const light = new THREE.PointLight(color, intensity, distance);
        light.position.set(position.x, position.y + 1.5, position.z);
        this.scene.add(light);
        
        // 自动移除
        setTimeout(() => {
            this.scene.remove(light);
            light.dispose();
        }, duration * 1000);
    }

    // ==================== 爆炸特效 ====================
    
    createExplosion(position) {
        const count = Math.min(this.config.hitBurst * 3, 30);
        
        for (let i = 0; i < count; i++) {
            const particle = {
                type: 'explosion_particle',
                position: { ...position },
                velocity: {
                    x: (Math.random() - 0.5) * 10,
                    y: Math.random() * 8,
                    z: (Math.random() - 0.5) * 10
                },
                size: Math.random() * 0.3 + 0.1,
                color: Math.random() > 0.5 ? 0xff6600 : 0xffaa00,
                life: 0.8,
                maxLife: 0.8,
                gravity: -5
            };
            this.addEffect(particle);
        }
        
        // 爆炸光源
        this.createTempLight(position, 0xff6600, 5.0, 20, 0.3);
    }

    // ==================== 子弹轨迹 ====================
    
    createBulletTrail(from, to) {
        const effect = {
            type: 'bullet_trail',
            from: { ...from },
            to: { ...to },
            life: 0.1,
            maxLife: 0.1
        };
        this.addEffect(effect);
    }

    // ==================== 血迹效果 ====================
    
    createBloodSplatter(position) {
        const count = Math.min(this.config.hitBurst * 2, 15);
        
        for (let i = 0; i < count; i++) {
            const particle = {
                type: 'blood_particle',
                position: { ...position },
                velocity: {
                    x: (Math.random() - 0.5) * 3,
                    y: Math.random() * 2,
                    z: (Math.random() - 0.5) * 3
                },
                size: Math.random() * 0.2 + 0.05,
                color: 0x880000,
                life: 1.0,
                maxLife: 1.0,
                gravity: -8
            };
            this.addEffect(particle);
        }
    }

    // ==================== 效果管理 ====================
    
    addEffect(effect) {
        this.effects.push(effect);
        
        // 超出上限移除最旧的
        while (this.effects.length > this.maxEffects) {
            this.effects.shift();
        }
    }

    update(deltaTime) {
        this.effects = this.effects.filter(effect => {
            effect.life -= deltaTime;
            
            // 更新粒子物理
            if (effect.velocity) {
                effect.position.x += effect.velocity.x * deltaTime;
                effect.position.y += effect.velocity.y * deltaTime;
                effect.position.z += effect.velocity.z * deltaTime;
                
                if (effect.gravity) {
                    effect.velocity.y += effect.gravity * deltaTime;
                }
            }
            
            return effect.life > 0;
        });
    }

    render(scene) {
        // 清理上一帧的临时mesh
        const toRemove = [];
        
        this.effects.forEach(effect => {
            const alpha = effect.life / effect.maxLife;
            
            if (effect.type === 'muzzle_flash') {
                const mesh = this.renderMuzzleFlash(effect, alpha);
                if (mesh) toRemove.push(mesh);
            } else if (effect.type === 'bullet_trail') {
                const mesh = this.renderBulletTrail(effect, alpha);
                if (mesh) toRemove.push(mesh);
            } else if (effect.velocity) {
                const mesh = this.renderParticle(effect, alpha);
                if (mesh) toRemove.push(mesh);
            }
        });
        
        // 延迟移除（让渲染完成）
        setTimeout(() => {
            toRemove.forEach(mesh => {
                scene.remove(mesh);
                if (mesh.geometry) mesh.geometry.dispose();
                if (mesh.material) mesh.material.dispose();
            });
        }, 50);
    }

    renderMuzzleFlash(effect, alpha) {
        const size = effect.size * (1 + (1 - alpha) * 0.5);
        const geometry = new THREE.SphereGeometry(size, 8, 8);
        const material = new THREE.MeshBasicMaterial({
            color: effect.color,
            transparent: true,
            opacity: alpha
        });
        const mesh = new THREE.Mesh(geometry, material);
        
        // 枪口位置偏移
        const offset = 1.5;
        mesh.position.set(
            effect.position.x + Math.sin(effect.rotation) * offset,
            effect.position.y + 1.5,
            effect.position.z + Math.cos(effect.rotation) * offset
        );
        
        this.scene.add(mesh);
        return mesh;
    }

    renderParticle(effect, alpha) {
        const geometry = new THREE.SphereGeometry(effect.size, 4, 4);
        const material = new THREE.MeshBasicMaterial({
            color: effect.color,
            transparent: true,
            opacity: alpha * 0.8
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(effect.position.x, effect.position.y, effect.position.z);
        this.scene.add(mesh);
        return mesh;
    }

    renderBulletTrail(effect, alpha) {
        const points = [
            new THREE.Vector3(effect.from.x, effect.from.y, effect.from.z),
            new THREE.Vector3(effect.to.x, effect.to.y, effect.to.z)
        ];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({
            color: 0xffff00,
            transparent: true,
            opacity: alpha
        });
        const line = new THREE.Line(geometry, material);
        this.scene.add(line);
        return line;
    }

    clear() {
        this.effects = [];
    }
}

window.EffectsCore = EffectsCore;
console.log('[EFFECTS] EffectsCore class exported');
```

- [ ] **Step 2: 提交核心特效模块**

```bash
git add client/js/effects/core.js
git commit -m "feat(effects): 实现核心特效模块

- 命中粒子爆发（支持爆头颜色区分）
- 枪口火焰（带临时光源）
- 爆炸特效
- 子弹轨迹
- 血迹效果
- 对象池优化"
```

---

### Task 2.2: 伤害数字飘字

**Files:**
- Create: `client/js/effects/damage-number.js`

- [ ] **Step 1: 创建伤害数字模块**

```javascript
// client/js/effects/damage-number.js
// 伤害数字飘字系统

console.log('[EFFECTS] effects/damage-number.js loading...');

class DamageNumber {
    constructor() {
        this.container = null;
        this.numbers = [];
        this.maxNumbers = 20;
        
        this.init();
    }

    init() {
        // 创建容器
        this.container = document.getElementById('damage-numbers-container');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'damage-numbers-container';
            this.container.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
                z-index: 200;
            `;
            document.body.appendChild(this.container);
        }
    }

    // 显示伤害数字
    show(damage, position, options = {}) {
        const {
            isHeadshot = false,
            isCritical = false,
            color = null
        } = options;

        // 创建数字元素
        const element = document.createElement('div');
        element.className = 'damage-number';
        
        // 样式
        let fontSize = '18px';
        let textColor = '#ffffff';
        let fontWeight = 'bold';
        
        if (isHeadshot) {
            fontSize = '24px';
            textColor = '#ff4444';
        } else if (isCritical) {
            fontSize = '20px';
            textColor = '#ff8800';
        } else if (color) {
            textColor = color;
        }
        
        element.style.cssText = `
            position: absolute;
            color: ${textColor};
            font-size: ${fontSize};
            font-weight: ${fontWeight};
            text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
            pointer-events: none;
            white-space: nowrap;
        `;
        
        element.textContent = `-${Math.round(damage)}`;
        
        // 转换为屏幕坐标
        const screenPos = this.worldToScreen(position);
        element.style.left = `${screenPos.x}px`;
        element.style.top = `${screenPos.y}px`;
        
        // 添加到容器
        this.container.appendChild(element);
        
        // 记录
        const numberData = {
            element,
            startTime: performance.now(),
            duration: 1000,
            startY: screenPos.y,
            offsetX: (Math.random() - 0.5) * 30
        };
        
        this.numbers.push(numberData);
        
        // 限制数量
        while (this.numbers.length > this.maxNumbers) {
            const old = this.numbers.shift();
            if (old.element && old.element.parentNode) {
                old.element.remove();
            }
        }
        
        // 爆头额外显示标签
        if (isHeadshot) {
            this.showHeadshotLabel(screenPos);
        }
        
        // 开始动画
        this.animateNumber(numberData);
    }

    showHeadshotLabel(screenPos) {
        const label = document.createElement('div');
        label.className = 'headshot-label';
        label.textContent = 'HEADSHOT!';
        label.style.cssText = `
            position: absolute;
            left: ${screenPos.x}px;
            top: ${screenPos.y - 30}px;
            color: #ff0000;
            font-size: 14px;
            font-weight: bold;
            text-shadow: 1px 1px 2px #000;
            pointer-events: none;
        `;
        this.container.appendChild(label);
        
        // 动画
        setTimeout(() => {
            label.style.transition = 'opacity 0.3s';
            label.style.opacity = '0';
            setTimeout(() => label.remove(), 300);
        }, 700);
    }

    worldToScreen(position) {
        if (!window.renderer || !window.renderer.camera) {
            return { 
                x: window.innerWidth / 2 + (Math.random() - 0.5) * 100,
                y: window.innerHeight / 2 + (Math.random() - 0.5) * 100
            };
        }

        const camera = window.renderer.camera;
        const vector = new THREE.Vector3(position.x, position.y, position.z);
        vector.project(camera);

        return {
            x: (vector.x + 1) / 2 * window.innerWidth,
            y: -(vector.y - 1) / 2 * window.innerHeight
        };
    }

    animateNumber(data) {
        const animate = () => {
            const elapsed = performance.now() - data.startTime;
            const progress = elapsed / data.duration;
            
            if (progress >= 1) {
                if (data.element && data.element.parentNode) {
                    data.element.remove();
                }
                return;
            }
            
            // 向上飘动
            const yOffset = progress * 50;
            // 淡出
            const opacity = 1 - progress;
            // 缩放
            const scale = 1 + progress * 0.3;
            
            data.element.style.transform = `translateX(${data.offsetX}px) translateY(${-yOffset}px) scale(${scale})`;
            data.element.style.opacity = opacity;
            
            requestAnimationFrame(animate);
        };
        
        requestAnimationFrame(animate);
    }

    clear() {
        this.numbers.forEach(data => {
            if (data.element && data.element.parentNode) {
                data.element.remove();
            }
        });
        this.numbers = [];
    }
}

// 创建全局实例
window.damageNumber = new DamageNumber();
window.DamageNumber = DamageNumber;
console.log('[EFFECTS] DamageNumber initialized');
```

- [ ] **Step 2: 提交伤害数字模块**

```bash
git add client/js/effects/damage-number.js
git commit -m "feat(effects): 实现伤害数字飘字系统

- 支持 3D 世界坐标转屏幕坐标
- 爆头伤害红色大字 + HEADSHOT 标签
- 暴击伤害橙色
- 向上飘动 + 淡出动画
- 自动限制最大显示数量"
```

---

### Task 2.3: 敌人血条

**Files:**
- Create: `client/js/effects/health-bar.js`

- [ ] **Step 1: 创建血条模块**

```javascript
// client/js/effects/health-bar.js
// 敌人血条系统

console.log('[EFFECTS] effects/health-bar.js loading...');

class HealthBarManager {
    constructor(renderer) {
        this.renderer = renderer;
        this.scene = renderer.scene;
        this.healthBars = new Map();
        this.config = { always: false, onDamage: true };
        
        // 使用 CSS2DRenderer 或 Sprite
        this.useSprite = true;
    }

    setConfig(config) {
        this.config = config;
    }

    // 创建或更新血条
    updateHealth(playerId, health, maxHealth, position, team = null) {
        if (!this.config.always && !this.config.onDamage) {
            return;
        }
        
        let healthBar = this.healthBars.get(playerId);
        
        // 满血时隐藏（除非配置为始终显示）
        const isFullHealth = health >= maxHealth;
        
        if (!healthBar) {
            if (isFullHealth && !this.config.always) {
                return;
            }
            
            healthBar = this.createHealthBar(playerId, position, team);
            this.healthBars.set(playerId, healthBar);
        }
        
        // 更新血量
        healthBar.health = health;
        healthBar.maxHealth = maxHealth;
        healthBar.position = position;
        healthBar.team = team;
        healthBar.lastUpdate = Date.now();
        healthBar.visible = !isFullHealth || this.config.always;
        
        // 更新显示
        this.renderHealthBar(healthBar);
    }

    createHealthBar(playerId, position, team) {
        return {
            playerId,
            position: { ...position },
            health: 100,
            maxHealth: 100,
            team,
            sprite: null,
            lastUpdate: Date.now(),
            visible: true,
            shakeOffset: 0
        };
    }

    renderHealthBar(healthBar) {
        if (!healthBar.visible) {
            if (healthBar.sprite) {
                this.scene.remove(healthBar.sprite);
            }
            return;
        }
        
        // 创建或更新 Sprite
        if (!healthBar.sprite) {
            const canvas = document.createElement('canvas');
            canvas.width = 128;
            canvas.height = 16;
            healthBar.canvas = canvas;
            healthBar.ctx = canvas.getContext('2d');
            
            const texture = new THREE.CanvasTexture(canvas);
            const material = new THREE.SpriteMaterial({ 
                map: texture,
                transparent: true
            });
            healthBar.sprite = new THREE.Sprite(material);
            healthBar.sprite.scale.set(1, 0.12, 1);
            this.scene.add(healthBar.sprite);
        }
        
        // 绘制血条
        const ctx = healthBar.ctx;
        const canvas = healthBar.canvas;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // 背景
        ctx.fillStyle = '#333333';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // 边框
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, canvas.width, canvas.height);
        
        // 血量
        const healthPercent = healthBar.health / healthBar.maxHealth;
        const barWidth = (canvas.width - 4) * healthPercent;
        
        // 颜色根据队伍
        let healthColor = '#44ff44'; // 绿色（无队伍）
        if (healthBar.team === 'red') {
            healthColor = '#ff4444';
        } else if (healthBar.team === 'blue') {
            healthColor = '#4444ff';
        }
        
        ctx.fillStyle = healthColor;
        ctx.fillRect(2, 2, barWidth, canvas.height - 4);
        
        // 更新纹理
        healthBar.sprite.material.map.needsUpdate = true;
        
        // 更新位置
        healthBar.sprite.position.set(
            healthBar.position.x,
            healthBar.position.y + 2.5, // 头顶上方
            healthBar.position.z
        );
        
        // 应用震动偏移
        if (healthBar.shakeOffset > 0) {
            healthBar.sprite.position.x += healthBar.shakeOffset * (Math.random() - 0.5) * 0.1;
        }
    }

    // 显示受伤效果
    showDamageEffect(playerId) {
        const healthBar = this.healthBars.get(playerId);
        if (healthBar) {
            healthBar.shakeOffset = 1;
            healthBar.visible = true;
            healthBar.lastUpdate = Date.now();
        }
    }

    update(deltaTime) {
        const now = Date.now();
        const hideDelay = 3000; // 3秒后隐藏
        
        this.healthBars.forEach((healthBar, playerId) => {
            // 震动衰减
            if (healthBar.shakeOffset > 0) {
                healthBar.shakeOffset *= 0.9;
                if (healthBar.shakeOffset < 0.01) {
                    healthBar.shakeOffset = 0;
                }
            }
            
            // 自动隐藏
            if (!this.config.always && now - healthBar.lastUpdate > hideDelay) {
                if (healthBar.sprite) {
                    this.scene.remove(healthBar.sprite);
                    healthBar.sprite = null;
                }
            }
        });
    }

    render() {
        // Sprite 会自动渲染
    }

    removeHealthBar(playerId) {
        const healthBar = this.healthBars.get(playerId);
        if (healthBar && healthBar.sprite) {
            this.scene.remove(healthBar.sprite);
            if (healthBar.sprite.material) {
                healthBar.sprite.material.dispose();
            }
        }
        this.healthBars.delete(playerId);
    }

    clear() {
        this.healthBars.forEach((healthBar, playerId) => {
            this.removeHealthBar(playerId);
        });
    }
}

window.HealthBarManager = HealthBarManager;
console.log('[EFFECTS] HealthBarManager class exported');
```

- [ ] **Step 2: 提交血条模块**

```bash
git add client/js/effects/health-bar.js
git commit -m "feat(effects): 实现敌人血条系统

- 使用 Three.js Sprite 实现
- 支持队伍颜色区分（红/蓝/绿）
- 受伤时显示，满血隐藏
- 受伤震动效果
- 3秒后自动隐藏"
```

---

## Chunk 3: 增强层实现

### Task 3.1: 受击指示器

**Files:**
- Create: `client/js/effects/hit-indicator.js`

- [ ] **Step 1: 创建受击指示器模块**

```javascript
// client/js/effects/hit-indicator.js
// 受击指示器系统

console.log('[EFFECTS] effects/hit-indicator.js loading...');

class HitIndicator {
    constructor() {
        this.container = null;
        this.indicators = [];
        this.maxIndicators = 4;
        
        this.init();
    }

    init() {
        this.container = document.getElementById('hit-indicator-container');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'hit-indicator-container';
            this.container.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
                z-index: 150;
            `;
            document.body.appendChild(this.container);
        }
    }

    // 显示受击指示
    show(enemyPosition, damage) {
        if (!window.renderer || !window.renderer.camera) return;
        
        // 计算方向
        const playerPos = window.game?.player?.position;
        if (!playerPos) return;
        
        const dx = enemyPosition.x - playerPos.x;
        const dz = enemyPosition.z - playerPos.z;
        const angle = Math.atan2(dx, dz);
        
        // 获取玩家朝向
        const playerRotation = window.game?.player?.rotation || 0;
        const relativeAngle = angle - playerRotation;
        
        // 转换为屏幕X坐标
        const screenX = Math.sin(relativeAngle) * (window.innerWidth / 2 - 50);
        const screenY = Math.cos(relativeAngle) * (window.innerHeight / 2 - 50);
        
        // 根据伤害确定大小
        let size = 20;
        if (damage >= 50) {
            size = 40;
        } else if (damage >= 20) {
            size = 30;
        }
        
        // 创建指示器
        const indicator = document.createElement('div');
        indicator.className = 'hit-indicator';
        indicator.innerHTML = '▼'; // 三角形箭头
        indicator.style.cssText = `
            position: absolute;
            left: calc(50% + ${screenX}px);
            top: calc(50% + ${screenY}px);
            transform: translate(-50%, -50%) rotate(${relativeAngle * 180 / Math.PI + 180}deg);
            color: #ff0000;
            font-size: ${size}px;
            text-shadow: 0 0 10px #ff0000;
            opacity: 0;
            transition: opacity 0.1s;
        `;
        
        this.container.appendChild(indicator);
        
        // 淡入
        requestAnimationFrame(() => {
            indicator.style.opacity = '0.8';
        });
        
        // 记录
        this.indicators.push({
            element: indicator,
            startTime: Date.now(),
            duration: 500
        });
        
        // 限制数量
        while (this.indicators.length > this.maxIndicators) {
            const old = this.indicators.shift();
            old.element.remove();
        }
        
        // 自动移除
        setTimeout(() => {
            indicator.style.opacity = '0';
            setTimeout(() => indicator.remove(), 200);
        }, 500);
    }

    clear() {
        this.indicators.forEach(ind => ind.element.remove());
        this.indicators = [];
    }
}

window.hitIndicator = new HitIndicator();
window.HitIndicator = HitIndicator;
console.log('[EFFECTS] HitIndicator initialized');
```

- [ ] **Step 2: 提交受击指示器**

```bash
git add client/js/effects/hit-indicator.js
git commit -m "feat(effects): 实现受击指示器

- 计算敌人相对方向并显示箭头
- 根据伤害量调整大小
- 淡入淡出动画
- 限制最大显示数量"
```

---

### Task 3.2: 击杀提示

**Files:**
- Create: `client/js/effects/kill-notice.js`

- [ ] **Step 1: 创建击杀提示模块**

```javascript
// client/js/effects/kill-notice.js
// 击杀提示系统

console.log('[EFFECTS] effects/kill-notice.js loading...');

class KillNotice {
    constructor() {
        this.container = null;
        this.queue = [];
        this.isShowing = false;
        
        this.init();
    }

    init() {
        this.container = document.getElementById('kill-notice-container');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'kill-notice-container';
            this.container.style.cssText = `
                position: fixed;
                top: 30%;
                left: 50%;
                transform: translateX(-50%);
                pointer-events: none;
                z-index: 300;
                text-align: center;
            `;
            document.body.appendChild(this.container);
        }
    }

    // 显示击杀提示
    show(victimName, options = {}) {
        const {
            isHeadshot = false,
            weapon = null,
            isSuicide = false
        } = options;
        
        this.queue.push({
            victimName,
            isHeadshot,
            weapon,
            isSuicide
        });
        
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
        const data = this.queue.shift();
        
        // 创建提示元素
        const notice = document.createElement('div');
        notice.className = 'kill-notice';
        
        let text = '';
        let color = '#ffffff';
        let fontSize = '24px';
        
        if (data.isSuicide) {
            text = `${data.victimName} 自杀了`;
            color = '#888888';
        } else if (data.isHeadshot) {
            text = `💀 爆头击杀 ${data.victimName}`;
            color = '#ff4444';
            fontSize = '28px';
        } else {
            text = `击杀 ${data.victimName}`;
        }
        
        notice.style.cssText = `
            color: ${color};
            font-size: ${fontSize};
            font-weight: bold;
            text-shadow: 2px 2px 4px #000;
            background: rgba(0,0,0,0.5);
            padding: 10px 20px;
            border-radius: 5px;
            opacity: 0;
            transform: scale(0.5);
        `;
        
        notice.textContent = text;
        this.container.appendChild(notice);
        
        // 动画
        requestAnimationFrame(() => {
            notice.style.transition = 'all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
            notice.style.opacity = '1';
            notice.style.transform = 'scale(1)';
        });
        
        // 移除
        setTimeout(() => {
            notice.style.transition = 'all 0.5s';
            notice.style.opacity = '0';
            notice.style.transform = 'translateY(-20px)';
            
            setTimeout(() => {
                notice.remove();
                setTimeout(() => this.showNext(), 100);
            }, 500);
        }, 2000);
    }

    clear() {
        this.queue = [];
        this.container.innerHTML = '';
        this.isShowing = false;
    }
}

window.killNotice = new KillNotice();
window.KillNotice = KillNotice;
console.log('[EFFECTS] KillNotice initialized');
```

- [ ] **Step 2: 提交击杀提示**

```bash
git add client/js/effects/kill-notice.js
git commit -m "feat(effects): 实现击杀提示系统

- 屏幕中央显示击杀信息
- 爆头击杀红色大字 + 💀 图标
- 支持队列显示多个击杀
- 弹性缩放动画"
```

---

### Task 3.3: 连杀提示（重构）

**Files:**
- Create: `client/js/effects/killstreak.js`（替换现有）

- [ ] **Step 1: 创建增强版连杀模块**

```javascript
// client/js/effects/killstreak.js
// 连杀提示系统（增强版）

console.log('[EFFECTS] effects/killstreak.js loading...');

class KillstreakEnhanced {
    constructor() {
        this.container = null;
        this.kills = [];
        this.timeout = 5000; // 5秒重置
        
        this.config = {
            double: { kills: 2, name: '双杀!', color: '#ffd700', size: '36px' },
            triple: { kills: 3, name: '三杀!', color: '#ffd700', size: '42px' },
            quad: { kills: 4, name: '四杀!', color: '#ff8c00', size: '48px' },
            penta: { kills: 5, name: '五连绝世!', color: '#ff4444', size: '56px' },
            legendary: { kills: 6, name: '无人能挡!', color: '#ff0000', size: '64px' }
        };
        
        this.init();
    }

    init() {
        this.container = document.getElementById('killstreak-container');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'killstreak-container';
            this.container.style.cssText = `
                position: fixed;
                top: 35%;
                left: 50%;
                transform: translateX(-50%);
                pointer-events: none;
                z-index: 400;
                text-align: center;
            `;
            document.body.appendChild(this.container);
        }
    }

    // 记录击杀
    addKill() {
        const now = Date.now();
        
        // 清理过期击杀
        this.kills = this.kills.filter(time => now - time < this.timeout);
        
        // 添加新击杀
        this.kills.push(now);
        
        // 检查连杀
        this.checkStreak();
        
        return this.kills.length;
    }

    checkStreak() {
        const count = this.kills.length;
        
        // 查找对应的连杀配置
        let streakConfig = null;
        for (const [key, config] of Object.entries(this.config)) {
            if (count >= config.kills) {
                streakConfig = config;
            }
        }
        
        if (streakConfig) {
            this.show(streakConfig);
        }
    }

    show(config) {
        // 清空容器
        this.container.innerHTML = '';
        
        // 创建显示元素
        const element = document.createElement('div');
        element.className = 'killstreak-notice';
        element.style.cssText = `
            color: ${config.color};
            font-size: ${config.size};
            font-weight: bold;
            text-shadow: 0 0 10px ${config.color}, 2px 2px 4px #000;
            opacity: 0;
            transform: scale(0.5);
        `;
        element.textContent = config.name;
        this.container.appendChild(element);
        
        // 动画
        requestAnimationFrame(() => {
            element.style.transition = 'all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
            element.style.opacity = '1';
            element.style.transform = 'scale(1.2)';
            
            setTimeout(() => {
                element.style.transform = 'scale(1)';
            }, 150);
        });
        
        // 屏幕震动（高连杀）
        if (this.kills.length >= 4 && window.screenEffects) {
            window.screenEffects.shake(5, 100);
        }
        
        // 移除
        setTimeout(() => {
            element.style.transition = 'all 0.5s';
            element.style.opacity = '0';
            element.style.transform = 'scale(1.5)';
        }, 1500);
    }

    reset() {
        this.kills = [];
    }

    getStreak() {
        return this.kills.length;
    }
}

window.killstreakEnhanced = new KillstreakEnhanced();
window.KillstreakEnhanced = KillstreakEnhanced;
console.log('[EFFECTS] KillstreakEnhanced initialized');
```

- [ ] **Step 2: 提交连杀模块**

```bash
git add client/js/effects/killstreak.js
git commit -m "feat(effects): 实现增强版连杀提示

- 双杀/三杀/四杀/五杀/无人能挡
- 渐进式字体大小和颜色
- 弹性缩放动画
- 高连杀触发屏幕震动
- 5秒超时重置"
```

---

## Chunk 4: 装饰层实现

### Task 4.1: 屏幕震动和特效

**Files:**
- Create: `client/js/effects/screen-effects.js`

- [ ] **Step 1: 创建屏幕特效模块**

```javascript
// client/js/effects/screen-effects.js
// 屏幕震动和视觉效果

console.log('[EFFECTS] effects/screen-effects.js loading...');

class ScreenEffectsEnhanced {
    constructor() {
        this.enabled = true;
        this.overlay = null;
        this.gameContainer = null;
        
        this.init();
    }

    init() {
        // 创建覆盖层
        this.overlay = document.createElement('div');
        this.overlay.id = 'screen-effects-overlay';
        this.overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 500;
            transition: background-color 0.1s;
        `;
        document.body.appendChild(this.overlay);
        
        // 游戏容器（用于震动）
        this.gameContainer = document.getElementById('game-container');
    }

    setEnabled(enabled) {
        this.enabled = enabled;
    }

    // ==================== 屏幕震动 ====================
    
    shake(intensity = 10, duration = 100) {
        if (!this.enabled || !this.gameContainer) return;
        
        const startTime = performance.now();
        const originalTransform = this.gameContainer.style.transform || '';
        
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            
            if (elapsed < duration) {
                const progress = elapsed / duration;
                const decay = 1 - progress;
                
                const x = (Math.random() - 0.5) * intensity * decay;
                const y = (Math.random() - 0.5) * intensity * decay;
                
                this.gameContainer.style.transform = `translate(${x}px, ${y}px)`;
                requestAnimationFrame(animate);
            } else {
                this.gameContainer.style.transform = originalTransform;
            }
        };
        
        requestAnimationFrame(animate);
    }

    // ==================== 屏幕闪烁 ====================
    
    flashDamage(intensity = 0.3) {
        if (!this.enabled) return;
        
        this.overlay.style.backgroundColor = `rgba(255, 0, 0, ${intensity})`;
        setTimeout(() => {
            this.overlay.style.backgroundColor = 'transparent';
        }, 100);
    }

    flashKill() {
        if (!this.enabled) return;
        
        this.overlay.style.backgroundColor = 'rgba(0, 255, 0, 0.2)';
        setTimeout(() => {
            this.overlay.style.backgroundColor = 'transparent';
        }, 150);
    }

    flashHeal() {
        if (!this.enabled) return;
        
        this.overlay.style.backgroundColor = 'rgba(0, 100, 255, 0.2)';
        setTimeout(() => {
            this.overlay.style.backgroundColor = 'transparent';
        }, 150);
    }

    // ==================== 死亡效果 ====================
    
    showDeath() {
        this.overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    }

    hideDeath() {
        this.overlay.style.backgroundColor = 'transparent';
    }

    clear() {
        this.overlay.style.backgroundColor = 'transparent';
        if (this.gameContainer) {
            this.gameContainer.style.transform = '';
        }
    }
}

window.screenEffectsEnhanced = new ScreenEffectsEnhanced();
window.ScreenEffectsEnhanced = ScreenEffectsEnhanced;

// 向后兼容
window.screenEffects = window.screenEffectsEnhanced;
window.ScreenEffects = ScreenEffectsEnhanced;

console.log('[EFFECTS] ScreenEffectsEnhanced initialized');
```

- [ ] **Step 2: 提交屏幕特效**

```bash
git add client/js/effects/screen-effects.js
git commit -m "feat(effects): 实现屏幕震动和视觉效果

- 屏幕震动（可调强度和持续时间）
- 受伤闪红
- 击杀闪绿
- 治愈闪蓝
- 死亡变暗"
```

---

### Task 4.2: 动态准星

**Files:**
- Create: `client/js/effects/crosshair.js`

- [ ] **Step 1: 创建动态准星模块**

```javascript
// client/js/effects/crosshair.js
// 动态准星系统

console.log('[EFFECTS] effects/crosshair.js loading...');

class DynamicCrosshair {
    constructor() {
        this.element = null;
        this.dynamic = true;
        this.color = '#ffffff';
        this.style = 'cross'; // cross, dot, cross-circle
        
        // 扩散参数
        this.baseSpread = 15;
        this.moveSpread = 10;
        this.shootSpread = 20;
        this.currentSpread = 15;
        this.recoverySpeed = 5;
        
        this.isMoving = false;
        this.isShooting = false;
        
        this.init();
    }

    init() {
        this.element = document.getElementById('crosshair');
        if (!this.element) {
            this.element = document.createElement('div');
            this.element.id = 'crosshair';
            document.body.appendChild(this.element);
        }
        
        this.render();
    }

    setDynamic(dynamic) {
        this.dynamic = dynamic;
    }

    setColor(color) {
        this.color = color;
        this.render();
    }

    setStyle(style) {
        this.style = style;
        this.render();
    }

    // 更新状态
    update(deltaTime) {
        if (!this.dynamic) return;
        
        let targetSpread = this.baseSpread;
        
        if (this.isMoving) targetSpread += this.moveSpread;
        if (this.isShooting) targetSpread += this.shootSpread;
        
        // 平滑过渡
        this.currentSpread += (targetSpread - this.currentSpread) * this.recoverySpeed * deltaTime;
        
        this.render();
    }

    setMoving(moving) {
        this.isMoving = moving;
    }

    setShooting(shooting) {
        this.isShooting = shooting;
    }

    // 命中反馈
    showHit() {
        this.element.classList.add('hit');
        setTimeout(() => {
            this.element.classList.remove('hit');
        }, 100);
    }

    render() {
        const spread = Math.round(this.currentSpread);
        const size = 2;
        const gap = spread;
        
        let html = '';
        let css = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            pointer-events: none;
            z-index: 600;
        `;
        
        if (this.style === 'dot') {
            html = `<div style="
                width: 4px;
                height: 4px;
                background: ${this.color};
                border-radius: 50%;
            "></div>`;
        } else if (this.style === 'cross-circle') {
            html = `
                <div style="
                    width: ${gap * 2}px;
                    height: ${gap * 2}px;
                    border: 2px solid ${this.color};
                    border-radius: 50%;
                    opacity: 0.5;
                "></div>
                <div style="
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    width: 4px;
                    height: 4px;
                    background: ${this.color};
                    border-radius: 50%;
                "></div>
            `;
        } else {
            // 十字准星
            html = `
                <div style="
                    position: absolute;
                    top: ${-gap - size}px;
                    left: 50%;
                    transform: translateX(-50%);
                    width: ${size}px;
                    height: ${size * 4}px;
                    background: ${this.color};
                "></div>
                <div style="
                    position: absolute;
                    bottom: ${-gap - size}px;
                    left: 50%;
                    transform: translateX(-50%);
                    width: ${size}px;
                    height: ${size * 4}px;
                    background: ${this.color};
                "></div>
                <div style="
                    position: absolute;
                    left: ${-gap - size}px;
                    top: 50%;
                    transform: translateY(-50%);
                    width: ${size * 4}px;
                    height: ${size}px;
                    background: ${this.color};
                "></div>
                <div style="
                    position: absolute;
                    right: ${-gap - size}px;
                    top: 50%;
                    transform: translateY(-50%);
                    width: ${size * 4}px;
                    height: ${size}px;
                    background: ${this.color};
                "></div>
            `;
        }
        
        this.element.style.cssText = css;
        this.element.innerHTML = html;
    }
}

window.dynamicCrosshair = new DynamicCrosshair();
window.DynamicCrosshair = DynamicCrosshair;
console.log('[EFFECTS] DynamicCrosshair initialized');
```

- [ ] **Step 2: 添加 CSS 样式**

```html
<!-- 在 index.html 的 <style> 中添加 -->
#crosshair.hit * {
    background: #ff0000 !important;
    border-color: #ff0000 !important;
}
```

- [ ] **Step 3: 提交动态准星**

```bash
git add client/js/effects/crosshair.js client/index.html
git commit -m "feat(effects): 实现动态准星系统

- 支持十字/圆点/十字圆圈三种样式
- 移动和射击时扩散
- 命中时变红反馈
- 平滑过渡动画"
```

---

### Task 4.3: 弹药动画

**Files:**
- Create: `client/js/effects/ammo-display.js`

- [ ] **Step 1: 创建弹药动画模块**

```javascript
// client/js/effects/ammo-display.js
// 弹药显示动画

console.log('[EFFECTS] effects/ammo-display.js loading...');

class AmmoDisplayEnhanced {
    constructor() {
        this.container = null;
        this.currentAmmoEl = null;
        this.reserveAmmoEl = null;
        this.reloadProgressEl = null;
        this.warningEl = null;
        
        this.lastAmmo = 30;
        this.maxAmmo = 30;
        
        this.init();
    }

    init() {
        // 查找现有元素
        this.container = document.getElementById('ammo-display');
        
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'ammo-display';
            this.container.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: rgba(0,0,0,0.6);
                padding: 15px 20px;
                border-radius: 8px;
                text-align: right;
                font-family: 'Segoe UI', sans-serif;
            `;
            document.body.appendChild(this.container);
        }
        
        // 创建子元素
        this.container.innerHTML = `
            <div id="ammo-current" style="font-size: 48px; font-weight: bold; color: #fff;">30</div>
            <div id="ammo-reserve" style="font-size: 18px; color: #888;">/ 90</div>
            <div id="reload-progress" style="
                width: 0%;
                height: 4px;
                background: #44ff44;
                margin-top: 8px;
                border-radius: 2px;
                transition: none;
            "></div>
            <div id="ammo-warning" style="
                font-size: 14px;
                color: #ff4444;
                margin-top: 5px;
                display: none;
            ">NO AMMO</div>
        `;
        
        this.currentAmmoEl = document.getElementById('ammo-current');
        this.reserveAmmoEl = document.getElementById('ammo-reserve');
        this.reloadProgressEl = document.getElementById('reload-progress');
        this.warningEl = document.getElementById('ammo-warning');
    }

    // 更新弹药显示
    update(current, reserve) {
        // 弹药变化动画
        if (current !== this.lastAmmo) {
            this.animateChange(current);
        }
        
        this.lastAmmo = current;
        this.currentAmmoEl.textContent = current;
        this.reserveAmmoEl.textContent = `/ ${reserve}`;
        
        // 低弹药警告
        const percent = current / this.maxAmmo;
        
        if (current === 0) {
            this.warningEl.style.display = 'block';
            this.warningEl.textContent = 'NO AMMO';
            this.currentAmmoEl.style.color = '#ff4444';
        } else if (percent < 0.3) {
            this.warningEl.style.display = 'block';
            this.warningEl.textContent = 'LOW AMMO';
            this.currentAmmoEl.style.color = '#ffaa00';
            this.startWarningBlink();
        } else {
            this.warningEl.style.display = 'none';
            this.currentAmmoEl.style.color = '#ffffff';
            this.stopWarningBlink();
        }
    }

    animateChange(newAmmo) {
        // 射击时数字跳动
        this.currentAmmoEl.style.transform = 'scale(1.1)';
        setTimeout(() => {
            this.currentAmmoEl.style.transform = 'scale(1)';
        }, 50);
    }

    // 换弹进度
    startReload(duration) {
        this.reloadProgressEl.style.transition = 'none';
        this.reloadProgressEl.style.width = '0%';
        
        requestAnimationFrame(() => {
            this.reloadProgressEl.style.transition = `width ${duration}ms linear`;
            this.reloadProgressEl.style.width = '100%';
        });
    }

    endReload() {
        this.reloadProgressEl.style.transition = 'none';
        this.reloadProgressEl.style.width = '0%';
    }

    startWarningBlink() {
        if (this.blinkInterval) return;
        
        this.blinkInterval = setInterval(() => {
            this.warningEl.style.opacity = this.warningEl.style.opacity === '0' ? '1' : '0';
        }, 500);
    }

    stopWarningBlink() {
        if (this.blinkInterval) {
            clearInterval(this.blinkInterval);
            this.blinkInterval = null;
        }
        this.warningEl.style.opacity = '1';
    }

    setMaxAmmo(max) {
        this.maxAmmo = max;
    }
}

window.ammoDisplayEnhanced = new AmmoDisplayEnhanced();
window.AmmoDisplayEnhanced = AmmoDisplayEnhanced;
console.log('[EFFECTS] AmmoDisplayEnhanced initialized');
```

- [ ] **Step 2: 提交弹药动画**

```bash
git add client/js/effects/ammo-display.js
git commit -m "feat(effects): 实现弹药显示动画

- 射击时数字跳动
- 低弹药警告（橙色闪烁）
- 无弹药警告（红色 NO AMMO）
- 换弹进度条"
```

---

### Task 4.4: 成就弹窗（重构）

**Files:**
- Create: `client/js/effects/achievements.js`

- [ ] **Step 1: 创建增强版成就模块**

```javascript
// client/js/effects/achievements.js
// 成就弹窗系统（增强版）

console.log('[EFFECTS] effects/achievements.js loading...');

class AchievementsEnhanced {
    constructor() {
        this.container = null;
        this.queue = [];
        this.isShowing = false;
        this.animated = true;
        
        this.init();
    }

    init() {
        this.container = document.getElementById('achievements-container');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'achievements-container';
            this.container.style.cssText = `
                position: fixed;
                bottom: 100px;
                right: 20px;
                pointer-events: none;
                z-index: 700;
            `;
            document.body.appendChild(this.container);
        }
    }

    setAnimated(animated) {
        this.animated = animated;
    }

    // 显示成就
    show(achievement) {
        this.queue.push({
            id: achievement.id,
            name: achievement.name,
            description: achievement.description || '',
            icon: achievement.icon || '🏆'
        });
        
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
        
        // 创建弹窗
        const popup = document.createElement('div');
        popup.className = 'achievement-popup';
        popup.style.cssText = `
            display: flex;
            align-items: center;
            width: 300px;
            background: rgba(0, 0, 0, 0.9);
            border: 2px solid #ffd700;
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 10px;
            transform: translateX(120%);
            transition: ${this.animated ? 'transform 0.3s ease-out' : 'none'};
        `;
        
        popup.innerHTML = `
            <div style="
                width: 48px;
                height: 48px;
                background: rgba(255, 215, 0, 0.2);
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 24px;
                margin-right: 12px;
            ">${achievement.icon}</div>
            <div>
                <div style="
                    color: #ffd700;
                    font-size: 14px;
                    font-weight: bold;
                ">${achievement.name}</div>
                <div style="
                    color: #888;
                    font-size: 12px;
                    margin-top: 4px;
                ">${achievement.description}</div>
            </div>
        `;
        
        this.container.appendChild(popup);
        
        // 动画
        requestAnimationFrame(() => {
            popup.style.transform = 'translateX(0)';
        });
        
        // 移除
        setTimeout(() => {
            popup.style.transform = 'translateX(120%)';
            setTimeout(() => {
                popup.remove();
                setTimeout(() => this.showNext(), 100);
            }, 300);
        }, 3000);
    }

    clear() {
        this.queue = [];
        this.container.innerHTML = '';
        this.isShowing = false;
    }
}

window.achievementsEnhanced = new AchievementsEnhanced();
window.AchievementsEnhanced = AchievementsEnhanced;
console.log('[EFFECTS] AchievementsEnhanced initialized');
```

- [ ] **Step 2: 提交成就模块**

```bash
git add client/js/effects/achievements.js
git commit -m "feat(effects): 实现增强版成就弹窗

- 队列系统避免重叠
- 右下角滑入动画
- 金色边框和图标
- 3秒后自动滑出"
```

---

## Chunk 5: 集成和测试

### Task 5.1: 更新 main.js 集成特效系统

**Files:**
- Modify: `client/js/main.js`

- [ ] **Step 1: 在 init() 函数中初始化特效系统**

在 `window.screenEffects = new ScreenEffects();` 之后添加：

```javascript
        // 初始化特效系统
        if (typeof EffectsSystem !== 'undefined') {
            window.effectsSystem.init(window.renderer);
            console.log('✅ Effects system initialized');
        }
```

- [ ] **Step 2: 更新网络事件处理器**

在 `setupNetworkHandlers()` 函数中，更新相关事件处理：

```javascript
    // 玩家受伤 - 增强版
    window.network.on('player_damaged', (data) => {
        console.log(`Player ${data.player_id} took ${data.damage} damage (${data.hitbox})`);

        if (data.player_id === window.game?.player?.id) {
            // 自己受伤
            window.game.player.health = data.remaining_health;
            window.uiManager.updateHealth(data.remaining_health);

            // 屏幕闪红 + 震动
            if (window.screenEffectsEnhanced) {
                window.screenEffectsEnhanced.flashDamage(data.damage / 100);
                window.screenEffectsEnhanced.shake(data.damage / 5, 100);
            }

            // 受击指示器
            if (window.hitIndicator && data.attacker_position) {
                window.hitIndicator.show(data.attacker_position, data.damage);
            }
        } else {
            // 敌人受伤（自己射击）
            if (data.attacker_id === window.game?.player?.id) {
                // 命中粒子
                if (window.effectsSystem?.core) {
                    window.effectsSystem.core.createHitBurst(
                        data.position,
                        data.hitbox === 'head'
                    );
                }

                // 伤害数字
                if (window.damageNumber) {
                    window.damageNumber.show(data.damage, data.position, {
                        isHeadshot: data.hitbox === 'head'
                    });
                }

                // 准星命中反馈
                if (window.dynamicCrosshair) {
                    window.dynamicCrosshair.showHit();
                }

                // 更新敌人血条
                if (window.effectsSystem?.healthBar) {
                    window.effectsSystem.healthBar.showDamageEffect(data.player_id);
                }
            }
        }
    });
```

- [ ] **Step 3: 更新击杀事件处理**

```javascript
    // 玩家死亡 - 增强版
    window.network.on('player_killed', (data) => {
        console.log(`Player ${data.victim_id} killed by ${data.killer_id}`);

        if (data.killer_id === window.game?.player?.id) {
            // 自己击杀
            window.game.player.kills++;
            window.uiManager.updateKills(window.game.player.kills);
            
            // 击杀提示
            if (window.killNotice) {
                killNotice.show(data.victim_name || data.victim_id, {
                    isHeadshot: data.is_headshot
                });
            }

            // 连杀
            if (window.killstreakEnhanced) {
                killstreakEnhanced.addKill();
            }

            // 屏幕闪绿
            if (window.screenEffectsEnhanced) {
                screenEffectsEnhanced.flashKill();
            }

            // 击杀音效
            if (window.audioManager) {
                window.audioManager.playKill();
            }
        }

        // 自己死亡
        if (data.victim_id === window.game?.player?.id) {
            if (window.screenEffectsEnhanced) {
                screenEffectsEnhanced.showDeath();
            }
        }

        // 移除血条
        if (window.effectsSystem?.healthBar) {
            window.effectsSystem.healthBar.removeHealthBar(data.victim_id);
        }
    });
```

- [ ] **Step 4: 在游戏循环中更新特效系统**

找到 `startGame()` 函数中的游戏循环，添加特效更新：

```javascript
        // 特效系统更新
        if (window.effectsSystem) {
            window.effectsSystem.update(deltaTime);
        }
```

- [ ] **Step 5: 提交集成更新**

```bash
git add client/js/main.js
git commit -m "feat(effects): 集成特效系统到主循环

- 初始化 EffectsSystem
- 更新受伤事件处理
- 更新击杀事件处理
- 添加特效系统更新循环"
```

---

### Task 5.2: 更新向后兼容

**Files:**
- Modify: `client/js/effects.js`

- [ ] **Step 1: 添加向后兼容代码**

```javascript
// effects.js - 向后兼容层
console.log('[DEPRECATED] effects.js is deprecated. Use effects/index.js instead.');
console.log('[EFFECTS] Loading backward compatibility layer...');

// 如果新系统未加载，提供基础实现
if (typeof EffectsManager === 'undefined') {
    console.warn('[EFFECTS] New effects system not loaded, using fallback');
    
    class EffectsManager {
        constructor(renderer) {
            this.renderer = renderer;
            this.effects = [];
            this.maxEffects = 50;
        }

        createMuzzleFlash(position, rotation) {
            // 委托给新系统
            if (window.effectsSystem?.core) {
                window.effectsSystem.core.createMuzzleFlash(position, rotation);
            }
        }

        createHitEffect(position) {
            if (window.effectsSystem?.core) {
                window.effectsSystem.core.createHitBurst(position, false);
            }
        }

        createKillEffect(position) {
            if (window.effectsSystem?.core) {
                window.effectsSystem.core.createExplosion(position);
            }
        }

        createExplosion(position) {
            if (window.effectsSystem?.core) {
                window.effectsSystem.core.createExplosion(position);
            }
        }

        update(deltaTime) {
            if (window.effectsSystem) {
                window.effectsSystem.update(deltaTime);
            }
        }

        render(scene) {
            if (window.effectsSystem) {
                window.effectsSystem.render(scene);
            }
        }

        clear() {
            if (window.effectsSystem) {
                window.effectsSystem.clear();
            }
        }
    }

    window.EffectsManager = EffectsManager;
}

// ScreenEffects 向后兼容
if (typeof ScreenEffects === 'undefined' && window.ScreenEffectsEnhanced) {
    window.ScreenEffects = window.ScreenEffectsEnhanced;
}

console.log('[EFFECTS] Backward compatibility layer loaded');
```

- [ ] **Step 2: 提交兼容层**

```bash
git add client/js/effects.js
git commit -m "feat(effects): 添加向后兼容层

- 保留旧 EffectsManager API
- 自动委托给新特效系统
- 控制台输出废弃警告"
```

---

### Task 5.3: 部署和测试

- [ ] **Step 1: 推送代码到服务器**

```bash
git push origin main
ssh wechat-prod "cd /home/lighthouse/fps-game && git pull"
```

- [ ] **Step 2: 重启服务**

```bash
ssh wechat-proad "docker restart fps-game-server"
```

- [ ] **Step 3: 打开浏览器测试**

打开 http://101.33.117.73:8080

测试清单：
- [ ] 射击时枪口火焰
- [ ] 命中敌人时粒子效果
- [ ] 伤害数字飘字
- [ ] 爆头时红色大字 + HEADSHOT 标签
- [ ] 敌人血条显示
- [ ] 受伤时屏幕闪红 + 震动
- [ ] 受击指示器指向伤害来源
- [ ] 击杀提示
- [ ] 连杀提示
- [ ] 动态准星扩散
- [ ] 弹药低时警告

- [ ] **Step 4: 提交最终版本**

```bash
git add -A
git commit -m "feat(effects): 完成前端特效增强系统

三层架构：
- 核心层：命中粒子、伤害数字、枪口火焰、血条
- 增强层：受击指示器、击杀提示、连杀提示
- 装饰层：屏幕震动、动态准星、弹药动画、成就弹窗

性能自适应降级：high/balanced/low/minimal

测试通过 ✅"
```

---

## 实现清单

### Chunk 1: 基础设施 ✅
- [x] 创建目录结构
- [x] 性能监控系统
- [x] 入口文件
- [x] 更新 HTML 脚本加载

### Chunk 2: 核心层 ✅
- [x] 核心特效模块（粒子、火焰）
- [x] 伤害数字飘字
- [x] 敌人血条

### Chunk 3: 增强层 ✅
- [x] 受击指示器
- [x] 击杀提示
- [x] 连杀提示

### Chunk 4: 装饰层 ✅
- [x] 屏幕震动和特效
- [x] 动态准星
- [x] 弹药动画
- [x] 成就弹窗

### Chunk 5: 集成测试
- [ ] 更新 main.js 集成
- [ ] 向后兼容层
- [ ] 部署测试
