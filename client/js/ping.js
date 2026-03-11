// ping.js - 标记系统 (Apex Legends 风格)
class PingSystem {
    constructor(scene) {
        this.scene = scene;
        this.pings = [];
        this.pingDuration = 5000; // 5秒
        this.maxPings = 10;
    }

    // 创建标记
    createPing(position, type, playerId, playerName) {
        const ping = {
            id: Date.now().toString(),
            position: { ...position },
            type: type,
            playerId: playerId,
            playerName: playerName,
            createdAt: Date.now(),
            expireAt: Date.now() + this.pingDuration
        };

        this.pings.push(ping);

        // 限制标记数量
        if (this.pings.length > this.maxPings) {
            this.pings.shift();
        }

        return ping;
    }

    // 标记敌人位置
    pingEnemy(position, playerId, playerName) {
        return this.createPing(position, 'enemy', playerId, playerName);
    }

    // 标记道具
    pingItem(position, itemType, playerId, playerName) {
        return this.createPing(position, 'item', playerId, playerName);
    }

    // 标记目的地
    pingGo(position, playerId, playerName) {
        return this.createPing(position, 'go', playerId, playerName);
    }

    // 标记危险区域
    pingDanger(position, playerId, playerName) {
        return this.createPing(position, 'danger', playerId, playerName);
    }

    // 标记防守位置
    pingDefend(position, playerId, playerName) {
        return this.createPing(position, 'defend', playerId, playerName);
    }

    // 标记需要帮助
    pingHelp(position, playerId, playerName) {
        return this.createPing(position, 'help', playerId, playerName);
    }

    // 更新标记
    update() {
        const now = Date.now();
        this.pings = this.pings.filter(ping => ping.expireAt > now);
    }

    // 获取所有标记
    getPings() {
        return this.pings;
    }

    // 获取附近标记
    getNearbyPings(position, radius = 20) {
        return this.pings.filter(ping => {
            const dx = ping.position.x - position.x;
            const dz = ping.position.z - position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            return dist <= radius;
        });
    }

    // 清除玩家标记
    clearPlayerPings(playerId) {
        this.pings = this.pings.filter(ping => ping.playerId !== playerId);
    }

    // 清除所有标记
    clearAll() {
        this.pings = [];
    }
}

// 标记 UI
class PingUI {
    constructor(container, pingSystem) {
        this.container = container;
        this.pingSystem = pingSystem;
        this.element = null;
        this.pingElements = new Map();
        this.camera = null;
    }

    setCamera(camera) {
        this.camera = camera;
    }

