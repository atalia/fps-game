// 模拟前端发送聊天消息测试
const WebSocket = require('ws');

const WS_URL = process.env.WS_URL || 'ws://localhost:8080/ws';
console.log(`Connecting to ${WS_URL}`);

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
    console.log('✅ Connected to server');
    
    // 1. 发送 join_room
    const joinMsg = {
        type: 'join_room',
        data: { room_id: '', name: 'TestPlayer_Claw' },
        timestamp: Date.now()
    };
    console.log('📤 Sending join_room...');
    ws.send(JSON.stringify(joinMsg));
});

ws.on('message', (data) => {
    try {
        const msg = JSON.parse(data.toString());
        console.log(`📥 Received: ${msg.type}`, JSON.stringify(msg.data || {}).substring(0, 100));
        
        if (msg.type === 'room_joined') {
            console.log('✅ Room joined:', msg.data.room_id);
            console.log('   Player ID:', msg.data.player_id);
            console.log('   Player count:', msg.data.player_count);
            
            // 2. 发送聊天消息
            setTimeout(() => {
                console.log('\n📤 Sending chat message...');
                const chatMsg = {
                    type: 'chat',
                    data: { message: 'Hello from test script!' },
                    timestamp: Date.now()
                };
                ws.send(JSON.stringify(chatMsg));
                console.log('✅ Chat message sent');
            }, 1000);
        }
        
        if (msg.type === 'chat') {
            console.log('\n🎉 CHAT RECEIVED!');
            console.log('   From:', msg.data.name);
            console.log('   Message:', msg.data.message);
        }
    } catch (e) {
        console.error('Parse error:', e.message);
    }
});

ws.on('error', (err) => {
    console.error('❌ WebSocket error:', err.message);
});

ws.on('close', () => {
    console.log('Connection closed');
    process.exit(0);
});

// 20秒后关闭
setTimeout(() => {
    console.log('\n⏰ Test timeout, closing...');
    ws.close();
}, 20000);
