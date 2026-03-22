// client/js/effects/index.js
// 特效系统入口

console.log('[EFFECTS] effects/index.js loading...')

// 等待所有模块加载完成
class EffectsSystem {
    constructor() {
        this.performanceMonitor = window.performanceMonitor
        this.initialized = false
        
        // 模块引用（初始化后填充）
        this.core = null
        this.damageNumber = null
        this.healthBar = null
        this.hitIndicator = null
        this.killfeed = null
        this.killNotice = null
        this.killstreak = null
        this.achievements = null
        this.screenEffects = null
        this.crosshair = null
        this.ammoDisplay = null
    }

    init(renderer) {
        console.log('[EFFECTS] Initializing effects system...')
        this.renderer = renderer
        
        // 初始化各模块（按依赖顺序）
        if (window.EffectsCore) {
            this.core = new window.EffectsCore(renderer)
        }
        
        if (window.DamageNumber) {
            this.damageNumber = new window.DamageNumber()
        }
        
        if (window.HealthBarManager) {
            this.healthBar = new window.HealthBarManager(renderer)
        }
        
        if (window.HitIndicator) {
            this.hitIndicator = new window.HitIndicator()
        }
        
        if (window.KillfeedEnhanced) {
            this.killfeed = new window.KillfeedEnhanced()
        }
        
        if (window.KillNotice) {
            this.killNotice = new window.KillNotice()
        }
        
        if (window.KillstreakEnhanced) {
            this.killstreak = new window.KillstreakEnhanced()
        }
        
        if (window.AchievementsEnhanced) {
            this.achievements = new window.AchievementsEnhanced()
        }
        
        if (window.ScreenEffectsEnhanced) {
            this.screenEffects = new window.ScreenEffectsEnhanced()
        }
        
        if (window.DynamicCrosshair) {
            this.crosshair = new window.DynamicCrosshair()
        }
        
        if (window.AmmoDisplayEnhanced) {
            this.ammoDisplay = new window.AmmoDisplayEnhanced()
        }
        
        // 监听性能等级变化
        this.performanceMonitor.onLevelChange((oldLevel, newLevel, fps, config) => {
            this.applyPerformanceLevel(config)
        })
        
        this.initialized = true
        console.log('[EFFECTS] Effects system initialized')
    }

    applyPerformanceLevel(config) {
        // 通知各模块应用新的性能配置
        if (this.core) this.core.setConfig(config.particles)
        if (this.healthBar) this.healthBar.setConfig(config.healthBars)
        if (this.screenEffects) this.screenEffects.setEnabled(config.screenShake)
        if (this.killfeed) this.killfeed.setAnimated(config.killfeed.animated)
        if (this.achievements) this.achievements.setAnimated(config.achievements.animated)
        if (this.crosshair) this.crosshair.setDynamic(config.crosshair.dynamic)
    }

    // 每帧更新
    update(deltaTime) {
        this.performanceMonitor.tick()
        
        if (this.core) this.core.update(deltaTime)
        if (this.healthBar) this.healthBar.update(deltaTime)
        if (this.crosshair) this.crosshair.update(deltaTime)
    }

    // 渲染（在Three.js渲染循环中调用）
    render(scene) {
        if (this.core) this.core.render(scene)
        if (this.healthBar) this.healthBar.render()
    }

    // 清理
    clear() {
        if (this.core) this.core.clear()
        if (this.healthBar) this.healthBar.clear()
        if (this.damageNumber) this.damageNumber.clear()
    }
}

// 创建全局实例
window.effectsSystem = new EffectsSystem()
window.EffectsSystem = EffectsSystem

console.log('[EFFECTS] effects/index.js loaded')