    show() {
        if (this.element) return;

        this.element = document.createElement('div');
        this.element.className = 'ping-ui';
        this.element.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            pointer-events: none;
            z-index: 50;
        `;

        this.container.appendChild(this.element);
    }

    update() {
        if (!this.element || !this.camera) return;

        this.pingSystem.update();
        const pings = this.pingSystem.getPings();

        // 移除过期标记
        for (const [id, el] of this.pingElements) {
            if (!pings.find(p => p.id === id)) {
                el.remove();
                this.pingElements.delete(id);
            }
        }

        // 更新/添加标记
        for (const ping of pings) {
            this.renderPing(ping);
        }
    }

    renderPing(ping) {
        // 将3D位置转换为屏幕坐标
        const screenPos = this.worldToScreen(ping.position);
        if (!screenPos) return;

        let element = this.pingElements.get(ping.id);

        if (!element) {
            element = document.createElement('div');
            element.className = 'ping-marker';
            element.style.cssText = `
                position: absolute;
                transform: translate(-50%, -50%);
                pointer-events: none;
            `;

            this.element.appendChild(element);
            this.pingElements.set(ping.id, element);
        }

        // 更新位置和内容
        element.style.left = `${screenPos.x}px`;
        element.style.top = `${screenPos.y}px`;

        const remaining = Math.max(0, ping.expireAt - Date.now());
        const opacity = Math.min(1, remaining / 2000);

        element.style.opacity = opacity;
        element.innerHTML = this.getPingContent(ping);
    }

    worldToScreen(position) {
        // 简化的屏幕投影
        // 实际项目中应该使用 Three.js 的投影
        return {
            x: (position.x + 50) * 8,
            y: (50 - position.z) * 5
        };
    }

    getPingContent(ping) {
        const icons = {
            enemy: '🔴',
            item: '📦',
            go: '➡️',
            danger: '⚠️',
            defend: '🛡️',
            help: '❗'
        };

        const colors = {
            enemy: '#ff4444',
            item: '#4CAF50',
            go: '#2196F3',
            danger: '#ff9800',
            defend: '#9c27b0',
            help: '#f44336'
        };

        const labels = {
            enemy: '敌人',
            item: '道具',
            go: '前进',
            danger: '危险',
            defend: '防守',
            help: '求助'
        };

        const icon = icons[ping.type] || '📍';
        const color = colors[ping.type] || '#ffffff';
        const label = labels[ping.type] || '';

        return `
            <div style="
                background: rgba(0, 0, 0, 0.7);
                border: 2px solid ${color};
                border-radius: 50%;
                width: 40px;
                height: 40px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 20px;
                animation: pingPulse 1s infinite;
            ">${icon}</div>
            <div style="
                position: absolute;
                top: 45px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(0, 0, 0, 0.8);
                color: ${color};
                padding: 3px 8px;
                border-radius: 3px;
                font-size: 12px;
                white-space: nowrap;
            ">
                ${label} (${ping.playerName})
            </div>
        `;
    }

    hide() {
        if (this.element) {
            this.element.remove();
            this.element = null;
        }
    }

    static addStyles() {
        if (document.getElementById('ping-styles')) return;

        const style = document.createElement('style');
        style.id = 'ping-styles';
        style.textContent = `
            @keyframes pingPulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.2); }
            }
        `;
        document.head.appendChild(style);
    }
}

// 标记菜单 (轮盘式)
class PingWheel {
    constructor(container) {
        this.container = container;
        this.element = null;
        this.isOpen = false;
        this.onSelect = null;
    }

    show(mousePosition) {
        if (this.element) {
            this.element.style.display = 'block';
            return;
        }

        this.element = document.createElement('div');
        this.element.className = 'ping-wheel';
        this.element.style.cssText = `
            position: absolute;
            left: ${mousePosition?.x || 400}px;
            top: ${mousePosition?.y || 300}px;
            transform: translate(-50%, -50%);
            z-index: 200;
        `;

        this.render();
        this.container.appendChild(this.element);
        this.isOpen = true;
    }

    render() {
        const options = [
            { type: 'enemy', icon: '🔴', label: '敌人', angle: 0 },
            { type: 'go', icon: '➡️', label: '前进', angle: 60 },
            { type: 'defend', icon: '🛡️', label: '防守', angle: 120 },
            { type: 'help', icon: '❗', label: '求助', angle: 180 },
            { type: 'danger', icon: '⚠️', label: '危险', angle: 240 },
            { type: 'item', icon: '📦', label: '道具', angle: 300 }
        ];

        const radius = 80;

        this.element.innerHTML = `
            <div style="position: relative; width: 200px; height: 200px;">
                <div style="
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    width: 60px;
                    height: 60px;
                    background: rgba(0, 0, 0, 0.8);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-size: 12px;
                ">标记</div>
                ${options.map(opt => {
                    const rad = (opt.angle - 90) * Math.PI / 180;
                    const x = 100 + Math.cos(rad) * radius;
                    const y = 100 + Math.sin(rad) * radius;

                    return `
                        <div class="ping-option" data-type="${opt.type}" style="
                            position: absolute;
                            left: ${x}px;
                            top: ${y}px;
                            transform: translate(-50%, -50%);
                            width: 50px;
                            height: 50px;
                            background: rgba(0, 0, 0, 0.8);
                            border: 2px solid rgba(255, 255, 255, 0.3);
                            border-radius: 50%;
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            justify-content: center;
                            cursor: pointer;
                            transition: all 0.2s;
                        " onmouseover="this.style.borderColor='#4fc3f7';this.style.transform='translate(-50%, -50%) scale(1.1)'" onmouseout="this.style.borderColor='rgba(255,255,255,0.3)';this.style.transform='translate(-50%, -50%) scale(1)'">
                            <span style="font-size: 20px;">${opt.icon}</span>
                            <span style="color: white; font-size: 10px;">${opt.label}</span>
                        </div>
                    `;
                }).join('')}
            </div>
        `;

        this.bindEvents();
    }

    bindEvents() {
        this.element.querySelectorAll('.ping-option').forEach(opt => {
            opt.addEventListener('click', (e) => {
                e.stopPropagation();
                const type = opt.dataset.type;
                if (this.onSelect) {
                    this.onSelect(type);
                }
                this.hide();
            });
        });
    }

    hide() {
        if (this.element) {
            this.element.style.display = 'none';
        }
        this.isOpen = false;
    }

    toggle(mousePosition) {
        if (this.isOpen) {
            this.hide();
        } else {
            this.show(mousePosition);
        }
    }
}

// 初始化样式
PingUI.addStyles();

window.PingSystem = PingSystem;
window.PingUI = PingUI;
window.PingWheel = PingWheel;
