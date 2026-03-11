// c4.js - C4爆破模式 (Counter-Strike 风格)
class C4System {
    constructor() {
        this.isPlanted = false;
        this.isDefused = false;
        this.plantProgress = 0;
        this.defuseProgress = 0;
        this.plantTime = 3.2;        // 安装时间 (秒)
        this.defuseTime = 5;         // 拆弹时间 (秒)
        this.defuseTimeWithKit = 2.5; // 带拆弹器时间
        this.explodeTime = 40;       // 爆炸倒计时 (秒)
        this.plantPosition = null;
        this.plantedAt = 0;
        this.hasDefuseKit = false;
        this.beepInterval = null;
    }

    // 安装 C4
    plant(position, hasKit = false) {
        if (this.isPlanted) return { success: false, reason: 'already_planted' };

        this.isPlanted = true;
        this.plantPosition = { ...position };
        this.plantedAt = Date.now();
        this.hasDefuseKit = hasKit;

        // 开始爆炸倒计时
        this.startBeeping();

        return {
            success: true,
            position: this.plantPosition,
            explodeIn: this.explodeTime
        };
    }

    // 拆除 C4
    defuse(hasKit = false) {
        if (!this.isPlanted) return { success: false, reason: 'not_planted' };
        if (this.isDefused) return { success: false, reason: 'already_defused' };

        const timeRemaining = this.getTimeRemaining();
        const defuseTime = hasKit ? this.defuseTimeWithKit : this.defuseTime;

        if (timeRemaining < defuseTime) {
            return { success: false, reason: 'not_enough_time' };
        }

        this.isDefused = true;
        this.stopBeeping();

        return { success: true, hasKit };
    }

    // 获取剩余时间
    getTimeRemaining() {
        if (!this.isPlanted) return 0;

        const elapsed = (Date.now() - this.plantedAt) / 1000;
        return Math.max(0, this.explodeTime - elapsed);
    }

    // 检查是否爆炸
    checkExplosion() {
        if (!this.isPlanted || this.isDefused) return false;
        return this.getTimeRemaining() <= 0;
    }

    // 开始哔哔声
    startBeeping() {
        const baseInterval = 1000; // 基础间隔

        this.beepInterval = setInterval(() => {
            const remaining = this.getTimeRemaining();
            
            // 随时间缩短间隔，增加紧张感
            const interval = Math.max(100, baseInterval * (remaining / this.explodeTime));
            
            if (this.onBeep) {
                this.onBeep(remaining);
            }

            // 最后 10 秒加快
            if (remaining <= 10 && remaining > 0) {
                clearInterval(this.beepInterval);
                this.beepInterval = setInterval(() => {
                    if (this.onBeep) {
                        this.onBeep(this.getTimeRemaining());
                    }
                }, 100);
            }
        }, baseInterval);
    }

    // 停止哔哔声
    stopBeeping() {
        if (this.beepInterval) {
            clearInterval(this.beepInterval);
            this.beepInterval = null;
        }
    }

    // 重置
    reset() {
        this.stopBeeping();
        this.isPlanted = false;
        this.isDefused = false;
        this.plantProgress = 0;
        this.defuseProgress = 0;
        this.plantPosition = null;
        this.plantedAt = 0;
    }

    // 获取状态
    getStatus() {
        return {
            isPlanted: this.isPlanted,
            isDefused: this.isDefused,
            timeRemaining: this.getTimeRemaining(),
            position: this.plantPosition,
            plantProgress: this.plantProgress,
            defuseProgress: this.defuseProgress
        };
    }
}

// C4 安装/拆除进度 UI
class C4ProgressUI {
    constructor(container, c4System) {
        this.container = container;
        this.c4System = c4System;
        this.element = null;
        this.isPlanting = false;
        this.isDefusing = false;
    }

    showPlanting() {
        this.isPlanting = true;
        this.isDefusing = false;
        this.show();
    }

    showDefusing(hasKit = false) {
        this.isPlanting = false;
        this.isDefusing = true;
        this.hasKit = hasKit;
        this.show();
    }

    show() {
        if (this.element) {
            this.element.style.display = 'block';
            return;
        }

        this.element = document.createElement('div');
        this.element.className = 'c4-progress';
        this.element.style.cssText = `
            position: absolute;
            bottom: 150px;
            left: 50%;
            transform: translateX(-50%);
            text-align: center;
            z-index: 100;
        `;

        this.container.appendChild(this.element);
    }

    update(progress) {
        if (!this.element || this.element.style.display === 'none') return;

        const isComplete = progress >= 100;
        const action = this.isPlanting ? '安装' : '拆除';
        const color = this.isPlanting ? '#f44336' : '#4CAF50';

        this.element.innerHTML = `
            <div style="
                background: rgba(0, 0, 0, 0.8);
                padding: 15px 30px;
                border-radius: 10px;
                border: 2px solid ${color};
            ">
                <div style="color: white; margin-bottom: 10px;">
                    ${isComplete ? `✅ C4 ${action}完成` : `⏳ 正在${action}C4...`}
                </div>
                <div style="
                    width: 200px;
                    height: 10px;
                    background: rgba(255, 255, 255, 0.2);
                    border-radius: 5px;
                    overflow: hidden;
                ">
                    <div style="
                        width: ${progress}%;
                        height: 100%;
                        background: ${color};
                        transition: width 0.1s;
                    "></div>
                </div>
                ${this.isDefusing && this.hasKit ? `
                    <div style="color: #4CAF50; font-size: 12px; margin-top: 5px;">
                        🔧 拆弹器加速
                    </div>
                ` : ''}
            </div>
        `;
    }

