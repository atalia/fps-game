// ranked.js - 排位赛系统
class RankedSystem {
    constructor() {
        // 段位定义
        this.ranks = [
            { id: 'bronze', name: '青铜', minMMR: 0, maxMMR: 1499, icon: '🥉', divisions: [3, 2, 1] },
            { id: 'silver', name: '白银', minMMR: 1500, maxMMR: 1999, icon: '🥈', divisions: [3, 2, 1] },
            { id: 'gold', name: '黄金', minMMR: 2000, maxMMR: 2499, icon: '🥇', divisions: [3, 2, 1] },
            { id: 'platinum', name: '铂金', minMMR: 2500, maxMMR: 2999, icon: '💎', divisions: [3, 2, 1] },
            { id: 'diamond', name: '钻石', minMMR: 3000, maxMMR: 3499, icon: '💠', divisions: [3, 2, 1] },
            { id: 'master', name: '大师', minMMR: 3500, maxMMR: 3999, icon: '👑', divisions: [1] },
            { id: 'grandmaster', name: '宗师', minMMR: 4000, maxMMR: 4999, icon: '🏆', divisions: [1] },
            { id: 'challenger', name: '王者', minMMR: 5000, maxMMR: 9999, icon: '⭐', divisions: [1] }
        ];

        this.mmr = 1500;           // 匹配分数
        this.lp = 0;               // 联赛积分
        this.wins = 0;
        this.losses = 0;
        this.winStreak = 0;
        this.loseStreak = 0;
        this.promotionProgress = null; // 晋级赛进度
    }

    // 获取当前段位
    getCurrentRank() {
        for (const rank of this.ranks) {
            if (this.mmr >= rank.minMMR && this.mmr <= rank.maxMMR) {
                // 计算小段位
                const range = rank.maxMMR - rank.minMMR + 1;
                const progress = this.mmr - rank.minMMR;
                const divisionSize = range / rank.divisions.length;
                const divisionIndex = Math.floor(progress / divisionSize);
                const division = rank.divisions[Math.min(divisionIndex, rank.divisions.length - 1)];

                return {
                    ...rank,
                    division,
                    progress: (progress % divisionSize) / divisionSize * 100,
                    mmrToNext: rank.divisions.length > 1 
                        ? divisionSize - (progress % divisionSize)
                        : rank.maxMMR - this.mmr + 1
                };
            }
        }

        return this.ranks[this.ranks.length - 1];
    }

    // 计算比赛结果
    calculateMatchResult(won, performance) {
        // 基础 MMR 变化
        let mmrChange = 0;
        let lpChange = 0;

        // 基础分数
        const baseMMR = won ? 25 : -20;

        // KDA 修正
        const kdaMultiplier = Math.max(0.5, Math.min(1.5, performance.kda / 2));

        // 连胜/连败修正
        let streakMultiplier = 1;
        if (won) {
            this.winStreak++;
            this.loseStreak = 0;
            streakMultiplier = 1 + Math.min(this.winStreak * 0.1, 0.5);
        } else {
            this.loseStreak++;
            this.winStreak = 0;
            streakMultiplier = 1 - Math.min(this.loseStreak * 0.05, 0.3);
        }

        // 计算最终变化
        mmrChange = Math.round(baseMMR * kdaMultiplier * streakMultiplier);

        // 钻石以上减少 MMR 变化
        const currentRank = this.getCurrentRank();
        if (currentRank.id === 'diamond') {
            mmrChange = Math.round(mmrChange * 0.8);
        } else if (currentRank.id === 'master' || currentRank.id === 'grandmaster') {
            mmrChange = Math.round(mmrChange * 0.6);
        } else if (currentRank.id === 'challenger') {
            mmrChange = Math.round(mmrChange * 0.5);
        }

        // LP 变化
        lpChange = won ? 20 : -15;

        // 应用变化
        const oldMMR = this.mmr;
        const oldRank = this.getCurrentRank();

        this.mmr = Math.max(0, this.mmr + mmrChange);
        this.lp = Math.max(-100, Math.min(100, this.lp + lpChange));

        if (won) {
            this.wins++;
        } else {
            this.losses++;
        }

        const newRank = this.getCurrentRank();

        // 检查是否晋级
        const promoted = this.checkPromotion(oldRank, newRank);

        return {
            mmrChange,
            lpChange,
            oldMMR,
            newMMR: this.mmr,
            oldRank,
            newRank,
            promoted,
            winStreak: this.winStreak,
            loseStreak: this.loseStreak
        };
    }

