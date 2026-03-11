// weapons.js - 扩展武器系统
class WeaponSystem {
    constructor() {
        this.weapons = this.loadWeapons();
        this.currentWeapon = null;
        this.inventory = [];
    }

    loadWeapons() {
        return {
            // 手枪类
            'pistol': {
                id: 'pistol',
                name: '手枪',
                type: 'pistol',
                damage: 25,
                fireRate: 400, // ms
                magSize: 12,
                reloadTime: 1500,
                accuracy: 0.95,
                range: 50,
                model: 'pistol',
                icon: '🔫',
                sound: 'pistol'
            },
            'desert_eagle': {
                id: 'desert_eagle',
                name: '沙漠之鹰',
                type: 'pistol',
                damage: 55,
                fireRate: 600,
                magSize: 7,
                reloadTime: 2000,
                accuracy: 0.9,
                range: 40,
                model: 'deagle',
                icon: '🔫',
                sound: 'deagle',
                unlockLevel: 10
            },

            // 步枪类
            'rifle': {
                id: 'rifle',
                name: '突击步枪',
                type: 'rifle',
                damage: 30,
                fireRate: 100, // 自动
                magSize: 30,
                reloadTime: 2500,
                accuracy: 0.85,
                range: 100,
                model: 'rifle',
                icon: '🔫',
                sound: 'rifle',
                auto: true
            },
            'ak47': {
                id: 'ak47',
                name: 'AK-47',
                type: 'rifle',
                damage: 35,
                fireRate: 100,
                magSize: 30,
                reloadTime: 2800,
                accuracy: 0.75,
                range: 80,
                model: 'ak47',
                icon: '🔫',
                sound: 'ak47',
                auto: true,
                unlockLevel: 5
            },
            'm4a1': {
                id: 'm4a1',
                name: 'M4A1',
                type: 'rifle',
                damage: 28,
                fireRate: 80,
                magSize: 30,
                reloadTime: 2200,
                accuracy: 0.9,
                range: 120,
                model: 'm4a1',
                icon: '🔫',
                sound: 'm4',
                auto: true,
                unlockLevel: 15
            },

            // 霰弹枪类
            'shotgun': {
                id: 'shotgun',
                name: '霰弹枪',
                type: 'shotgun',
                damage: 15, // 每颗弹丸
                pellets: 8,
                fireRate: 800,
                magSize: 6,
                reloadTime: 3000,
                accuracy: 0.6,
                range: 20,
                spread: 0.1,
                model: 'shotgun',
                icon: '🔫',
                sound: 'shotgun'
            },
            'spas12': {
                id: 'spas12',
                name: 'SPAS-12',
                type: 'shotgun',
                damage: 20,
                pellets: 10,
                fireRate: 600,
                magSize: 8,
                reloadTime: 3500,
                accuracy: 0.65,
                range: 25,
                spread: 0.08,
                model: 'spas12',
                icon: '🔫',
                sound: 'shotgun',
                unlockLevel: 20
            },

            // 狙击枪类
            'sniper': {
                id: 'sniper',
                name: '狙击步枪',
                type: 'sniper',
                damage: 100,
                fireRate: 1500,
                magSize: 5,
                reloadTime: 3500,
                accuracy: 0.98,
                range: 500,
                scope: 4,
                model: 'sniper',
                icon: '🎯',
                sound: 'sniper'
            },
            'awp': {
                id: 'awp',
                name: 'AWP',
                type: 'sniper',
                damage: 150,
                fireRate: 2000,
                magSize: 5,
                reloadTime: 4000,
                accuracy: 0.99,
                range: 800,
                scope: 8,
                model: 'awp',
                icon: '🎯',
                sound: 'awp',
                unlockLevel: 25
            },

            // 冲锋枪类
            'smg': {
                id: 'smg',
                name: '冲锋枪',
                type: 'smg',
                damage: 18,
                fireRate: 60,
                magSize: 40,
                reloadTime: 2000,
                accuracy: 0.75,
                range: 40,
                model: 'smg',
                icon: '🔫',
                sound: 'smg',
                auto: true
            },
            'mp5': {
                id: 'mp5',
                name: 'MP5',
                type: 'smg',
                damage: 22,
                fireRate: 70,
                magSize: 30,
                reloadTime: 2200,
                accuracy: 0.85,
                range: 50,
                model: 'mp5',
                icon: '🔫',
                sound: 'mp5',
                auto: true,
                unlockLevel: 8
            },

            // 机枪类
            'mg': {
                id: 'mg',
                name: '轻机枪',
                type: 'mg',
                damage: 25,
                fireRate: 80,
                magSize: 100,
                reloadTime: 5000,
                accuracy: 0.7,
                range: 80,
                model: 'mg',
                icon: '🔫',
                sound: 'mg',
                auto: true,
                movePenalty: 0.3,
                unlockLevel: 30
            },

            // 特殊武器
            'crossbow': {
                id: 'crossbow',
                name: '十字弩',
                type: 'special',
                damage: 200,
                fireRate: 3000,
                magSize: 1,
                reloadTime: 3000,
                accuracy: 0.95,
                range: 150,
                model: 'crossbow',
                icon: '🏹',
                sound: 'crossbow',
                silent: true,
                unlockLevel: 35
            },
            'railgun': {
                id: 'railgun',
                name: '电磁炮',
                type: 'special',
                damage: 300,
                fireRate: 5000,
                magSize: 3,
                reloadTime: 6000,
                accuracy: 1.0,
                range: 1000,
                pierce: true,
                model: 'railgun',
                icon: '⚡',
                sound: 'railgun',
                unlockLevel: 50
            }
        };
    }

