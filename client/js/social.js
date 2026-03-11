// friends.js - 好友系统
class FriendsSystem {
    constructor() {
        this.friends = [];
        this.pendingRequests = [];
        this.blockedPlayers = [];
        this.onlineFriends = [];
    }

    // 添加好友
    addFriend(friend) {
        if (this.isFriend(friend.id)) return false;

        this.friends.push({
            id: friend.id,
            name: friend.name,
            avatar: friend.avatar || null,
            status: 'offline',
            lastOnline: null,
            addedAt: Date.now()
        });

        return true;
    }

    // 移除好友
    removeFriend(friendId) {
        const index = this.friends.findIndex(f => f.id === friendId);
        if (index !== -1) {
            this.friends.splice(index, 1);
            return true;
        }
        return false;
    }

    // 是否为好友
    isFriend(playerId) {
        return this.friends.some(f => f.id === playerId);
    }

    // 更新好友状态
    updateFriendStatus(friendId, status) {
        const friend = this.friends.find(f => f.id === friendId);
        if (friend) {
            friend.status = status;
            if (status === 'offline') {
                friend.lastOnline = Date.now();
            }
            return true;
        }
        return false;
    }

    // 获取在线好友
    getOnlineFriends() {
        return this.friends.filter(f => f.status === 'online' || f.status === 'in-game');
    }

    // 添加好友请求
    addRequest(request) {
        this.pendingRequests.push({
            id: request.id,
            from: request.from,
            fromName: request.fromName,
            timestamp: Date.now()
        });
    }

    // 接受请求
    acceptRequest(requestId) {
        const index = this.pendingRequests.findIndex(r => r.id === requestId);
        if (index !== -1) {
            const request = this.pendingRequests.splice(index, 1)[0];
            this.addFriend({
                id: request.from,
                name: request.fromName
            });
            return request;
        }
        return null;
    }

    // 拒绝请求
    declineRequest(requestId) {
        const index = this.pendingRequests.findIndex(r => r.id === requestId);
        if (index !== -1) {
            this.pendingRequests.splice(index, 1);
            return true;
        }
        return false;
    }

    // 屏蔽玩家
    blockPlayer(playerId, playerName) {
        if (this.isBlocked(playerId)) return false;

        this.blockedPlayers.push({
            id: playerId,
            name: playerName,
            blockedAt: Date.now()
        });

        // 如果是好友，移除
        this.removeFriend(playerId);

        return true;
    }

    // 取消屏蔽
    unblockPlayer(playerId) {
        const index = this.blockedPlayers.findIndex(p => p.id === playerId);
        if (index !== -1) {
            this.blockedPlayers.splice(index, 1);
            return true;
        }
        return false;
    }

    // 是否已屏蔽
    isBlocked(playerId) {
        return this.blockedPlayers.some(p => p.id === playerId);
    }

    // 搜索好友
    searchFriends(query) {
        const lowerQuery = query.toLowerCase();
        return this.friends.filter(f => 
            f.name.toLowerCase().includes(lowerQuery)
        );
    }

    // 获取好友列表（排序）
    getFriendsSorted() {
        return [...this.friends].sort((a, b) => {
            // 在线优先
            const statusOrder = { 'in-game': 0, 'online': 1, 'away': 2, 'offline': 3 };
            const orderA = statusOrder[a.status] || 4;
            const orderB = statusOrder[b.status] || 4;

            if (orderA !== orderB) {
                return orderA - orderB;
            }

            // 按名称排序
            return a.name.localeCompare(b.name);
        });
    }

    // 导出数据
    export() {
        return {
            friends: this.friends,
            blockedPlayers: this.blockedPlayers
        };
    }

    // 导入数据
    import(data) {
        if (data.friends) {
            this.friends = data.friends;
        }
        if (data.blockedPlayers) {
            this.blockedPlayers = data.blockedPlayers;
        }
    }
}

// 好友列表 UI
class FriendsUI {
    constructor(container, friendsSystem) {
        this.container = container;
        this.friendsSystem = friendsSystem;
        this.element = null;
        this.isVisible = false;
    }

    show() {
        if (this.element) {
            this.element.style.display = 'flex';
            this.render();
            this.isVisible = true;
            return;
        }

        this.element = document.createElement('div');
        this.element.className = 'friends-ui';
        this.element.style.cssText = `
            position: absolute;
            right: 10px;
            top: 200px;
            width: 250px;
            max-height: 400px;
            background: rgba(0, 0, 0, 0.85);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 10px;
            display: flex;
            flex-direction: column;
            z-index: 100;
            overflow: hidden;
        `;

        this.render();
        this.container.appendChild(this.element);
        this.isVisible = true;
    }

