// radio.js - CS 1.6 风格无线电指令系统
class RadioMenu {
    constructor() {
        this.currentMenu = null;
        this.visible = false;
        this.menus = {
            'z': { // 标准无线电
                title: '标准无线电',
                items: [
                    { key: '1', text: '"Cover Me"', cmd: 'coverme' },
                    { key: '2', text: '"You Take the Point"', cmd: 'takepoint' },
                    { key: '3', text: '"Hold This Position"', cmd: 'holdpos' },
                    { key: '4', text: '"Regroup Team"', cmd: 'regroup' },
                    { key: '5', text: '"Follow Me"', cmd: 'followme' },
                    { key: '6', text: '"Taking Fire, Need Assistance"', cmd: 'takingfire' }
                ]
            },
            'x': { // 组队无线电
                title: '组队无线电',
                items: [
                    { key: '1', text: '"Go Go Go"', cmd: 'go' },
                    { key: '2', text: '"Fall Back"', cmd: 'fallback' },
                    { key: '3', text: '"Stick Together Team"', cmd: 'sticktog' },
                    { key: '4', text: '"Get in Position"', cmd: 'getinpos' },
                    { key: '5', text: '"Storm the Front"', cmd: 'stormfront' },
                    { key: '6', text: '"Report In Team"', cmd: 'report' }
                ]
            },
            'c': { // 回答无线电
                title: '回答无线电',
                items: [
                    { key: '1', text: '"Affirmative/Roger"', cmd: 'roger' },
                    { key: '2', text: '"Negative"', cmd: 'negative' },
                    { key: '3', text: '"Enemy Down"', cmd: 'enemydown' },
                    { key: '4', text: '"Need Backup"', cmd: 'needbackup' },
                    { key: '5', text: '"Sector Clear"', cmd: 'sectorclear' },
                    { key: '6', text: '"In Position"', cmd: 'inposition' },
                    { key: '7', text: '"Reporting In"', cmd: 'reportingin' },
                    { key: '8', text: '"She\'s gonna Blow!"', cmd: 'blow' },
                    { key: '9', text: '"Negative"', cmd: 'negative' }
                ]
            }
        };
        
        this.createMenuElement();
        this.bindEvents();
    }

    createMenuElement() {
        this.menuElement = document.createElement('div');
        this.menuElement.id = 'radio-menu';
        this.menuElement.style.cssText = `
            position: fixed;
            left: 50px;
            top: 50%;
            transform: translateY(-50%);
            background: rgba(0, 0, 0, 0.8);
            border: 2px solid rgba(255, 255, 255, 0.3);
            border-radius: 8px;
            padding: 10px;
            font-family: 'Courier New', monospace;
            font-size: 14px;
            color: white;
            display: none;
            z-index: 1000;
            min-width: 250px;
        `;
        document.body.appendChild(this.menuElement);
    }

    bindEvents() {
        document.addEventListener('keydown', (e) => {
            if (e.code === 'KeyZ' || e.code === 'KeyX' || e.code === 'KeyC') {
                const key = e.code.replace('Key', '').toLowerCase();
                this.showMenu(key);
            } else if (this.visible && e.key >= '0' && e.key <= '9') {
                this.selectItem(e.key);
            } else if (e.code === 'Escape') {
                this.hideMenu();
            }
        });

        document.addEventListener('keyup', (e) => {
            if (e.code === 'KeyZ' || e.code === 'KeyX' || e.code === 'KeyC') {
                // 延迟隐藏，给用户选择时间
                setTimeout(() => {
                    if (this.currentMenu === e.code.replace('Key', '').toLowerCase()) {
                        // 如果还没选择，保持显示
                    }
                }, 100);
            }
        });
    }

    showMenu(key) {
        if (!this.menus[key]) return;
        
        this.currentMenu = key;
        this.visible = true;
        
        const menu = this.menus[key];
        let html = `<div style="color: #FFD700; margin-bottom: 10px; font-weight: bold;">${menu.title}</div>`;
        
        menu.items.forEach(item => {
            html += `<div style="margin: 5px 0;"><span style="color: #FFD700;">${item.key}.</span> ${item.text}</div>`;
        });
        
        html += `<div style="margin-top: 10px; color: #888; font-size: 12px;">按数字键选择</div>`;
        
        this.menuElement.innerHTML = html;
        this.menuElement.style.display = 'block';
    }

    hideMenu() {
        this.visible = false;
        this.currentMenu = null;
        this.menuElement.style.display = 'none';
    }

    selectItem(key) {
        if (!this.currentMenu || !this.menus[this.currentMenu]) return;
        
        const menu = this.menus[this.currentMenu];
        const item = menu.items.find(i => i.key === key);
        
        if (item) {
            this.sendRadioCommand(item.cmd, item.text);
            this.hideMenu();
        }
    }

    sendRadioCommand(cmd, text) {
        // 发送到服务器
        if (window.network?.connected) {
            window.network.send('radio', {
                cmd: cmd,
                text: text
            });
        }

        // 本地显示
        this.showRadioText(text);
        
        // 播放音效
        if (window.audioManager?.playRadio) {
            window.audioManager.playRadio(cmd);
        }
    }

    showRadioText(text) {
        // 显示在聊天区域
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) {
            const msg = document.createElement('div');
            msg.style.cssText = 'color: #FFD700; font-style: italic;';
            msg.textContent = `[无线电] ${text}`;
            chatMessages.appendChild(msg);
            chatMessages.scrollTop = chatMessages.scrollHeight;
            
            // 5秒后淡出
            setTimeout(() => {
                msg.style.opacity = '0.5';
            }, 5000);
        }
    }

    // 接收其他玩家的无线电消息
    receiveRadio(data) {
        this.showRadioText(`(${data.player_name}): ${data.text}`);
        
        // 播放音效
        if (window.audioManager?.playRadio) {
            window.audioManager.playRadio(data.cmd);
        }
    }
}

window.RadioMenu = RadioMenu;
