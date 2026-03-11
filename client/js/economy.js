// economy.js - 经济系统
class EconomySystem {
    constructor() {
        this.money = 800; // 起始金钱
        this.maxMoney = 16000;

        // 武器价格
        this.weaponPrices = {
            // 手枪
            'pistol': 200,
            'desert_eagle': 700,
            'dual_pistols': 500,

            // 冲锋枪
            'smg': 1200,
            'mp5': 1500,
            'p90': 2350,

            // 步枪
            'rifle': 2000,
            'ak47': 2700,
            'm4a1': 3100,
            'aug': 3300,

            // 狙击枪
            'sniper': 4750,
            'awp': 4750,
            'scout': 1700,

            // 霰弹枪
            'shotgun': 1050,
            'spas12': 1800,

            // 机枪
            'lmg': 5200,

            // 近战
            'knife': 0
        };

        // 道具价格
        this.itemPrices = {
            'kevlar': 650,           // 轻型护甲
            'kevlar_helmet': 1000,   // 护甲+头盔
            'flashbang': 200,        // 闪光弹
            'smoke': 300,            // 烟雾弹
            'he_grenade': 300,       // 手雷
            'molotov': 400,          // 燃烧瓶
            'decoy': 50,             // 诱饵弹
            'defuse_kit': 400        // 拆弹器
        };

        // 收益设置
        this.rewards = {
            kill: 300,
            kill_headshot: 400,
            kill_knife: 500,
            win_round: 3000,
            lose_round: 1400,
            lose_streak_bonus: 500,
            plant_c4: 300,
            defuse_c4: 300,
            mvp_bonus: 500
        };
    }

    // 购买武器
    buyWeapon(weaponId) {
        const price = this.weaponPrices[weaponId];
        if (!price) return { success: false, reason: 'unknown_weapon' };

        if (this.money < price) {
            return { success: false, reason: 'insufficient_funds' };
        }

        this.money -= price;
        return { success: true, cost: price };
    }

    // 购买道具
    buyItem(itemId) {
        const price = this.itemPrices[itemId];
        if (!price) return { success: false, reason: 'unknown_item' };

        if (this.money < price) {
            return { success: false, reason: 'insufficient_funds' };
        }

        this.money -= price;
        return { success: true, cost: price };
    }

    // 增加金钱
    addMoney(amount) {
        this.money = Math.min(this.maxMoney, this.money + amount);
    }

    // 击杀奖励
    onKill(isHeadshot = false, isKnife = false) {
        let reward = this.rewards.kill;

        if (isKnife) {
            reward = this.rewards.kill_knife;
        } else if (isHeadshot) {
            reward = this.rewards.kill_headshot;
        }

        this.addMoney(reward);
        return reward;
    }

    // 回合结束奖励
    onRoundEnd(isWin, loseStreak = 0) {
        if (isWin) {
            this.addMoney(this.rewards.win_round);
            return this.rewards.win_round;
        } else {
            const bonus = Math.min(loseStreak, 4) * this.rewards.lose_streak_bonus;
            this.addMoney(this.rewards.lose_round + bonus);
            return this.rewards.lose_round + bonus;
        }
    }

    // 获取购买建议
    getBuyRecommendation() {
        const recommendations = [];

        // 需要护甲
        if (this.money >= this.itemPrices.kevlar_helmet) {
            recommendations.push({ item: 'kevlar_helmet', priority: 1 });
        }

        // 主武器
        if (this.money >= this.weaponPrices.ak47) {
            recommendations.push({ item: 'ak47', priority: 2 });
        } else if (this.money >= this.weaponPrices.mp5) {
            recommendations.push({ item: 'mp5', priority: 2 });
        }

        // 道具
        if (this.money >= this.itemPrices.he_grenade + this.itemPrices.flashbang) {
            recommendations.push({ item: 'he_grenade', priority: 3 });
            recommendations.push({ item: 'flashbang', priority: 3 });
        }

        return recommendations.sort((a, b) => a.priority - b.priority);
    }

    // 是否可以全买
    canFullBuy() {
        return this.money >= 4400; // 护甲 + 主武器
    }

    // 是否需要存钱
    shouldSave() {
        return this.money < 2000;
    }

    // 获取经济状态
    getStatus() {
        return {
            money: this.money,
            maxMoney: this.maxMoney,
            canFullBuy: this.canFullBuy(),
            shouldSave: this.shouldSave(),
            recommendations: this.getBuyRecommendation()
        };
    }
}

// 购买菜单 UI
class BuyMenuUI {
    constructor(container, economySystem) {
        this.container = container;
        this.economySystem = economySystem;
        this.element = null;
        this.selectedCategory = 'pistols';
        this.onBuy = null;
    }

