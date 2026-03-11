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
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            const constraints = {
                audio: {
                    echoCancellation: this.echoCancellation,
                    noiseSuppression: this.noiseSuppression,
                    autoGainControl: true
                }
            };

            this.inputStream = await navigator.mediaDevices.getUserMedia(constraints);
            
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
        // TODO: 实际音频传输逻辑
    }

    // 停止传输
    stopTransmission() {
        this.transmissionEnabled = false;
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
        // TODO: 播放远端音频
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
