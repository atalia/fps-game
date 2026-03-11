// notifications.js - 游戏内通知系统
class NotificationSystem {
    constructor(container) {
        this.container = container;
        this.notifications = [];
        this.maxNotifications = 5;
        this.element = null;
    }

    init() {
        this.element = document.createElement('div');
        this.element.className = 'notification-container';
        this.element.style.cssText = `
            position: absolute;
            top: 80px;
            right: 20px;
            width: 300px;
            z-index: 200;
        `;
        this.container.appendChild(this.element);
    }

    // 显示通知
    show(options) {
        const notification = {
            id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: options.type || 'info',
            title: options.title || '',
            message: options.message || '',
            icon: options.icon || this.getDefaultIcon(options.type),
            duration: options.duration || 5000,
            progress: options.progress || false,
            progressValue: 0,
            timestamp: Date.now()
        };

        this.notifications.push(notification);

        // 限制数量
        while (this.notifications.length > this.maxNotifications) {
            this.notifications.shift();
        }

        this.render();

        // 自动移除
        if (notification.duration > 0) {
            setTimeout(() => {
                this.remove(notification.id);
            }, notification.duration);
        }

        return notification.id;
    }

    remove(id) {
        this.notifications = this.notifications.filter(n => n.id !== id);
        this.render();
    }

    clear() {
        this.notifications = [];
        this.render();
    }

    getDefaultIcon(type) {
        const icons = {
            'info': 'ℹ️',
            'success': '✅',
            'warning': '⚠️',
            'error': '❌',
            'achievement': '🏆',
            'kill': '💀',
            'death': '☠️',
            'levelup': '⬆️',
            'item': '📦',
            'skill': '⚡'
        };
        return icons[type] || '📢';
    }

    updateProgress(id, value) {
        const notification = this.notifications.find(n => n.id === id);
        if (notification) {
            notification.progressValue = value;
            this.render();
        }
    }

    render() {
        if (!this.element) return;

        const typeColors = {
            'info': { bg: 'rgba(33, 150, 243, 0.9)', border: '#2196F3' },
            'success': { bg: 'rgba(76, 175, 80, 0.9)', border: '#4CAF50' },
            'warning': { bg: 'rgba(255, 152, 0, 0.9)', border: '#FF9800' },
            'error': { bg: 'rgba(244, 67, 54, 0.9)', border: '#f44336' },
            'achievement': { bg: 'rgba(156, 39, 176, 0.9)', border: '#9C27B0' },
            'kill': { bg: 'rgba(244, 67, 54, 0.9)', border: '#f44336' },
            'death': { bg: 'rgba(66, 66, 66, 0.9)', border: '#424242' },
            'levelup': { bg: 'rgba(255, 193, 7, 0.9)', border: '#FFC107' },
            'item': { bg: 'rgba(0, 150, 136, 0.9)', border: '#009688' },
            'skill': { bg: 'rgba(103, 58, 183, 0.9)', border: '#673AB7' }
        };

        this.element.innerHTML = this.notifications.map(notif => {
            const colors = typeColors[notif.type] || typeColors['info'];
            return `
                <div class="notification" data-id="${notif.id}" style="
                    background: ${colors.bg};
                    border-left: 4px solid ${colors.border};
                    border-radius: 8px;
                    padding: 12px 15px;
                    margin-bottom: 10px;
                    color: white;
                    animation: slideInRight 0.3s ease-out;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
                ">
                    <div style="display: flex; align-items: flex-start; gap: 10px;">
                        <span style="font-size: 24px;">${notif.icon}</span>
                        <div style="flex: 1;">
                            ${notif.title ? `<div style="font-weight: bold; margin-bottom: 5px;">${notif.title}</div>` : ''}
                            <div style="font-size: 14px;">${notif.message}</div>
                            ${notif.progress ? `
                                <div style="
                                    width: 100%;
                                    height: 4px;
                                    background: rgba(255, 255, 255, 0.3);
                                    border-radius: 2px;
                                    margin-top: 8px;
                                ">
                                    <div style="
                                        width: ${notif.progressValue}%;
                                        height: 100%;
                                        background: white;
                                        border-radius: 2px;
                                        transition: width 0.2s;
                                    "></div>
                                </div>
                            ` : ''}
                        </div>
                        <button onclick="window.notifications.remove('${notif.id}')" style="
                            background: none;
                            border: none;
                            color: rgba(255, 255, 255, 0.7);
                            cursor: pointer;
                            font-size: 16px;
                        ">✕</button>
                    </div>
                </div>
            `;
        }).join('');

        // 添加动画样式
        if (!document.getElementById('notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                @keyframes slideInRight {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }

    // 便捷方法
    info(message, title = '') {
        return this.show({ type: 'info', message, title });
    }

    success(message, title = '') {
        return this.show({ type: 'success', message, title });
    }

    warning(message, title = '') {
        return this.show({ type: 'warning', message, title });
    }

    error(message, title = '') {
        return this.show({ type: 'error', message, title });
    }

    achievement(message, title = '成就解锁!') {
        return this.show({ 
            type: 'achievement', 
            message, 
            title, 
            duration: 8000 
        });
    }

    kill(playerName, weapon) {
        return this.show({
            type: 'kill',
            title: '击杀',
            message: `你消灭了 ${playerName} [${weapon}]`,
            duration: 3000
        });
    }

    death(killerName, weapon) {
        return this.show({
            type: 'death',
            title: '死亡',
            message: `被 ${killerName} 消灭 [${weapon}]`,
            duration: 3000
        });
    }

    levelUp(newLevel) {
        return this.show({
            type: 'levelup',
            title: '升级!',
            message: `你已达到等级 ${newLevel}`,
            icon: '🎉',
            duration: 5000
        });
    }

    itemPickup(itemName) {
        return this.show({
            type: 'item',
            message: `获得 ${itemName}`,
            duration: 2000
        });
    }

    skillReady(skillName) {
        return this.show({
            type: 'skill',
            message: `${skillName} 已就绪`,
            duration: 2000
        });
    }
}

// Toast 消息 (短暂提示)
class Toast {
    constructor(container) {
        this.container = container;
        this.element = null;
    }

    show(message, duration = 2000) {
        if (!this.element) {
            this.element = document.createElement('div');
            this.element.style.cssText = `
                position: absolute;
                bottom: 150px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 10px 20px;
                border-radius: 20px;
                font-size: 14px;
                z-index: 250;
                transition: opacity 0.3s;
            `;
            this.container.appendChild(this.element);
        }

        this.element.textContent = message;
        this.element.style.opacity = '1';

        setTimeout(() => {
            this.element.style.opacity = '0';
        }, duration);
    }
}

window.NotificationSystem = NotificationSystem;
window.Toast = Toast;
