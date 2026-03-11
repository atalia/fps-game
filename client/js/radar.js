// radar.js - 雷达系统 (显示周围敌人和事件)
class RadarSystem {
    constructor(container) {
        this.container = container;
        this.element = null;
        this.canvas = null;
        this.ctx = null;
        this.size = 200;
        this.range = 50;
        this.pings = [];
        this.localPlayer = null;
        this.enemies = [];
    }

    init() {
        this.element = document.createElement('div');
        this.element.className = 'radar';
        this.element.style.cssText = `
            position: absolute;
            top: 10px;
            left: 10px;
            width: ${this.size}px;
            height: ${this.size}px;
            background: rgba(0, 50, 0, 0.6);
            border: 2px solid rgba(0, 255, 0, 0.3);
            border-radius: 50%;
            overflow: hidden;
            z-index: 100;
        `;

        this.canvas = document.createElement('canvas');
        this.canvas.width = this.size;
        this.canvas.height = this.size;
        this.canvas.style.borderRadius = '50%';
        this.element.appendChild(this.canvas);

        this.ctx = this.canvas.getContext('2d');
        this.container.appendChild(this.element);
    }

    setLocalPlayer(player) {
        this.localPlayer = player;
    }

    setEnemies(enemies) {
        this.enemies = enemies;
    }

    // 添加雷达脉冲 (射击声音等)
    addPing(position, type = 'gunfire') {
        this.pings.push({
            x: position.x,
            z: position.z,
            type,
            time: Date.now(),
            duration: 3000
        });
    }

    update() {
        if (!this.ctx || !this.localPlayer) return;

        const ctx = this.ctx;
        const centerX = this.size / 2;
        const centerY = this.size / 2;

        // 清空
        ctx.clearRect(0, 0, this.size, this.size);

        // 背景
        ctx.fillStyle = 'rgba(0, 30, 0, 0.8)';
        ctx.beginPath();
        ctx.arc(centerX, centerY, this.size / 2 - 5, 0, Math.PI * 2);
        ctx.fill();

        // 扫描线动画
        const scanAngle = (Date.now() / 1000) % (Math.PI * 2);
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(
            centerX + Math.cos(scanAngle) * (this.size / 2 - 5),
            centerY + Math.sin(scanAngle) * (this.size / 2 - 5)
        );
        ctx.stroke();

        // 绘制脉冲
        const now = Date.now();
        this.pings = this.pings.filter(ping => {
            const age = now - ping.time;
            if (age > ping.duration) return false;

            const dx = ping.x - this.localPlayer.position.x;
            const dz = ping.z - this.localPlayer.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist > this.range) return true;

            const x = centerX + (dx / this.range) * (this.size / 2 - 10);
            const y = centerY + (dz / this.range) * (this.size / 2 - 10);

            const opacity = 1 - (age / ping.duration);
            const radius = (age / ping.duration) * 30;

            ctx.strokeStyle = `rgba(255, 0, 0, ${opacity})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.stroke();

            return true;
        });

        // 绘制敌人
        for (const enemy of this.enemies) {
            if (!enemy.alive) continue;

            const dx = enemy.position.x - this.localPlayer.position.x;
            const dz = enemy.position.z - this.localPlayer.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist > this.range) continue;

            const x = centerX + (dx / this.range) * (this.size / 2 - 10);
            const y = centerY + (dz / this.range) * (this.size / 2 - 10);

            // 敌人点
            ctx.fillStyle = enemy.isInView ? '#ff4444' : '#ff8800';
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fill();

            // 方向指示
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(enemy.rotation || 0);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.beginPath();
            ctx.moveTo(0, -6);
            ctx.lineTo(-3, 0);
            ctx.lineTo(3, 0);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }

        // 中心点（自己）
        ctx.fillStyle = '#00ff00';
        ctx.beginPath();
        ctx.arc(centerX, centerY, 5, 0, Math.PI * 2);
        ctx.fill();

        // 视野锥
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(this.localPlayer.rotation || 0);

        const fovAngle = Math.PI / 3; // 60度视野
        ctx.fillStyle = 'rgba(0, 255, 0, 0.1)';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, 40, -fovAngle, fovAngle);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // 距离圈
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(centerX, centerY, this.size / 4, 0, Math.PI * 2);
        ctx.stroke();
    }

    show() {
        if (this.element) {
            this.element.style.display = 'block';
        }
    }

    hide() {
        if (this.element) {
            this.element.style.display = 'none';
        }
    }
}

window.RadarSystem = RadarSystem;
