// voice.js - 语音系统
class VoiceSystem {
    constructor() {
        this.enabled = false;
        this.muted = false;
        this.deafened = false;
        this.inputVolume = 1.0;
        this.outputVolume = 1.0;
        this.pushToTalk = true;
        this.pushToTalkKey = 'v';
        this.transmissionEnabled = false;
        
        this.audioContext = null;
        this.inputStream = null;
        this.analyser = null;
        this.peers = new Map(); // peerId -> peer connection
        
        this.voiceActivityThreshold = 30;
        this.noiseSuppression = true;
        this.echoCancellation = true;
    }

    async init() {
        const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
        const getUserMedia = navigator?.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);

        if (!AudioContextCtor) {
            console.warn('[VOICE] AudioContext unavailable, voice disabled');
            return false;
        }

        if (!getUserMedia) {
            console.warn('[VOICE] getUserMedia unavailable (likely insecure context or unsupported browser), voice disabled');
            return false;
        }

        try {
            this.audioContext = new AudioContextCtor();
            
            const constraints = {
                audio: {
                    echoCancellation: this.echoCancellation,
                    noiseSuppression: this.noiseSuppression,
                    autoGainControl: true
                }
            };

            this.inputStream = await getUserMedia(constraints);
            
            const source = this.audioContext.createMediaStreamSource(this.inputStream);
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
            source.connect(this.analyser);

            this.enabled = true;
            return true;
        } catch (err) {
            console.error('Failed to initialize voice:', err);
            return false;
        }
    }

    // 获取麦克风音量
    getMicrophoneLevel() {
        if (!this.analyser) return 0;

        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
        }
        return sum / dataArray.length;
    }

    // 是否正在说话
    isSpeaking() {
        if (this.muted || this.deafened) return false;
        return this.getMicrophoneLevel() > this.voiceActivityThreshold;
    }

    // 开始传输
    startTransmission() {
        if (!this.enabled || this.muted || this.deafened) return;
        this.transmissionEnabled = true;
        
        // 通过 WebSocket 通知服务器开始语音
        if (window.network && window.network.connected) {
            window.network.send('voice_start', {
                playerId: window.network.playerId
            });
        }
        
        // 开始音频采集和传输
        this.startAudioCapture();
    }

    // 停止传输
    stopTransmission() {
        this.transmissionEnabled = false;
        
        // 通过 WebSocket 通知服务器停止语音
        if (window.network && window.network.connected) {
            window.network.send('voice_stop', {
                playerId: window.network.playerId
            });
        }
        
        this.stopAudioCapture();
    }

    // 开始音频采集
    startAudioCapture() {
        if (!this.inputStream || !this.audioContext) return;
        
        // 创建音频处理器
        if (!this.scriptProcessor) {
            this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);
            
            const source = this.audioContext.createMediaStreamSource(this.inputStream);
            source.connect(this.scriptProcessor);
            this.scriptProcessor.connect(this.audioContext.destination);
            
            this.scriptProcessor.onaudioprocess = (e) => {
                if (!this.transmissionEnabled) return;
                
                const inputData = e.inputBuffer.getChannelData(0);
                
                // 降低采样率以减少带宽 (48000 -> 16000)
                const downsampled = this.downsample(inputData, 48000, 16000);
                
                // 转换为 Base64 发送
                const encoded = this.encodeAudio(downsampled);
                
                // 通过 WebSocket 发送
                if (window.network && window.network.connected) {
                    window.network.send('voice_data', {
                        playerId: window.network.playerId,
                        audio: encoded
                    });
                }
            };
        }
    }

    // 停止音频采集
    stopAudioCapture() {
        if (this.scriptProcessor) {
            this.scriptProcessor.disconnect();
        }
    }

    // 降采样
    downsample(buffer, fromRate, toRate) {
        const ratio = fromRate / toRate;
        const newLength = Math.floor(buffer.length / ratio);
        const result = new Float32Array(newLength);
        
        for (let i = 0; i < newLength; i++) {
            result[i] = buffer[Math.floor(i * ratio)];
        }
        
        return result;
    }

    // 编码音频为 Base64
    encodeAudio(float32Array) {
        const buffer = new ArrayBuffer(float32Array.length * 2);
        const view = new DataView(buffer);
        
        for (let i = 0; i < float32Array.length; i++) {
            const s = Math.max(-1, Math.min(1, float32Array[i]));
            view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }
        
        return btoa(String.fromCharCode(...new Uint8Array(buffer)));
    }

    // 解码 Base64 音频
    decodeAudio(base64) {
        const binary = atob(base64);
        const buffer = new ArrayBuffer(binary.length);
        const view = new Uint8Array(buffer);
        
        for (let i = 0; i < binary.length; i++) {
            view[i] = binary.charCodeAt(i);
        }
        
        const int16Array = new Int16Array(buffer);
        const float32Array = new Float32Array(int16Array.length);
        
        for (let i = 0; i < int16Array.length; i++) {
            float32Array[i] = int16Array[i] / (int16Array[i] < 0 ? 0x8000 : 0x7FFF);
        }
        
        return float32Array;
    }

    // 切换静音
    toggleMute() {
        this.muted = !this.muted;
        if (this.muted) {
            this.stopTransmission();
        }
        return this.muted;
    }

    // 切换聋音
    toggleDeafen() {
        this.deafened = !this.deafened;
        if (this.deafened) {
            this.stopTransmission();
        }
        return this.deafened;
    }

    // 设置按键说话
    setPushToTalk(enabled, key = 'v') {
        this.pushToTalk = enabled;
        this.pushToTalkKey = key;
    }

    // 处理按键
    handleKeyDown(key) {
        if (!this.pushToTalk) return;
        if (key.toLowerCase() === this.pushToTalkKey) {
            this.startTransmission();
        }
    }

    handleKeyUp(key) {
        if (!this.pushToTalk) return;
        if (key.toLowerCase() === this.pushToTalkKey) {
            this.stopTransmission();
        }
    }

    // 接收远端音频
    receiveAudio(peerId, audioData) {
        if (this.deafened) return;
        
        // 获取或创建该玩家的音频源
        let peerAudio = this.peers.get(peerId);
        if (!peerAudio) {
            this.addPeer(peerId);
            peerAudio = this.peers.get(peerId);
        }
        
        // 解码音频
        const float32Data = this.decodeAudio(audioData);
        
        // 播放音频
        this.playAudio(float32Data, peerAudio.volume);
    }

    // 播放音频
    playAudio(float32Data, volume = 1.0) {
        if (!this.audioContext) return;
        
        // 创建音频缓冲区
        const audioBuffer = this.audioContext.createBuffer(1, float32Data.length, 16000);
        audioBuffer.getChannelData(0).set(float32Data);
        
        // 创建音频源
        const source = this.audioContext.createBufferSource();
        source.buffer = audioBuffer;
        
        // 创建增益节点控制音量
        const gainNode = this.audioContext.createGain();
        gainNode.gain.value = volume * this.outputVolume;
        
        // 连接节点
        source.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        // 播放
        source.start();
    }

    // 添加玩家语音
    addPeer(peerId) {
        this.peers.set(peerId, {
            id: peerId,
            speaking: false,
            volume: 1.0
        });
    }

    // 移除玩家语音
    removePeer(peerId) {
        this.peers.delete(peerId);
    }

    // 设置玩家音量
    setPeerVolume(peerId, volume) {
        const peer = this.peers.get(peerId);
        if (peer) {
            peer.volume = volume;
        }
    }

    // 销毁
    destroy() {
        if (this.inputStream) {
            this.inputStream.getTracks().forEach(track => track.stop());
        }
        if (this.audioContext) {
            this.audioContext.close();
        }
        this.peers.clear();
    }
}

