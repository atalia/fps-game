// client/js/effects/screen-effects.js
// 屏幕震动和视觉效果

console.log('[EFFECTS] effects/screen-effects.js loading...')

class ScreenEffectsEnhanced {
    constructor() {
        this.enabled = true
        this.overlay = null
        this.gameContainer = null
        
        this.init()
    }

    init() {
        // 创建覆盖层
        this.overlay = document.createElement('div')
        this.overlay.id = 'screen-effects-overlay'
        this.overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 500;
            transition: background-color 0.1s;
        `
        document.body.appendChild(this.overlay)
        
        // 游戏容器（用于震动）
        this.gameContainer = document.getElementById('game-container')
    }

    setEnabled(enabled) {
        this.enabled = enabled
    }

    // ==================== 屏幕震动 ====================
    
    shake(intensity = 10, duration = 100) {
        if (!this.enabled || !this.gameContainer) return
        
        const startTime = performance.now()
        const originalTransform = this.gameContainer.style.transform || ''
        
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime
            
            if (elapsed < duration) {
                const progress = elapsed / duration
                const decay = 1 - progress
                
                const x = (Math.random() - 0.5) * intensity * decay
                const y = (Math.random() - 0.5) * intensity * decay
                
                this.gameContainer.style.transform = `translate(${x}px, ${y}px)`
                requestAnimationFrame(animate)
            } else {
                this.gameContainer.style.transform = originalTransform
            }
        }
        
        requestAnimationFrame(animate)
    }

    // ==================== 屏幕闪烁 ====================
    
    flashDamage(intensity = 0.3) {
        if (!this.enabled) return
        
        this.overlay.style.backgroundColor = `rgba(255, 0, 0, ${intensity})`
        setTimeout(() => {
            this.overlay.style.backgroundColor = 'transparent'
        }, 100)
    }

    flashKill() {
        if (!this.enabled) return
        
        this.overlay.style.backgroundColor = 'rgba(0, 255, 0, 0.2)'
        setTimeout(() => {
            this.overlay.style.backgroundColor = 'transparent'
        }, 150)
    }

    flashHeal() {
        if (!this.enabled) return
        
        this.overlay.style.backgroundColor = 'rgba(0, 100, 255, 0.2)'
        setTimeout(() => {
            this.overlay.style.backgroundColor = 'transparent'
        }, 150)
    }

    // ==================== 闪光弹致盲 ====================

    flashblind(duration = 3000, intensity = 1.0) {
        if (!this.enabled) return

        // 创建致盲覆盖层
        let flashOverlay = document.getElementById('flashbang-overlay')
        if (!flashOverlay) {
            flashOverlay = document.createElement('div')
            flashOverlay.id = 'flashbang-overlay'
            flashOverlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: white;
                pointer-events: none;
                z-index: 1000;
            `
            document.body.appendChild(flashOverlay)
        }

        // 设置初始亮度
        flashOverlay.style.opacity = intensity
        flashOverlay.style.display = 'block'

        // 渐变恢复
        const startTime = Date.now()
        const fadeStep = () => {
            const elapsed = Date.now() - startTime
            const progress = Math.min(1, elapsed / duration)
            
            // 非线性恢复（开始慢，后来快）
            const opacity = intensity * Math.pow(1 - progress, 2)
            flashOverlay.style.opacity = opacity

            if (progress < 1) {
                requestAnimationFrame(fadeStep)
            } else {
                flashOverlay.style.display = 'none'
            }
        }
        requestAnimationFrame(fadeStep)

        // 播放耳鸣音效
        if (window.audioManager?.playFlashbangRing) {
            window.audioManager.playFlashbangRing()
        }
    }

    // ==================== 死亡效果 ====================
    
    showDeath() {
        this.overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)'
    }

    hideDeath() {
        this.overlay.style.backgroundColor = 'transparent'
    }

    clear() {
        this.overlay.style.backgroundColor = 'transparent'
        if (this.gameContainer) {
            this.gameContainer.style.transform = ''
        }
    }
}

window.screenEffectsEnhanced = new ScreenEffectsEnhanced()
window.ScreenEffectsEnhanced = ScreenEffectsEnhanced

// 向后兼容
window.screenEffects = window.screenEffectsEnhanced
window.ScreenEffects = ScreenEffectsEnhanced

console.log('[EFFECTS] ScreenEffectsEnhanced initialized')
