// skills.js - 技能系统
class SkillSystem {
    constructor() {
        this.skills = {};
        this.cooldowns = {};
        this.activeSkills = [];
    }

    // 注册技能
    registerSkill(skill) {
        this.skills[skill.id] = {
            ...skill,
            currentCooldown: 0
        };
    }

    // 使用技能
    useSkill(skillId, player, target = null) {
        const skill = this.skills[skillId];
        if (!skill) return { success: false, reason: 'skill_not_found' };

        // 检查冷却
        if (this.cooldowns[skillId] && Date.now() < this.cooldowns[skillId]) {
            return { success: false, reason: 'on_cooldown' };
        }

        // 检查能量/弹药
        if (skill.energyCost && player.energy < skill.energyCost) {
            return { success: false, reason: 'not_enough_energy' };
        }

        // 消耗资源
        if (skill.energyCost) {
            player.energy -= skill.energyCost;
        }

        // 设置冷却
        this.cooldowns[skillId] = Date.now() + skill.cooldown;

        // 执行技能效果
        const result = this.executeSkill(skill, player, target);

        return { success: true, result };
    }

    // 执行技能
    executeSkill(skill, player, target) {
        switch (skill.type) {
            case 'dash':
                return this.executeDash(player, skill);
            case 'heal':
                return this.executeHeal(player, skill);
            case 'shield':
                return this.executeShield(player, skill);
            case 'slowmo':
                return this.executeSlowmo(player, skill);
            case 'rage':
                return this.executeRage(player, skill);
            case 'teleport':
                return this.executeTeleport(player, skill, target);
            default:
                return null;
        }
    }

    // 冲刺
    executeDash(player, skill) {
        const direction = player.direction || { x: 0, z: -1 };
        const distance = skill.distance || 10;

        player.position.x += direction.x * distance;
        player.position.z += direction.z * distance;

        return { type: 'dash', distance };
    }

    // 治疗
    executeHeal(player, skill) {
        const healAmount = skill.healAmount || 50;
        player.health = Math.min(player.maxHealth, player.health + healAmount);

        return { type: 'heal', amount: healAmount };
    }

    // 护盾
    executeShield(player, skill) {
        const shieldAmount = skill.shieldAmount || 100;
        const duration = skill.duration || 5000;

        player.shield = (player.shield || 0) + shieldAmount;

        // 设置过期
        setTimeout(() => {
            player.shield = Math.max(0, (player.shield || 0) - shieldAmount);
        }, duration);

        return { type: 'shield', amount: shieldAmount, duration };
    }

    // 子弹时间
    executeSlowmo(player, skill) {
        const duration = skill.duration || 3000;
        const multiplier = skill.multiplier || 0.5;

        this.activeSkills.push({
            type: 'slowmo',
            player,
            multiplier,
            endTime: Date.now() + duration
        });

        return { type: 'slowmo', multiplier, duration };
    }

    // 狂暴
    executeRage(player, skill) {
        const duration = skill.duration || 10000;
        const damageMultiplier = skill.damageMultiplier || 2;
        const speedMultiplier = skill.speedMultiplier || 1.5;

        player.damageMultiplier = damageMultiplier;
        player.speedMultiplier = speedMultiplier;

        setTimeout(() => {
            player.damageMultiplier = 1;
            player.speedMultiplier = 1;
        }, duration);

        return { type: 'rage', damageMultiplier, speedMultiplier, duration };
    }

    // 瞬移
    executeTeleport(player, skill, target) {
        if (!target) return null;

        player.position.x = target.x;
        player.position.y = target.y;
        player.position.z = target.z;

        return { type: 'teleport', target };
    }

    // 获取冷却剩余时间
    getCooldownRemaining(skillId) {
        if (!this.cooldowns[skillId]) return 0;
        const remaining = this.cooldowns[skillId] - Date.now();
        return Math.max(0, remaining);
    }

    // 获取技能状态
    getSkillStatus(skillId) {
        const skill = this.skills[skillId];
        if (!skill) return null;

        return {
            ...skill,
            cooldownRemaining: this.getCooldownRemaining(skillId),
            ready: this.getCooldownRemaining(skillId) === 0
        };
    }

    // 更新活跃技能
    update(dt) {
        const now = Date.now();

        this.activeSkills = this.activeSkills.filter(skill => {
            if (now >= skill.endTime) {
                // 技能结束，清理效果
                return false;
            }
            return true;
        });
    }
}

