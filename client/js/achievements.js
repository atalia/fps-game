// achievements.js - 成就系统
class AchievementSystem {
    constructor() {
        this.achievements = this.loadAchievements();
        this.playerProgress = {};
    }

    loadAchievements() {
        return {
            // 击杀成就
            'first-blood': {
                id: 'first-blood',
                name: '首杀',
                description: '完成第一次击杀',
                icon: '🩸',
                category: 'kills',
                requirement: 1,
                points: 10
            },
            'killer': {
                id: 'killer',
                name: '杀手',
                description: '累计击杀 100 次',
                icon: '💀',
                category: 'kills',
                requirement: 100,
                points: 50
            },
            'serial-killer': {
                id: 'serial-killer',
                name: '连环杀手',
                description: '累计击杀 500 次',
                icon: '🔪',
                category: 'kills',
                requirement: 500,
                points: 100
            },
            'mass-murderer': {
                id: 'mass-murderer',
                name: '杀神',
                description: '累计击杀 1000 次',
                icon: '☠️',
                category: 'kills',
                requirement: 1000,
                points: 200
            },

            // 连杀成就
            'double-kill': {
                id: 'double-kill',
                name: '双杀',
                description: '达成双杀',
                icon: '✌️',
                category: 'streak',
                requirement: 2,
                points: 20
            },
            'triple-kill': {
                id: 'triple-kill',
                name: '三杀',
                description: '达成三杀',
                icon: '3️⃣',
                category: 'streak',
                requirement: 3,
                points: 30
            },
            'ultra-kill': {
                id: 'ultra-kill',
                name: '四杀',
                description: '达成四杀',
                icon: '4️⃣',
                category: 'streak',
                requirement: 4,
                points: 50
            },
            'rampage': {
                id: 'rampage',
                name: '五杀',
                description: '达成五杀',
                icon: '5️⃣',
                category: 'streak',
                requirement: 5,
                points: 80
            },
            'unstoppable': {
                id: 'unstoppable',
                name: '不可阻挡',
                description: '达成十连杀',
                icon: '🔥',
                category: 'streak',
                requirement: 10,
                points: 200
            },

            // 武器成就
            'pistol-master': {
                id: 'pistol-master',
                name: '手枪大师',
                description: '使用手枪击杀 50 人',
                icon: '🔫',
                category: 'weapon',
                requirement: 50,
                points: 50
            },
            'sniper-elite': {
                id: 'sniper-elite',
                name: '狙击精英',
                description: '使用狙击枪击杀 100 人',
                icon: '🎯',
                category: 'weapon',
                requirement: 100,
                points: 100
            },
            'shotgun-surgeon': {
                id: 'shotgun-surgeon',
                name: '霰弹外科医生',
                description: '使用霰弹枪击杀 50 人',
                icon: '💥',
                category: 'weapon',
                requirement: 50,
                points: 50
            },

            // 爆头成就
            'headhunter': {
                id: 'headhunter',
                name: '猎头者',
                description: '爆头击杀 50 次',
                icon: '🎯',
                category: 'headshot',
                requirement: 50,
                points: 50
            },
            'sharpshooter': {
                id: 'sharpshooter',
                name: '神枪手',
                description: '爆头击杀 200 次',
                icon: '🎖️',
                category: 'headshot',
                requirement: 200,
                points: 100
            },
            'one-shot': {
                id: 'one-shot',
                name: '一枪毙命',
                description: '爆头率达到 50%',
                icon: '💀',
                category: 'headshot',
                requirement: 0.5,
                points: 150
            },

            // 比赛成就
            'mvp': {
                id: 'mvp',
                name: 'MVP',
                description: '获得 MVP 10 次',
                icon: '🏆',
                category: 'match',
                requirement: 10,
                points: 100
            },
            'winner': {
                id: 'winner',
                name: '胜利者',
                description: '赢得 100 场比赛',
                icon: '🥇',
                category: 'match',
                requirement: 100,
                points: 200
            },
            'undefeated': {
                id: 'undefeated',
                name: '不败传说',
                description: '连续赢得 10 场比赛',
                icon: '👑',
                category: 'match',
                requirement: 10,
                points: 300
            },

            // 生存成就
            'survivor': {
                id: 'survivor',
                name: '幸存者',
                description: '单局不死',
                icon: '🛡️',
                category: 'survival',
                requirement: 1,
                points: 50
            },
            'immortal': {
                id: 'immortal',
                name: '不死之身',
                description: '单局不死且击杀 10 人',
                icon: '♾️',
                category: 'survival',
                requirement: 10,
                points: 200
            },

            // 道具成就
            'collector': {
                id: 'collector',
                name: '收集者',
                description: '拾取 500 个道具',
                icon: '💎',
                category: 'powerup',
                requirement: 500,
                points: 50
            },

            // 时间成就
            'dedicated': {
                id: 'dedicated',
                name: '专注玩家',
                description: '游戏时间达到 10 小时',
                icon: '⏰',
                category: 'time',
                requirement: 36000,
                points: 50
            },
            'veteran': {
                id: 'veteran',
                name: '资深玩家',
                description: '游戏时间达到 100 小时',
                icon: '🎖️',
                category: 'time',
                requirement: 360000,
                points: 200
            }
        };
    }