    // 检查晋级
    checkPromotion(oldRank, newRank) {
        // 段位提升
        if (this.getRankIndex(newRank.id) > this.getRankIndex(oldRank.id)) {
            return {
                type: 'rank_up',
                from: oldRank,
                to: newRank
            };
        }

        // 小段位提升
        if (oldRank.id === newRank.id && newRank.division < oldRank.division) {
            return {
                type: 'division_up',
                from: oldRank,
                to: newRank
            };
        }

        return null;
    }

    // 获取段位索引
    getRankIndex(rankId) {
        return this.ranks.findIndex(r => r.id === rankId);
    }

    // 获取段位统计
    getStats() {
        const rank = this.getCurrentRank();
        const totalGames = this.wins + this.losses;
        const winRate = totalGames > 0 ? (this.wins / totalGames * 100).toFixed(1) : 0;

        return {
            mmr: this.mmr,
            lp: this.lp,
            rank: rank,
            wins: this.wins,
            losses: this.losses,
            winRate,
            winStreak: this.winStreak,
            loseStreak: this.loseStreak,
            totalGames
        };
    }

    // 获取排名信息
    getLeaderboardPosition(allPlayers) {
        const sortedPlayers = [...allPlayers].sort((a, b) => b.mmr - a.mmr);
        const position = sortedPlayers.findIndex(p => p.mmr === this.mmr) + 1;
        const percentile = (1 - position / sortedPlayers.length) * 100;

        return {
            position,
            total: sortedPlayers.length,
            percentile: percentile.toFixed(1),
            topPercent: percentile >= 95,
            top100: position <= 100
        };
    }
}

// 排位赛 UI
class RankedUI {
    constructor(container, rankedSystem) {
        this.container = container;
        this.rankedSystem = rankedSystem;
        this.element = null;
    }

    show() {
        if (this.element) {
            this.element.style.display = 'flex';
            this.render();
            return;
        }

        this.element = document.createElement('div');
        this.element.className = 'ranked-ui';
        this.element.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.95);
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 40px;
            z-index: 400;
            overflow-y: auto;
        `;

        this.render();
        this.container.appendChild(this.element);
    }

    render() {
        const stats = this.rankedSystem.getStats();
        const rank = stats.rank;

        this.element.innerHTML = `
            <button id="closeRanked" style="
                position: absolute;
                top: 20px;
                right: 20px;
                background: #f44336;
                border: none;
                color: white;
                padding: 10px 20px;
                border-radius: 5px;
                cursor: pointer;
            ">关闭</button>

            <div style="text-align: center; margin-bottom: 40px;">
                <div style="font-size: 80px; margin-bottom: 10px;">${rank.icon}</div>
                <h1 style="margin: 0; color: white; font-size: 36px;">
                    ${rank.name} ${rank.divisions.length > 1 ? rank.division : ''}
                </h1>
                <div style="color: #4fc3f7; font-size: 24px; margin-top: 10px;">
                    MMR: ${stats.mmr}
                </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; width: 100%; max-width: 800px;">
                <div style="background: rgba(50, 50, 50, 0.8); padding: 20px; border-radius: 10px; text-align: center;">
                    <div style="color: #4CAF50; font-size: 32px; font-weight: bold;">${stats.wins}</div>
                    <div style="color: #888; margin-top: 5px;">胜利</div>
                </div>
                <div style="background: rgba(50, 50, 50, 0.8); padding: 20px; border-radius: 10px; text-align: center;">
                    <div style="color: #f44336; font-size: 32px; font-weight: bold;">${stats.losses}</div>
                    <div style="color: #888; margin-top: 5px;">失败</div>
                </div>
                <div style="background: rgba(50, 50, 50, 0.8); padding: 20px; border-radius: 10px; text-align: center;">
                    <div style="color: #4fc3f7; font-size: 32px; font-weight: bold;">${stats.winRate}%</div>
                    <div style="color: #888; margin-top: 5px;">胜率</div>
                </div>
                <div style="background: rgba(50, 50, 50, 0.8); padding: 20px; border-radius: 10px; text-align: center;">
                    <div style="color: #ffc107; font-size: 32px; font-weight: bold;">${stats.totalGames}</div>
                    <div style="color: #888; margin-top: 5px;">总场次</div>
                </div>
            </div>

