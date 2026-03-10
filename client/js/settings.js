// settings.js - 游戏设置
class GameSettings {
    constructor() {
        this.settings = this.load();
    }

    defaults() {
        return {
            // 音频
            masterVolume: 0.8,
            musicVolume: 0.5,
            sfxVolume: 0.8,
            voiceVolume: 0.8,

            // 图形
            quality: 'high', // low, medium, high
            shadows: true,
            antialias: true,
            renderDistance: 500,
            fov: 75,

            // 控制
            sensitivity: 1.0,
            invertY: false,
            holdToAim: false,

            // 游戏
            showFPS: true,
            showPing: true,
            crosshairStyle: 'default',
            crosshairColor: '#00ff00',
            crosshairSize: 10,

            // HUD
            showHealthBar: true,
            showAmmoCount: true,
            showMinimap: true,
            showKillFeed: true,
            showScoreboard: true,

            // 快捷键
            keyBindings: {
                forward: 'w',
                backward: 's',
                left: 'a',
                right: 'd',
                jump: ' ',
                reload: 'r',
                shoot: 'mouse0',
                aim: 'mouse2',
                score: 'tab',
                chat: 'enter'
            }
        };
    }

    load() {
        const saved = localStorage.getItem('fps_game_settings');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                return { ...this.defaults(), ...parsed };
            } catch (e) {
                console.error('Failed to load settings:', e);
            }
        }
        return this.defaults();
    }

    save() {
        localStorage.setItem('fps_game_settings', JSON.stringify(this.settings));
    }

    get(key) {
        return this.settings[key];
    }

    set(key, value) {
        this.settings[key] = value;
        this.save();
    }

    reset() {
        this.settings = this.defaults();
        this.save();
    }

    // 获取 Three.js 渲染质量设置
    getRendererSettings() {
        const presets = {
            low: {
                antialias: false,
                pixelRatio: 0.75,
                shadowMap: false
            },
            medium: {
                antialias: true,
                pixelRatio: 1,
                shadowMap: true
            },
            high: {
                antialias: true,
                pixelRatio: window.devicePixelRatio,
                shadowMap: true
            }
        };

        return presets[this.settings.quality] || presets.medium;
    }

    // 导出配置
    export() {
        return JSON.stringify(this.settings, null, 2);
    }

    // 导入配置
    import(json) {
        try {
            const imported = JSON.parse(json);
            this.settings = { ...this.defaults(), ...imported };
            this.save();
            return true;
        } catch (e) {
            console.error('Failed to import settings:', e);
            return false;
        }
    }
}

// 设置界面
class SettingsUI {
    constructor(container, settings) {
        this.container = container;
        this.settings = settings;
        this.element = null;
        this.visible = false;
    }

