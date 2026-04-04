// client/js/effects/performance.js
// 性能监控和降级控制系统

console.log('[EFFECTS] effects/performance.js loading...')

class PerformanceMonitor {
    constructor() {
        this.frames = []
        this.lastTime = performance.now()
        this.fps = 60
        this.level = 'high' // high, balanced, low, minimal
        this.listeners = []
        
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
        }
        
        this.currentConfig = this.config.high
    }

    // 每帧调用
    update() {
        const now = performance.now()
        const delta = now - this.lastTime
        this.lastTime = now
        
        if (delta > 0) {
            this.frames.push(1000 / delta)
        }
        
        // 每60帧更新一次FPS
        if (this.frames.length >= 60) {
            this.updateFPS()
            this.frames = []
        }
    }
    
    // 别名
    tick() {
        this.update()
    }

    updateFPS() {
        const avgFPS = this.frames.reduce((a, b) => a + b, 0) / this.frames.length
        this.fps = Math.round(avgFPS)
        
        // 确定性能等级
        const oldLevel = this.level
        
        if (this.fps >= 55) {
            this.level = 'high'
        } else if (this.fps >= 30) {
            this.level = 'balanced'
        } else if (this.fps >= 20) {
            this.level = 'low'
        } else {
            this.level = 'minimal'
        }
        
        this.currentConfig = this.config[this.level]
        
        // 等级变化时通知监听器
        if (oldLevel !== this.level) {
            console.log(`[Performance] Level changed: ${oldLevel} → ${this.level} (FPS: ${this.fps})`)
            this.notifyListeners(oldLevel, this.level)
        }
    }

    // 添加性能等级变化监听器
    onLevelChange(callback) {
        this.listeners.push(callback)
    }

    notifyListeners(oldLevel, newLevel) {
        this.listeners.forEach(cb => {
            try {
                cb(oldLevel, newLevel, this.fps, this.currentConfig)
            } catch (e) {
                console.error('[Performance] Listener error:', e)
            }
        })
    }

    // 获取当前配置
    getConfig() {
        return this.currentConfig
    }

    getFPS() {
        return this.fps
    }

    getLevel() {
        return this.level
    }
}

// 单例
window.performanceMonitor = new PerformanceMonitor()

// 导出
window.PerformanceMonitor = PerformanceMonitor
console.log('[EFFECTS] PerformanceMonitor initialized')
