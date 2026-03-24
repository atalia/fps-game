// lobby.js - 游戏大厅
class Lobby {
    constructor() {
        this.rooms = [];
        this.selectedRoom = null;
        this.visible = true;

        this.init();
    }

    init() {
        this.createUI();
        this.refreshRooms();
    }

    createUI() {
        const container = document.createElement('div');
        container.id = 'lobby-container';
        container.innerHTML = `
            <div id="lobby-panel">
                <h1>🎮 FPS Game</h1>
                
                <div id="player-name-section">
                    <input type="text" id="player-name-input" placeholder="输入你的名字" maxlength="16" />
                </div>

                <div id="room-actions">
                    <button id="quick-join-btn" class="btn primary">快速加入</button>
                    <button id="join-room-btn" class="btn success">加入选中房间</button>
                    <button id="create-room-btn" class="btn">创建新房间</button>
                </div>

                <div id="rooms-list">
                    <h3>房间列表 <span id="room-count">(0)</span></h3>
                    <div id="rooms-container"></div>
                </div>

                
                <div id="lobby-status">
                    <span id="online-count">在线: 0</span>
                    <span id="room-count-total">房间: 0</span>
                </div>
            </div>

            <style>
                #lobby-container {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0,0,0,0.9);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 2000;
                }

                #lobby-container.hidden {
                    display: none;
                }

                #lobby-panel {
                    background: #1a1a2e;
                    padding: 30px;
                    border-radius: 10px;
                    min-width: 400px;
                    max-width: 600px;
                    color: #fff;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.5);
                }

                #lobby-panel h1 {
                    text-align: center;
                    margin-bottom: 20px;
                    font-size: 32px;
                }

                #player-name-section {
                    margin-bottom: 20px;
                }

                #player-name-input {
                    width: 100%;
                    padding: 12px;
                    font-size: 16px;
                    background: #0f0f1a;
                    border: 1px solid #333;
                    border-radius: 5px;
                    color: #fff;
                }

                #player-name-input:focus {
                    outline: none;
                    border-color: #4fc3f7;
                }

                #room-actions {
                    display: flex;
                    gap: 10px;
                    margin-bottom: 20px;
                }

                .btn {
                    flex: 1;
                    padding: 12px 20px;
                    font-size: 16px;
                    background: #333;
                    border: none;
                    border-radius: 5px;
                    color: #fff;
                    cursor: pointer;
                    transition: background 0.2s;
                }

                .btn:hover {
                    background: #444;
                }

                .btn.primary {
                    background: #4fc3f7;
                    color: #000;
                }

                .btn.primary:hover {
                    background: #29b6f6;
                }
                
                .btn.success {
                    background: #4caf50;
                    color: #fff;
                }

                .btn.success:hover {
                    background: #43a047;
                }

                #rooms-list h3 {
                    margin-bottom: 10px;
                    color: #888;
                }

                #rooms-container {
                    max-height: 200px;
                    overflow-y: auto;
                    background: #0f0f1a;
                    border-radius: 5px;
                    padding: 10px;
                }

                .room-item {
                    padding: 10px;
                    background: #1a1a2e;
                    margin-bottom: 5px;
                    border-radius: 5px;
                    cursor: pointer;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    transition: background 0.2s;
                }

                .room-item:hover {
                    background: #252540;
                }

                .room-item.selected {
                    background: #4fc3f7;
                    color: #000;
                }

                .room-item .room-name {
                    font-weight: bold;
                }

                .room-item .room-players {
                    font-size: 12px;
                    color: #888;
                }

                .room-item.selected .room-players {
                    color: #333;
                }

                #lobby-status {
                    margin-top: 20px;
                    text-align: center;
                    color: #666;
                    font-size: 12px;
                }

                #lobby-status span {
                    margin: 0 10px;
                }

                .empty-message {
                    text-align: center;
                    color: #666;
                    padding: 20px;
                }
            </style>
        `;

        document.body.appendChild(container);
        this.container = container;

        // 事件绑定
        document.getElementById('quick-join-btn').onclick = () => this.quickJoin();
        document.getElementById('join-room-btn').onclick = () => this.joinSelectedRoom();
        document.getElementById('create-room-btn').onclick = () => this.createRoom();
        
        // 初始状态：禁用加入按钮
        document.getElementById('join-room-btn').disabled = true;

        // 加载保存的名字
        const savedName = localStorage.getItem('player_name');
        if (savedName) {
            document.getElementById('player-name-input').value = savedName;
        }
    }

    refreshRooms() {
        fetch('/api/rooms')
            .then(res => res.json())
            .then(data => {
                this.rooms = data.rooms || [];
                this.renderRooms();

                // 更新统计
                document.getElementById('room-count').textContent = `(${this.rooms.length})`;
            })
            .catch(err => console.error('Failed to fetch rooms:', err));

        fetch('/api/stats')
            .then(res => res.json())
            .then(data => {
                document.getElementById('online-count').textContent = `在线: ${data.players || 0}`;
                document.getElementById('room-count-total').textContent = `房间: ${data.rooms || 0}`;
            })
            .catch(err => console.error('Failed to fetch stats:', err));
    }

    renderRooms() {
        const container = document.getElementById('rooms-container');

        if (this.rooms.length === 0) {
            container.innerHTML = '<div class="empty-message">暂无房间，快创建一个吧！</div>';
            return;
        }

        container.innerHTML = this.rooms.map(room => `
            <div class="room-item ${this.selectedRoom === room.id ? 'selected' : ''}" 
                 onclick="lobby.selectRoom('${room.id}')">
                <span class="room-name">房间 ${room.id}</span>
                <span class="room-players">${room.player_count}/${room.max_size}</span>
            </div>
        `).join('');
    }

    selectRoom(roomId) {
        this.selectedRoom = roomId;
        this.renderRooms();
        
        // 更新加入按钮状态
        const joinBtn = document.getElementById('join-room-btn');
        if (joinBtn) {
            joinBtn.disabled = !roomId;
        }
    }

    getPlayerName() {
        const name = document.getElementById('player-name-input').value.trim() || 
                     'Player_' + Math.random().toString(36).substr(2, 4);
        localStorage.setItem('player_name', name);
        return name;
    }

    quickJoin() {
        const name = this.getPlayerName();
        
        // 如果选中了房间，加入选中的房间
        const roomId = this.selectedRoom || '';
        
        if (window.network && window.network.connected) {
            console.log('[LOBBY] Joining room:', roomId || 'new room');
            window.network.send('join_room', {
                room_id: roomId,
                name: name
            });
            this.hide();
            
            // 清除选中状态
            this.selectedRoom = null;
        } else {
            console.error('Network not connected');
        }
    }
    
    joinSelectedRoom() {
        if (!this.selectedRoom) {
            console.warn('[LOBBY] No room selected');
            return;
        }
        this.quickJoin();
    }
    
    createRoom() {
        // 创建新房间（发送空 room_id）
        this.selectedRoom = null;
        this.quickJoin();
    }

    hide() {
        this.container.classList.add('hidden');
        this.visible = false;

        // 锁定鼠标
        document.body.requestPointerLock();
    }

    show() {
        this.container.classList.remove('hidden');
        this.visible = true;
        document.exitPointerLock();
    }

    toggle() {
        if (this.visible) {
            this.hide();
        } else {
            this.show();
        }
    }
}

window.lobby = null;
window.Lobby = Lobby;
