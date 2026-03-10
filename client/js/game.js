// Game module - Main game logic
class Game {
    constructor() {
        this.renderer = null;
        this.player = null;
        this.players = new Map();
        this.running = false;
        this.roomId = null;
    }

    init() {
        const container = document.getElementById('game-container');
        this.renderer = new Renderer(container);
        this.player = new PlayerController();
        this.running = true;

        // Start game loop
        this.loop();

        // Handle chat
        this.setupChat();
    }

    loop() {
        if (!this.running) return;

        // Update player
        const { position, rotation } = this.player.update();

        // Update camera
        this.renderer.updateCamera(position, rotation);

        // Send position to server
        if (window.network.connected) {
            window.network.send('move', { ...position, rotation });
        }

        // Update renderer
        this.renderer.update();
        this.renderer.render();

        requestAnimationFrame(() => this.loop());
    }

    setupChat() {
        const input = document.getElementById('chat-input');
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.repeat) {
                if (document.activeElement === input) {
                    const message = input.value.trim();
                    if (message) {
                        window.network.send('chat', { message });
                        input.value = '';
                    }
                    input.blur();
                } else {
                    input.focus();
                    e.preventDefault();
                }
            }
        });
    }

    onRoomJoined(data) {
        this.roomId = data.room_id;
        document.getElementById('room-id').textContent = data.room_id;
        document.getElementById('player-count').textContent = data.players.length;

        // Add local player to renderer
        this.renderer.addPlayer(window.network.playerId, this.player.position, true);

        // Add other players
        data.players.forEach(p => {
            if (p.id !== window.network.playerId) {
                this.renderer.addPlayer(p.id, p.position, false);
                this.players.set(p.id, p);
            }
        });
    }

    onPlayerJoined(data) {
        if (data.player_id !== window.network.playerId) {
            this.renderer.addPlayer(data.player_id, data.position, false);
            this.players.set(data.player_id, data);
            
            const count = this.players.size + 1;
            document.getElementById('player-count').textContent = count;

            this.addKillFeed(`${data.name || data.player_id} 加入了游戏`);
        }
    }

    onPlayerLeft(data) {
        if (data.player_id !== window.network.playerId) {
            this.renderer.removePlayer(data.player_id);
            this.players.delete(data.player_id);
            
            const count = this.players.size + 1;
            document.getElementById('player-count').textContent = count;

            this.addKillFeed(`${data.name || data.player_id} 离开了游戏`);
        }
    }

    onPlayerMoved(data) {
        if (data.player_id !== window.network.playerId) {
            this.renderer.updatePlayer(data.player_id, data.position, data.rotation);
        }
    }

    onPlayerShot(data) {
        const { player_id, target_id, damage } = data;

        // Add bullet visual
        const shooter = player_id === window.network.playerId 
            ? { position: this.player.position }
            : this.players.get(player_id);
        
        if (shooter) {
            this.renderer.addBullet(shooter.position, target_id);
        }

        // If local player was hit
        if (target_id === window.network.playerId) {
            this.player.takeDamage(damage);
            this.addKillFeed(`你被 ${player_id} 击中了！`);
        }

        // If local player hit someone
        if (player_id === window.network.playerId && target_id) {
            this.player.addKill();
            this.addKillFeed(`你击中了 ${target_id}！`);
        }
    }

    onChat(data) {
        const messages = document.getElementById('chat-messages');
        const div = document.createElement('div');
        div.className = 'chat-message';
        div.innerHTML = `<span class="name">${data.name || data.player_id}:</span> ${data.message}`;
        messages.appendChild(div);
        messages.scrollTop = messages.scrollHeight;

        // Remove old messages
        while (messages.children.length > 50) {
            messages.removeChild(messages.firstChild);
        }
    }

    addKillFeed(text) {
        const feed = document.getElementById('kill-feed');
        const div = document.createElement('div');
        div.className = 'kill-item';
        div.textContent = text;
        feed.appendChild(div);

        // Remove after 5 seconds
        setTimeout(() => {
            feed.removeChild(div);
        }, 5000);

        // Limit feed items
        while (feed.children.length > 5) {
            feed.removeChild(feed.firstChild);
        }
    }

    toggleScoreboard(show) {
        const scoreboard = document.getElementById('scoreboard');
        if (show) {
            scoreboard.classList.add('show');
            this.updateScoreboard();
        } else {
            scoreboard.classList.remove('show');
        }
    }

    updateScoreboard() {
        const tbody = document.getElementById('scoreboard-body');
        tbody.innerHTML = '';

        // Add local player
        this.addScoreboardRow(tbody, {
            name: 'You',
            kills: this.player.kills,
            deaths: this.player.deaths,
            score: this.player.score
        });

        // Add other players
        // TODO: Get from server
    }

    addScoreboardRow(tbody, player) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${player.name}</td>
            <td>${player.kills}</td>
            <td>${player.deaths}</td>
            <td>${player.score}</td>
        `;
        tbody.appendChild(tr);
    }

    destroy() {
        this.running = false;
        this.renderer?.dispose();
    }
}

window.Game = Game;
