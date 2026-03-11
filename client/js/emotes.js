// emotes.js - 表情系统
class EmoteSystem {
    constructor() {
        this.emotes = this.loadEmotes();
        this.activeEmotes = new Map(); // playerId -> emote
    }

    loadEmotes() {
        return {
            // 基础表情
            'wave': { name: '挥手', emoji: '👋', duration: 2000 },
            'thumbsup': { name: '点赞', emoji: '👍', duration: 2000 },
            'thumbsdown': { name: '踩', emoji: '👎', duration: 2000 },
            'clap': { name: '鼓掌', emoji: '👏', duration: 3000 },
            'shrug': { name: '耸肩', emoji: '🤷', duration: 2000 },
            
            // 情感表情
            'happy': { name: '开心', emoji: '😊', duration: 2000 },
            'sad': { name: '难过', emoji: '😢', duration: 2000 },
            'angry': { name: '生气', emoji: '😠', duration: 2000 },
            'love': { name: '爱心', emoji: '❤️', duration: 2000 },
            'cool': { name: '酷', emoji: '😎', duration: 2000 },
            
            // 游戏表情
            'gg': { name: 'GG', emoji: '🎮', duration: 3000 },
            'nice': { name: 'Nice!', emoji: '🎯', duration: 2000 },
            'oops': { name: '哎呀', emoji: '😅', duration: 2000 },
            'fire': { name: '火了', emoji: '🔥', duration: 2000 },
            'crown': { name: '王者', emoji: '👑', duration: 3000 },
            
            // 动作表情
            'dance': { name: '跳舞', emoji: '💃', duration: 5000, animation: true },
            'sit': { name: '坐下', emoji: '🪑', duration: 0 }, // 持续到移动
            'sleep': { name: '睡觉', emoji: '😴', duration: 0 },
        };
    }

    // 播放表情
    playEmote(playerId, emoteId) {
        const emote = this.emotes[emoteId];
        if (!emote) return false;

        this.activeEmotes.set(playerId, {
            ...emote,
            id: emoteId,
            startTime: Date.now()
        });

        // 自动移除（如果有持续时间）
        if (emote.duration > 0) {
            setTimeout(() => {
                this.stopEmote(playerId);
            }, emote.duration);
        }

        return true;
    }

    // 停止表情
    stopEmote(playerId) {
        this.activeEmotes.delete(playerId);
    }

    // 获取玩家当前表情
    getActiveEmote(playerId) {
        const emote = this.activeEmotes.get(playerId);
        if (!emote) return null;

        // 检查是否过期
        if (emote.duration > 0) {
            const elapsed = Date.now() - emote.startTime;
            if (elapsed >= emote.duration) {
                this.activeEmotes.delete(playerId);
                return null;
            }
        }

        return emote;
    }

    // 获取所有可用表情
    getAvailableEmotes() {
        return Object.entries(this.emotes).map(([id, emote]) => ({
            id,
            ...emote
        }));
    }
}

// 表情选择器 UI
class EmoteWheel {
    constructor(container, emoteSystem) {
        this.container = container;
        this.emoteSystem = emoteSystem;
        this.element = null;
        this.visible = false;
        this.selectedEmote = null;
        this.onSelect = null;
    }

    show() {
        if (this.element) {
            this.element.style.display = 'block';
            this.visible = true;
            return;
        }

        this.element = document.createElement('div');
        this.element.className = 'emote-wheel';
        this.element.style.cssText = `
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            z-index: 200;
        `;

        this.render();
        this.container.appendChild(this.element);
        this.visible = true;
    }

    render() {
        const emotes = this.emoteSystem.getAvailableEmotes();
        const categories = {
            '基础': emotes.filter(e => ['wave', 'thumbsup', 'thumbsdown', 'clap', 'shrug'].includes(e.id)),
            '情感': emotes.filter(e => ['happy', 'sad', 'angry', 'love', 'cool'].includes(e.id)),
            '游戏': emotes.filter(e => ['gg', 'nice', 'oops', 'fire', 'crown'].includes(e.id)),
            '动作': emotes.filter(e => ['dance', 'sit', 'sleep'].includes(e.id)),
        };

        this.element.innerHTML = `
            <div style="
                background: rgba(0, 0, 0, 0.9);
                padding: 20px;
                border-radius: 15px;
                color: white;
            ">
                <h3 style="margin: 0 0 15px 0; text-align: center;">🎭 表情</h3>
                ${Object.entries(categories).map(([category, emotes]) => `
                    <div style="margin-bottom: 15px;">
                        <div style="color: #888; font-size: 12px; margin-bottom: 5px;">${category}</div>
                        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                            ${emotes.map(emote => `
                                <div class="emote-btn" data-id="${emote.id}" style="
                                    width: 50px;
                                    height: 50px;
                                    background: rgba(50, 50, 50, 0.8);
                                    border: 2px solid #555;
                                    border-radius: 10px;
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    cursor: pointer;
                                    font-size: 24px;
                                    transition: all 0.2s;
                                " title="${emote.name}">${emote.emoji}</div>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}
                <div style="text-align: center; margin-top: 10px; color: #666; font-size: 12px;">
                    按 ESC 关闭
                </div>
            </div>
        `;

        this.bindEvents();
    }

    bindEvents() {
        this.element.querySelectorAll('.emote-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const emoteId = btn.dataset.id;
                if (this.onSelect) {
                    this.onSelect(emoteId);
                }
                this.hide();
            });

            btn.addEventListener('mouseenter', () => {
                btn.style.borderColor = '#4fc3f7';
                btn.style.transform = 'scale(1.1)';
            });

            btn.addEventListener('mouseleave', () => {
                btn.style.borderColor = '#555';
                btn.style.transform = 'scale(1)';
            });
        });
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
}

