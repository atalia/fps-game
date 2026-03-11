// gamemodes.js - 游戏模式系统
class GameModeSystem {
    constructor() {
        this.modes = this.loadModes();
        this.currentMode = null;
    }

    loadModes() {
        return {
            'deathmatch': {
                id: 'deathmatch',
                name: '死亡竞赛',
                description: '自由混战，击杀得分',
                icon: '💀',
                maxPlayers: 16,
                teamBased: false,
                scoreLimit: 30,
                timeLimit: 600, // 10分钟
                respawnDelay: 3,
                rules: {
                    friendlyFire: false,
                    killScore: 1,
                    deathPenalty: 0,
                    headshotBonus: 1
                }
            },
            'team-deathmatch': {
                id: 'team-deathmatch',
                name: '团队死斗',
                description: '红蓝对抗，团队击杀',
                icon: '⚔️',
                maxPlayers: 10,
                teamBased: true,
                teams: ['red', 'blue'],
                scoreLimit: 50,
                timeLimit: 600,
                respawnDelay: 3,
                rules: {
                    friendlyFire: false,
                    killScore: 1,
                    deathPenalty: 0,
                    headshotBonus: 1
                }
            },
            'capture-the-flag': {
                id: 'capture-the-flag',
                name: '夺旗模式',
                description: '夺取敌方旗帜',
                icon: '🚩',
                maxPlayers: 10,
                teamBased: true,
                teams: ['red', 'blue'],
                scoreLimit: 5,
                timeLimit: 900, // 15分钟
                respawnDelay: 5,
                rules: {
                    friendlyFire: false,
                    captureScore: 3,
                    killScore: 0,
                    flagCarrierSpeed: 0.7
                }
            },
            'free-for-all': {
                id: 'free-for-all',
                name: '大逃杀',
                description: '最后一人存活',
                icon: '🏃',
                maxPlayers: 20,
                teamBased: false,
                timeLimit: 0, // 无时间限制
                respawnDelay: 0, // 无重生
                rules: {
                    friendlyFire: true,
                    killScore: 1,
                    zoneShrink: true,
                    zoneDamage: 10
                }
            },
            'gun-game': {
                id: 'gun-game',
                name: '枪王争霸',
                description: '每杀一人升级武器',
                icon: '🔫',
                maxPlayers: 12,
                teamBased: false,
                timeLimit: 600,
                respawnDelay: 2,
                weaponProgression: [
                    'pistol', 'desert_eagle', 'smg', 'mp5',
                    'shotgun', 'spas12', 'rifle', 'ak47',
                    'm4a1', 'sniper', 'awp'
                ],
                rules: {
                    killScore: 1,
                    weaponChangeOnKill: true
                }
            },
            'one-shot': {
                id: 'one-shot',
                name: '一击必杀',
                description: '一枪毙命，狙击对决',
                icon: '🎯',
                maxPlayers: 10,
                teamBased: false,
                scoreLimit: 15,
                timeLimit: 300,
                respawnDelay: 2,
                rules: {
                    oneShotKill: true,
                    headshotOnly: false,
                    sniperOnly: true
                }
            },
            'zombie': {
                id: 'zombie',
                name: '僵尸模式',
                description: '人类 vs 僵尸',
                icon: '🧟',
                maxPlayers: 16,
                teamBased: true,
                teams: ['human', 'zombie'],
                timeLimit: 180, // 3分钟
                respawnDelay: 0,
                rules: {
                    zombieSpeed: 1.3,
                    zombieHealth: 200,
                    zombieInfection: true,
                    humanWeapons: true
                }
            },
            'king-of-the-hill': {
                id: 'king-of-the-hill',
                name: '占山为王',
                description: '占领区域得分',
                icon: '👑',
                maxPlayers: 10,
                teamBased: true,
                teams: ['red', 'blue'],
                scoreLimit: 200,
                timeLimit: 600,
                respawnDelay: 3,
                rules: {
                    capturePoint: { x: 0, z: 0, radius: 10 },
                    captureSpeed: 1,
                    holdScorePerSecond: 1
                }
            }
        };
    }

    getMode(id) {
        return this.modes[id] || null;
    }

    getAllModes() {
        return Object.values(this.modes);
    }

    setMode(id) {
        const mode = this.modes[id];
        if (!mode) return false;
        this.currentMode = mode;
        return true;
    }

    isTeamBased() {
        return this.currentMode?.teamBased || false;
    }

    getScoreLimit() {
        return this.currentMode?.scoreLimit || 30;
    }

    getTimeLimit() {
        return this.currentMode?.timeLimit || 600;
    }

    getRules() {
        return this.currentMode?.rules || {};
    }
}

// 游戏模式选择 UI
class GameModeSelectUI {
    constructor(container, gameModeSystem) {
        this.container = container;
        this.gameModeSystem = gameModeSystem;
        this.element = null;
        this.selectedMode = 'deathmatch';
        this.onSelect = null;
    }

