// main.js - 主入口
let gameStarted = false;

async function init() {
    const loading = document.getElementById('loading');
    const loadingText = loading ? loading.querySelector('p') : null;

    try {
        console.log('🚀 Starting game initialization...');
        console.log('📍 DOM Elements:', {
            loading: !!loading,
            loadingText: !!loadingText,
            gameContainer: !!document.getElementById('game-container')
        });

        if (!loading || !loadingText) {
            throw new Error('DOM 元素未找到，请检查 HTML 结构');
        }
        
        // 更新加载状态
        loadingText.textContent = '初始化音效系统...';
        
        // 检查类是否存在
        console.log('📦 Checking required classes:', {
            AudioManager: typeof AudioManager !== 'undefined',
            UIManager: typeof UIManager !== 'undefined',
            ScreenEffects: typeof ScreenEffects !== 'undefined',
            Renderer: typeof Renderer !== 'undefined',
            Network: typeof Network !== 'undefined',
            Lobby: typeof Lobby !== 'undefined',
            Game: typeof Game !== 'undefined'
        });

        // 初始化音效
        if (typeof AudioManager === 'undefined') {
            throw new Error('AudioManager 类未定义，请检查 audio.js 加载');
        }
        window.audioManager = new AudioManager();
        await window.audioManager.init();
        console.log('✅ Audio initialized');

        // 初始化 UI
        loadingText.textContent = '初始化界面...';
        if (typeof UIManager === 'undefined') {
            throw new Error('UIManager 类未定义，请检查 ui.js 加载');
        }
        if (typeof ScreenEffects === 'undefined') {
            throw new Error('ScreenEffects 类未定义，请检查 effects.js 加载');
        }
        window.uiManager = new UIManager();
        window.screenEffects = new ScreenEffects();
        console.log('✅ UI initialized');

        // 初始化渲染器
        loadingText.textContent = '初始化渲染器...';
        if (typeof Renderer === 'undefined') {
            throw new Error('Renderer 类未定义，请检查 renderer.js 加载');
        }
        window.renderer = new Renderer('game-container');
        console.log('✅ Renderer initialized');

        // 初始化特效系统
        loadingText.textContent = '初始化特效系统...';
        if (typeof EffectsSystem !== 'undefined' && typeof PerformanceMonitor !== 'undefined') {
            window.performanceMonitor = new PerformanceMonitor();
            window.effectsSystem = new EffectsSystem(window.renderer);
            console.log('✅ Effects system initialized');
        } else {
            console.warn('⚠️ Effects system not loaded, using fallback');
        }

        // 初始化网络
        loadingText.textContent = '连接服务器...';
        if (typeof Network === 'undefined') {
            throw new Error('Network 类未定义，请检查 network.js 加载');
        }
        const wsUrl = `ws://${window.location.host}/ws`;
        console.log('🔌 Connecting to:', wsUrl);
        window.network = new Network(wsUrl);

        // 设置网络事件处理
        setupNetworkHandlers();

        // 等待连接
        await new Promise((resolve, reject) => {
            window.network.onConnect = () => {
                console.log('✅ WebSocket connected');
                resolve();
            };
            window.network.onError = (err) => {
                console.error('❌ WebSocket error:', err);
                reject(new Error('WebSocket 连接失败'));
            };
            setTimeout(() => reject(new Error('连接超时 (10秒)')), 10000);
        });

        // 初始化大厅
        loadingText.textContent = '加载大厅...';
        if (typeof Lobby === 'undefined') {
            throw new Error('Lobby 类未定义，请检查 lobby.js 加载');
        }
        window.lobby = new Lobby();

        // 隐藏加载画面
        loading.style.display = 'none';

        console.log('🎮 Game initialized successfully!');

    } catch (error) {
        console.error('初始化失败:', error);
        if (loading) {
            loading.innerHTML = `
                <h1>❌ 初始化失败</h1>
                <p style="color: #ff6b6b;">${error.message}</p>
                <p style="color: #888; margin-top: 10px; font-size: 14px;">
                    请检查控制台 (F12) 获取详细信息
                </p>
                <p style="margin-top: 20px">
                    <button onclick="location.reload()" style="
                        padding: 12px 24px; 
                        font-size: 16px; 
                        cursor: pointer;
                        background: #4CAF50;
                        color: white;
                        border: none;
                        border-radius: 5px;
                    ">
                        🔄 重试
                    </button>
                </p>
            `;
        }
    }
}

