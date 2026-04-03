// killfeed.js - 击杀信息管理
class KillFeed {
    constructor() {
        this.items = [];
        this.maxItems = 5;
        this.container = document.getElementById('kill-feed');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text == null ? '' : String(text);
        return div.innerHTML;
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
            const weaponText = item.weapon ? ` [${this.escapeHtml(item.weapon)}]` : '';
            const killer = this.escapeHtml(item.killer);
            const victim = this.escapeHtml(item.victim);
            
            return `
                <div class="kill-item">
                    <span class="killer">${killer}</span>
                    ${headshotIcon}${weaponText} → 
                    <span class="victim">${victim}</span>
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
