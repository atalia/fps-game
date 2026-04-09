// spectator.js - 观战模式
class SpectatorMode {
    constructor(camera, players, selfPlayerId = null) {
        this.camera = camera;
        this.players = players; // 玩家列表引用
        this.selfPlayerId = selfPlayerId;
        this.active = false;
        this.currentTarget = null;
        this.targetIndex = -1;
        this.mode = 'free'; // 'free' | 'follow' | 'firstperson'
        this.moveSpeed = 10;
        this.keys = {};
    }

    setSelfPlayerId(playerId) {
        this.selfPlayerId = playerId;
    }

    getSelfPlayerId() {
        return typeof this.selfPlayerId === 'function'
            ? this.selfPlayerId()
            : this.selfPlayerId;
    }

    getPlayerList() {
        if (this.players instanceof Map) {
            return Array.from(this.players.values());
        }
        return Object.values(this.players || {});
    }

    getAliveTargets() {
        const selfPlayerId = this.getSelfPlayerId();
        return this.getPlayerList().filter((player) => {
            if (!player || player.id === selfPlayerId) {
                return false;
            }
            if (player.alive === false) {
                return false;
            }
            const health = Number(player.health);
            return Number.isNaN(health) || health > 0;
        });
    }

    syncCurrentTarget() {
        const targets = this.getAliveTargets();
        if (targets.length === 0) {
            this.currentTarget = null;
            this.targetIndex = -1;
            this.mode = 'free';
            return targets;
        }

        if (this.currentTarget) {
            const nextIndex = targets.findIndex(
                (player) => player.id === this.currentTarget.id,
            );
            if (nextIndex >= 0) {
                this.targetIndex = nextIndex;
                this.currentTarget = targets[nextIndex];
                return targets;
            }
        }

        if (this.targetIndex < 0 || this.targetIndex >= targets.length) {
            this.targetIndex = 0;
        }
        this.currentTarget = targets[this.targetIndex];
        return targets;
    }

    // 开启观战
    start() {
        this.active = true;
        this.mode = 'follow';
        
        // 选择第一个玩家跟随
        this.targetIndex = -1;
        this.selectNextTarget();
    }

    // 关闭观战
    stop() {
        this.active = false;
        this.currentTarget = null;
        this.targetIndex = -1;
        this.mode = 'free';
        this.keys = {};
    }

    // 选择下一个目标
    selectNextTarget() {
        const playerList = this.getAliveTargets();
        
        if (playerList.length === 0) {
            this.currentTarget = null;
            this.targetIndex = -1;
            this.mode = 'free';
            return;
        }

        if (this.currentTarget) {
            const currentIndex = playerList.findIndex(
                (player) => player.id === this.currentTarget.id,
            );
            this.targetIndex = currentIndex >= 0 ? currentIndex : this.targetIndex;
        }

        this.targetIndex = (this.targetIndex + 1 + playerList.length) % playerList.length;
        this.currentTarget = playerList[this.targetIndex];
    }

    // 选择上一个目标
    selectPrevTarget() {
        const playerList = this.getAliveTargets();
        
        if (playerList.length === 0) {
            this.currentTarget = null;
            this.targetIndex = -1;
            this.mode = 'free';
            return;
        }

        if (this.currentTarget) {
            const currentIndex = playerList.findIndex(
                (player) => player.id === this.currentTarget.id,
            );
            this.targetIndex = currentIndex >= 0 ? currentIndex : this.targetIndex;
        }

        this.targetIndex = (this.targetIndex - 1 + playerList.length) % playerList.length;
        this.currentTarget = playerList[this.targetIndex];
    }

    // 切换模式
    toggleMode() {
        const modes = ['free', 'follow', 'firstperson'];
        const currentIndex = modes.indexOf(this.mode);
        this.mode = modes[(currentIndex + 1) % modes.length];
        
        if (this.mode !== 'free' && !this.currentTarget) {
            this.selectNextTarget();
        }
    }

