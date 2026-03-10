// killfeed.js - 击杀信息管理
class KillFeed {
    constructor() {
        this.items = [];
        this.maxItems = 5;
        this.container = document.getElementById('kill-feed');
    }

    add(killer, victim, weapon = '', headshot = false) {
        const item = {
            killer,
            victim,
            weapon,
            headshot,
            timestamp: Date.now()
        };

        this.items.unshift(item);
        
        // 限制数量
        if (this.items.length > this.maxItems) {
            this.items.pop();
        }

        this.render();
    }

    render() {
        if (!this.container) return;

        this.container.innerHTML = this.items.map(item => {
            const headshotIcon = item.headshot ? '🎯 ' : '';
            const weaponText = item.weapon ? ` [${item.weapon}]` : '';
            
            return `
                <div class="kill-item">
                    <span class="killer">${item.killer}</span>
                    ${headshotIcon}${weaponText} → 
                    <span class="victim">${item.victim}</span>
                </div>
            `;
        }).join('');
    }

    clear() {
        this.items = [];
        this.render();
    }
}

window.KillFeed = KillFeed;
