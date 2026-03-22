// client/js/effects/ammo-display.js
// 弹药显示动画

console.log('[EFFECTS] effects/ammo-display.js loading...')

class AmmoDisplayEnhanced {
    constructor() {
        this.container = null
        this.currentAmmoEl = null
        this.reserveAmmoEl = null
        this.reloadProgressEl = null
        this.warningEl = null
        
        this.lastAmmo = 30
        this.maxAmmo = 30
        
        this.blinkInterval = null
        
        this.init()
    }

    init() {
        // 查找现有元素
        this.container = document.getElementById('ammo-display')
        
        if (!this.container) {
            this.container = document.createElement('div')
            this.container.id = 'ammo-display'
            this.container.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: rgba(0,0,0,0.6);
                padding: 15px 20px;
                border-radius: 8px;
                text-align: right;
                font-family: 'Segoe UI', sans-serif;
            `
            document.body.appendChild(this.container)
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
        `
        
        this.currentAmmoEl = document.getElementById('ammo-current')
        this.reserveAmmoEl = document.getElementById('ammo-reserve')
        this.reloadProgressEl = document.getElementById('reload-progress')
        this.warningEl = document.getElementById('ammo-warning')
    }

    // 更新弹药显示
    update(current, reserve) {
        // 弹药变化动画
        if (current !== this.lastAmmo) {
            this.animateChange(current)
        }
        
        this.lastAmmo = current
        this.currentAmmoEl.textContent = current
        this.reserveAmmoEl.textContent = `/ ${reserve}`
        
        // 低弹药警告
        const percent = current / this.maxAmmo
        
        if (current === 0) {
            this.warningEl.style.display = 'block'
            this.warningEl.textContent = 'NO AMMO'
            this.currentAmmoEl.style.color = '#ff4444'
        } else if (percent < 0.3) {
            this.warningEl.style.display = 'block'
            this.warningEl.textContent = 'LOW AMMO'
            this.currentAmmoEl.style.color = '#ffaa00'
            this.startWarningBlink()
        } else {
            this.warningEl.style.display = 'none'
            this.currentAmmoEl.style.color = '#ffffff'
            this.stopWarningBlink()
        }
    }

    animateChange(newAmmo) {
        // 射击时数字跳动
        this.currentAmmoEl.style.transform = 'scale(1.1)'
        setTimeout(() => {
            this.currentAmmoEl.style.transform = 'scale(1)'
        }, 50)
    }

    // 换弹进度
    startReload(duration) {
        this.reloadProgressEl.style.transition = 'none'
        this.reloadProgressEl.style.width = '0%'
        
        requestAnimationFrame(() => {
            this.reloadProgressEl.style.transition = `width ${duration}ms linear`
            this.reloadProgressEl.style.width = '100%'
        })
    }

    endReload() {
        this.reloadProgressEl.style.transition = 'none'
        this.reloadProgressEl.style.width = '0%'
    }

    startWarningBlink() {
        if (this.blinkInterval) return
        
        this.blinkInterval = setInterval(() => {
            this.warningEl.style.opacity = this.warningEl.style.opacity === '0' ? '1' : '0'
        }, 500)
    }

    stopWarningBlink() {
        if (this.blinkInterval) {
            clearInterval(this.blinkInterval)
            this.blinkInterval = null
        }
        this.warningEl.style.opacity = '1'
    }

    setMaxAmmo(max) {
        this.maxAmmo = max
    }
}

window.ammoDisplayEnhanced = new AmmoDisplayEnhanced()
window.AmmoDisplayEnhanced = AmmoDisplayEnhanced
console.log('[EFFECTS] AmmoDisplayEnhanced initialized')
