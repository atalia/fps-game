// team-client.js - 客户端团队系统
class TeamSystem {
    constructor() {
        this.teams = new Map();
        this.playerTeam = new Map(); // playerId -> teamId
        this.myTeam = null;
    }

    // 设置队伍数据
    setTeams(teams) {
        this.teams.clear();
        for (const team of teams) {
            this.teams.set(team.id, team);
        }
    }

    // 获取队伍
    getTeam(teamId) {
        return this.teams.get(teamId);
    }

    // 获取所有队伍
    getAllTeams() {
        return Array.from(this.teams.values());
    }

    // 设置玩家队伍
    setPlayerTeam(playerId, teamId) {
        this.playerTeam.set(playerId, teamId);
    }

    // 获取玩家队伍
    getPlayerTeam(playerId) {
        const teamId = this.playerTeam.get(playerId);
        return this.teams.get(teamId);
    }

    // 获取队伍玩家列表
    getTeamPlayers(teamId) {
        const players = [];
        for (const [playerId, tId] of this.playerTeam) {
            if (tId === teamId) {
                players.push(playerId);
            }
        }
        return players;
    }

    // 更新队伍分数
    updateScore(teamId, score) {
        const team = this.teams.get(teamId);
        if (team) {
            team.score = score;
        }
    }

    // 获取领先队伍
    getWinningTeam() {
        let winner = null;
        for (const team of this.teams.values()) {
            if (!winner || team.score > winner.score) {
                winner = team;
            }
        }
        return winner;
    }
}

// 团队选择 UI
class TeamSelectUI {
    constructor(container, teamSystem) {
        this.container = container;
        this.teamSystem = teamSystem;
        this.element = null;
        this.onSelect = null;
    }

    show() {
        if (this.element) {
            this.element.style.display = 'flex';
            return;
        }

        this.element = document.createElement('div');
        this.element.className = 'team-select';
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
            z-index: 400;
        `;

        this.render();
        this.container.appendChild(this.element);
    }

    render() {
        const teams = this.teamSystem.getAllTeams();

        this.element.innerHTML = `
            <h2 style="margin: 0 0 40px 0; color: white; font-size: 32px;">选择队伍</h2>
            
            <div style="display: flex; gap: 40px;">
                ${teams.map(team => `
                    <div class="team-card" data-id="${team.id}" style="
                        width: 250px;
                        padding: 30px;
                        background: linear-gradient(135deg, ${team.color}22, ${team.color}44);
                        border: 3px solid ${team.color};
                        border-radius: 15px;
                        cursor: pointer;
                        text-align: center;
                        transition: all 0.3s;
                    ">
                        <div style="
                            font-size: 64px;
                            margin-bottom: 15px;
                            text-shadow: 0 0 20px ${team.color};
                        ">${team.id === 'red' ? '🔴' : '🔵'}</div>
                        <h3 style="margin: 0 0 10px 0; color: ${team.color};">${team.name}</h3>
                        <div style="color: #888; margin-bottom: 15px;">
                            ${team.player_count || 0} / ${team.max_players} 玩家
                        </div>
                        <div style="font-size: 24px; color: white;">
                            分数: ${team.score || 0}
                        </div>
                    </div>
                `).join('')}
            </div>

            <button id="autoAssign" style="
                margin-top: 40px;
                padding: 15px 40px;
                font-size: 18px;
                background: #333;
                border: 2px solid #666;
                border-radius: 8px;
                color: white;
                cursor: pointer;
            ">🎲 自动分配</button>
        `;

        this.bindEvents();
    }

    bindEvents() {
        this.element.querySelectorAll('.team-card').forEach(card => {
            card.addEventListener('click', () => {
                const teamId = card.dataset.id;
                if (this.onSelect) {
                    this.onSelect(teamId);
                }
            });

            card.addEventListener('mouseenter', () => {
                card.style.transform = 'scale(1.05)';
            });

            card.addEventListener('mouseleave', () => {
                card.style.transform = 'scale(1)';
            });
        });

        this.element.querySelector('#autoAssign').addEventListener('click', () => {
            if (this.onSelect) {
                this.onSelect('auto');
            }
        });
    }

    hide() {
        if (this.element) {
            this.element.style.display = 'none';
        }
    }
}

// 团队分数显示
class TeamScoreUI {
    constructor(container) {
        this.container = container;
        this.element = null;
        this.teams = [];
    }

    show(teams) {
        this.teams = teams;

        if (!this.element) {
            this.element = document.createElement('div');
            this.element.className = 'team-score';
            this.element.style.cssText = `
                position: absolute;
                top: 10px;
                left: 50%;
                transform: translateX(-50%);
                display: flex;
                gap: 30px;
                padding: 10px 30px;
                background: rgba(0, 0, 0, 0.7);
                border-radius: 10px;
                z-index: 100;
            `;
            this.container.appendChild(this.element);
        }

        this.render();
    }

    render() {
        const winner = this.getWinningTeam();

        this.element.innerHTML = this.teams.map(team => {
            const isWinning = winner && winner.id === team.id;
            return `
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="
                        width: 12px;
                        height: 12px;
                        background: ${team.color};
                        border-radius: 50%;
                        box-shadow: ${isWinning ? `0 0 10px ${team.color}` : 'none'};
                    "></div>
                    <span style="color: ${team.color}; font-weight: bold;">${team.name}</span>
                    <span style="color: white; font-size: 24px; font-weight: bold;">${team.score}</span>
                </div>
            `;
        }).join('<div style="color: #666; font-size: 24px;">vs</div>');
    }

    getWinningTeam() {
        if (this.teams.length === 0) return null;
        return this.teams.reduce((a, b) => a.score > b.score ? a : b);
    }

    hide() {
        if (this.element) {
            this.element.style.display = 'none';
        }
    }

    update(teamId, score) {
        const team = this.teams.find(t => t.id === teamId);
        if (team) {
            team.score = score;
            this.render();
        }
    }
}

window.TeamSystem = TeamSystem;
window.TeamSelectUI = TeamSelectUI;
window.TeamScoreUI = TeamScoreUI;