    hide() {
        if (this.element) {
            this.element.style.display = 'none';
        }
        this.isPlanting = false;
        this.isDefusing = false;
    }
}

// C4 爆炸倒计时 UI
class C4TimerUI {
    constructor(container, c4System) {
        this.container = container;
        this.c4System = c4System;
        this.element = null;
        this.updateInterval = null;
    }

    show() {
        if (this.element) {
            this.element.style.display = 'block';
            this.startUpdate();
            return;
        }

        this.element = document.createElement('div');
        this.element.className = 'c4-timer';
        this.element.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            text-align: center;
            z-index: 150;
            pointer-events: none;
        `;

        this.container.appendChild(this.element);
        this.startUpdate();
    }

    startUpdate() {
        if (this.updateInterval) return;

        this.updateInterval = setInterval(() => {
            this.update();
        }, 100);
    }

    update() {
        if (!this.element || !this.c4System.isPlanted) {
            this.hide();
            return;
        }

        const remaining = this.c4System.getTimeRemaining();
        const isCritical = remaining <= 10;

        // 计算脉冲效果
        const pulseScale = isCritical ? 1 + Math.sin(Date.now() / 100) * 0.1 : 1;

        this.element.innerHTML = `
            <div style="
                background: rgba(0, 0, 0, 0.8);
                padding: 20px 40px;
                border-radius: 10px;
                border: 3px solid ${isCritical ? '#f44336' : '#ffc107'};
                animation: ${isCritical ? 'c4Pulse 0.5s infinite' : 'none'};
            ">
                <div style="font-size: 60px; font-weight: bold; color: ${isCritical ? '#f44336' : '#ffc107'};">
                    💣 ${remaining.toFixed(1)}s
                </div>
                <div style="color: #888; font-size: 14px; margin-top: 10px;">
                    ${this.c4System.plantPosition 
                        ? `位置: (${this.c4System.plantPosition.x.toFixed(0)}, ${this.c4System.plantPosition.z.toFixed(0)})`
                        : ''}
                </div>
            </div>
        `;
    }

    hide() {
        if (this.element) {
            this.element.style.display = 'none';
        }
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    static addStyles() {
        if (document.getElementById('c4-styles')) return;

        const style = document.createElement('style');
        style.id = 'c4-styles';
        style.textContent = `
            @keyframes c4Pulse {
                0%, 100% { transform: translate(-50%, -50%) scale(1); }
                50% { transform: translate(-50%, -50%) scale(1.05); }
            }
        `;
        document.head.appendChild(style);
    }
}

// 爆炸区域
class ExplosionZone {
    constructor(position, radius = 10, damage = 500) {
        this.position = position;
        this.radius = radius;
        this.damage = damage;
        this.createdAt = Date.now();
        this.active = true;
    }

    // 检查玩家是否在爆炸范围内
    isInZone(playerPosition) {
        const dx = playerPosition.x - this.position.x;
        const dz = playerPosition.z - this.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        return dist <= this.radius;
    }

    // 计算伤害 (距离越近伤害越高)
    calculateDamage(playerPosition) {
        if (!this.isInZone(playerPosition)) return 0;

        const dx = playerPosition.x - this.position.x;
        const dz = playerPosition.z - this.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        // 线性衰减
        const damageMultiplier = 1 - (dist / this.radius);
        return Math.round(this.damage * damageMultiplier);
    }
}

// 炸点位置
class BombSites {
    constructor() {
        this.sites = [
            {
                id: 'A',
                name: 'A点',
                position: { x: -30, z: -30 },
                radius: 5
            },
            {
                id: 'B',
                name: 'B点',
                position: { x: 30, z: 30 },
                radius: 5
            }
        ];
    }

    // 检查是否在炸点内
    isInSite(position) {
        for (const site of this.sites) {
            const dx = position.x - site.position.x;
            const dz = position.z - site.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist <= site.radius) {
                return site;
            }
        }
        return null;
    }

    // 获取最近的炸点
    getNearestSite(position) {
        let nearest = null;
        let minDist = Infinity;

        for (const site of this.sites) {
            const dx = position.x - site.position.x;
            const dz = position.z - site.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist < minDist) {
                minDist = dist;
                nearest = site;
            }
        }

        return { site: nearest, distance: minDist };
    }

    // 获取所有炸点
    getAllSites() {
        return this.sites;
    }
}

// 初始化样式
C4TimerUI.addStyles();

window.C4System = C4System;
window.C4ProgressUI = C4ProgressUI;
window.C4TimerUI = C4TimerUI;
window.ExplosionZone = ExplosionZone;
window.BombSites = BombSites;
