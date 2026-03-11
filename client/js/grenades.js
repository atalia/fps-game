// grenades.js - 投掷武器系统
class GrenadeSystem {
    constructor(scene) {
        this.scene = scene;
        this.activeGrenades = [];
        this.smokeEffects = [];
        this.fireEffects = [];
    }

    // 投掷闪光弹
    throwFlashbang(position, direction, velocity) {
        const grenade = {
            id: Date.now().toString(),
            type: 'flashbang',
            position: { ...position },
            velocity: { ...velocity },
            detonateTime: Date.now() + 1500,
            active: true
        };

        this.activeGrenades.push(grenade);
        return grenade;
    }

    // 投掷烟雾弹
    throwSmoke(position, direction, velocity) {
        const grenade = {
            id: Date.now().toString(),
            type: 'smoke',
            position: { ...position },
            velocity: { ...velocity },
            detonateTime: Date.now() + 2000,
            active: true,
            smokeDuration: 18000 // 18秒
        };

        this.activeGrenades.push(grenade);
        return grenade;
    }

    // 投掷高爆手雷
    throwHE(position, direction, velocity) {
        const grenade = {
            id: Date.now().toString(),
            type: 'he',
            position: { ...position },
            velocity: { ...velocity },
            detonateTime: Date.now() + 2500,
            active: true,
            damage: 98,
            radius: 8
        };

        this.activeGrenades.push(grenade);
        return grenade;
    }

    // 投掷燃烧瓶
    throwMolotov(position, direction, velocity) {
        const grenade = {
            id: Date.now().toString(),
            type: 'molotov',
            position: { ...position },
            velocity: { ...velocity },
            detonateTime: Date.now() + 1000, // 撞击即爆
            active: true,
            fireDuration: 8000 // 8秒
        };

        this.activeGrenades.push(grenade);
        return grenade;
    }

    // 投掷诱饵弹
    throwDecoy(position, direction, velocity) {
        const grenade = {
            id: Date.now().toString(),
            type: 'decoy',
            position: { ...position },
            velocity: { ...velocity },
            detonateTime: Date.now() + 500,
            active: true,
            decoyDuration: 15000
        };

        this.activeGrenades.push(grenade);
        return grenade;
    }

    // 更新投掷物
    update(deltaTime) {
        const now = Date.now();

        for (let i = this.activeGrenades.length - 1; i >= 0; i--) {
            const grenade = this.activeGrenades[i];

            if (!grenade.active) continue;

            // 物理模拟
            this.updatePhysics(grenade, deltaTime);

            // 检查是否爆炸
            if (now >= grenade.detonateTime) {
                this.detonate(grenade);
            }

            // 检查烟雾/火焰持续时间
            if (grenade.detonated) {
                if (grenade.type === 'smoke' && now - grenade.detonateTime > grenade.smokeDuration) {
                    this.removeSmokeEffect(grenade);
                    this.activeGrenades.splice(i, 1);
                } else if (grenade.type === 'molotov' && now - grenade.detonateTime > grenade.fireDuration) {
                    this.removeFireEffect(grenade);
                    this.activeGrenades.splice(i, 1);
                } else if (grenade.type === 'decoy' && now - grenade.detonateTime > grenade.decoyDuration) {
                    this.activeGrenades.splice(i, 1);
                }
            }
        }
    }

    // 物理更新
    updatePhysics(grenade, deltaTime) {
        if (grenade.detonated) return;

        // 重力
        grenade.velocity.y -= 9.8 * deltaTime;

        // 移动
        grenade.position.x += grenade.velocity.x * deltaTime;
        grenade.position.y += grenade.velocity.y * deltaTime;
        grenade.position.z += grenade.velocity.z * deltaTime;

        // 地面碰撞
        if (grenade.position.y < 0) {
            grenade.position.y = 0;
            grenade.velocity.y *= -0.3; // 弹跳
            grenade.velocity.x *= 0.8;  // 摩擦
            grenade.velocity.z *= 0.8;
        }

        // 燃烧瓶撞击地面
        if (grenade.type === 'molotov' && grenade.position.y === 0 && grenade.velocity.y < 0.5) {
            grenade.detonateTime = Date.now();
        }
    }

    // 引爆
    detonate(grenade) {
        if (grenade.detonated) return;
        grenade.detonated = true;

        switch (grenade.type) {
            case 'flashbang':
                this.detonateFlashbang(grenade);
                break;
            case 'smoke':
                this.detonateSmoke(grenade);
                break;
            case 'he':
                this.detonateHE(grenade);
                break;
            case 'molotov':
                this.detonateMolotov(grenade);
                break;
            case 'decoy':
                this.detonateDecoy(grenade);
                break;
        }
    }

    // 闪光弹爆炸
    detonateFlashbang(grenade) {
        const effect = {
            position: grenade.position,
            radius: 15,
            duration: 2000 + Math.random() * 1000,
            startTime: Date.now()
        };

        // 检查玩家是否看向闪光弹
        if (this.onFlashEffect) {
            this.onFlashEffect(effect);
        }
    }