// 快捷聊天
class QuickChat {
    constructor() {
        this.messages = {
            'general': [
                { id: 'hello', text: '你好！', icon: '👋' },
                { id: 'gg', text: 'GG', icon: '🎮' },
                { id: 'nice', text: 'Nice!', icon: '👍' },
                { id: 'ns', text: 'Nice shot!', icon: '🎯' },
                { id: 'sorry', text: '抱歉', icon: '😅' },
                { id: 'thanks', text: '谢谢', icon: '🙏' },
            ],
            'tactical': [
                { id: 'attack', text: '进攻！', icon: '⚔️' },
                { id: 'defend', text: '防守！', icon: '🛡️' },
                { id: 'help', text: '需要支援！', icon: '🆘' },
                { id: 'cover', text: '掩护我！', icon: '🏃' },
                { id: 'retreat', text: '撤退！', icon: '🔙' },
                { id: 'follow', text: '跟我来！', icon: '➡️' },
            ],
            'warnings': [
                { id: 'enemy', text: '敌人！', icon: '⚠️' },
                { id: 'sniper', text: '狙击手！', icon: '🎯' },
                { id: 'behind', text: '注意后方！', icon: '🔙' },
                { id: 'item', text: '道具在这里！', icon: '💎' },
            ]
        };
    }

    getCategories() {
        return Object.keys(this.messages);
    }

    getMessages(category) {
        return this.messages[category] || [];
    }

    getAllMessages() {
        return this.messages;
    }
}

// 快捷聊天 UI
class QuickChatUI {
    constructor(container, quickChat) {
        this.container = container;
        this.quickChat = quickChat;
        this.element = null;
        this.visible = false;
        this.onSelect = null;
    }

    show() {
        if (this.element) {
            this.element.style.display = 'block';
            this.visible = true;
            return;
        }

        this.element = document.createElement('div');
        this.element.className = 'quick-chat';
        this.element.style.cssText = `
            position: absolute;
            left: 20px;
            top: 50%;
            transform: translateY(-50%);
            z-index: 150;
        `;

        this.render();
        this.container.appendChild(this.element);
        this.visible = true;
    }

    render() {
        const categories = this.quickChat.getCategories();

        this.element.innerHTML = `
            <div style="
                background: rgba(0, 0, 0, 0.8);
                padding: 15px;
                border-radius: 10px;
                color: white;
            ">
                ${categories.map(category => `
                    <div style="margin-bottom: 15px;">
                        <div style="color: #888; font-size: 12px; margin-bottom: 5px; text-transform: uppercase;">
                            ${category}
                        </div>
                        ${this.quickChat.getMessages(category).map(msg => `
                            <div class="chat-msg" data-id="${msg.id}" data-text="${msg.text}" style="
                                padding: 8px 12px;
                                margin: 3px 0;
                                background: rgba(50, 50, 50, 0.8);
                                border-radius: 5px;
                                cursor: pointer;
                                font-size: 14px;
                            ">
                                ${msg.icon} ${msg.text}
                            </div>
                        `).join('')}
                    </div>
                `).join('')}
            </div>
        `;

        this.bindEvents();
    }

    bindEvents() {
        this.element.querySelectorAll('.chat-msg').forEach(msg => {
            msg.addEventListener('click', () => {
                const text = msg.dataset.text;
                if (this.onSelect) {
                    this.onSelect(text);
                }
            });

            msg.addEventListener('mouseenter', () => {
                msg.style.background = 'rgba(79, 195, 247, 0.3)';
            });

            msg.addEventListener('mouseleave', () => {
                msg.style.background = 'rgba(50, 50, 50, 0.8)';
            });
        });
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
}

window.EmoteSystem = EmoteSystem;
window.EmoteWheel = EmoteWheel;
window.QuickChat = QuickChat;
window.QuickChatUI = QuickChatUI;
