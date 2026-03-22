// client/js/effects/killstreak.js
// 连杀提示系统（增强版）

console.log('[EFFECTS] effects/killstreak.js loading...')

class KillstreakEnhanced {
    constructor() {
        this.container = null
        this.kills = []
        this.timeout = 5000 // 5秒重置
        
        this.config = {
            double: { kills: 2, name: '双杀!', color: '#ffd700', size: '36px' },
            triple: { kills: 3, name: '三杀!', color: '#ffd700', size: '42px' },
            quad: { kills: 4, name: '四杀!', color: '#ff8c00', size: '48px' },
            penta: { kills: 5, name: '五连绝世!', color: '#ff4444', size: '56px' },
            legendary: { kills: 6, name: '无人能挡!', color: '#ff0000', size: '64px' }
        }
        
        this.init()
    }

    init() {
        this.container = document.getElementById('killstreak-container')
        if (!this.container) {
            this.container = document.createElement('div')
            this.container.id = 'killstreak-container'
            this.container.style.cssText = `
                position: fixed;
                top: 35%;
                left: 50%;
                transform: translateX(-50%);
                pointer-events: none;
                z-index: 400;
                text-align: center;
            `
            document.body.appendChild(this.container)
        }
    }

    // 记录击杀
    addKill() {
        const now = Date.now()
        
        // 清理过期击杀
        this.kills = this.kills.filter(time => now - time < this.timeout)
        
        // 添加新击杀
        this.kills.push(now)
        
        // 检查连杀
        this.checkStreak()
        
        return this.kills.length
    }

    checkStreak() {
        const count = this.kills.length
        
        // 查找对应的连杀配置
        let streakConfig = null
        for (const [key, config] of Object.entries(this.config)) {
            if (count >= config.kills) {
                streakConfig = config
            }
        }
        
        if (streakConfig) {
            this.show(streakConfig)
        }
    }

    show(config) {
        // 清空容器
        this.container.innerHTML = ''
        
        // 创建显示元素
        const element = document.createElement('div')
        element.className = 'killstreak-notice'
        element.style.cssText = `
            color: ${config.color};
            font-size: ${config.size};
            font-weight: bold;
            text-shadow: 0 0 10px ${config.color}, 2px 2px 4px #000;
            opacity: 0;
            transform: scale(0.5);
        `
        element.textContent = config.name
        this.container.appendChild(element)
        
        // 动画
        requestAnimationFrame(() => {
            element.style.transition = 'all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55)'
            element.style.opacity = '1'
            element.style.transform = 'scale(1.2)'
            
            setTimeout(() => {
                element.style.transform = 'scale(1)'
            }, 150)
        })
        
        // 屏幕震动（高连杀）
        if (this.kills.length >= 4 && window.screenEffectsEnhanced) {
            window.screenEffectsEnhanced.shake(5, 100)
        }
        
        // 移除
        setTimeout(() => {
            element.style.transition = 'all 0.5s'
            element.style.opacity = '0'
            element.style.transform = 'scale(1.5)'
        }, 1500)
    }

    reset() {
        this.kills = []
    }

    getStreak() {
        return this.kills.length
    }
}

window.killstreakEnhanced = new KillstreakEnhanced()
window.KillstreakEnhanced = KillstreakEnhanced
console.log('[EFFECTS] KillstreakEnhanced initialized')