    show() {
        if (this.element) {
            this.element.style.display = 'flex';
            this.render();
            return;
        }

        this.element = document.createElement('div');
        this.element.className = 'buy-menu';
        this.element.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 700px;
            max-height: 80vh;
            background: rgba(0, 0, 0, 0.95);
            border: 2px solid rgba(255, 255, 255, 0.2);
            border-radius: 15px;
            display: flex;
            flex-direction: column;
            z-index: 300;
        `;

        this.render();
        this.container.appendChild(this.element);
    }

    render() {
        const status = this.economySystem.getStatus();

        this.element.innerHTML = `
            <div style="
                padding: 20px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                display: flex;
                justify-content: space-between;
                align-items: center;
            ">
                <h2 style="margin: 0; color: white; font-size: 24px;">🛒 购买菜单</h2>
                <div style="display: flex; align-items: center; gap: 20px;">
                    <div style="color: ${status.canFullBuy ? '#4CAF50' : '#f44336'};">
                        ${status.canFullBuy ? '✅ 全买' : status.shouldSave ? '⚠️ 存钱' : '💰 半买'}
                    </div>
                    <div style="color: #4CAF50; font-size: 20px; font-weight: bold;">
                        $${this.economySystem.money}
                    </div>
                    <button id="closeBuyMenu" style="
                        background: #f44336;
                        border: none;
                        color: white;
                        padding: 10px 20px;
                        border-radius: 5px;
                        cursor: pointer;
                    ">关闭</button>
                </div>
            </div>

            <div style="display: flex; flex: 1; overflow: hidden;">
                <!-- 分类 -->
                <div style="
                    width: 150px;
                    background: rgba(30, 30, 30, 0.8);
                    padding: 10px;
                    border-right: 1px solid rgba(255, 255, 255, 0.1);
                ">
                    ${this.renderCategories()}
                </div>

                <!-- 商品列表 -->
                <div style="flex: 1; padding: 15px; overflow-y: auto;">
                    ${this.renderItems()}
                </div>
            </div>
        `;

        this.bindEvents();
    }

    renderCategories() {
        const categories = [
            { id: 'pistols', name: '手枪', icon: '🔫' },
            { id: 'smgs', name: '冲锋枪', icon: '💥' },
            { id: 'rifles', name: '步枪', icon: '🎯' },
            { id: 'snipers', name: '狙击枪', icon: '🎯' },
            { id: 'shotguns', name: '霰弹枪', icon: '💥' },
            { id: 'heavy', name: '重武器', icon: '🔥' },
            { id: 'gear', name: '装备', icon: '🛡️' },
            { id: 'grenades', name: '投掷物', icon: '💣' }
        ];

        return categories.map(cat => `
            <div class="category-btn" data-id="${cat.id}" style="
                padding: 10px;
                margin-bottom: 5px;
                background: ${this.selectedCategory === cat.id ? 'rgba(79, 195, 247, 0.3)' : 'transparent'};
                border: 1px solid ${this.selectedCategory === cat.id ? '#4fc3f7' : 'transparent'};
                border-radius: 5px;
                cursor: pointer;
                color: white;
                display: flex;
                align-items: center;
                gap: 8px;
            ">
                <span>${cat.icon}</span>
                <span>${cat.name}</span>
            </div>
        `).join('');
    }

    renderItems() {
        const items = this.getItemsForCategory(this.selectedCategory);
        const money = this.economySystem.money;

        return items.map(item => `
            <div class="buy-item" data-id="${item.id}" data-price="${item.price}" style="
                display: flex;
                align-items: center;
                padding: 15px;
                margin-bottom: 10px;
                background: ${item.price <= money ? 'rgba(50, 50, 50, 0.8)' : 'rgba(30, 30, 30, 0.8)'};
                border: 1px solid ${item.price <= money ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)'};
                border-radius: 8px;
                cursor: ${item.price <= money ? 'pointer' : 'not-allowed'};
                opacity: ${item.price <= money ? 1 : 0.5};
            ">
                <div style="font-size: 30px; width: 50px; text-align: center;">
                    ${item.icon}
                </div>
                <div style="flex: 1; margin-left: 15px;">
                    <div style="color: white; font-size: 16px; font-weight: bold;">
                        ${item.name}
                    </div>
                    <div style="color: #888; font-size: 12px; margin-top: 3px;">
                        ${item.description}
                    </div>
                </div>
                <div style="color: ${item.price <= money ? '#4CAF50' : '#f44336'}; font-size: 18px; font-weight: bold;">
                    $${item.price}
                </div>
            </div>
        `).join('');
    }

    getItemsForCategory(category) {
        const items = {
            pistols: [
                { id: 'pistol', name: '手枪', description: '标准手枪', price: 200, icon: '🔫' },
                { id: 'desert_eagle', name: '沙漠之鹰', description: '高伤害手枪', price: 700, icon: '🔫' },
                { id: 'dual_pistols', name: '双持手枪', description: '双持射击', price: 500, icon: '🔫' }
            ],
            smgs: [
                { id: 'smg', name: '冲锋枪', description: '快速射击', price: 1200, icon: '💥' },
                { id: 'mp5', name: 'MP5', description: '精准冲锋枪', price: 1500, icon: '💥' },
                { id: 'p90', name: 'P90', description: '高弹容量', price: 2350, icon: '💥' }
            ],
            rifles: [
                { id: 'rifle', name: '突击步枪', description: '标准步枪', price: 2000, icon: '🎯' },
                { id: 'ak47', name: 'AK-47', description: '高伤害步枪', price: 2700, icon: '🎯' },
                { id: 'm4a1', name: 'M4A1', description: '精准步枪', price: 3100, icon: '🎯' },
                { id: 'aug', name: 'AUG', description: '带镜步枪', price: 3300, icon: '🎯' }
            ],
            snipers: [
                { id: 'scout', name: '侦察步枪', description: '轻量狙击', price: 1700, icon: '🎯' },
                { id: 'awp', name: 'AWP', description: '重型狙击枪', price: 4750, icon: '🎯' }
            ],
            shotguns: [
                { id: 'shotgun', name: '霰弹枪', description: '近距离高伤害', price: 1050, icon: '💥' },
                { id: 'spas12', name: 'SPAS-12', description: '战术霰弹枪', price: 1800, icon: '💥' }
            ],
            heavy: [
                { id: 'lmg', name: '轻机枪', description: '高弹容量', price: 5200, icon: '🔥' }
            ],
            gear: [
                { id: 'kevlar', name: '护甲', description: '减少身体伤害', price: 650, icon: '🛡️' },
                { id: 'kevlar_helmet', name: '护甲+头盔', description: '全面防护', price: 1000, icon: '🛡️' },
                { id: 'defuse_kit', name: '拆弹器', description: '快速拆弹', price: 400, icon: '🔧' }
            ],
            grenades: [
                { id: 'flashbang', name: '闪光弹', description: '致盲敌人', price: 200, icon: '💣' },
                { id: 'smoke', name: '烟雾弹', description: '阻挡视野', price: 300, icon: '💨' },
                { id: 'he_grenade', name: '高爆手雷', description: '爆炸伤害', price: 300, icon: '💣' },
                { id: 'molotov', name: '燃烧瓶', description: '火焰伤害', price: 400, icon: '🔥' },
                { id: 'decoy', name: '诱饵弹', description: '模拟射击声', price: 50, icon: '🎯' }
            ]
        };

        return items[category] || [];
    }

    bindEvents() {
        this.element.querySelector('#closeBuyMenu').addEventListener('click', () => {
            this.hide();
        });

        this.element.querySelectorAll('.category-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.selectedCategory = btn.dataset.id;
                this.render();
            });
        });

        this.element.querySelectorAll('.buy-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = item.dataset.id;
                const price = parseInt(item.dataset.price);

                if (price <= this.economySystem.money) {
                    const result = this.economySystem.buyWeapon(id) || this.economySystem.buyItem(id);

                    if (result.success && this.onBuy) {
                        this.onBuy(id, result.cost);
                    }

                    this.render();
                }
            });
        });
    }

    hide() {
        if (this.element) {
            this.element.style.display = 'none';
        }
    }

    toggle() {
        if (this.element && this.element.style.display !== 'none') {
            this.hide();
        } else {
            this.show();
        }
    }
}

// 护甲系统
class ArmorSystem {
    constructor() {
        this.armor = 0;        // 0-100
        this.hasHelmet = false;
        this.maxArmor = 100;
        this.damageReduction = 0.5; // 护甲减少 50% 伤害
        this.headshotProtection = 0.8; // 头盔减少 80% 头部伤害
    }

    // 购买护甲
    buyArmor(withHelmet = false) {
        if (withHelmet) {
            this.armor = 100;
            this.hasHelmet = true;
        } else {
            this.armor = 100;
        }
    }

    // 受到伤害
    takeDamage(damage, isHeadshot = false) {
        if (this.armor <= 0) {
            return { damage, armorDamage: 0, armorRemaining: 0 };
        }

        let effectiveReduction = this.damageReduction;

        // 头盔保护
        if (isHeadshot && this.hasHelmet) {
            effectiveReduction = this.headshotProtection;
        }

        // 计算伤害吸收
        const absorbedDamage = damage * effectiveReduction;
        const actualDamage = damage - absorbedDamage;

        // 护甲损耗（吸收伤害的 50%）
        const armorDamage = absorbedDamage * 0.5;
        const oldArmor = this.armor;
        this.armor = Math.max(0, this.armor - armorDamage);

        return {
            damage: actualDamage,
            armorDamage: oldArmor - this.armor,
            armorRemaining: this.armor
        };
    }

    // 修理护甲
    repair(amount = 100) {
        this.armor = Math.min(this.maxArmor, this.armor + amount);
    }

    // 状态
    getStatus() {
        return {
            armor: this.armor,
            hasHelmet: this.hasHelmet,
            maxArmor: this.maxArmor,
            armorPercent: (this.armor / this.maxArmor) * 100
        };
    }
}

window.EconomySystem = EconomySystem;
window.BuyMenuUI = BuyMenuUI;
window.ArmorSystem = ArmorSystem;
