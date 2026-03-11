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
    // 房间加入成功
    window.network.on('room_joined', (data) => {
        console.log('✅ Joined room:', data.room_id);
        
        window.uiManager.updateRoom(data.room_id, data.player_count);
        window.uiManager.showMessage(`已加入房间 ${data.room_id}`);

        // 初始化游戏
        if (!gameStarted) {
            startGame(data.player_id);
        }
    });

    // 玩家加入
    window.network.on('player_joined', (data) => {
        console.log('Player joined:', data.name);
        window.renderer.addPlayer(data.player_id, data.position, false);
        window.uiManager.addKillFeed(`${data.name} 加入了游戏`);
    });

    // 玩家离开
    window.network.on('player_left', (data) => {
        console.log('Player left:', data.player_id);
        window.renderer.removePlayer(data.player_id);
        window.uiManager.addKillFeed(`玩家离开了游戏`);
    });

    // 玩家移动
    window.network.on('player_moved', (data) => {
        window.renderer.updatePlayer(data.player_id, data.position, data.rotation);
    });

    // 玩家射击
    window.network.on('player_shot', (data) => {
        window.audioManager.playShoot('rifle');
        if (data.position) {
            window.renderer.addProjectile(data.position, { x: 0, y: 0, z: 0 });
        }
    });

    // 聊天消息
    window.network.on('chat', (data) => {
        window.uiManager.addChatMessage(data.name, data.message);
    });

    // 错误消息
    window.network.on('error', (data) => {
        console.error('Server error:', data.message);
        window.uiManager.showMessage(data.message, 'error');
    });
}

function startGame(playerId) {
    gameStarted = true;

    // 初始化游戏
    window.game = new Game();
    window.game.init();

    // 隐藏大厅
    if (window.lobby) {
        window.lobby.hide();
    }
}

// 启动
init();
