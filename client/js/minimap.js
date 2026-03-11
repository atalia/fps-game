// minimap.js - 小地图系统
class Minimap {
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            size: options.size || 180,
            range: options.range || 100,
            updateInterval: options.updateInterval || 50,
            ...options
        };

        this.element = null;
        this.canvas = null;
        this.ctx = null;
        this.players = [];
        this.localPlayer = null;
        this.obstacles = [];
        this.powerups = [];
    }

    init() {
        this.element = document.createElement('div');
        this.element.className = 'minimap';
        this.element.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            width: ${this.options.size}px;
            height: ${this.options.size}px;
            background: rgba(0, 0, 0, 0.7);
            border: 2px solid rgba(255, 255, 255, 0.3);
            border-radius: 10px;
            overflow: hidden;
            z-index: 100;
        `;

        this.canvas = document.createElement('canvas');
        this.canvas.width = this.options.size;
        this.canvas.height = this.options.size;
        this.element.appendChild(this.canvas);

        this.ctx = this.canvas.getContext('2d');
        this.container.appendChild(this.element);
    }

    setLocalPlayer(player) {
        this.localPlayer = player;
    }

    setPlayers(players) {
        this.players = players;
    }

    setObstacles(obstacles) {
        this.obstacles = obstacles;
    }

    setPowerups(powerups) {
        this.powerups = powerups;
    }

    update() {
        if (!this.ctx) return;

        const ctx = this.ctx;
        const size = this.options.size;
        const range = this.options.range;

        // 清空画布
        ctx.fillStyle = 'rgba(0, 20, 0, 0.8)';
        ctx.fillRect(0, 0, size, size);

        // 计算中心点（本地玩家位置）
        const centerX = size / 2;
        const centerY = size / 2;

        let offsetX = 0;
        let offsetZ = 0;

        if (this.localPlayer) {
            offsetX = this.localPlayer.position.x;
            offsetZ = this.localPlayer.position.z;
        }

        // 绘制网格
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 0.5;
        const gridSize = size / 4;
        for (let i = 0; i <= 4; i++) {
            ctx.beginPath();
            ctx.moveTo(i * gridSize, 0);
            ctx.lineTo(i * gridSize, size);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, i * gridSize);
            ctx.lineTo(size, i * gridSize);
            ctx.stroke();
        }

        // 绘制障碍物
        ctx.fillStyle = 'rgba(100, 100, 100, 0.6)';
        for (const obs of this.obstacles) {
            const x = centerX + ((obs.x - offsetX) / range) * (size / 2);
            const y = centerY + ((obs.z - offsetZ) / range) * (size / 2);
            const w = (obs.w / range) * (size / 2);
            const h = (obs.d / range) * (size / 2);

            ctx.fillRect(x - w / 2, y - h / 2, w, h);
        }

        // 绘制道具
        for (const powerup of this.powerups) {
            if (!powerup.active) continue;

            const x = centerX + ((powerup.position.x - offsetX) / range) * (size / 2);
            const y = centerY + ((powerup.position.z - offsetZ) / range) * (size / 2);

            if (x < 0 || x > size || y < 0 || y > size) continue;

            ctx.fillStyle = this.getPowerupColor(powerup.type);
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fill();
        }

        // 绘制玩家
        for (const player of this.players) {
            if (!player.alive) continue;

            const x = centerX + ((player.position.x - offsetX) / range) * (size / 2);
            const y = centerY + ((player.position.z - offsetZ) / range) * (size / 2);

            if (x < 0 || x > size || y < 0 || y > size) continue;

            // 绘制玩家
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(player.rotation || 0);

            // 本地玩家
            if (this.localPlayer && player.id === this.localPlayer.id) {
                ctx.fillStyle = '#4CAF50';
                ctx.beginPath();
                ctx.moveTo(0, -6);
                ctx.lineTo(-4, 4);
                ctx.lineTo(4, 4);
                ctx.closePath();
                ctx.fill();
            } else {
                // 其他玩家
                const team = player.team || 'enemy';
                ctx.fillStyle = team === 'red' ? '#f44336' : 
                               team === 'blue' ? '#2196F3' : '#f44336';
                ctx.beginPath();
                ctx.arc(0, 0, 4, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();
        }

        // 绘制视野范围
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(centerX, centerY, size / 2 - 5, 0, Math.PI * 2);
        ctx.stroke();

        // 绘制方向指示器
        if (this.localPlayer) {
            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.rotate(this.localPlayer.rotation || 0);

            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.beginPath();
            ctx.moveTo(0, -size / 2 + 10);
            ctx.lineTo(-4, -size / 2 + 18);
            ctx.lineTo(4, -size / 2 + 18);
            ctx.closePath();
            ctx.fill();

            ctx.restore();
        }
    }

    getPowerupColor(type) {
        const colors = {
            'health': '#00ff00',
            'ammo': '#ffff00',
            'speed': '#00ffff',
            'damage': '#ff0000',
            'shield': '#0088ff'
        };
        return colors[type] || '#ffffff';
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

    resize(size) {
        this.options.size = size;
        if (this.element) {
            this.element.style.width = `${size}px`;
            this.element.style.height = `${size}px`;
        }
        if (this.canvas) {
            this.canvas.width = size;
            this.canvas.height = size;
        }
    }
}

// 放大小地图
class MinimapZoom {
    constructor(minimap) {
        this.minimap = minimap;
        this.expanded = false;
        this.originalSize = minimap.options.size;
        this.expandedSize = 400;
        this.element = null;
    }

    toggle() {
        this.expanded = !this.expanded;
        
        if (this.expanded) {
            this.minimap.resize(this.expandedSize);
            this.minimap.element.style.zIndex = '200';
        } else {
            this.minimap.resize(this.originalSize);
            this.minimap.element.style.zIndex = '100';
        }
    }

    isExpanded() {
        return this.expanded;
    }
}

window.Minimap = Minimap;
window.MinimapZoom = MinimapZoom;
