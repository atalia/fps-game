// scoreboard.js - 记分板
class Scoreboard {
    constructor() {
        this.players = [];
        this.visible = false;
        this.container = document.getElementById('scoreboard');
        this.rowsContainer = document.getElementById('scoreboard-rows');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text == null ? '' : String(text);
        return div.innerHTML;
    }

    update(players) {
        // 按分数排序
        this.players = players.sort((a, b) => b.score - a.score);
        this.render();
    }

    render() {
        if (!this.rowsContainer) return;

        this.rowsContainer.innerHTML = this.players.map((p, i) => {
            const kd = p.deaths > 0 ? (p.kills / p.deaths).toFixed(2) : p.kills.toFixed(2);
            const name = this.escapeHtml(p.name);
            
            return `
                <div class="score-row ${i === 0 ? 'top' : ''}">
                    <span>${name}</span>
                    <span>${p.kills}</span>
                    <span>${p.deaths}</span>
                    <span>${p.score}</span>
                    <span>${kd}</span>
                </div>
            `;
        }).join('');
    }

    show() {
        if (this.container) {
            this.container.classList.add('visible');
            this.visible = true;
        }
    }

    hide() {
        if (this.container) {
            this.container.classList.remove('visible');
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

window.Scoreboard = Scoreboard;
