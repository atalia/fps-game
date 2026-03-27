// 多人联机同步测试脚本
// 测试多个 WebSocket 客户端之间的消息同步

const WebSocket = require('ws');

const SERVER_URL = process.env.SERVER_URL || process.env.WS_URL || 'ws://localhost:8080/ws';
const CLIENT_COUNT = 3;
const TEST_DURATION = 10000; // 10秒测试

console.log(`Using server: ${SERVER_URL}`);

const clients = [];
const messages = {}; // clientIndex -> [messages]

// 创建客户端
async function createClient(index) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(SERVER_URL);
    messages[index] = [];

    ws.on('open', () => {
      console.log(`[Client ${index}] Connected`);
      
      // 第一个客户端创建房间
      if (index === 0) {
        ws.send(JSON.stringify({
          type: 'join_room',
          data: { name: `Player${index}`, room_id: '' }
        }));
      }
      // 其他客户端等待房间ID后再加入
    });

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      messages[index].push(msg);
      
      // 记录关键消息
      if (['room_joined', 'player_joined', 'move', 'shoot', 'chat', 'player_left'].includes(msg.type)) {
        console.log(`[Client ${index}] ${msg.type}: ${JSON.stringify(msg.data || {}).substring(0, 100)}`);
      }

      // 第一个客户端收到 room_joined 后，通知其他客户端加入
      if (index === 0 && msg.type === 'room_joined' && !global.roomId) {
        global.roomId = msg.data.room_id;
        console.log(`\n=== Room created: ${global.roomId} ===\n`);
      }
      
      // 其他客户端收到欢迎消息后，检查是否需要加入房间
      if (index !== 0 && msg.type === 'welcome' && global.roomId) {
        ws.send(JSON.stringify({
          type: 'join_room',
          data: { name: `Player${index}`, room_id: global.roomId }
        }));
      }
    });

    ws.on('error', (err) => {
      console.error(`[Client ${index}] Error:`, err.message);
    });

    ws.on('close', () => {
      console.log(`[Client ${index}] Disconnected`);
    });

    setTimeout(() => resolve(ws), 200);
  });
}

// 等待所有客户端加入同一房间
async function waitForSync() {
  return new Promise(resolve => {
    const check = () => {
      // 检查房间ID是否已创建
      if (!global.roomId) {
        setTimeout(check, 100);
        return;
      }
      
      // 检查所有客户端是否都在房间中
      const allJoined = Object.values(messages).every(msgs => 
        msgs.some(m => m.type === 'room_joined')
      );
      
      if (allJoined) {
        resolve();
      } else {
        setTimeout(check, 100);
      }
    };
    check();
  });
}

// 测试移动同步
function testMoveSync() {
  console.log('\n=== Testing Move Sync ===\n');
  
  // 客户端0发送移动
  clients[0].send(JSON.stringify({
    type: 'move',
    data: { x: 100, y: 0, z: 200, rotation: 1.57 }
  }));
  
  console.log('[Client 0] Sent move: {x: 100, y: 0, z: 200}');
}

// 测试射击同步
function testShootSync() {
  console.log('\n=== Testing Shoot Sync ===\n');
  
  // 客户端1发送射击
  clients[1].send(JSON.stringify({
    type: 'shoot',
    data: { 
      position: { x: 50, y: 1.25, z: 100 },
      direction: { x: 0, y: 0, z: 1 },
      rotation: 0,
      weapon_id: 'rifle'
    }
  }));
  
  console.log('[Client 1] Sent shoot');
}

// 测试聊天同步
function testChatSync() {
  console.log('\n=== Testing Chat Sync ===\n');
  
  // 客户端2发送聊天
  clients[2].send(JSON.stringify({
    type: 'chat',
    data: { message: 'Hello from Player3!' }
  }));
  
  console.log('[Client 2] Sent chat: Hello from Player3!');
}

// 测试机器人同步
function testBotSync() {
  console.log('\n=== Testing Bot Sync ===\n');
  
  // 客户端0添加机器人
  clients[0].send(JSON.stringify({
    type: 'add_bot',
    data: { difficulty: 'normal', team: 'red' }
  }));
  
  console.log('[Client 0] Sent add_bot');
}

// 验证同步结果
function verifySync() {
  console.log('\n=== Verifying Sync Results ===\n');
  
  const results = {
    move: { sent: false, received: [false, false, false] },
    shoot: { sent: false, received: [false, false, false] },
    chat: { sent: false, received: [false, false, false] },
    player_joined: [false, false, false],
    bot_added: false
  };

  Object.entries(messages).forEach(([clientIndex, clientMessages]) => {
    const index = parseInt(clientIndex, 10);
    
    clientMessages.forEach(msg => {
      if (msg.type === 'move') {
        results.move.received[index] = true;
      }
      if (msg.type === 'shoot') {
        results.shoot.received[index] = true;
      }
      if (msg.type === 'chat' && msg.data?.message === 'Hello from Player3!') {
        results.chat.received[index] = true;
      }
      if (msg.type === 'player_joined') {
        results.player_joined[index] = true;
      }
      if (msg.type === 'bot_added' || (msg.type === 'player_joined' && msg.data?.is_bot)) {
        results.bot_added = true;
      }
    });
  });

  console.log('Move received:', results.move.received);
  console.log('Shoot received:', results.shoot.received);
  console.log('Chat received:', results.chat.received);
  console.log('Player joined seen:', results.player_joined);
  console.log('Bot added seen:', results.bot_added);

  return results;
}

async function main() {
  console.log('=== Multiplayer Sync Test ===\n');

  for (let i = 0; i < CLIENT_COUNT; i++) {
    clients.push(await createClient(i));
  }

  await waitForSync();
  console.log('\n=== All clients joined ===\n');

  testMoveSync();
  setTimeout(testShootSync, 1000);
  setTimeout(testChatSync, 2000);
  setTimeout(testBotSync, 3000);

  setTimeout(() => {
    verifySync();
    clients.forEach(ws => ws.close());
    setTimeout(() => process.exit(0), 500);
  }, TEST_DURATION);
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
