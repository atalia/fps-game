// main.js - 主入口
let gameStarted = false;

async function init() {
    const loading = document.getElementById('loading');

    try {
        // 初始化音效
        window.audioManager = new AudioManager();
        await window.audioManager.init();

        // 初始化 UI
        window.uiManager = new UIManager();
        window.screenEffects = new ScreenEffects();

        // 初始化渲染器
        window.renderer = new Renderer('game-container');

        // 初始化网络
        const wsUrl = `ws://${window.location.host}/ws`;
        window.network = new Network(wsUrl);

        // 设置网络事件处理
        setupNetworkHandlers();

        // 等待连接
        await new Promise((resolve, reject) => {
            window.network.onConnect = resolve;
            window.network.onError = reject;
            setTimeout(() => reject(new Error('连接超时')), 10000);
        });

        // 初始化大厅
        window.lobby = new Lobby();

        // 隐藏加载画面
        loading.style.display = 'none';

        console.log('🎮 Game initialized successfully!');

    } catch (error) {
        console.error('初始化失败:', error);
        loading.innerHTML = `
            <h1>❌ 连接失败</h1>
            <p>${error.message}</p>
            <p style="margin-top: 20px">
                <button onclick="location.reload()" style="padding: 10px 20px; font-size: 16px; cursor: pointer;">
                    重试
                </button>
            </p>
        `;
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
