// match-end.js - 游戏结束界面
class MatchEndUI {
    constructor(container) {
        this.container = container;
        this.element = null;
    }

    show(stats) {
        if (this.element) {
            this.element.remove();
        }

        this.element = document.createElement('div');
        this.element.className = 'match-end';
        this.element.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.9);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 500;
            animation: fadeIn 0.5s;
        `;

        const isWinner = stats.result === 'win';
        const resultColor = isWinner ? '#4CAF50' : '#f44336';
        const resultText = isWinner ? '🎉 胜利!' : '😢 失败';
        const kd = stats.deaths > 0 ? (stats.kills / stats.deaths).toFixed(2) : stats.kills.toFixed(2);
        const accuracy = stats.shots > 0 ? ((stats.hits / stats.shots) * 100).toFixed(1) : '0.0';
        const headshotRate = stats.kills > 0 ? ((stats.headshots / stats.kills) * 100).toFixed(1) : '0.0';

        this.element.innerHTML = `
            <style>
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideIn {
                    from { transform: translateY(-20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                @keyframes pulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                }
                .stat-card {
                    background: rgba(50, 50, 50, 0.8);
                    border-radius: 10px;
                    padding: 15px 25px;
                    margin: 5px;
                    animation: slideIn 0.3s ease-out;
                }
            </style>

            <h1 style="
                font-size: 64px;
                margin: 0 0 30px 0;
                color: ${resultColor};
                text-shadow: 0 0 20px ${resultColor};
                animation: ${isWinner ? 'pulse 1s infinite' : 'none'};
            ">${resultText}</h1>

            <div style="
                display: flex;
                gap: 20px;
                flex-wrap: wrap;
                justify-content: center;
                margin-bottom: 30px;
            ">
                <div class="stat-card" style="animation-delay: 0.1s;">
                    <div style="color: #888; font-size: 12px;">击杀</div>
                    <div style="font-size: 36px; font-weight: bold; color: #4CAF50;">${stats.kills}</div>
                </div>
                <div class="stat-card" style="animation-delay: 0.15s;">
                    <div style="color: #888; font-size: 12px;">死亡</div>
                    <div style="font-size: 36px; font-weight: bold; color: #f44336;">${stats.deaths}</div>
                </div>
                <div class="stat-card" style="animation-delay: 0.2s;">
                    <div style="color: #888; font-size: 12px;">K/D</div>
                    <div style="font-size: 36px; font-weight: bold; color: #4fc3f7;">${kd}</div>
                </div>
            </div>

            <div style="
                display: flex;
                gap: 20px;
                flex-wrap: wrap;
                justify-content: center;
                margin-bottom: 30px;
            ">
                <div class="stat-card" style="animation-delay: 0.25s;">
                    <div style="color: #888; font-size: 12px;">伤害</div>
                    <div style="font-size: 28px; color: #ff9800;">${stats.damage}</div>
                </div>
                <div class="stat-card" style="animation-delay: 0.3s;">
                    <div style="color: #888; font-size: 12px;">精准度</div>
                    <div style="font-size: 28px; color: #9c27b0;">${accuracy}%</div>
                </div>
                <div class="stat-card" style="animation-delay: 0.35s;">
                    <div style="color: #888; font-size: 12px;">爆头率</div>
                    <div style="font-size: 28px; color: #e91e63;">${headshotRate}%</div>
                </div>
                <div class="stat-card" style="animation-delay: 0.4s;">
                    <div style="color: #888; font-size: 12px;">最高连杀</div>
                    <div style="font-size: 28px; color: #ffeb3b;">${stats.maxKillStreak}</div>
                </div>
            </div>

            <div style="
                background: rgba(30, 30, 30, 0.8);
                padding: 20px;
                border-radius: 10px;
                margin-bottom: 30px;
                text-align: center;
            ">
                <div style="color: #888; font-size: 14px; margin-bottom: 10px;">获得奖励</div>
                <div style="display: flex; gap: 30px; justify-content: center;">
                    <div>
                        <div style="font-size: 24px;">💰</div>
                        <div style="color: #ffeb3b; font-weight: bold;">+${stats.coins || 0}</div>
                    </div>
                    <div>
                        <div style="font-size: 24px;">⭐</div>
                        <div style="color: #4fc3f7; font-weight: bold;">+${stats.xp || 0} XP</div>
                    </div>
                </div>
            </div>

            <div style="display: flex; gap: 20px;">
                <button id="playAgain" style="
                    padding: 15px 40px;
                    font-size: 18px;
                    background: #4CAF50;
                    border: none;
                    border-radius: 8px;
                    color: white;
                    cursor: pointer;
                    transition: transform 0.2s;
                ">🔄 再来一局</button>
                <button id="backToLobby" style="
                    padding: 15px 40px;
                    font-size: 18px;
                    background: #2196F3;
                    border: none;
                    border-radius: 8px;
                    color: white;
                    cursor: pointer;
                    transition: transform 0.2s;
                ">🏠 返回大厅</button>
            </div>
        `;

        this.container.appendChild(this.element);
        this.bindEvents();
    }

    bindEvents() {
        this.element.querySelector('#playAgain').addEventListener('click', () => {
            window.location.reload();
        });

        this.element.querySelector('#backToLobby').addEventListener('click', () => {
            if (window.onBackToLobby) {
                window.onBackToLobby();
            }
        });
    }

    hide() {
        if (this.element) {
            this.element.remove();
            this.element = null;
        }
    }
}

// 战绩统计
class PlayerStats {
    constructor() {
        this.stats = this.load();
    }

    defaults() {
        return {
            totalKills: 0,
            totalDeaths: 0,
            totalDamage: 0,
            totalShots: 0,
            totalHits: 0,
            totalHeadshots: 0,
            wins: 0,
            losses: 0,
            matches: 0,
            playTime: 0, // 秒
            maxKillStreak: 0,
            currentStreak: 0,
            coins: 0,
            xp: 0,
            level: 1,
            achievements: [],
            favoriteWeapon: null,
            weaponStats: {},
            mapStats: {}
        };
    }

    load() {
        const saved = localStorage.getItem('fps_player_stats');
        if (saved) {
            try {
                return { ...this.defaults(), ...JSON.parse(saved) };
            } catch (e) {
                console.error('Failed to load stats:', e);
            }
        }
        return this.defaults();
    }

    save() {
        localStorage.setItem('fps_player_stats', JSON.stringify(this.stats));
    }

    // 记录击杀
    recordKill(weaponId, isHeadshot = false) {
        this.stats.totalKills++;
        this.stats.currentStreak++;

        if (isHeadshot) {
            this.stats.totalHeadshots++;
        }

        if (this.stats.currentStreak > this.stats.maxKillStreak) {
            this.stats.maxKillStreak = this.stats.currentStreak;
        }

        // 武器统计
        if (weaponId) {
            if (!this.stats.weaponStats[weaponId]) {
                this.stats.weaponStats[weaponId] = { kills: 0, headshots: 0 };
            }
            this.stats.weaponStats[weaponId].kills++;
            if (isHeadshot) {
                this.stats.weaponStats[weaponId].headshots++;
            }
        }

        this.save();
    }

    // 记录死亡
    recordDeath() {
        this.stats.totalDeaths++;
        this.stats.currentStreak = 0;
        this.save();
    }

    // 记录射击
    recordShot(weaponId, hit = false) {
        this.stats.totalShots++;
        if (hit) {
            this.stats.totalHits++;
        }
        this.save();
    }

    // 记录伤害
    recordDamage(damage) {
        this.stats.totalDamage += damage;
        this.save();
    }

    // 记录比赛结果
    recordMatch(result, mapId) {
        this.stats.matches++;

        if (result === 'win') {
            this.stats.wins++;
        } else {
            this.stats.losses++;
        }

        // 地图统计
        if (mapId) {
            if (!this.stats.mapStats[mapId]) {
                this.stats.mapStats[mapId] = { plays: 0, wins: 0 };
            }
            this.stats.mapStats[mapId].plays++;
            if (result === 'win') {
                this.stats.mapStats[mapId].wins++;
            }
        }

        this.save();
    }

    // 添加奖励
    addRewards(coins, xp) {
        this.stats.coins += coins;
        this.stats.xp += xp;

        // 升级检查 (每 1000 XP 升一级)
        const newLevel = Math.floor(this.stats.xp / 1000) + 1;
        if (newLevel > this.stats.level) {
            this.stats.level = newLevel;
        }

        this.save();
    }

    // 获取 K/D 比率
    getKDRatio() {
        if (this.stats.totalDeaths === 0) {
            return this.stats.totalKills;
        }
        return (this.stats.totalKills / this.stats.totalDeaths).toFixed(2);
    }

    // 获取胜率
    getWinRate() {
        if (this.stats.matches === 0) return 0;
        return ((this.stats.wins / this.stats.matches) * 100).toFixed(1);
    }

    // 获取精准度
    getAccuracy() {
        if (this.stats.totalShots === 0) return 0;
        return ((this.stats.totalHits / this.stats.totalShots) * 100).toFixed(1);
    }

    // 获取当前回合数据
    getCurrentMatchStats() {
        return {
            kills: 0,
            deaths: 0,
            damage: 0,
            shots: 0,
            hits: 0,
            headshots: 0,
            maxKillStreak: 0,
            currentStreak: 0
        };
    }

    // 重置统计
    reset() {
        this.stats = this.defaults();
        this.save();
    }
}

window.MatchEndUI = MatchEndUI;
window.PlayerStats = PlayerStats;
