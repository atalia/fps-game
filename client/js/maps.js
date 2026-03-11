// maps.js - 多地图系统
class MapSystem {
    constructor() {
        this.maps = {};
        this.currentMap = null;
        this.loadDefaultMaps();
    }

    loadDefaultMaps() {
        // 经典地图 - 对称布局
        this.maps['classic'] = {
            id: 'classic',
            name: '经典竞技场',
            description: '对称布局，适合团队对抗',
            maxPlayers: 10,
            spawnPoints: [
                // 队伍1 出生点
                { x: -40, y: 0, z: 0, team: 1 },
                { x: -40, y: 0, z: 10, team: 1 },
                { x: -40, y: 0, z: -10, team: 1 },
                { x: -35, y: 0, z: 5, team: 1 },
                { x: -35, y: 0, z: -5, team: 1 },
                // 队伍2 出生点
                { x: 40, y: 0, z: 0, team: 2 },
                { x: 40, y: 0, z: 10, team: 2 },
                { x: 40, y: 0, z: -10, team: 2 },
                { x: 35, y: 0, z: 5, team: 2 },
                { x: 35, y: 0, z: -5, team: 2 },
            ],
            obstacles: [
                // 中央建筑
                { x: 0, z: 0, w: 15, h: 5, d: 15, color: 0x555555 },
                // 侧翼掩体
                { x: 20, z: 20, w: 6, h: 3, d: 6, color: 0x666666 },
                { x: -20, z: 20, w: 6, h: 3, d: 6, color: 0x666666 },
                { x: 20, z: -20, w: 6, h: 3, d: 6, color: 0x666666 },
                { x: -20, z: -20, w: 6, h: 3, d: 6, color: 0x666666 },
                // 走廊
                { x: 30, z: 0, w: 2, h: 4, d: 20, color: 0x444444 },
                { x: -30, z: 0, w: 2, h: 4, d: 20, color: 0x444444 },
                { x: 0, z: 30, w: 20, h: 4, d: 2, color: 0x444444 },
                { x: 0, z: -30, w: 20, h: 4, d: 2, color: 0x444444 },
            ],
            powerupSpawns: [
                { x: 15, y: 0, z: 15 },
                { x: -15, y: 0, z: 15 },
                { x: 15, y: 0, z: -15 },
                { x: -15, y: 0, z: -15 },
                { x: 0, y: 0, z: 0 },
            ],
            bounds: { minX: -50, maxX: 50, minZ: -50, maxZ: 50 },
            skyColor: 0x87CEEB,
            groundColor: 0x3a5f0b,
        };

        // 狭窄地图 - 近战
        this.maps['close'] = {
            id: 'close',
            name: '巷战',
            description: '狭窄通道，近距离作战',
            maxPlayers: 6,
            spawnPoints: [
                { x: -20, y: 0, z: 0, team: 1 },
                { x: -20, y: 0, z: 5, team: 1 },
                { x: -20, y: 0, z: -5, team: 1 },
                { x: 20, y: 0, z: 0, team: 2 },
                { x: 20, y: 0, z: 5, team: 2 },
                { x: 20, y: 0, z: -5, team: 2 },
            ],
            obstacles: [
                // 狭窄走廊
                { x: -10, z: 5, w: 3, h: 4, d: 8, color: 0x555555 },
                { x: 10, z: 5, w: 3, h: 4, d: 8, color: 0x555555 },
                { x: -10, z: -5, w: 3, h: 4, d: 8, color: 0x555555 },
                { x: 10, z: -5, w: 3, h: 4, d: 8, color: 0x555555 },
                // 中央障碍
                { x: 0, z: 0, w: 5, h: 3, d: 5, color: 0x666666 },
            ],
            powerupSpawns: [
                { x: 0, y: 0, z: 8 },
                { x: 0, y: 0, z: -8 },
            ],
            bounds: { minX: -25, maxX: 25, minZ: -15, maxZ: 15 },
            skyColor: 0x2f4f4f,
            groundColor: 0x4a4a4a,
        };

        // 大型地图 - 远距离
        this.maps['sniper'] = {
            id: 'sniper',
            name: '狙击场',
            description: '开阔地带，适合远距离作战',
            maxPlayers: 16,
            spawnPoints: [
                // 四角出生
                { x: -80, y: 0, z: -80, team: 1 },
                { x: -80, y: 0, z: -70, team: 1 },
                { x: -70, y: 0, z: -80, team: 1 },
                { x: -80, y: 0, z: -60, team: 1 },
                { x: -70, y: 0, z: -70, team: 1 },
                { x: 80, y: 0, z: 80, team: 2 },
                { x: 80, y: 0, z: 70, team: 2 },
                { x: 70, y: 0, z: 80, team: 2 },
                { x: 80, y: 0, z: 60, team: 2 },
                { x: 70, y: 0, z: 70, team: 2 },
                // 额外出生点
                { x: -80, y: 0, z: 80, team: 1 },
                { x: -70, y: 0, z: 70, team: 1 },
                { x: 80, y: 0, z: -80, team: 2 },
                { x: 70, y: 0, z: -70, team: 2 },
            ],
            obstacles: [
                // 散落的掩体
                { x: 0, z: 0, w: 20, h: 6, d: 20, color: 0x4a4a4a },
                { x: 40, z: 40, w: 8, h: 4, d: 8, color: 0x555555 },
                { x: -40, z: 40, w: 8, h: 4, d: 8, color: 0x555555 },
                { x: 40, z: -40, w: 8, h: 4, d: 8, color: 0x555555 },
                { x: -40, z: -40, w: 8, h: 4, d: 8, color: 0x555555 },
                // 狙击塔
                { x: 60, z: 0, w: 4, h: 10, d: 4, color: 0x333333 },
                { x: -60, z: 0, w: 4, h: 10, d: 4, color: 0x333333 },
                { x: 0, z: 60, w: 4, h: 10, d: 4, color: 0x333333 },
                { x: 0, z: -60, w: 4, h: 10, d: 4, color: 0x333333 },
            ],
            powerupSpawns: [
                { x: 0, y: 0, z: 0 },
                { x: 50, y: 0, z: 50 },
                { x: -50, y: 0, z: 50 },
                { x: 50, y: 0, z: -50 },
                { x: -50, y: 0, z: -50 },
            ],
            bounds: { minX: -100, maxX: 100, minZ: -100, maxZ: 100 },
            skyColor: 0x1a1a2e,
            groundColor: 0x2d3436,
        };

        // 室内地图 - 多层
        this.maps['indoor'] = {
            id: 'indoor',
            name: '仓库',
            description: '室内多层结构',
            maxPlayers: 8,
            spawnPoints: [
                { x: -15, y: 0, z: -15, team: 1 },
                { x: -15, y: 0, z: -10, team: 1 },
                { x: -10, y: 0, z: -15, team: 1 },
                { x: 15, y: 0, z: 15, team: 2 },
                { x: 15, y: 0, z: 10, team: 2 },
                { x: 10, y: 0, z: 15, team: 2 },
                // 二楼
                { x: 0, y: 5, z: 0, team: 0 },
                { x: 5, y: 5, z: 5, team: 0 },
            ],
            obstacles: [
                // 墙壁
                { x: 0, z: -15, w: 30, h: 8, d: 1, color: 0x666666 },
                { x: 0, z: 15, w: 30, h: 8, d: 1, color: 0x666666 },
                { x: -15, z: 0, w: 1, h: 8, d: 30, color: 0x666666 },
                { x: 15, z: 0, w: 1, h: 8, d: 30, color: 0x666666 },
                // 箱子
                { x: -8, z: -8, w: 4, h: 3, d: 4, color: 0x8B4513 },
                { x: 8, z: 8, w: 4, h: 3, d: 4, color: 0x8B4513 },
                // 二楼平台
                { x: 0, z: 0, w: 10, h: 1, d: 10, color: 0x555555 },
                // 柱子
                { x: -10, z: -10, w: 2, h: 8, d: 2, color: 0x444444 },
                { x: 10, z: -10, w: 2, h: 8, d: 2, color: 0x444444 },
                { x: -10, z: 10, w: 2, h: 8, d: 2, color: 0x444444 },
                { x: 10, z: 10, w: 2, h: 8, d: 2, color: 0x444444 },
            ],
            powerupSpawns: [
                { x: 0, y: 0, z: 0 },
                { x: 0, y: 5, z: 0 },
            ],
            bounds: { minX: -15, maxX: 15, minZ: -15, maxZ: 15 },
            skyColor: 0x1a1a1a,
            groundColor: 0x4a4a4a,
        };
    }

