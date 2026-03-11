// killstreak.js - 连杀奖励系统
class KillStreakSystem {
    constructor() {
        this.streaks = this.loadStreaks();
        this.currentStreak = 0;
        this.streakTimer = null;
        this.streakTimeout = 5000; // 5秒内击杀算连杀
    }

    loadStreaks() {
        return [
            { kills: 2, name: 'Double Kill', icon: '✌️', bonus: 50, message: '双杀!' },
            { kills: 3, name: 'Triple Kill', icon: '3️⃣', bonus: 100, message: '三杀!' },
            { kills: 4, name: 'Multi Kill', icon: '🔥', bonus: 150, message: '多杀!' },
            { kills: 5, name: 'Ultra Kill', icon: '⚡', bonus: 200, message: '疯狂杀戮!' },
            { kills: 6, name: 'Monster Kill', icon: '👹', bonus: 300, message: '怪兽杀戮!' },
            { kills: 7, name: 'Unstoppable', icon: '🚀', bonus: 400, message: '无人能挡!' },
            { kills: 8, name: 'Godlike', icon: '👑', bonus: 500, message: '神一般!' },
            { kills: 10, name: 'Holy Shit!', icon: '💥', bonus: 1000, message: '天神下凡!' }
        ];
    }

    // 记录击杀
    recordKill() {
        this.currentStreak++;

        // 重置计时器
        if (this.streakTimer) {
            clearTimeout(this.streakTimer);
        }

        this.streakTimer = setTimeout(() => {
            this.resetStreak();
        }, this.streakTimeout);

        // 检查是否达到连杀奖励
        return this.checkStreak();
    }

    // 检查连杀
    checkStreak() {
        const streak = this.streaks.find(s => s.kills === this.currentStreak);
        if (streak) {
            return streak;
        }
        return null;
    }

    // 重置连杀
    resetStreak() {
        this.currentStreak = 0;
        if (this.streakTimer) {
            clearTimeout(this.streakTimer);
            this.streakTimer = null;
        }
    }

    // 死亡重置
    onDeath() {
        const finalStreak = this.currentStreak;
        this.resetStreak();
        return finalStreak;
    }

    // 获取当前连杀数
    getCurrentStreak() {
        return this.currentStreak;
    }

    // 获取下一个奖励
    getNextStreak() {
        for (const streak of this.streaks) {
            if (streak.kills > this.currentStreak) {
                return streak;
            }
        }
        return null;
    }
}

// 连杀奖励 UI
class KillStreakUI {
    constructor(container) {
        this.container = container;
        this.element = null;
    }

    show(streak) {
        if (!streak) return;

        if (this.element) {
            this.element.remove();
        }

        this.element = document.createElement('div');
        this.element.className = 'killstreak-announcement';
        this.element.style.cssText = `
            position: absolute;
            top: 35%;
            left: 50%;
            transform: translate(-50%, -50%);
            text-align: center;
            z-index: 150;
            animation: streakAnnounce 1.5s ease-out forwards;
        `;

        this.element.innerHTML = `
            <style>
                @keyframes streakAnnounce {
                    0% {
                        opacity: 0;
                        transform: translate(-50%, -50%) scale(0.5);
                    }
                    20% {
                        opacity: 1;
                        transform: translate(-50%, -50%) scale(1.2);
                    }
                    80% {
                        opacity: 1;
                        transform: translate(-50%, -50%) scale(1);
                    }
                    100% {
                        opacity: 0;
                        transform: translate(-50%, -50%) scale(0.8);
                    }
                }
            </style>

            <div style="
                font-size: 72px;
                margin-bottom: 10px;
                text-shadow: 0 0 30px rgba(255, 215, 0, 0.8);
            ">${streak.icon}</div>
            <div style="
                font-size: 36px;
                font-weight: bold;
                color: #FFD700;
                text-shadow: 2px 2px 4px #000;
            ">${streak.name}</div>
            <div style="
                font-size: 18px;
                color: #fff;
                margin-top: 10px;
            ">${streak.message}</div>
            <div style="
                font-size: 24px;
                color: #4CAF50;
                margin-top: 5px;
            ">+${streak.bonus} 分</div>
        `;

        this.container.appendChild(this.element);

        // 自动移除
        setTimeout(() => {
            if (this.element) {
                this.element.remove();
                this.element = null;
            }
        }, 1500);
    }
}

// 终结奖励 (终结敌方连杀)
class ShutdownBonus {
    constructor() {
        this.bonuses = [
            { streak: 3, name: 'Shutdown', bonus: 75, icon: '🛑' },
            { streak: 5, name: 'Denied!', bonus: 150, icon: '🚫' },
            { streak: 7, name: 'Revenge', bonus: 250, icon: '💀' },
            { streak: 10, name: 'Buzzkill', bonus: 500, icon: '🥶' }
        ];
    }

    // 计算终结奖励
    calculate(killStreak) {
        for (const bonus of this.bonuses) {
            if (killStreak >= bonus.streak) {
                return bonus;
            }
        }
        return null;
    }
}

window.KillStreakSystem = KillStreakSystem;
window.KillStreakUI = KillStreakUI;
window.ShutdownBonus = ShutdownBonus;
