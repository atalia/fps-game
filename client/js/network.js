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
        this.pendingRttProbes = new Map();
        this.rttSamples = [];
        this.maxRttSamples = 10;
        this.lastRttMs = null;
        this.lastPongAt = 0;
        this.heartbeatSequence = 0;

        this.connect();
    }

    connect() {
        console.log('[NETWORK] connect() called, URL:', this.url);
        
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

        console.log('[NETWORK] Creating WebSocket...');
        try {
            this.ws = new WebSocket(this.url);
            console.log('[NETWORK] WebSocket created, readyState:', this.ws.readyState);
        } catch (e) {
            console.error('[NETWORK] WebSocket creation failed:', e);
            return;
        }

        this.ws.onopen = () => {
            console.log('[NETWORK] ✅ WebSocket onopen triggered');
            console.log('✅ WebSocket connected to:', this.url);
            this.connected = true;
            this.reconnectAttempts = 0;
            this.startHeartbeat();
            this.sendHeartbeatProbe();
            window.uiManager?.updateConnectionStatus?.(true);
            if (this.onConnect) this.onConnect();
        };

        this.ws.onerror = (err) => {
            console.error('[NETWORK] ❌ WebSocket onerror:', err);
            if (this.onError) this.onError(err);
        };

        this.ws.onclose = (event) => {
            console.log('❌ WebSocket disconnected, code:', event.code);
            this.connected = false;
            this.stopHeartbeat();
            this.pendingRttProbes.clear();
            this.ws = null;
            window.uiManager?.updateConnectionStatus?.(false);

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
                this.sendHeartbeatProbe();
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
                this.maybeRecordPong(parsed);
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

    sendHeartbeatProbe() {
        if (!this.connected) {
            return false;
        }

        const sentAt = Date.now();
        const probeId = `hb_${++this.heartbeatSequence}`;
        this.pendingRttProbes.set(probeId, sentAt);

        const sent = this.send('heartbeat', {
            time: sentAt,
            probe_id: probeId,
        });

        if (!sent) {
            this.pendingRttProbes.delete(probeId);
        }

        return sent;
    }

    maybeRecordPong(message) {
        const type = String(message?.type || '').toLowerCase();
        const data = message?.data || {};
        const isProbeAck =
            type === 'pong' ||
            type === 'heartbeat_ack' ||
            (type === 'heartbeat' && (data.ack === true || data.pong === true));

        if (!isProbeAck) {
            return;
        }

        const probeId = data.probe_id || data.id || null;
        const echoedSentAt = Number(data.time) || null;
        const receivedAt = Date.now();
        let sentAt = echoedSentAt;

        if (probeId && this.pendingRttProbes.has(probeId)) {
            sentAt = this.pendingRttProbes.get(probeId);
            this.pendingRttProbes.delete(probeId);
        }

        if (!Number.isFinite(sentAt)) {
            return;
        }

        const rttMs = Math.max(0, receivedAt - sentAt);
        this.lastRttMs = rttMs;
        this.lastPongAt = receivedAt;
        this.rttSamples.push(rttMs);
        if (this.rttSamples.length > this.maxRttSamples) {
            this.rttSamples.shift();
        }
    }

    getNetworkQuality() {
        const averageRttMs = this.rttSamples.length
            ? this.rttSamples.reduce((sum, value) => sum + value, 0) / this.rttSamples.length
            : null;
        const roundedRttMs =
            this.lastRttMs === null ? null : Math.round(this.lastRttMs);
        const roundedAverageRttMs =
            averageRttMs === null ? null : Math.round(averageRttMs);

        let quality = 'probing';
        if (!this.connected) {
            quality = 'offline';
        } else if (roundedAverageRttMs === null) {
            quality = 'probing';
        } else if (roundedAverageRttMs <= 60) {
            quality = 'excellent';
        } else if (roundedAverageRttMs <= 120) {
            quality = 'good';
        } else if (roundedAverageRttMs <= 200) {
            quality = 'fair';
        } else {
            quality = 'poor';
        }

        const icons = {
            offline: 'x...',
            probing: '....',
            poor: '|...',
            fair: '||..',
            good: '|||.',
            excellent: '||||',
        };

        return {
            connected: this.connected,
            rttMs: roundedRttMs,
            averageRttMs: roundedAverageRttMs,
            lastPongAgeMs: this.lastPongAt ? Date.now() - this.lastPongAt : null,
            quality,
            icon: icons[quality] || icons.probing,
        };
    }

    send(type, data) {
        if (!this.connected) {
            console.warn('[NETWORK] WebSocket not connected, cannot send:', type);
            return false;
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
        return true;
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
        this.pendingRttProbes.clear();
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
