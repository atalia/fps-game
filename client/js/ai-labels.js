// ai-labels.js - AI 机器人标签渲染
class AILabels {
    constructor() {
        this.botLabels = new Map();
    }

    // 难度颜色
    getDifficultyColor(difficulty) {
        const colors = {
            easy: '#00ff00',
            normal: '#ffff00',
            hard: '#ff8800',
            nightmare: '#ff0000'
        };
        return colors[difficulty] || '#ffffff';
    }

    // 难度中文名
    getDifficultyName(difficulty) {
        const names = {
            easy: '简单',
            normal: '普通',
            hard: '困难',
            nightmare: '噩梦'
        };
        return names[difficulty] || '未知';
    }

    // 创建机器人标签
    createLabel(botId, name, difficulty) {
        // 如果已存在，先移除
        this.removeLabel(botId);

        const label = document.createElement('div');
        label.className = 'ai-label';
        label.style.cssText = `
            position: fixed;
            color: ${this.getDifficultyColor(difficulty)};
            font-size: 12px;
            font-weight: bold;
            text-shadow: 1px 1px 2px black;
            pointer-events: none;
            z-index: 100;
            transform: translate(-50%, -100%);
            white-space: nowrap;
        `;
        label.innerHTML = `<span style="opacity: 0.7;">[BOT]</span> ${name}`;
        document.body.appendChild(label);

        this.botLabels.set(botId, {
            element: label,
            difficulty: difficulty,
            name: name
        });

        return label;
    }

    // 更新标签位置
    updateLabel(botId, screenPos) {
        const label = this.botLabels.get(botId);
        if (label) {
            label.element.style.left = `${screenPos.x}px`;
            label.element.style.top = `${screenPos.y - 60}px`;
        }
    }

    // 更新所有标签 (在游戏循环中调用)
    updateAll(camera) {
        if (!camera) return;

        this.botLabels.forEach((label, botId) => {
            // 需要从 game.players 获取位置
            const player = window.game?.players?.get(botId);
            if (player && player.position) {
                const screenPos = this.worldToScreen(player.position, camera);
                
                // 检查是否在屏幕内
                if (screenPos.z > 1) {
                    // 在相机背后
                    label.element.style.display = 'none';
                } else {
                    label.element.style.display = 'block';
                    label.element.style.left = `${screenPos.x}px`;
                    label.element.style.top = `${screenPos.y - 60}px`;
                }
            }
        });
    }

    // 世界坐标转屏幕坐标
    worldToScreen(position, camera) {
        const vector = new THREE.Vector3(position.x, position.y + 1.5, position.z);
        vector.project(camera);

        return {
            x: (vector.x + 1) / 2 * window.innerWidth,
            y: -(vector.y - 1) / 2 * window.innerHeight,
            z: vector.z
        };
    }

    // 移除标签
    removeLabel(botId) {
        const label = this.botLabels.get(botId);
        if (label) {
            label.element.remove();
            this.botLabels.delete(botId);
        }
    }

    // 移除所有标签
    removeAll() {
        this.botLabels.forEach((label) => {
            label.element.remove();
        });
        this.botLabels.clear();
    }

    // 获取所有机器人信息
    getAllBots() {
        const bots = [];
        this.botLabels.forEach((label, botId) => {
            bots.push({
                id: botId,
                name: label.name,
                difficulty: label.difficulty
            });
        });
        return bots;
    }
}

window.AILabels = AILabels;