function setupNetworkHandlers() {
    // 辅助函数：刷新玩家列表 UI
    function refreshPlayerList() {
        if (!window.game || !window.game.players) return
        const players = Array.from(window.game.players.values())
        // 添加自己
        if (window.game.player) {
            const selfInList = players.find(p => p.id === window.game.player.id)
            if (!selfInList) {
                players.unshift({
                    id: window.game.player.id,
                    name: window.game.player.name || 'You',
                    kills: window.game.player.kills || 0,
                    health: window.game.player.health || 100,
                    is_bot: false
                })
            }
        }
        window.uiManager.updatePlayerList(players)
    }
    
    // 房间加入成功
    window.network.on('room_joined', (data) => {
        console.log('✅ Joined room:', data.room_id);
        
        window.uiManager.updateRoom(data.room_id, data.player_count);
        window.uiManager.showMessage(`已加入房间 ${data.room_id}`);
        
        // 设置当前玩家 ID
        window.uiManager.setSelfPlayerId(data.player_id);

        // 初始化游戏
        if (!gameStarted) {
            startGame(data.player_id);
        }
        
        // 创建房间内现有玩家的模型（排除自己）
        if (data.players && Array.isArray(data.players)) {
            console.log('Room has', data.players.length, 'players');
            
            // 更新玩家列表 UI
            window.uiManager.updatePlayerList(data.players);
            
            data.players.forEach(player => {
                if (player.id !== data.player_id) {
                    console.log('Creating existing player:', player.id, 'position:', player.position);
                    const position = player.position || { x: 0, y: 0, z: 0 };
                    window.renderer.addPlayer(player.id, position, player.is_bot || false);
                    
                    // 如果是机器人，显示 AI 标签
                    if (player.is_bot && window.aiLabels) {
                        window.aiLabels.createLabel(player.id, player.name, player.difficulty);
                    }
                    
                    // 同步到 game.players Map
                    if (window.game && window.game.players) {
                        window.game.players.set(player.id, {
                            id: player.id,
                            name: player.name,
                            position: position,
                            rotation: player.rotation || 0,
                            is_bot: player.is_bot,
                            kills: player.kills || 0,
                            health: player.health || 100
                        });
                    }
                }
            });
        }
    });

    // 玩家加入
    window.network.on('player_joined', (data) => {
        console.log('Player joined:', data.name, 'position:', data.position, 'is_bot:', data.is_bot);
        // 确保位置有效
        const position = data.position || { x: 0, y: 0, z: 0 };
        window.renderer.addPlayer(data.player_id, position, false);
        
        // 如果是机器人，显示 AI 标签
        if (data.is_bot && window.aiLabels) {
            window.aiLabels.createLabel(data.player_id, data.name, data.difficulty);
        }
        
        window.uiManager.addKillFeed(`${data.name || data.player_id} 加入了游戏`);
        
        // 同步到 game.players Map
        if (window.game && window.game.players) {
            window.game.players.set(data.player_id, {
                id: data.player_id,
                name: data.name,
                position: position,
                rotation: 0,
                is_bot: data.is_bot,
                kills: data.kills || 0,
                health: data.health || 100
            });
        }
        
        // 更新玩家列表 UI
        if (typeof refreshPlayerList === 'function') refreshPlayerList();
    });

    // 玩家离开
    window.network.on('player_left', (data) => {
        console.log('Player left:', data.player_id);
        window.renderer.removePlayer(data.player_id);
        
        // 移除 AI 标签
        if (window.aiLabels) {
            window.aiLabels.removeLabel(data.player_id);
        }
        
        window.uiManager.addKillFeed(`${data.name || data.player_id} 离开了游戏`);
        
        // 从 game.players Map 移除
        if (window.game && window.game.players) {
            window.game.players.delete(data.player_id);
        }
        
        // 更新玩家列表 UI
        if (typeof refreshPlayerList === 'function') refreshPlayerList();
    });

    // 玩家移动
    window.network.on('player_moved', (data) => {
        window.renderer.updatePlayer(data.player_id, data.position, data.rotation);
        
        // 同步到 game.players Map
        if (window.game && window.game.players) {
            const player = window.game.players.get(data.player_id);
            if (player) {
                player.position = data.position;
                player.rotation = data.rotation;
            }
        }
    });

    // 玩家射击
    window.network.on('player_shot', (data) => {
        window.audioManager.playShoot('rifle');
        if (data.position) {
            window.renderer.addProjectile(data.position, { x: 0, y: 0, z: 0 });
        }
    });

    // 玩家受伤
    window.network.on('player_damaged', (data) => {
        console.log(`Player ${data.player_id} took ${data.damage} damage (${data.hitbox})`);

        // 更新血量
        if (data.player_id === window.game?.player?.id) {
            window.game.player.health = data.remaining_health;
            window.uiManager.updateHealth(data.remaining_health);

            // 屏幕闪红 + 受击指示
            if (window.screenEffects) {
                window.screenEffects.flashDamage();
            }
            if (window.hitIndicator && data.attacker_position) {
                window.hitIndicator.show(data.attacker_position, data.damage);
            }
        } else {
            // 显示命中标记 (射击者视角)
            if (data.attacker_id === window.game?.player?.id) {
                // 新特效系统
                if (window.damageNumber) {
                    window.damageNumber.show(data.damage, data.position, {
                        isHeadshot: data.hitbox === 'head'
                    });
                }
                if (window.dynamicCrosshair) {
                    window.dynamicCrosshair.showHit();
                }
                // 兼容旧系统
                if (window.hitEffects) {
                    window.hitEffects.showHitMarker(
                        new THREE.Vector3(data.position.x, data.position.y, data.position.z),
                        data.hitbox,
                        data.damage
                    );
                }
            }
        }
    });

    // 玩家死亡
    window.network.on('player_killed', (data) => {
        console.log(`Player ${data.victim_id} killed by ${data.killer_id}`);

        // 更新击杀计数
        if (data.killer_id === window.game?.player?.id) {
            window.game.player.kills++;
            window.uiManager.updateKills(window.game.player.kills);
            window.uiManager.addKillFeed(`击杀 ${data.victim_id}${data.is_headshot ? ' (爆头!)' : ''}`);
            
            // 击杀音效
            if (window.audioManager) {
                window.audioManager.playKill();
            }
            
            // 新特效系统
            if (window.killNotice) {
                window.killNotice.show(data.victim_id, { isHeadshot: data.is_headshot });
            }
            if (window.killstreakEnhanced) {
                window.killstreakEnhanced.addKill();
            }
            if (window.screenEffects) {
                window.screenEffects.flashKill();
            }
        }

        if (data.victim_id === window.game?.player?.id) {
            window.game.player.deaths++;
            window.uiManager.updateDeaths(window.game.player.deaths);
            window.uiManager.showDeathScreen();
        }
    });

    // 玩家重生
    window.network.on('player_respawned', (data) => {
        if (data.player_id === window.game?.player?.id) {
            window.game.player.health = data.health;
            window.game.player.position = data.position;
            window.uiManager.updateHealth(data.health);
            window.uiManager.hideDeathScreen();
        }

        window.renderer.updatePlayer(data.player_id, data.position, 0);
    });

    // 聊天消息
    window.network.on('chat', (data) => {
        console.log('[MAIN] Received chat message:', data);
        window.uiManager.addChatMessage(data.name, data.message);
    });

    // 错误消息
    window.network.on('error', (data) => {
        console.error('Server error:', data.message);
        window.uiManager.showMessage(data.message, 'error');
    });
}

async function startGame(playerId) {
    gameStarted = true;

    // 初始化游戏
    window.game = new Game();
    await window.game.init();

    // 初始化命中效果系统
    if (typeof HitEffects !== 'undefined') {
        window.hitEffects = new HitEffects(window.renderer.scene, window.renderer.camera);
    }

    // 初始化 AI 标签系统
    if (typeof AILabels !== 'undefined') {
        window.aiLabels = new AILabels();
    }

    // 隐藏大厅
    if (window.lobby) {
        window.lobby.hide();
    }
}

// 启动
init();
