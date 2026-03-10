// damage-display.js - 伤害显示系统
class DamageDisplay {
    constructor() {
        this.indicators = [];
        this.container = document.getElementById('damage-overlay') || this.createContainer();
    }

    createContainer() {
        const div = document.createElement('div');
        div.id = 'damage-overlay';
        div.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            pointer-events: none;
            z-index: 50;
        `;
        document.getElementById('game-container').appendChild(div);
        return div;
    }

    // 显示伤害数字
    showDamageNumber(damage, position, isHeadshot = false) {
        const indicator = document.createElement('div');
        indicator.className = 'damage-number';
        indicator.textContent = `-${damage}`;
        indicator.style.cssText = `
            position: absolute;
            color: ${isHeadshot ? '#ff4444' : '#ffffff'};
            font-size: ${isHeadshot ? '24px' : '18px'};
            font-weight: bold;
            text-shadow: 2px 2px 4px #000;
            pointer-events: none;
            z-index: 100;
            animation: floatUp 1s ease-out forwards;
        `;

        // 将 3D 位置转换为屏幕坐标
        const screenPos = this.worldToScreen(position);
        indicator.style.left = `${screenPos.x}px`;
        indicator.style.top = `${screenPos.y}px`;

        this.container.appendChild(indicator);

        // 1秒后移除
        setTimeout(() => {
            indicator.remove();
        }, 1000);
    }

    // 世界坐标转屏幕坐标
    worldToScreen(position) {
        if (!window.renderer || !window.renderer.camera) {
            return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        }

        const camera = window.renderer.camera;
        const vector = new THREE.Vector3(position.x, position.y, position.z);
        vector.project(camera);

        return {
            x: (vector.x + 1) / 2 * window.innerWidth,
            y: -(vector.y - 1) / 2 * window.innerHeight
        };
    }

    // 受伤闪烁
    showDamage(amount) {
        this.container.classList.remove('hit');
        void this.container.offsetWidth; // 强制重绘
        this.container.classList.add('hit');

        // 设置闪烁强度
        const intensity = Math.min(amount / 50, 1);
        this.container.style.setProperty('--damage-intensity', intensity);
    }

    // 击杀反馈
    showKill() {
        this.container.classList.remove('kill');
        void this.container.offsetWidth;
        this.container.classList.add('kill');
    }

    // 死亡效果
    showDeath() {
        this.container.classList.add('death');
    }

    hideDeath() {
        this.container.classList.remove('death');
    }

    // 爆头击杀特效
    showHeadshotKill(position) {
        // 显示大号爆头伤害
        this.showDamageNumber(100, position, true);

        // 添加爆头提示
        const headshot = document.createElement('div');
        headshot.className = 'headshot-indicator';
        headshot.textContent = 'HEADSHOT!';
        headshot.style.cssText = `
            position: absolute;
            top: 40%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: #ff4444;
            font-size: 32px;
            font-weight: bold;
            text-shadow: 2px 2px 4px #000;
            pointer-events: none;
            z-index: 100;
            animation: fadeInOut 1.5s ease-out forwards;
        `;

        document.getElementById('game-container').appendChild(headshot);

        setTimeout(() => headshot.remove(), 1500);
    }

    clear() {
        this.container.innerHTML = '';
        this.container.classList.remove('hit', 'kill', 'death');
    }
}

// 添加 CSS 动画
const style = document.createElement('style');
style.textContent = `
    @keyframes floatUp {
        0% {
            opacity: 1;
            transform: translateY(0) scale(1);
        }
        100% {
            opacity: 0;
            transform: translateY(-50px) scale(1.5);
        }
    }

    @keyframes fadeInOut {
        0% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.5);
        }
        20% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1.2);
        }
        80% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
        }
        100% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.8);
        }
    }

    #damage-overlay.hit {
        background: radial-gradient(ellipse at center, transparent 50%, rgba(255,0,0,0.3) 100%);
        animation: damageFlash 0.3s ease-out;
    }

    #damage-overlay.kill {
        background: radial-gradient(ellipse at center, transparent 50%, rgba(0,255,0,0.3) 100%);
        animation: killFlash 0.5s ease-out;
    }

    #damage-overlay.death {
        background: rgba(0,0,0,0.8);
    }
`;
document.head.appendChild(style);

window.DamageDisplay = DamageDisplay;