// 语音 UI
class VoiceUI {
    constructor(container, voiceSystem) {
        this.container = container;
        this.voiceSystem = voiceSystem;
        this.element = null;
        this.indicatorElement = null;
    }

    show() {
        if (this.element) {
            this.element.style.display = 'block';
            return;
        }

        this.element = document.createElement('div');
        this.element.className = 'voice-ui';
        this.element.style.cssText = `
            position: absolute;
            bottom: 100px;
            left: 20px;
            background: rgba(0, 0, 0, 0.7);
            border-radius: 10px;
            padding: 10px;
            z-index: 100;
        `;

        this.render();
        this.container.appendChild(this.element);
        this.startUpdateLoop();
    }

    render() {
        this.element.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <button id="voiceMute" style="
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    border: none;
                    background: ${this.voiceSystem.muted ? '#f44336' : '#4CAF50'};
                    color: white;
                    cursor: pointer;
                    font-size: 18px;
                ">${this.voiceSystem.muted ? '🔇' : '🎤'}</button>
                
                <button id="voiceDeafen" style="
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    border: none;
                    background: ${this.voiceSystem.deafened ? '#f44336' : '#2196F3'};
                    color: white;
                    cursor: pointer;
                    font-size: 18px;
                ">${this.voiceSystem.deafened ? '🔕' : '🔊'}</button>

                <div id="voiceIndicator" style="
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                    background: #666;
                    transition: background 0.1s;
                "></div>
            </div>
        `;

        this.indicatorElement = this.element.querySelector('#voiceIndicator');

        this.bindEvents();
    }

    bindEvents() {
        this.element.querySelector('#voiceMute').addEventListener('click', () => {
            this.voiceSystem.toggleMute();
            this.render();
        });

        this.element.querySelector('#voiceDeafen').addEventListener('click', () => {
            this.voiceSystem.toggleDeafen();
            this.render();
        });
    }

    startUpdateLoop() {
        const update = () => {
            if (!this.element || this.element.style.display === 'none') return;

            const speaking = this.voiceSystem.isSpeaking();
            if (this.indicatorElement) {
                this.indicatorElement.style.background = speaking ? '#4CAF50' : '#666';
                if (speaking) {
                    this.indicatorElement.style.boxShadow = '0 0 10px #4CAF50';
                } else {
                    this.indicatorElement.style.boxShadow = 'none';
                }
            }

            requestAnimationFrame(update);
        };

        update();
    }

    hide() {
        if (this.element) {
            this.element.style.display = 'none';
        }
    }
}

// 说话指示器 (显示谁在说话)
class SpeakingIndicator {
    constructor(container) {
        this.container = container;
        this.speakers = new Map();
        this.elements = new Map();
    }

    addSpeaker(playerId, playerName) {
        this.speakers.set(playerId, { name: playerName, speaking: false });
    }

    removeSpeaker(playerId) {
        this.speakers.delete(playerId);
        const element = this.elements.get(playerId);
        if (element) {
            element.remove();
            this.elements.delete(playerId);
        }
    }

    setSpeaking(playerId, speaking) {
        const speaker = this.speakers.get(playerId);
        if (!speaker) return;

        speaker.speaking = speaking;

        if (speaking) {
            this.showIndicator(playerId, speaker.name);
        } else {
            this.hideIndicator(playerId);
        }
    }

    showIndicator(playerId, name) {
        if (this.elements.has(playerId)) return;

        const element = document.createElement('div');
        element.className = 'speaking-indicator';
        element.style.cssText = `
            position: absolute;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 5px 15px;
            border-radius: 20px;
            border: 2px solid #4CAF50;
            font-size: 14px;
            display: flex;
            align-items: center;
            gap: 8px;
            animation: fadeIn 0.2s;
        `;

        element.innerHTML = `
            <div style="
                width: 8px;
                height: 8px;
                background: #4CAF50;
                border-radius: 50%;
                animation: pulse 0.5s infinite;
            "></div>
            <span>${name}</span>
        `;

        this.container.appendChild(element);
        this.elements.set(playerId, element);
    }

    hideIndicator(playerId) {
        const element = this.elements.get(playerId);
        if (element) {
            element.remove();
            this.elements.delete(playerId);
        }
    }

    // 添加动画样式
    static addStyles() {
        if (document.getElementById('speaking-styles')) return;

        const style = document.createElement('style');
        style.id = 'speaking-styles';
        style.textContent = `
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(-10px); }
                to { opacity: 1; transform: translateY(0); }
            }
        `;
        document.head.appendChild(style);
    }
}

// 初始化样式
SpeakingIndicator.addStyles();

window.VoiceSystem = VoiceSystem;
window.VoiceUI = VoiceUI;
window.SpeakingIndicator = SpeakingIndicator;