    show() {
        if (this.element) {
            this.element.style.display = 'block';
            this.visible = true;
            return;
        }

        this.element = document.createElement('div');
        this.element.className = 'settings-panel';
        this.element.innerHTML = this.renderHTML();
        this.element.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 30px;
            border-radius: 15px;
            min-width: 500px;
            max-height: 80vh;
            overflow-y: auto;
            z-index: 1000;
        `;

        this.container.appendChild(this.element);
        this.bindEvents();
        this.visible = true;
    }

    hide() {
        if (this.element) {
            this.element.style.display = 'none';
            this.visible = false;
        }
    }

    toggle() {
        if (this.visible) {
            this.hide();
        } else {
            this.show();
        }
    }

    renderHTML() {
        return `
            <h2 style="margin: 0 0 20px 0;">⚙️ 游戏设置</h2>
            
            <div class="settings-section">
                <h3>🔊 音频</h3>
                <div class="setting-row">
                    <label>主音量</label>
                    <input type="range" id="masterVolume" min="0" max="1" step="0.1" 
                           value="${this.settings.get('masterVolume')}">
                    <span>${Math.round(this.settings.get('masterVolume') * 100)}%</span>
                </div>
                <div class="setting-row">
                    <label>音效</label>
                    <input type="range" id="sfxVolume" min="0" max="1" step="0.1"
                           value="${this.settings.get('sfxVolume')}">
                </div>
            </div>

            <div class="settings-section">
                <h3>🎮 控制</h3>
                <div class="setting-row">
                    <label>灵敏度</label>
                    <input type="range" id="sensitivity" min="0.1" max="3" step="0.1"
                           value="${this.settings.get('sensitivity')}">
                    <span>${this.settings.get('sensitivity').toFixed(1)}</span>
                </div>
                <div class="setting-row">
                    <label>反转 Y 轴</label>
                    <input type="checkbox" id="invertY" ${this.settings.get('invertY') ? 'checked' : ''}>
                </div>
            </div>

            <div class="settings-section">
                <h3>🖥️ 图形</h3>
                <div class="setting-row">
                    <label>画质</label>
                    <select id="quality">
                        <option value="low" ${this.settings.get('quality') === 'low' ? 'selected' : ''}>低</option>
                        <option value="medium" ${this.settings.get('quality') === 'medium' ? 'selected' : ''}>中</option>
                        <option value="high" ${this.settings.get('quality') === 'high' ? 'selected' : ''}>高</option>
                    </select>
                </div>
                <div class="setting-row">
                    <label>视场角 (FOV)</label>
                    <input type="range" id="fov" min="60" max="120" step="5"
                           value="${this.settings.get('fov')}">
                    <span>${this.settings.get('fov')}°</span>
                </div>
            </div>

            <div class="settings-section">
                <h3>🎯 准星</h3>
                <div class="setting-row">
                    <label>颜色</label>
                    <input type="color" id="crosshairColor" value="${this.settings.get('crosshairColor')}">
                </div>
                <div class="setting-row">
                    <label>大小</label>
                    <input type="range" id="crosshairSize" min="5" max="30" step="1"
                           value="${this.settings.get('crosshairSize')}">
                </div>
            </div>

            <div class="settings-buttons" style="margin-top: 20px; text-align: right;">
                <button id="resetSettings" style="padding: 10px 20px; margin-right: 10px;">重置默认</button>
                <button id="closeSettings" style="padding: 10px 20px;">关闭</button>
            </div>

            <style>
                .settings-section { margin-bottom: 20px; }
                .settings-section h3 { margin: 0 0 10px 0; color: #4fc3f7; }
                .setting-row { 
                    display: flex; 
                    align-items: center; 
                    margin: 8px 0;
                }
                .setting-row label { 
                    width: 120px; 
                    color: #aaa;
                }
                .setting-row input[type="range"] { 
                    flex: 1; 
                    margin: 0 10px;
                }
                .setting-row select {
                    flex: 1;
                    padding: 5px;
                    background: #333;
                    color: white;
                    border: 1px solid #555;
                    border-radius: 4px;
                }
                .setting-row input[type="checkbox"] {
                    transform: scale(1.5);
                }
            </style>
        `;
    }

    bindEvents() {
        // 滑块
        this.element.querySelectorAll('input[type="range"]').forEach(input => {
            input.addEventListener('input', (e) => {
                const key = e.target.id;
                const value = parseFloat(e.target.value);
                this.settings.set(key, value);

                // 更新显示
                const span = e.target.nextElementSibling;
                if (span && span.tagName === 'SPAN') {
                    if (key === 'sensitivity') {
                        span.textContent = value.toFixed(1);
                    } else if (key === 'fov') {
                        span.textContent = value + '°';
                    } else if (key.includes('Volume')) {
                        span.textContent = Math.round(value * 100) + '%';
                    }
                }
            });
        });

        // 复选框
        this.element.querySelectorAll('input[type="checkbox"]').forEach(input => {
            input.addEventListener('change', (e) => {
                this.settings.set(e.target.id, e.target.checked);
            });
        });

        // 选择框
        this.element.querySelectorAll('select').forEach(select => {
            select.addEventListener('change', (e) => {
                this.settings.set(e.target.id, e.target.value);
            });
        });

        // 颜色选择器
        this.element.querySelectorAll('input[type="color"]').forEach(input => {
            input.addEventListener('input', (e) => {
                this.settings.set(e.target.id, e.target.value);
            });
        });

        // 按钮
        this.element.querySelector('#resetSettings').addEventListener('click', () => {
            if (confirm('确定要重置所有设置为默认值吗？')) {
                this.settings.reset();
                this.element.innerHTML = this.renderHTML();
                this.bindEvents();
            }
        });

        this.element.querySelector('#closeSettings').addEventListener('click', () => {
            this.hide();
        });
    }
}

window.GameSettings = GameSettings;
window.SettingsUI = SettingsUI;
