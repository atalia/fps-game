// Network module - WebSocket communication
class Network {
    constructor() {
        this.ws = null;
        this.playerId = null;
        this.connected = false;
        this.messageHandlers = {};
    }

    connect(url) {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(url);

            this.ws.onopen = () => {
                this.connected = true;
                this.updateConnectionStatus(true);
                console.log('Connected to server');
                resolve();
            };

            this.ws.onclose = () => {
                this.connected = false;
                this.updateConnectionStatus(false);
                console.log('Disconnected from server');
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                reject(error);
            };

            this.ws.onmessage = (event) => {
                const message = JSON.parse(event.data);
                this.handleMessage(message);
            };
        });
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    send(type, data = {}) {
        if (!this.connected) {
            console.warn('Not connected');
            return;
        }

        const message = JSON.stringify({ type, data });
        this.ws.send(message);
    }

    handleMessage(message) {
        const { type, data } = message;

        switch (type) {
            case 'welcome':
                this.playerId = data.player_id;
                console.log('Welcome! Player ID:', this.playerId);
                break;
            case 'room_joined':
                window.game?.onRoomJoined(data);
                break;
            case 'player_joined':
                window.game?.onPlayerJoined(data);
                break;
            case 'player_left':
                window.game?.onPlayerLeft(data);
                break;
            case 'player_moved':
                window.game?.onPlayerMoved(data);
                break;
            case 'player_shot':
                window.game?.onPlayerShot(data);
                break;
            case 'chat':
                window.game?.onChat(data);
                break;
            default:
                console.log('Unknown message type:', type);
        }

        // Call custom handlers
        if (this.messageHandlers[type]) {
            this.messageHandlers[type](data);
        }
    }

    on(type, handler) {
        this.messageHandlers[type] = handler;
    }

    updateConnectionStatus(connected) {
        const status = document.getElementById('connection-status');
        if (status) {
            status.textContent = connected ? '已连接' : '已断开';
            status.className = connected ? 'connected' : 'disconnected';
        }
    }
}

window.network = new Network();
