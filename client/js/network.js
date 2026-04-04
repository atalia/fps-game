// network.js - WebSocket 网络通信
class Network {
    constructor(url) {
        this.url = url;
        this.ws = null;
        this.connected = false;
        this.playerId = null;
        this.handlers = new Map();
        this.heartbeatInterval = null;
        this.reconnectTimer = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.allowReconnect = true;

        this.connect();
    }

    connect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        if (this.ws) {
            this.ws.onclose = null;
            this.ws.onerror = null;
            this.ws.onmessage = null;
            this.ws.onopen = null;
        }

        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
            console.log('✅ WebSocket connected');
            this.connected = true;
            this.reconnectAttempts = 0;
            this.startHeartbeat();
            if (this.onConnect) this.onConnect();
        };

        this.ws.onclose = (event) => {
            console.log('❌ WebSocket disconnected, code:', event.code);
            this.connected = false;
            this.stopHeartbeat();
            this.ws = null;

            if (!this.allowReconnect) {
                return;
            }
            
            // 自动重连
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                this.reconnectAttempts++;
                const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
                console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})...`);
                this.reconnectTimer = setTimeout(() => {
                    this.reconnectTimer = null;
                    this.connect();
                }, delay);
            } else {
                console.error('Max reconnect attempts reached');
                if (this.onError) this.onError(new Error('连接断开，请刷新页面重试'));
            }
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            if (this.onError) this.onError(error);
        };

        this.ws.onmessage = (event) => {
            this.handleMessage(event.data);
        };
    }
    
    startHeartbeat() {
        this.stopHeartbeat();
        
        // 每30秒发送一次心跳
        this.heartbeatInterval = setInterval(() => {
            if (this.connected) {
                this.send('heartbeat', { time: Date.now() });
            }
        }, 30000);
    }
    
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    handleMessage(data) {
        const messages = data.split('\n');

        for (const rawMessage of messages) {
            const msg = rawMessage.trim();
            if (!msg) {
                continue;
            }

            try {
                const parsed = JSON.parse(msg);
                // 只在 DEBUG 模式下打印详细日志
                if (window.DEBUG_MODE) {
                    console.log('[NETWORK] Received:', parsed.type, parsed.data ? JSON.stringify(parsed.data).substring(0, 100) : '');
                }
                const handler = this.handlers.get(parsed.type);

                if (handler) {
                    handler(parsed.data);
                    continue;
                }

                // 默认处理
                switch (parsed.type) {
                    case 'welcome':
                        this.playerId = parsed.data?.player_id ?? null;
                        console.log('🎮 Player ID:', this.playerId);
                        break;
                    default:
                        console.log('Message:', parsed.type, parsed.data);
                }
            } catch (error) {
                console.error('Parse error:', error);
            }
        }
    }

    on(type, handler) {
        this.handlers.set(type, handler);
    }

    send(type, data) {
        if (!this.connected) {
            console.warn('[NETWORK] WebSocket not connected, cannot send:', type);
            return;
        }

        const message = JSON.stringify({
            type,
            data,
            timestamp: Date.now()
        });

        // 只在 DEBUG 模式下打印详细日志
        if (window.DEBUG_MODE) {
            console.log('[NETWORK] Sending:', type, JSON.stringify(data).substring(0, 100));
        }
        this.ws.send(message);
    }

    // 设置语音处理器
    setupVoiceHandlers(voiceSystem) {
        this.on('voice_start', (data) => {
            if (voiceSystem && window.speakingIndicator) {
                window.speakingIndicator.setSpeaking(data.playerId, true);
            }
        });

        this.on('voice_stop', (data) => {
            if (voiceSystem && window.speakingIndicator) {
                window.speakingIndicator.setSpeaking(data.playerId, false);
            }
        });

        this.on('voice_data', (data) => {
            if (voiceSystem) {
                voiceSystem.receiveAudio(data.playerId, data.audio);
            }
        });
    }

    close() {
        this.allowReconnect = false;
        this.connected = false;
        this.stopHeartbeat();
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.ws) {
            this.ws.onclose = null;
            this.ws.onerror = null;
            this.ws.onmessage = null;
            this.ws.onopen = null;
            this.ws.close();
            this.ws = null;
        }
    }
}

window.Network = Network;

export default Network;