    show() {
        if (this.element) {
            this.element.style.display = 'flex';
            return;
        }

        this.element = document.createElement('div');
        this.element.className = 'gamemode-select';
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
            padding: 30px;
            z-index: 400;
            overflow-y: auto;
        `;

        this.render();
        this.container.appendChild(this.element);
    }

    render() {
        const modes = this.gameModeSystem.getAllModes();

        this.element.innerHTML = `
            <h2 style="margin: 0 0 30px 0; color: white; font-size: 32px;">🎮 选择游戏模式</h2>
            
            <div style="
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 20px;
                max-width: 1200px;
                width: 100%;
            ">
                ${modes.map(mode => `
                    <div class="mode-card" data-id="${mode.id}" style="
                        background: ${this.selectedMode === mode.id ? 'rgba(79, 195, 247, 0.3)' : 'rgba(50, 50, 50, 0.8)'};
                        border: 2px solid ${this.selectedMode === mode.id ? '#4fc3f7' : '#555'};
                        border-radius: 15px;
                        padding: 20px;
                        cursor: pointer;
                        transition: all 0.3s;
                        text-align: center;
                    ">
                        <div style="font-size: 48px; margin-bottom: 10px;">${mode.icon}</div>
                        <h3 style="margin: 0 0 10px 0; color: ${this.selectedMode === mode.id ? '#4fc3f7' : 'white'};">${mode.name}</h3>
                        <p style="margin: 0 0 15px 0; color: #888; font-size: 13px;">${mode.description}</p>
                        <div style="display: flex; justify-content: center; gap: 15px; font-size: 12px; color: #aaa;">
                            <span>👥 ${mode.maxPlayers}</span>
                            ${mode.timeLimit ? `<span>⏱️ ${Math.floor(mode.timeLimit / 60)}分钟</span>` : '<span>⏱️ 无限</span>'}
                            ${mode.teamBased ? '<span>🤝 组队</span>' : '<span>👤 个人</span>'}
                        </div>
                    </div>
                `).join('')}
            </div>

            <div style="margin-top: 30px; display: flex; gap: 20px;">
                <button id="confirmMode" style="
                    padding: 15px 50px;
                    font-size: 18px;
                    background: #4CAF50;
                    border: none;
                    border-radius: 8px;
                    color: white;
                    cursor: pointer;
                ">确认选择</button>
                <button id="cancelMode" style="
                    padding: 15px 50px;
                    font-size: 18px;
                    background: #f44336;
                    border: none;
                    border-radius: 8px;
                    color: white;
                    cursor: pointer;
                ">取消</button>
            </div>
        `;

        this.bindEvents();
    }

    bindEvents() {
        this.element.querySelectorAll('.mode-card').forEach(card => {
            card.addEventListener('click', () => {
                this.selectedMode = card.dataset.id;
                this.render();
            });

            card.addEventListener('mouseenter', () => {
                if (card.dataset.id !== this.selectedMode) {
                    card.style.borderColor = '#888';
                }
            });

            card.addEventListener('mouseleave', () => {
                if (card.dataset.id !== this.selectedMode) {
                    card.style.borderColor = '#555';
                }
            });
        });

        this.element.querySelector('#confirmMode').addEventListener('click', () => {
            if (this.onSelect) {
                this.onSelect(this.selectedMode);
            }
            this.hide();
        });

        this.element.querySelector('#cancelMode').addEventListener('click', () => {
            this.hide();
        });
    }

    hide() {
        if (this.element) {
            this.element.style.display = 'none';
        }
    }
}

// 夺旗模式逻辑
class CaptureTheFlag {
    constructor() {
        this.flags = {
            red: { x: -40, z: 0, carrier: null, dropped: false },
            blue: { x: 40, z: 0, carrier: null, dropped: false }
        };
        this.captureZones = {
            red: { x: -40, z: 0, radius: 5 },
            blue: { x: 40, z: 0, radius: 5 }
        };
    }

    pickupFlag(team, playerId, playerPos) {
        const enemyTeam = team === 'red' ? 'blue' : 'red';
        const flag = this.flags[enemyTeam];

        if (flag.carrier || flag.dropped) return false;

        // 检查距离
        const dx = playerPos.x - flag.x;
        const dz = playerPos.z - flag.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist > 3) return false;

        flag.carrier = playerId;
        return true;
    }

    captureFlag(team, playerPos) {
        const zone = this.captureZones[team];
        const dx = playerPos.x - zone.x;
        const dz = playerPos.z - zone.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        return dist <= zone.radius;
    }

    dropFlag(team) {
        const enemyTeam = team === 'red' ? 'blue' : 'red';
        const flag = this.flags[enemyTeam];

        if (flag.carrier) {
            flag.dropped = true;
            flag.carrier = null;
            return true;
        }
        return false;
    }

    returnFlag(team) {
        const enemyTeam = team === 'red' ? 'blue' : 'red';
        const flag = this.flags[enemyTeam];

        if (flag.dropped) {
            flag.dropped = false;
            flag.x = enemyTeam === 'red' ? -40 : 40;
            flag.z = 0;
            return true;
        }
        return false;
    }
}

window.GameModeSystem = GameModeSystem;
window.GameModeSelectUI = GameModeSelectUI;
window.CaptureTheFlag = CaptureTheFlag;