    // 烟雾弹爆炸
    detonateSmoke(grenade) {
        const smoke = {
            position: { ...grenade.position },
            radius: 6,
            startTime: Date.now()
        };

        this.smokeEffects.push(smoke);

        if (this.onSmokeEffect) {
            this.onSmokeEffect(smoke);
        }
    }

    // 高爆手雷爆炸
    detonateHE(grenade) {
        const explosion = {
            position: grenade.position,
            damage: grenade.damage,
            radius: grenade.radius
        };

        if (this.onExplosion) {
            this.onExplosion(explosion);
        }
    }

    // 燃烧瓶爆炸
    detonateMolotov(grenade) {
        const fire = {
            position: { ...grenade.position },
            radius: 4,
            damage: 40, // 每秒
            startTime: Date.now()
        };

        this.fireEffects.push(fire);

        if (this.onFireEffect) {
            this.onFireEffect(fire);
        }
    }

    // 诱饵弹
    detonateDecoy(grenade) {
        // 模拟射击声音
        if (this.onDecoyEffect) {
            this.onDecoyEffect({
                position: grenade.position,
                weapon: 'ak47'
            });
        }
    }

    // 移除烟雾效果
    removeSmokeEffect(grenade) {
        const index = this.smokeEffects.findIndex(s => 
            s.position.x === grenade.position.x && s.position.z === grenade.position.z
        );
        if (index !== -1) {
            this.smokeEffects.splice(index, 1);
        }
    }

    // 移除火焰效果
    removeFireEffect(grenade) {
        const index = this.fireEffects.findIndex(f =>
            f.position.x === grenade.position.x && f.position.z === grenade.position.z
        );
        if (index !== -1) {
            this.fireEffects.splice(index, 1);
        }
    }

    // 检查烟雾遮蔽
    isSmoked(position) {
        for (const smoke of this.smokeEffects) {
            const dx = position.x - smoke.position.x;
            const dz = position.z - smoke.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist < smoke.radius) {
                return true;
            }
        }
        return false;
    }

    // 检查火焰伤害
    isInFire(position) {
        for (const fire of this.fireEffects) {
            const dx = position.x - fire.position.x;
            const dz = position.z - fire.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist < fire.radius) {
                return fire.damage;
            }
        }
        return 0;
    }

    // 获取投掷物携带量
    static getMaxCarry() {
        return {
            flashbang: 2,
            smoke: 1,
            he_grenade: 1,
            molotov: 1,
            decoy: 1
        };
    }
}

// 投掷物 UI
class GrenadeUI {
    constructor(container) {
        this.container = container;
        this.element = null;
        this.grenades = {
            flashbang: 2,
            smoke: 1,
            he_grenade: 1,
            molotov: 0,
            decoy: 0
        };
        this.selectedGrenade = 'he_grenade';
    }

    show() {
        if (this.element) {
            this.element.style.display = 'flex';
            return;
        }

        this.element = document.createElement('div');
        this.element.className = 'grenade-ui';
        this.element.style.cssText = `
            position: absolute;
            bottom: 80px;
            right: 20px;
            display: flex;
            flex-direction: column;
            gap: 5px;
            z-index: 100;
        `;

        this.render();
        this.container.appendChild(this.element);
    }

    render() {
        const icons = {
            flashbang: '💡',
            smoke: '💨',
            he_grenade: '💣',
            molotov: '🔥',
            decoy: '🎯'
        };

        const keys = {
            flashbang: '4',
            smoke: '5',
            he_grenade: '3',
            molotov: '6',
            decoy: '7'
        };

        this.element.innerHTML = Object.entries(this.grenades).map(([type, count]) => `
            <div class="grenade-slot ${type === this.selectedGrenade ? 'selected' : ''}" data-type="${type}" style="
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px 12px;
                background: ${type === this.selectedGrenade ? 'rgba(79, 195, 247, 0.3)' : 'rgba(0, 0, 0, 0.6)'};
                border: 1px solid ${type === this.selectedGrenade ? '#4fc3f7' : 'rgba(255, 255, 255, 0.2)'};
                border-radius: 5px;
                color: white;
                font-size: 14px;
                cursor: pointer;
                opacity: ${count > 0 ? 1 : 0.4};
            ">
                <span style="font-size: 18px;">${icons[type]}</span>
                <span style="min-width: 20px;">${count}</span>
                <span style="font-size: 11px; color: #888;">[${keys[type]}]</span>
            </div>
        `).join('');

        this.bindEvents();
    }

    bindEvents() {
        this.element.querySelectorAll('.grenade-slot').forEach(slot => {
            slot.addEventListener('click', () => {
                const type = slot.dataset.type;
                if (this.grenades[type] > 0) {
                    this.selectedGrenade = type;
                    this.render();
                }
            });
        });
    }

    useGrenade(type) {
        if (this.grenades[type] > 0) {
            this.grenades[type]--;
            this.render();
            return true;
        }
        return false;
    }

    addGrenade(type, count = 1) {
        const maxCarry = GrenadeSystem.getMaxCarry();
        this.grenades[type] = Math.min(maxCarry[type], this.grenades[type] + count);
        this.render();
    }

    hide() {
        if (this.element) {
            this.element.style.display = 'none';
        }
    }
}

window.GrenadeSystem = GrenadeSystem;
window.GrenadeUI = GrenadeUI;