    // 设置按键
    setKey(key, pressed) {
        this.keys[key] = pressed;
    }

    // 更新
    update(dt) {
        if (!this.active) return;
        this.syncCurrentTarget();

        switch (this.mode) {
            case 'free':
                this.updateFreeCam(dt);
                break;
            case 'follow':
                this.updateFollowCam(dt);
                break;
            case 'firstperson':
                this.updateFirstPersonCam(dt);
                break;
        }
    }

    // 自由视角
    updateFreeCam(dt) {
        const move = this.moveSpeed * dt;

        // WASD 移动
        if (this.keys['w'] || this.keys['arrowup']) {
            this.camera.position.z -= move;
        }
        if (this.keys['s'] || this.keys['arrowdown']) {
            this.camera.position.z += move;
        }
        if (this.keys['a'] || this.keys['arrowleft']) {
            this.camera.position.x -= move;
        }
        if (this.keys['d'] || this.keys['arrowright']) {
            this.camera.position.x += move;
        }
        if (this.keys['r']) {
            this.camera.position.y += move;
        }
        if (this.keys['f'] || this.keys['shift']) {
            this.camera.position.y -= move;
        }
    }

    // 跟随视角
    updateFollowCam(dt) {
        if (!this.currentTarget) return;

        const target = this.currentTarget;
        const offset = { x: 0, y: 5, z: 10 };

        // 平滑跟随
        this.camera.position.x += (target.position.x + offset.x - this.camera.position.x) * 0.1;
        this.camera.position.y += (target.position.y + offset.y - this.camera.position.y) * 0.1;
        this.camera.position.z += (target.position.z + offset.z - this.camera.position.z) * 0.1;

        // 看向目标
        this.camera.lookAt(target.position.x, target.position.y + 1, target.position.z);
    }

    // 第一人称视角
    updateFirstPersonCam(dt) {
        if (!this.currentTarget) return;

        const target = this.currentTarget;

        // 放置在玩家眼睛位置
        this.camera.position.set(
            target.position.x,
            target.position.y + 1.7,
            target.position.z
        );

        // 使用玩家旋转
        this.camera.rotation.y = target.rotation || 0;
    }

    // 获取 UI 信息
    getUIInfo() {
        return {
            active: this.active,
            mode: this.mode,
            modeName: this.getModeName(),
            targetName: this.currentTarget ? this.currentTarget.name : null
        };
    }

    getModeName() {
        const names = {
            'free': '自由视角',
            'follow': '跟随视角',
            'firstperson': '第一人称'
        };
        return names[this.mode] || this.mode;
    }
}

// 观战 UI
class SpectatorUI {
    constructor(container) {
        this.container = container;
        this.element = null;
    }

    show(info) {
        if (!this.element) {
            this.element = document.createElement('div');
            this.element.className = 'spectator-ui';
            this.element.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(0, 0, 0, 0.7);
                color: white;
                padding: 20px;
                border-radius: 10px;
                text-align: center;
                z-index: 100;
            `;
            this.container.appendChild(this.element);
        }

        this.element.innerHTML = `
            <h2 style="margin: 0 0 15px 0; color: #ff4444;">💀 你已死亡</h2>
            <p style="margin: 5px 0;">模式: ${info.modeName}</p>
            ${info.targetName ? `<p style="margin: 5px 0;">观看: ${info.targetName}</p>` : ''}
            <p style="margin: 15px 0 0 0; font-size: 14px; color: #888;">
                [空格] 下一个目标 | [Q] 上一个 | [E] 切换模式 | [R/F] 升降
            </p>
        `;

        this.element.style.display = 'block';
    }

    hide() {
        if (this.element) {
            this.element.style.display = 'none';
        }
    }

    update(info) {
        if (info.active) {
            this.show(info);
        } else {
            this.hide();
        }
    }
}

window.SpectatorMode = SpectatorMode;
window.SpectatorUI = SpectatorUI;
