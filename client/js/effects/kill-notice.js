// client/js/effects/kill-notice.js
// 击杀提示系统

console.log('[EFFECTS] effects/kill-notice.js loading...')

class KillNotice {
    constructor() {
        this.container = null
        this.queue = []
        this.isShowing = false
        
        this.init()
    }

    init() {
        this.container = document.getElementById('kill-notice-container')
        if (!this.container) {
            this.container = document.createElement('div')
            this.container.id = 'kill-notice-container'
            this.container.style.cssText = `
                position: fixed;
                top: 30%;
                left: 50%;
                transform: translateX(-50%);
                pointer-events: none;
                z-index: 300;
                text-align: center;
            `
            document.body.appendChild(this.container)
        }
    }

    // 显示击杀提示
    show(victimName, options = {}) {
        const {
            isHeadshot = false,
            weapon = null,
            isSuicide = false
        } = options
        
        this.queue.push({
            victimName,
            isHeadshot,
            weapon,
            isSuicide
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
        const data = this.queue.shift()
        
        // 创建提示元素
        const notice = document.createElement('div')
        notice.className = 'kill-notice'
        
        let text = ''
        let color = '#ffffff'
        let fontSize = '24px'
        
        if (data.isSuicide) {
            text = `${data.victimName} 自杀了`
            color = '#888888'
        } else if (data.isHeadshot) {
            text = `💀 爆头击杀 ${data.victimName}`
            color = '#ff4444'
            fontSize = '28px'
        } else {
            text = `击杀 ${data.victimName}`
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
        `
        
        notice.textContent = text
        this.container.appendChild(notice)
        
        // 动画
        requestAnimationFrame(() => {
            notice.style.transition = 'all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55)'
            notice.style.opacity = '1'
            notice.style.transform = 'scale(1)'
        })
        
        // 移除
        setTimeout(() => {
            notice.style.transition = 'all 0.5s'
            notice.style.opacity = '0'
            notice.style.transform = 'translateY(-20px)'
            
            setTimeout(() => {
                notice.remove()
                setTimeout(() => this.showNext(), 100)
            }, 500)
        }, 2000)
    }

    clear() {
        this.queue = []
        this.container.innerHTML = ''
        this.isShowing = false
    }
}

window.killNotice = new KillNotice()
window.KillNotice = KillNotice
console.log('[EFFECTS] KillNotice initialized')
