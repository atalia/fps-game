// client/js/effects/achievements.js
// 成就弹窗系统（增强版）

console.log('[EFFECTS] effects/achievements.js loading...')

class AchievementsEnhanced {
    constructor() {
        this.container = null
        this.queue = []
        this.isShowing = false
        this.animated = true
        
        this.init()
    }

    init() {
        this.container = document.getElementById('achievements-container')
        if (!this.container) {
            this.container = document.createElement('div')
            this.container.id = 'achievements-container'
            this.container.style.cssText = `
                position: fixed;
                bottom: 100px;
                right: 20px;
                pointer-events: none;
                z-index: 700;
            `
            document.body.appendChild(this.container)
        }
    }

    setAnimated(animated) {
        this.animated = animated
    }

    // 显示成就
    show(achievement) {
        this.queue.push({
            id: achievement.id,
            name: achievement.name,
            description: achievement.description || '',
            icon: achievement.icon || '🏆'
        })
        
        if (!this.isShowing) {
            this.showNext()
        }
    }

    showNext() {
        if (this.queue.length === 0) {
            this.isShowing = false
            return
        }
        
        this.isShowing = true
        const achievement = this.queue.shift()
        
        // 创建弹窗
        const popup = document.createElement('div')
        popup.className = 'achievement-popup'
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
        `
        
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
        `
        
        this.container.appendChild(popup)
        
        // 动画
        requestAnimationFrame(() => {
            popup.style.transform = 'translateX(0)'
        })
        
        // 移除
        setTimeout(() => {
            popup.style.transform = 'translateX(120%)'
            setTimeout(() => {
                popup.remove()
                setTimeout(() => this.showNext(), 100)
            }, 300)
        }, 3000)
    }

    clear() {
        this.queue = []
        this.container.innerHTML = ''
        this.isShowing = false
    }
}

window.achievementsEnhanced = new AchievementsEnhanced()
window.AchievementsEnhanced = AchievementsEnhanced
console.log('[EFFECTS] AchievementsEnhanced initialized')
