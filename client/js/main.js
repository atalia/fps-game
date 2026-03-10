// Main entry point
let game = null;

// Join game
async function joinGame() {
    const nameInput = document.getElementById('player-name');
    const serverInput = document.getElementById('server-url');

    const name = nameInput.value.trim() || 'Player';
    const serverUrl = serverInput.value.trim();

    try {
        // Connect to server
        await window.network.connect(serverUrl);

        // Show game screen
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('game-screen').style.display = 'block';

        // Initialize game
        game = new Game();
        game.init();
        window.game = game;

        // Join room
        window.network.send('join_room', { name });

    } catch (error) {
        alert('连接服务器失败: ' + error.message);
        console.error('Connection error:', error);
    }
}

// Handle Enter key on login screen
document.addEventListener('DOMContentLoaded', () => {
    const nameInput = document.getElementById('player-name');
    nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            joinGame();
        }
    });
    nameInput.focus();
});

// Handle page unload
window.addEventListener('beforeunload', () => {
    window.network.disconnect();
    game?.destroy();
});
