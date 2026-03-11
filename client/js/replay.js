// replay.js - 回放系统
class ReplaySystem {
    constructor() {
        this.recording = false;
        this.playing = false;
        this.frames = [];
        this.maxFrames = 36000; // 10分钟 @ 60fps
        this.currentIndex = 0;
        this.startTime = 0;
    }

    // 开始录制
    startRecording() {
        this.recording = true;
        this.frames = [];
        this.startTime = Date.now();
        console.log('🎬 开始录制');
    }

    // 停止录制
    stopRecording() {
        this.recording = false;
        console.log(`🎬 录制结束，共 ${this.frames.length} 帧`);
    }

    // 记录帧
    recordFrame(gameState) {
        if (!this.recording) return;

        const frame = {
            time: Date.now() - this.startTime,
            players: {},
            events: []
        };

        // 记录玩家状态
        for (const [id, player] of Object.entries(gameState.players || {})) {
            frame.players[id] = {
                id: player.id,
                name: player.name,
                position: { ...player.position },
                rotation: player.rotation,
                health: player.health,
                ammo: player.ammo,
                alive: player.alive
            };
        }

        // 记录事件
        if (gameState.events) {
            frame.events = [...gameState.events];
        }

        this.frames.push(frame);

        // 限制最大帧数
        if (this.frames.length > this.maxFrames) {
            this.frames.shift();
        }
    }

    // 开始播放
    startPlayback() {
        if (this.frames.length === 0) {
            console.error('没有可播放的录像');
            return false;
        }

        this.playing = true;
        this.currentIndex = 0;
        console.log(`▶️ 开始播放，共 ${this.frames.length} 帧`);
        return true;
    }

    // 停止播放
    stopPlayback() {
        this.playing = false;
        this.currentIndex = 0;
        console.log('⏹️ 停止播放');
    }

    // 暂停/恢复
    togglePause() {
        if (this.playing) {
            this.playing = false;
            console.log('⏸️ 暂停');
        } else {
            this.playing = true;
            console.log('▶️ 继续');
        }
    }

    // 跳转到指定时间
    seekTo(percent) {
        this.currentIndex = Math.floor(this.frames.length * (percent / 100));
    }

    // 获取当前帧
    getCurrentFrame() {
        if (!this.playing || this.currentIndex >= this.frames.length) {
            this.playing = false;
            return null;
        }

        const frame = this.frames[this.currentIndex];
        this.currentIndex++;
        return frame;
    }

    // 获取播放进度
    getProgress() {
        if (this.frames.length === 0) return 0;
        return (this.currentIndex / this.frames.length) * 100;
    }

    // 获取录像时长
    getDuration() {
        if (this.frames.length === 0) return 0;
        const lastFrame = this.frames[this.frames.length - 1];
        return lastFrame.time / 1000; // 秒
    }

    // 导出录像
    exportReplay() {
        const data = {
            version: 1,
            timestamp: Date.now(),
            duration: this.getDuration(),
            frameCount: this.frames.length,
            frames: this.frames
        };

        const json = JSON.stringify(data);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `replay_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
        a.click();

        URL.revokeObjectURL(url);
        console.log('💾 录像已导出');
    }

    // 导入录像
    importReplay(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    if (data.version !== 1) {
                        throw new Error('不支持的录像版本');
                    }

                    this.frames = data.frames;
                    console.log(`📂 录像已导入，共 ${this.frames.length} 帧`);
                    resolve(true);
                } catch (err) {
                    reject(err);
                }
            };
            reader.readAsText(file);
        });
    }
}

// 回放播放器 UI
class ReplayUI {
    constructor(container, replaySystem) {
        this.container = container;
        this.replay = replaySystem;
        this.element = null;
    }

    show() {
        if (this.element) {
            this.element.style.display = 'block';
            return;
        }

        this.element = document.createElement('div');
        this.element.className = 'replay-controls';
        this.element.style.cssText = `
            position: absolute;
            bottom: 80px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.8);
            padding: 15px 25px;
            border-radius: 10px;
            color: white;
            display: flex;
            align-items: center;
            gap: 15px;
            z-index: 100;
        `;

        this.render();
        this.container.appendChild(this.element);
        this.startUpdateLoop();
    }

    render() {
        const duration = this.replay.getDuration();
        const progress = this.replay.getProgress();

        this.element.innerHTML = `
            <button id="replay-play" style="
                width: 40px; height: 40px;
                background: ${this.replay.playing ? '#f44336' : '#4CAF50'};
                border: none; border-radius: 50%;
                color: white; font-size: 18px;
                cursor: pointer;
            ">${this.replay.playing ? '⏸' : '▶'}</button>
            
            <div style="flex: 1; min-width: 300px;">
                <input type="range" id="replay-seek" min="0" max="100" value="${progress}"
                    style="width: 100%;">
            </div>
            
            <span id="replay-time" style="min-width: 100px; text-align: center;">
                ${this.formatTime(duration * progress / 100)} / ${this.formatTime(duration)}
            </span>
            
            <div style="display: flex; gap: 5px;">
                <button id="replay-speed" style="
                    padding: 8px 12px;
                    background: #333;
                    border: 1px solid #555;
                    border-radius: 5px;
                    color: white;
                    cursor: pointer;
                ">1x</button>
            </div>
            
            <button id="replay-export" style="
                padding: 8px 15px;
                background: #2196F3;
                border: none;
                border-radius: 5px;
                color: white;
                cursor: pointer;
            ">💾 保存</button>
        `;

        this.bindEvents();
    }

    bindEvents() {
        this.element.querySelector('#replay-play').addEventListener('click', () => {
            this.replay.togglePause();
            this.render();
        });

        this.element.querySelector('#replay-seek').addEventListener('input', (e) => {
            this.replay.seekTo(parseFloat(e.target.value));
        });

        this.element.querySelector('#replay-export').addEventListener('click', () => {
            this.replay.exportReplay();
        });
    }

    startUpdateLoop() {
        const update = () => {
            if (!this.element || this.element.style.display === 'none') return;

            const progress = this.replay.getProgress();
            const duration = this.replay.getDuration();
            const seekBar = this.element.querySelector('#replay-seek');
            const timeDisplay = this.element.querySelector('#replay-time');

            if (seekBar) seekBar.value = progress;
            if (timeDisplay) {
                timeDisplay.textContent = `${this.formatTime(duration * progress / 100)} / ${this.formatTime(duration)}`;
            }

            requestAnimationFrame(update);
        };

        update();
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    hide() {
        if (this.element) {
            this.element.style.display = 'none';
        }
    }
}

window.ReplaySystem = ReplaySystem;
window.ReplayUI = ReplayUI;