    // 获取武器
    getWeapon(id) {
        return this.weapons[id] || null;
    }

    // 获取所有武器
    getAllWeapons() {
        return Object.values(this.weapons);
    }

    // 按类型获取武器
    getWeaponsByType(type) {
        return Object.values(this.weapons).filter(w => w.type === type);
    }

    // 获取解锁武器
    getUnlockedWeapons(level) {
        return Object.values(this.weapons).filter(w => 
            !w.unlockLevel || w.unlockLevel <= level
        );
    }

    // 切换武器
    switchWeapon(weaponId) {
        const weapon = this.weapons[weaponId];
        if (!weapon) return false;

        this.currentWeapon = weapon;
        return true;
    }

    // 计算伤害
    calculateDamage(weapon, distance, headshot = false) {
        let damage = weapon.damage;

        // 距离衰减
        if (distance > weapon.range * 0.5) {
            const falloff = 1 - ((distance - weapon.range * 0.5) / (weapon.range * 0.5));
            damage *= Math.max(0.5, falloff);
        }

        // 爆头加成
        if (headshot) {
            damage *= 1.5;
        }

        // 霰弹枪多弹丸
        if (weapon.pellets) {
            damage *= weapon.pellets;
        }

        return Math.round(damage);
    }

    // 计算散布
    calculateSpread(weapon, isMoving = false, isCrouching = false) {
        let spread = (1 - weapon.accuracy) * 0.1;

        if (isMoving) {
            spread *= 2;
        }

        if (isCrouching) {
            spread *= 0.5;
        }

        return spread;
    }
}

// 武器商店 UI
class WeaponShop {
    constructor(container, weaponSystem) {
        this.container = container;
        this.weaponSystem = weaponSystem;
        this.element = null;
        this.playerLevel = 1;
        this.playerCoins = 0;
    }

    show(level = 1, coins = 0) {
        this.playerLevel = level;
        this.playerCoins = coins;

        if (this.element) {
            this.element.style.display = 'block';
            return;
        }

        this.element = document.createElement('div');
        this.element.className = 'weapon-shop';
        this.element.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.95);
            padding: 30px;
            border-radius: 15px;
            color: white;
            max-width: 900px;
            max-height: 80vh;
            overflow-y: auto;
            z-index: 100;
        `;

        this.render();
        this.container.appendChild(this.element);
    }

    render() {
        const weapons = this.weaponSystem.getAllWeapons();
        const types = ['pistol', 'rifle', 'shotgun', 'sniper', 'smg', 'mg', 'special'];
        const typeNames = {
            'pistol': '手枪',
            'rifle': '步枪',
            'shotgun': '霰弹枪',
            'sniper': '狙击枪',
            'smg': '冲锋枪',
            'mg': '机枪',
            'special': '特殊'
        };

        this.element.innerHTML = `
            <h2 style="margin: 0 0 20px 0; text-align: center;">🔫 武器库</h2>
            