    getMap(id) {
        return this.maps[id] || null;
    }

    getAllMaps() {
        return Object.values(this.maps);
    }

    setMap(id) {
        const map = this.maps[id];
        if (!map) return false;
        this.currentMap = map;
        return true;
    }

    getSpawnPoint(team = 0) {
        if (!this.currentMap) return { x: 0, y: 0, z: 0 };

        const spawns = this.currentMap.spawnPoints.filter(s => 
            team === 0 || s.team === 0 || s.team === team
        );

        if (spawns.length === 0) return { x: 0, y: 0, z: 0 };

        const spawn = spawns[Math.floor(Math.random() * spawns.length)];
        return { x: spawn.x, y: spawn.y, z: spawn.z };
    }

    isInBounds(x, z) {
        if (!this.currentMap) return true;

        const bounds = this.currentMap.bounds;
        return x >= bounds.minX && x <= bounds.maxX && 
               z >= bounds.minZ && z <= bounds.maxZ;
    }
}

// 地图选择 UI
class MapSelectUI {
    constructor(container, mapSystem) {
        this.container = container;
        this.mapSystem = mapSystem;
        this.element = null;
        this.selectedMap = 'classic';
        this.onSelect = null;
    }

    show() {
        if (this.element) {
            this.element.style.display = 'block';
            return;
        }

        this.element = document.createElement('div');
        this.element.className = 'map-select';
        this.element.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.9);
            padding: 30px;
            border-radius: 15px;
            color: white;
            min-width: 600px;
            z-index: 100;
        `;

        this.render();
        this.container.appendChild(this.element);
    }

    render() {
        const maps = this.mapSystem.getAllMaps();

        this.element.innerHTML = `
            <h2 style="margin: 0 0 20px 0; text-align: center;">🗺️ 选择地图</h2>
            <div class="map-grid" style="
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 15px;
            ">
                ${maps.map(map => `
                    <div class="map-card" data-id="${map.id}" style="
                        background: ${this.selectedMap === map.id ? 'rgba(0, 255, 0, 0.2)' : 'rgba(50, 50, 50, 0.8)'};
                        border: 2px solid ${this.selectedMap === map.id ? '#00ff00' : '#555'};
                        border-radius: 10px;
                        padding: 15px;
                        cursor: pointer;
                        transition: all 0.3s;
                    ">
                        <h3 style="margin: 0 0 10px 0; color: #4fc3f7;">${map.name}</h3>
                        <p style="margin: 0 0 10px 0; color: #aaa; font-size: 14px;">${map.description}</p>
                        <div style="display: flex; gap: 15px; font-size: 12px; color: #888;">
                            <span>👥 ${map.maxPlayers}人</span>
                            <span>📦 ${map.obstacles.length}障碍</span>
                            <span>💎 ${map.powerupSpawns.length}道具</span>
                        </div>
                    </div>
                `).join('')}
            </div>
            <div style="text-align: center; margin-top: 20px;">
                <button id="confirmMap" style="
                    padding: 15px 40px;
                    font-size: 16px;
                    background: #4CAF50;
                    border: none;
                    border-radius: 8px;
                    color: white;
                    cursor: pointer;
                ">确认选择</button>
            </div>
        `;

        this.bindEvents();
    }

    bindEvents() {
        // 地图卡片点击
        this.element.querySelectorAll('.map-card').forEach(card => {
            card.addEventListener('click', () => {
                this.selectedMap = card.dataset.id;
                this.render();
            });
        });

        // 确认按钮
        this.element.querySelector('#confirmMap').addEventListener('click', () => {
            if (this.onSelect) {
                this.onSelect(this.selectedMap);
            }
            this.hide();
        });
    }

    hide() {
        if (this.element) {
            this.element.style.display = 'none';
        }
    }
}

window.MapSystem = MapSystem;
window.MapSelectUI = MapSelectUI;
