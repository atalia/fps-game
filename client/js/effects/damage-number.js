// client/js/effects/damage-number.js
// 伤害数字飘字系统

console.log('[EFFECTS] effects/damage-number.js loading...')

class DamageNumber {
    constructor() {
        this.container = null
        this.numbers = []
        this.maxNumbers = 20
        
        this.init()
    }

    init() {
        // 创建容器
        this.container = document.getElementById('damage-numbers-container')
        if (!this.container) {
            this.container = document.createElement('div')
            this.container.id = 'damage-numbers-container'
            this.container.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
                z-index: 200;
            `
            document.body.appendChild(this.container)
        }
    }

    // 显示伤害数字
    show(damage, position, options = {}) {
        const {
            isHeadshot = false,
            isCritical = false,
            color = null
        } = options

        // 创建数字元素
        const element = document.createElement('div')
        element.className = 'damage-number'
        
        // 样式
        let fontSize = '18px'
        let textColor = '#ffffff'
        let fontWeight = 'bold'
        
        if (isHeadshot) {
            fontSize = '24px'
            textColor = '#ff4444'
        } else if (isCritical) {
            fontSize = '20px'
            textColor = '#ff8800'
        } else if (color) {
            textColor = color
        }
        
        element.style.cssText = `
            position: absolute;
            color: ${textColor};
            font-size: ${fontSize};
            font-weight: ${fontWeight};
            text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
            pointer-events: none;
            white-space: nowrap;
        `
        
        element.textContent = `-${Math.round(damage)}`
        
        // 转换为屏幕坐标
        const screenPos = this.worldToScreen(position)
        element.style.left = `${screenPos.x}px`
        element.style.top = `${screenPos.y}px`
        
        // 添加到容器
        this.container.appendChild(element)
        
        // 记录
        const numberData = {
            element,
            startTime: performance.now(),
            duration: 1000,
            startY: screenPos.y,
            offsetX: (Math.random() - 0.5) * 30
        }
        
        this.numbers.push(numberData)
        
        // 限制数量
        while (this.numbers.length > this.maxNumbers) {
            const old = this.numbers.shift()
            if (old.element && old.element.parentNode) {
                old.element.remove()
            }
        }
        
        // 爆头额外显示标签
        if (isHeadshot) {
            this.showHeadshotLabel(screenPos)
        }
        
        // 开始动画
        this.animateNumber(numberData)
    }

    showHeadshotLabel(screenPos) {
        const label = document.createElement('div')
        label.className = 'headshot-label'
        label.textContent = 'HEADSHOT!'
        label.style.cssText = `
            position: absolute;
            left: ${screenPos.x}px;
            top: ${screenPos.y - 30}px;
            color: #ff0000;
            font-size: 14px;
            font-weight: bold;
            text-shadow: 1px 1px 2px #000;
            pointer-events: none;
        `
        this.container.appendChild(label)
        
        // 动画
        setTimeout(() => {
            label.style.transition = 'opacity 0.3s'
            label.style.opacity = '0'
            setTimeout(() => label.remove(), 300)
        }, 700)
    }

    worldToScreen(position) {
        if (!window.renderer || !window.renderer.camera) {
            return { 
                x: window.innerWidth / 2 + (Math.random() - 0.5) * 100,
                y: window.innerHeight / 2 + (Math.random() - 0.5) * 100
            }
        }

        const camera = window.renderer.camera
        const vector = new THREE.Vector3(position.x, position.y, position.z)
        vector.project(camera)

        return {
            x: (vector.x + 1) / 2 * window.innerWidth,
            y: -(vector.y - 1) / 2 * window.innerHeight
        }
    }

    animateNumber(data) {
        const animate = () => {
            const elapsed = performance.now() - data.startTime
            const progress = elapsed / data.duration
            
            if (progress >= 1) {
                if (data.element && data.element.parentNode) {
                    data.element.remove()
                }
                return
            }
            
            // 向上飘动
            const yOffset = progress * 50
            // 淡出
            const opacity = 1 - progress
            // 缩放
            const scale = 1 + progress * 0.3
            
            data.element.style.transform = `translateX(${data.offsetX}px) translateY(${-yOffset}px) scale(${scale})`
            data.element.style.opacity = opacity
            
            requestAnimationFrame(animate)
        }
        
        requestAnimationFrame(animate)
    }

    clear() {
        this.numbers.forEach(data => {
            if (data.element && data.element.parentNode) {
                data.element.remove()
            }
        })
        this.numbers = []
    }
}

// 创建全局实例
window.damageNumber = new DamageNumber()
window.DamageNumber = DamageNumber
console.log('[EFFECTS] DamageNumber initialized')