            <div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
                <span>等级: ${this.playerLevel}</span>
                <span>金币: ${this.playerCoins}</span>
            </div>

            ${types.map(type => {
                const typeWeapons = weapons.filter(w => w.type === type);
                if (typeWeapons.length === 0) return '';
                
                return `
                    <div style="margin-bottom: 25px;">
                        <h3 style="color: #4fc3f7; border-bottom: 1px solid #333; padding-bottom: 5px;">
                            ${typeNames[type]}
                        </h3>
                        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px;">
                            ${typeWeapons.map(w => {
                                const locked = w.unlockLevel && w.unlockLevel > this.playerLevel;
                                return `
                                    <div class="weapon-card" data-id="${w.id}" style="
                                        background: ${locked ? 'rgba(50, 50, 50, 0.5)' : 'rgba(50, 50, 50, 0.8)'};
                                        border: 1px solid ${locked ? '#333' : '#555'};
                                        border-radius: 8px;
                                        padding: 15px;
                                        ${locked ? '' : 'cursor: pointer;'}
                                    ">
                                        <div style="font-size: 32px; text-align: center; margin-bottom: 10px;">
                                            ${w.icon}
                                        </div>
                                        <div style="font-weight: bold; text-align: center; margin-bottom: 5px;">
                                            ${w.name}
                                            ${locked ? `<span style="color: #f44336;">🔒 Lv.${w.unlockLevel}</span>` : ''}
                                        </div>
                                        <div style="font-size: 12px; color: #888;">
                                            <div>伤害: ${w.damage}</div>
                                            <div>弹匣: ${w.magSize}</div>
                                            <div>射程: ${w.range}m</div>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                `;
            }).join('')}
            
            <div style="text-align: center; margin-top: 20px;">
                <button id="closeShop" style="
                    padding: 10px 30px;
                    background: #f44336;
                    border: none;
                    border-radius: 5px;
                    color: white;
                    cursor: pointer;
                ">关闭</button>
            </div>
        `;

        this.bindEvents();
    }

    bindEvents() {
        this.element.querySelectorAll('.weapon-card:not([style*="rgba(50, 50, 50, 0.5)"])').forEach(card => {
            card.addEventListener('click', () => {
                const weaponId = card.dataset.id;
                const weapon = this.weaponSystem.getWeapon(weaponId);
                if (weapon) {
                    this.selectWeapon(weapon);
                }
            });
        });

        this.element.querySelector('#closeShop').addEventListener('click', () => {
            this.hide();
        });
    }

    selectWeapon(weapon) {
        // 检查等级限制
        if (weapon.unlockLevel && this.playerLevel < weapon.unlockLevel) {
            this.showMessage(`需要等级 ${weapon.unlockLevel} 解锁`, 'error');
            return;
        }

        // 检查金币（如果有价格）
        if (weapon.price && this.playerCoins < weapon.price) {
            this.showMessage('金币不足', 'error');
            return;
        }

        // 通知游戏切换武器
        if (window.game) {
            window.game.switchWeaponById(weapon.id);
        }

        // 更新 UI
        this.showMessage(`已装备: ${weapon.name}`, 'success');
        this.hide();
    }

    showMessage(text, type = 'info') {
        const msg = document.createElement('div');
        msg.style.cssText = `
            position: fixed;
            top: 20%;
            left: 50%;
            transform: translateX(-50%);
            background: ${type === 'error' ? '#f44336' : type === 'success' ? '#4CAF50' : '#2196F3'};
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            font-size: 16px;
            z-index: 10000;
            animation: fadeInOut 2s forwards;
        `;
        msg.textContent = text;
        document.body.appendChild(msg);

        setTimeout(() => msg.remove(), 2000);
    }

    hide() {
        if (this.element) {
            this.element.style.display = 'none';
        }
    }
}

window.WeaponSystem = WeaponSystem;
window.WeaponShop = WeaponShop;