// 默认技能定义
const DEFAULT_SKILLS = [
    {
        id: 'dash',
        name: '冲刺',
        description: '快速向前冲刺',
        type: 'dash',
        icon: '💨',
        cooldown: 5000,
        energyCost: 20,
        distance: 10
    },
    {
        id: 'heal',
        name: '治疗',
        description: '恢复 50 点生命值',
        type: 'heal',
        icon: '💚',
        cooldown: 15000,
        energyCost: 30,
        healAmount: 50
    },
    {
        id: 'shield',
        name: '护盾',
        description: '获得 100 点护盾，持续 5 秒',
        type: 'shield',
        icon: '🛡️',
        cooldown: 20000,
        energyCost: 40,
        shieldAmount: 100,
        duration: 5000
    },
    {
        id: 'slowmo',
        name: '子弹时间',
        description: '减慢时间流逝',
        type: 'slowmo',
        icon: '⏱️',
        cooldown: 30000,
        energyCost: 50,
        multiplier: 0.5,
        duration: 3000
    },
    {
        id: 'rage',
        name: '狂暴',
        description: '伤害和速度翻倍',
        type: 'rage',
        icon: '🔥',
        cooldown: 60000,
        energyCost: 60,
        damageMultiplier: 2,
        speedMultiplier: 1.5,
        duration: 10000
    },
    {
        id: 'teleport',
        name: '瞬移',
        description: '传送到目标位置',
        type: 'teleport',
        icon: '✨',
        cooldown: 25000,
        energyCost: 35
    }
];

// 技能 UI
class SkillUI {
    constructor(container) {
        this.container = container;
        this.element = null;
    }

    show(skillSystem, player) {
        if (this.element) {
            this.element.remove();
        }

        this.element = document.createElement('div');
        this.element.className = 'skill-bar';
        this.element.style.cssText = `
            position: absolute;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            gap: 10px;
            padding: 10px;
            background: rgba(0, 0, 0, 0.5);
            border-radius: 10px;
        `;

        const skills = Object.values(skillSystem.skills);

        for (let i = 0; i < skills.length; i++) {
            const skill = skills[i];
            const status = skillSystem.getSkillStatus(skill.id);

            const skillSlot = document.createElement('div');
            skillSlot.className = 'skill-slot';
            skillSlot.dataset.skillId = skill.id;
            skillSlot.style.cssText = `
                width: 60px;
                height: 60px;
                background: ${status.ready ? 'rgba(0, 255, 0, 0.3)' : 'rgba(100, 100, 100, 0.5)'};
                border: 2px solid ${status.ready ? '#00ff00' : '#666'};
                border-radius: 8px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                position: relative;
                cursor: pointer;
            `;

            skillSlot.innerHTML = `
                <span style="font-size: 24px;">${skill.icon}</span>
                <span style="font-size: 10px; color: #aaa;">${i + 1}</span>
                ${status.cooldownRemaining > 0 ? `
                    <div style="
                        position: absolute;
                        bottom: 0;
                        left: 0;
                        right: 0;
                        background: rgba(255, 0, 0, 0.5);
                        height: ${(status.cooldownRemaining / skill.cooldown) * 100}%;
                        transition: height 0.1s;
                    "></div>
                ` : ''}
            `;

            skillSlot.title = `${skill.name}\n${skill.description}`;
            this.element.appendChild(skillSlot);
        }

        this.container.appendChild(this.element);
    }

    hide() {
        if (this.element) {
            this.element.remove();
            this.element = null;
        }
    }

    update(skillSystem) {
        if (!this.element) return;

        const slots = this.element.querySelectorAll('.skill-slot');
        slots.forEach(slot => {
            const skillId = slot.dataset.skillId;
            const status = skillSystem.getSkillStatus(skillId);

            if (status) {
                slot.style.background = status.ready 
                    ? 'rgba(0, 255, 0, 0.3)' 
                    : 'rgba(100, 100, 100, 0.5)';
                slot.style.borderColor = status.ready ? '#00ff00' : '#666';

                // 更新冷却条
                const cooldownBar = slot.querySelector('div');
                if (status.cooldownRemaining > 0) {
                    if (cooldownBar) {
                        cooldownBar.style.height = `${(status.cooldownRemaining / status.cooldown) * 100}%`;
                    }
                } else if (cooldownBar) {
                    cooldownBar.remove();
                }
            }
        });
    }
}

window.SkillSystem = SkillSystem;
window.DEFAULT_SKILLS = DEFAULT_SKILLS;
window.SkillUI = SkillUI;
