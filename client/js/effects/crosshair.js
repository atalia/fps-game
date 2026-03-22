// client/js/effects/crosshair.js
// 动态准星系统

console.log('[EFFECTS] effects/crosshair.js loading...')

class DynamicCrosshair {
    constructor() {
        this.element = null
        this.dynamic = true
        this.color = '#ffffff'
        this.style = 'cross' // cross, dot, cross-circle
        
        // 扩散参数
        this.baseSpread = 15
        this.moveSpread = 10
        this.shootSpread = 20
        this.currentSpread = 15
        this.recoverySpeed = 5
        
        this.isMoving = false
        this.isShooting = false
        
        this.init()
    }

    init() {
        this.element = document.getElementById('crosshair')
        if (!this.element) {
            this.element = document.createElement('div')
            this.element.id = 'crosshair'
            document.body.appendChild(this.element)
        }
        
        this.render()
    }

    setDynamic(dynamic) {
        this.dynamic = dynamic
    }

    setColor(color) {
        this.color = color
        this.render()
    }

    setStyle(style) {
        this.style = style
        this.render()
    }

    // 更新状态
    update(deltaTime) {
        if (!this.dynamic) return
        
        let targetSpread = this.baseSpread
        
        if (this.isMoving) targetSpread += this.moveSpread
        if (this.isShooting) targetSpread += this.shootSpread
        
        // 平滑过渡
        this.currentSpread += (targetSpread - this.currentSpread) * this.recoverySpeed * deltaTime
        
        this.render()
    }

    setMoving(moving) {
        this.isMoving = moving
    }

    setShooting(shooting) {
        this.isShooting = shooting
    }

    // 命中反馈
    showHit() {
        this.element.classList.add('hit')
        setTimeout(() => {
            this.element.classList.remove('hit')
        }, 100)
    }

    render() {
        const spread = Math.round(this.currentSpread)
        const size = 2
        const gap = spread
        
        let html = ''
        let css = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            pointer-events: none;
            z-index: 600;
        `
        
        if (this.style === 'dot') {
            html = `<div style="
                width: 4px;
                height: 4px;
                background: ${this.color};
                border-radius: 50%;
            "></div>`
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
            `
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
            `
        }
        
        this.element.style.cssText = css
        this.element.innerHTML = html
    }
}

window.dynamicCrosshair = new DynamicCrosshair()
window.DynamicCrosshair = DynamicCrosshair
console.log('[EFFECTS] DynamicCrosshair initialized')