    init(playerStats) {
        this.playerProgress = playerStats || {
            kills: 0,
            deaths: 0,
            headshots: 0,
            wins: 0,
            mvpCount: 0,
            winStreak: 0,
            maxStreak: 0,
            powerupsCollected: 0,
            playTime: 0,
            weaponKills: {},
            unlockedAchievements: []
        };
    }

    checkAchievement(achievementId) {
        const achievement = this.achievements[achievementId];
        if (!achievement) return null;

        if (this.playerProgress.unlockedAchievements.includes(achievementId)) {
            return null; // 已解锁
        }

        let progress = 0;
        let unlocked = false;

        switch (achievement.category) {
            case 'kills':
                progress = this.playerProgress.kills;
                break;
            case 'streak':
                progress = this.playerProgress.maxStreak;
                break;
            case 'headshot':
                if (achievementId === 'one-shot') {
                    const totalKills = this.playerProgress.kills;
                    progress = totalKills > 0 ? this.playerProgress.headshots / totalKills : 0;
                } else {
                    progress = this.playerProgress.headshots;
                }
                break;
            case 'weapon':
                progress = this.playerProgress.weaponKills[achievementId.split('-')[0]] || 0;
                break;
            case 'match':
                if (achievementId === 'mvp') {
                    progress = this.playerProgress.mvpCount;
                } else if (achievementId === 'winner') {
                    progress = this.playerProgress.wins;
                } else if (achievementId === 'undefeated') {
                    progress = this.playerProgress.winStreak;
                }
                break;
            case 'survival':
                // 特殊检查，需要比赛结束时处理
                break;
            case 'powerup':
                progress = this.playerProgress.powerupsCollected;
                break;
            case 'time':
                progress = this.playerProgress.playTime;
                break;
        }

        unlocked = progress >= achievement.requirement;

        if (unlocked) {
            this.playerProgress.unlockedAchievements.push(achievementId);
            return achievement;
        }

        return null;
    }

    checkAllAchievements() {
        const newlyUnlocked = [];

        for (const id of Object.keys(this.achievements)) {
            const achievement = this.checkAchievement(id);
            if (achievement) {
                newlyUnlocked.push(achievement);
            }
        }

        return newlyUnlocked;
    }

    getProgress(achievementId) {
        const achievement = this.achievements[achievementId];
        if (!achievement) return null;

        let current = 0;

        switch (achievement.category) {
            case 'kills':
                current = this.playerProgress.kills;
                break;
            case 'streak':
                current = this.playerProgress.maxStreak;
                break;
            case 'headshot':
                if (achievementId === 'one-shot') {
                    const totalKills = this.playerProgress.kills;
                    current = totalKills > 0 ? (this.playerProgress.headshots / totalKills) * 100 : 0;
                } else {
                    current = this.playerProgress.headshots;
                }
                break;
            case 'weapon':
                current = this.playerProgress.weaponKills[achievementId.split('-')[0]] || 0;
                break;
            case 'match':
                if (achievementId === 'mvp') {
                    current = this.playerProgress.mvpCount;
                } else if (achievementId === 'winner') {
                    current = this.playerProgress.wins;
                } else if (achievementId === 'undefeated') {
                    current = this.playerProgress.winStreak;
                }
                break;
            case 'powerup':
                current = this.playerProgress.powerupsCollected;
                break;
            case 'time':
                current = this.playerProgress.playTime;
                break;
        }

        const required = achievement.requirement;
        const percentage = Math.min(100, (current / required) * 100);

        return {
            current,
            required,
            percentage,
            unlocked: this.playerProgress.unlockedAchievements.includes(achievementId)
        };
    }

    getTotalPoints() {
        let total = 0;
        for (const id of this.playerProgress.unlockedAchievements) {
            const achievement = this.achievements[id];
            if (achievement) {
                total += achievement.points;
            }
        }
        return total;
    }

    getAllAchievements() {
        return Object.values(this.achievements);
    }

    getUnlockedAchievements() {
        return this.playerProgress.unlockedAchievements.map(id => this.achievements[id]);
    }

    getAchievementsByCategory(category) {
        return Object.values(this.achievements).filter(a => a.category === category);
    }
}

// 成就通知 UI
class AchievementNotification {
    constructor(container) {
        this.container = container;
        this.queue = [];
        this.isShowing = false;
    }

    show(achievement) {
        this.queue.push(achievement);
        if (!this.isShowing) {
            this.processQueue();
        }
    }