            <div style="margin-top: 30px; width: 100%; max-width: 600px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <span style="color: #888;">段位进度</span>
                    <span style="color: white;">${rank.progress.toFixed(1)}%</span>
                </div>
                <div style="height: 20px; background: rgba(50, 50, 50, 0.8); border-radius: 10px; overflow: hidden;">
                    <div style="
                        height: 100%;
                        width: ${rank.progress}%;
                        background: linear-gradient(90deg, #4fc3f7, #4CAF50);
                        border-radius: 10px;
                    "></div>
                </div>
                <div style="display: flex; justify-content: space-between; margin-top: 5px;">
                    <span style="color: #888; font-size: 12px;">${rank.name} ${rank.division}</span>
                    <span style="color: #888; font-size: 12px;">下一段位还需 ${rank.mmrToNext} MMR</span>
                </div>
            </div>

            <div style="margin-top: 30px; width: 100%; max-width: 600px;">
                <h3 style="color: white; margin-bottom: 15px;">段位列表</h3>
                <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                    ${this.rankedSystem.ranks.map(r => `
                        <div style="
                            background: ${r.id === rank.id ? 'rgba(79, 195, 247, 0.3)' : 'rgba(50, 50, 50, 0.8)'};
                            border: 1px solid ${r.id === rank.id ? '#4fc3f7' : 'transparent'};
                            padding: 10px 15px;
                            border-radius: 5px;
                            display: flex;
                            align-items: center;
                            gap: 8px;
                        ">
                            <span style="font-size: 20px;">${r.icon}</span>
                            <span style="color: ${r.id === rank.id ? '#4fc3f7' : 'white'};">${r.name}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        this.element.querySelector('#closeRanked').addEventListener('click', () => {
            this.hide();
        });
    }

    hide() {
        if (this.element) {
            this.element.style.display = 'none';
        }
    }
}

// 排位赛匹配
class RankedMatchmaking {
    constructor(rankedSystem) {
        this.rankedSystem = rankedSystem;
        this.queue = [];
        this.isQueuing = false;
        this.queueStartTime = 0;
        this.estimatedWaitTime = 60000; // 1分钟预估
    }

    // 加入排位队列
    joinQueue() {
        if (this.isQueuing) return false;

        this.isQueuing = true;
        this.queueStartTime = Date.now();

        this.queue.push({
            mmr: this.rankedSystem.mmr,
            rank: this.rankedSystem.getCurrentRank(),
            timestamp: Date.now(),
            expanded: false
        });

        return true;
    }

    // 离开队列
    leaveQueue() {
        this.isQueuing = false;
        this.queue = [];
    }

    // 获取队列时间
    getQueueTime() {
        if (!this.isQueuing) return 0;
        return Date.now() - this.queueStartTime;
    }

    // 匹配逻辑
    findMatch(otherPlayers) {
        const myMMR = this.rankedSystem.mmr;
        const queueTime = this.getQueueTime();

        // 匹配范围随时间扩大
        let mmrRange = 100; // 初始 ±100 MMR
        mmrRange += Math.floor(queueTime / 30000) * 50; // 每30秒扩大50

        // 限制最大范围
        mmrRange = Math.min(mmrRange, 500);

        // 筛选匹配范围内的玩家
        const candidates = otherPlayers.filter(p => {
            const mmrDiff = Math.abs(p.mmr - myMMR);
            return mmrDiff <= mmrRange;
        });

        // 按MMR差距排序
        candidates.sort((a, b) => {
            const diffA = Math.abs(a.mmr - myMMR);
            const diffB = Math.abs(b.mmr - myMMR);
            return diffA - diffB;
        });

        return candidates.length >= 1 ? candidates.slice(0, 10) : null;
    }

    // 获取匹配状态
    getStatus() {
        return {
            isQueuing: this.isQueuing,
            queueTime: this.getQueueTime(),
            estimatedWaitTime: this.estimatedWaitTime,
            position: this.queue.length,
            mmr: this.rankedSystem.mmr,
            rank: this.rankedSystem.getCurrentRank()
        };
    }
}

window.RankedSystem = RankedSystem;
window.RankedUI = RankedUI;
window.RankedMatchmaking = RankedMatchmaking;
