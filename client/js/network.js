// network.js - WebSocket 网络通信
class Network {
    constructor(url) {
        this.url = url;
        this.ws = null;
        this.connected = false;
        this.playerId = null;
        this.handlers = new Map();

        this.connect();
    }

    connect() {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
            console.log('✅ WebSocket connected');
            this.connected = true;
            if (this.onConnect) this.onConnect();
        };

        this.ws.onclose = () => {
            console.log('❌ WebSocket disconnected');
            this.connected = false;
            // 自动重连
            setTimeout(() => this.connect(), 3000);
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            if (this.onError) this.onError(error);
        };

        this.ws.onmessage = (event) => {
            this.handleMessage(event.data);
        };
    }

    handleMessage(data) {
        try {
            const messages = data.split('\n').filter(m => m.trim());

            messages.forEach(msg => {
                const parsed = JSON.parse(msg);
                const handler = this.handlers.get(parsed.type);

                if (handler) {
                    handler(parsed.data);
                } else {
                    // 默认处理
                    switch (parsed.type) {
                        case 'welcome':
                            this.playerId = parsed.data.player_id;
                            console.log('🎮 Player ID:', this.playerId);
                            break;
                        default:
                            console.log('Message:', parsed.type, parsed.data);
                    }
                }
            });
        } catch (error) {
            console.error('Parse error:', error);
        }
    }

    on(type, handler) {
        this.handlers.set(type, handler);
    }

    send(type, data) {
        if (!this.connected) {
            console.warn('WebSocket not connected');
            return;
        }

        const message = JSON.stringify({
            type,
            data,
            timestamp: Date.now()
        });

        this.ws.send(message);
    }

    close() {
        if (this.ws) {
            this.ws.close();
        }
    }
}

window.Network = Network;