    processQueue() {
        if (this.queue.length === 0) {
            this.isShowing = false;
            return;
        }

        this.isShowing = true;
        const achievement = this.queue.shift();

        const element = document.createElement('div');
        element.className = 'achievement-notification';
        element.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, rgba(0, 0, 0, 0.95), rgba(30, 30, 30, 0.95));
            border: 3px solid #ffd700;
            border-radius: 15px;
            padding: 30px 50px;
            text-align: center;
            z-index: 500;
            animation: achievementPop 0.5s ease-out;
        `;

        element.innerHTML = `
            <div style="font-size: 60px; margin-bottom: 10px;">${achievement.icon}</div>
            <div style="color: #ffd700; font-size: 24px; font-weight: bold; margin-bottom: 10px;">
                🏆 成就解锁！
            </div>
            <div style="color: white; font-size: 20px; font-weight: bold; margin-bottom: 5px;">
                ${achievement.name}
            </div>
            <div style="color: #888; font-size: 14px; margin-bottom: 10px;">
                ${achievement.description}
            </div>
            <div style="color: #4CAF50; font-size: 16px;">
                +${achievement.points} 点
            </div>
        `;

        this.container.appendChild(element);

        setTimeout(() => {
            element.style.animation = 'achievementFade 0.5s ease-in forwards';
            setTimeout(() => {
                element.remove();
                this.processQueue();
            }, 500);
        }, 3000);
    }

    static addStyles() {
        if (document.getElementById('achievement-styles')) return;

        const style = document.createElement('style');
        style.id = 'achievement-styles';
        style.textContent = `
            @keyframes achievementPop {
                0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
                50% { transform: translate(-50%, -50%) scale(1.2); }
                100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
            }
            @keyframes achievementFade {
                from { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                to { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
            }
        `;
        document.head.appendChild(style);
    }
}

// 成就面板 UI
class AchievementPanel {
    constructor(container, achievementSystem) {
        this.container = container;
        this.achievementSystem = achievementSystem;
        this.element = null;
    }

    show() {
        if (this.element) {
            this.element.style.display = 'flex';
            return;
        }

        this.element = document.createElement('div');
        this.element.className = 'achievement-panel';
        this.element.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.95);
            display: flex;
            flex-direction: column;
            padding: 30px;
            z-index: 400;
            overflow-y: auto;
        `;

        this.render();
        this.container.appendChild(this.element);
    }

    render() {
        const achievements = this.achievementSystem.getAllAchievements();
        const unlocked = this.achievementSystem.getUnlockedAchievements();
        const totalPoints = this.achievementSystem.getTotalPoints();

        const categories = {
            kills: '击杀',
            streak: '连杀',
            weapon: '武器',
            headshot: '爆头',
            match: '比赛',
            survival: '生存',
            powerup: '道具',
            time: '时间'
        };

        this.element.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px;">
                <h2 style="margin: 0; color: white; font-size: 28px;">🏆 成就</h2>
                <div style="color: #ffd700; font-size: 20px;">
                    ${unlocked.length}/${achievements.length} 已解锁 | ${totalPoints} 点
                </div>
                <button id="closeAchievements" style="
                    background: #f44336;
                    border: none;
                    color: white;
                    padding: 10px 20px;
                    border-radius: 5px;
                    cursor: pointer;
                ">关闭</button>
            </div>

            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px;">
                ${Object.entries(categories).map(([cat, name]) => `
                    <div style="margin-bottom: 20px;">
                        <h3 style="color: #4fc3f7; margin: 0 0 10px 0; font-size: 16px;">${name}</h3>
                        ${this.achievementSystem.getAchievementsByCategory(cat).map(a => {
                            const progress = this.achievementSystem.getProgress(a.id);
                            const isUnlocked = this.playerProgress?.unlockedAchievements?.includes(a.id);
                            return `
                                <div style="
                                    background: ${isUnlocked ? 'rgba(76, 175, 80, 0.2)' : 'rgba(50, 50, 50, 0.8)'};
                                    border: 1px solid ${isUnlocked ? '#4CAF50' : '#555'};
                                    border-radius: 8px;
                                    padding: 10px;
                                    margin-bottom: 8px;
                                ">
                                    <div style="display: flex; align-items: center; gap: 10px;">
                                        <span style="font-size: 24px; ${!isUnlocked ? 'filter: grayscale(1);' : ''}">${a.icon}</span>
                                        <div style="flex: 1;">
                                            <div style="color: ${isUnlocked ? '#4CAF50' : 'white'}; font-size: 14px; font-weight: bold;">
                                                ${a.name}
                                            </div>
                                            <div style="color: #888; font-size: 11px;">
                                                ${a.description}
                                            </div>
                                            <div style="
                                                height: 4px;
                                                background: #333;
                                                border-radius: 2px;
                                                margin-top: 5px;
                                            ">
                                                <div style="
                                                    height: 100%;
                                                    background: ${isUnlocked ? '#4CAF50' : '#4fc3f7'};
                                                    width: ${progress.percentage}%;
                                                    border-radius: 2px;
                                                "></div>
                                            </div>
                                        </div>
                                        <div style="color: #ffd700; font-size: 12px;">
                                            +${a.points}
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `).join('')}
            </div>
        `;

        this.element.querySelector('#closeAchievements').addEventListener('click', () => {
            this.hide();
        });
    }

    hide() {
        if (this.element) {
            this.element.style.display = 'none';
        }
    }
}

// 初始化样式
AchievementNotification.addStyles();

window.AchievementSystem = AchievementSystem;
window.AchievementNotification = AchievementNotification;
window.AchievementPanel = AchievementPanel;
