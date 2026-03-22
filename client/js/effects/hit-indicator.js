// client/js/effects/hit-indicator.js
// 受击指示器系统

console.log('[EFFECTS] effects/hit-indicator.js loading...')

class HitIndicator {
    constructor() {
        this.container = null
        this.indicators = []
        this.maxIndicators = 4
        
        this.init()
    }

    init() {
        this.container = document.getElementById('hit-indicator-container')
        if (!this.container) {
            this.container = document.createElement('div')
            this.container.id = 'hit-indicator-container'
            this.container.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
                z-index: 150;
            `
            document.body.appendChild(this.container)
        }
    }

    // 显示受击指示
    show(enemyPosition, damage) {
        if (!window.renderer || !window.renderer.camera) return
        
        // 计算方向
        const playerPos = window.game?.player?.position
        if (!playerPos) return
        
        const dx = enemyPosition.x - playerPos.x
        const dz = enemyPosition.z - playerPos.z
        const angle = Math.atan2(dx, dz)
        
        // 获取玩家朝向
        const playerRotation = window.game?.player?.rotation || 0
        const relativeAngle = angle - playerRotation
        
        // 转换为屏幕X坐标
        const screenX = Math.sin(relativeAngle) * (window.innerWidth / 2 - 50)
        const screenY = Math.cos(relativeAngle) * (window.innerHeight / 2 - 50)
        
        // 根据伤害确定大小
        let size = 20
        if (damage >= 50) {
            size = 40
        } else if (damage >= 20) {
            size = 30
        }
        
        // 创建指示器
        const indicator = document.createElement('div')
        indicator.className = 'hit-indicator'
        indicator.innerHTML = '▼' // 三角形箭头
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
        `
        
        this.container.appendChild(indicator)
        
        // 淡入
        requestAnimationFrame(() => {
            indicator.style.opacity = '0.8'
        })
        
        // 记录
        this.indicators.push({
            element: indicator,
            startTime: Date.now(),
            duration: 500
        })
        
        // 限制数量
        while (this.indicators.length > this.maxIndicators) {
            const old = this.indicators.shift()
            old.element.remove()
        }
        
        // 自动移除
        setTimeout(() => {
            indicator.style.opacity = '0'
            setTimeout(() => indicator.remove(), 200)
        }, 500)
    }

    clear() {
        this.indicators.forEach(ind => ind.element.remove())
        this.indicators = []
    }
}

window.hitIndicator = new HitIndicator()
window.HitIndicator = HitIndicator
console.log('[EFFECTS] HitIndicator initialized')