    render() {
        const friends = this.friendsSystem.getFriendsSorted();
        const online = this.friendsSystem.getOnlineFriends();
        const pending = this.friendsSystem.pendingRequests;

        this.element.innerHTML = `
            <div style="
                padding: 10px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                display: flex;
                justify-content: space-between;
                align-items: center;
            ">
                <span style="color: white; font-weight: bold;">好友 (${online.length}/${friends.length})</span>
                <button id="closeFriends" style="
                    background: none;
                    border: none;
                    color: white;
                    cursor: pointer;
                    font-size: 18px;
                ">×</button>
            </div>

            ${pending.length > 0 ? `
                <div style="padding: 10px; background: rgba(255, 193, 7, 0.2); border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
                    <div style="color: #ffc107; font-size: 12px; margin-bottom: 5px;">
                        好友请求 (${pending.length})
                    </div>
                    ${pending.slice(0, 3).map(r => `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 5px 0;">
                            <span style="color: white; font-size: 12px;">${r.fromName}</span>
                            <div>
                                <button class="accept-request" data-id="${r.id}" style="
                                    background: #4CAF50;
                                    border: none;
                                    color: white;
                                    padding: 3px 8px;
                                    border-radius: 3px;
                                    cursor: pointer;
                                    font-size: 11px;
                                    margin-right: 5px;
                                ">✓</button>
                                <button class="decline-request" data-id="${r.id}" style="
                                    background: #f44336;
                                    border: none;
                                    color: white;
                                    padding: 3px 8px;
                                    border-radius: 3px;
                                    cursor: pointer;
                                    font-size: 11px;
                                ">×</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            ` : ''}

            <div style="flex: 1; overflow-y: auto; padding: 10px;">
                ${friends.length === 0 ? `
                    <div style="color: #888; text-align: center; padding: 20px;">
                        暂无好友
                    </div>
                ` : friends.map(f => `
                    <div class="friend-item" data-id="${f.id}" style="
                        display: flex;
                        align-items: center;
                        padding: 8px;
                        border-radius: 5px;
                        cursor: pointer;
                        margin-bottom: 5px;
                    " onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='transparent'">
                        <div style="
                            width: 8px;
                            height: 8px;
                            border-radius: 50%;
                            background: ${this.getStatusColor(f.status)};
                            margin-right: 10px;
                        "></div>
                        <div style="flex: 1;">
                            <div style="color: white; font-size: 13px;">${f.name}</div>
                            <div style="color: #888; font-size: 11px;">
                                ${this.getStatusText(f.status)}
                            </div>
                        </div>
                        <button class="invite-friend" data-id="${f.id}" style="
                            background: rgba(79, 195, 247, 0.3);
                            border: 1px solid #4fc3f7;
                            color: #4fc3f7;
                            padding: 3px 8px;
                            border-radius: 3px;
                            cursor: pointer;
                            font-size: 11px;
                            display: ${f.status === 'online' ? 'block' : 'none'};
                        ">邀请</button>
                    </div>
                `).join('')}
            </div>

            <div style="padding: 10px; border-top: 1px solid rgba(255, 255, 255, 0.1);">
                <button id="addFriendBtn" style="
                    width: 100%;
                    padding: 8px;
                    background: rgba(79, 195, 247, 0.2);
                    border: 1px solid #4fc3f7;
                    color: #4fc3f7;
                    border-radius: 5px;
                    cursor: pointer;
                ">+ 添加好友</button>
            </div>
        `;

        this.bindEvents();
    }

    getStatusColor(status) {
        const colors = {
            'online': '#4CAF50',
            'in-game': '#2196F3',
            'away': '#ffc107',
            'offline': '#666'
        };
        return colors[status] || '#666';
    }

    getStatusText(status) {
        const texts = {
            'online': '在线',
            'in-game': '游戏中',
            'away': '离开',
            'offline': '离线'
        };
        return texts[status] || '离线';
    }

    bindEvents() {
        this.element.querySelector('#closeFriends')?.addEventListener('click', () => {
            this.hide();
        });

        this.element.querySelectorAll('.accept-request').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const request = this.friendsSystem.acceptRequest(btn.dataset.id);
                if (request && this.onFriendAdded) {
                    this.onFriendAdded(request);
                }
                this.render();
            });
        });

        this.element.querySelectorAll('.decline-request').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.friendsSystem.declineRequest(btn.dataset.id);
                this.render();
            });
        });

        this.element.querySelectorAll('.invite-friend').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.onInviteFriend) {
                    this.onInviteFriend(btn.dataset.id);
                }
            });
        });

        this.element.querySelector('#addFriendBtn')?.addEventListener('click', () => {
            if (this.onAddFriend) {
                this.onAddFriend();
            }
        });
    }

    hide() {
        if (this.element) {
            this.element.style.display = 'none';
            this.isVisible = false;
        }
    }

    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }
}

// 聊天系统
class ChatSystem {
    constructor() {
        this.channels = new Map();
        this.currentChannel = 'global';
        this.maxMessages = 100;
    }

    // 添加频道
    addChannel(channelId, name) {
        this.channels.set(channelId, {
            id: channelId,
            name: name,
            messages: [],
            unread: 0,
            muted: false
        });
    }

    // 发送消息
    sendMessage(channelId, message) {
        const channel = this.channels.get(channelId);
        if (!channel || channel.muted) return false;

        channel.messages.push({
            id: Date.now().toString(),
            sender: message.sender,
            senderId: message.senderId,
            content: message.content,
            timestamp: Date.now(),
            type: message.type || 'text'
        });

        // 限制消息数量
        if (channel.messages.length > this.maxMessages) {
            channel.messages.shift();
        }

        return true;
    }

    // 接收消息
    receiveMessage(channelId, message) {
        const channel = this.channels.get(channelId);
        if (!channel || channel.muted) return false;

        channel.messages.push({
            id: message.id || Date.now().toString(),
            sender: message.sender,
            senderId: message.senderId,
            content: message.content,
            timestamp: message.timestamp || Date.now(),
            type: message.type || 'text'
        });

        // 未读计数
        if (channelId !== this.currentChannel) {
            channel.unread++;
        }

        // 限制消息数量
        if (channel.messages.length > this.maxMessages) {
            channel.messages.shift();
        }

        return true;
    }

    // 获取消息
    getMessages(channelId, limit = 50) {
        const channel = this.channels.get(channelId);
        if (!channel) return [];

        const messages = channel.messages;
        const start = Math.max(0, messages.length - limit);
        return messages.slice(start);
    }

    // 切换频道
    switchChannel(channelId) {
        if (!this.channels.has(channelId)) return false;

        this.currentChannel = channelId;

        // 清除未读
        const channel = this.channels.get(channelId);
        channel.unread = 0;

        return true;
    }

    // 静音频道
    toggleMute(channelId) {
        const channel = this.channels.get(channelId);
        if (!channel) return false;

        channel.muted = !channel.muted;
        return channel.muted;
    }

    // 清除频道
    clearChannel(channelId) {
        const channel = this.channels.get(channelId);
        if (!channel) return false;

        channel.messages = [];
        return true;
    }

    // 获取未读数
    getUnreadCount() {
        let total = 0;
        for (const channel of this.channels.values()) {
            total += channel.unread;
        }
        return total;
    }
}

// 聊天 UI
class ChatUI {
    constructor(container, chatSystem) {
        this.container = container;
        this.chatSystem = chatSystem;
        this.element = null;
        this.inputElement = null;
        this.isFocused = false;
    }

    show() {
        if (this.element) {
            this.element.style.display = 'flex';
            return;
        }

        this.element = document.createElement('div');
        this.element.className = 'chat-ui';
        this.element.style.cssText = `
            position: absolute;
            left: 10px;
            bottom: 10px;
            width: 350px;
            height: 200px;
            background: rgba(0, 0, 0, 0.7);
            border-radius: 10px;
            display: flex;
            flex-direction: column;
            z-index: 100;
        `;

        this.render();
        this.container.appendChild(this.element);
    }

    render() {
        const messages = this.chatSystem.getMessages(this.chatSystem.currentChannel, 20);

        this.element.innerHTML = `
            <div id="chatMessages" style="
                flex: 1;
                overflow-y: auto;
                padding: 10px;
                font-size: 13px;
            ">
                ${messages.map(m => `
                    <div style="margin-bottom: 5px;">
                        <span style="color: #4fc3f7;">${m.sender}:</span>
                        <span style="color: white;">${this.escapeHtml(m.content)}</span>
                    </div>
                `).join('')}
            </div>
            <div style="padding: 10px; border-top: 1px solid rgba(255, 255, 255, 0.1);">
                <input id="chatInput" type="text" placeholder="输入消息... (Enter 发送)" style="
                    width: 100%;
                    padding: 8px;
                    background: rgba(255, 255, 255, 0.1);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    border-radius: 5px;
                    color: white;
                    font-size: 13px;
                    outline: none;
                " />
            </div>
        `;

        this.inputElement = this.element.querySelector('#chatInput');
        this.bindEvents();
        this.scrollToBottom();
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    bindEvents() {
        if (this.inputElement) {
            this.inputElement.addEventListener('focus', () => {
                this.isFocused = true;
            });

            this.inputElement.addEventListener('blur', () => {
                this.isFocused = false;
            });

            this.inputElement.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && this.inputElement.value.trim()) {
                    if (this.onSendMessage) {
                        this.onSendMessage(this.inputElement.value.trim());
                    }
                    this.inputElement.value = '';
                }
            });
        }
    }

    scrollToBottom() {
        const messagesEl = this.element.querySelector('#chatMessages');
        if (messagesEl) {
            messagesEl.scrollTop = messagesEl.scrollHeight;
        }
    }

    addMessage(message) {
        const messagesEl = this.element.querySelector('#chatMessages');
        if (!messagesEl) return;

        const msgEl = document.createElement('div');
        msgEl.style.marginBottom = '5px';
        msgEl.innerHTML = `
            <span style="color: #4fc3f7;">${message.sender}:</span>
            <span style="color: white;">${this.escapeHtml(message.content)}</span>
        `;
        messagesEl.appendChild(msgEl);
        this.scrollToBottom();
    }

    hide() {
        if (this.element) {
            this.element.style.display = 'none';
        }
    }
}

window.FriendsSystem = FriendsSystem;
window.FriendsUI = FriendsUI;
window.ChatSystem = ChatSystem;
window.ChatUI = ChatUI;
