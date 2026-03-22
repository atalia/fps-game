// 多人联机同步测试脚本
// 测试多个 WebSocket 客户端之间的消息同步

const WebSocket = require('ws');

const SERVER_URL = 'ws://101.33.117.73:8080/ws';
const CLIENT_COUNT = 3;
const TEST_DURATION = 10000; // 10秒测试

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

  // 检查每个客户端收到的消息
  Object.entries(messages).forEach(([idx, msgs]) => {
    const i = parseInt(idx);
    
    msgs.forEach(msg => {
      // 服务器广播移动消息为 player_moved
      if (msg.type === 'player_moved') results.move.received[i] = true;
      // 服务器广播射击消息为 player_shot
      if (msg.type === 'player_shot') results.shoot.received[i] = true;
      if (msg.type === 'chat') results.chat.received[i] = true;
      if (msg.type === 'player_joined') results.player_joined[i] = true;
      if (msg.type === 'player_joined' && msg.data?.is_bot) results.bot_added = true;
    });
  });

  // 打印结果 - 排除发送者
  const moveReceived = results.move.received.filter((_, i) => i !== 0); // 客户端0发送，检查其他
  const shootReceived = results.shoot.received.filter((_, i) => i !== 1); // 客户端1发送，检查其他
  
  console.log('Move sync:', moveReceived.some(r => r) ? '✅ PASS' : '❌ FAIL', results.move.received);
  console.log('Shoot sync:', shootReceived.some(r => r) ? '✅ PASS' : '❌ FAIL', results.shoot.received);
  console.log('Chat sync:', results.chat.received.every(r => r) ? '✅ PASS' : '❌ FAIL', results.chat.received);
  console.log('Player joined:', results.player_joined.every(r => r) ? '✅ PASS' : '❌ FAIL', results.player_joined);
  console.log('Bot added:', results.bot_added ? '✅ PASS' : '❌ FAIL');

  // 统计消息数量
  console.log('\nMessage counts:');
  Object.entries(messages).forEach(([idx, msgs]) => {
    const byType = {};
    msgs.forEach(m => { byType[m.type] = (byType[m.type] || 0) + 1; });
    console.log(`  Client ${idx}: ${msgs.length} total`, byType);
  });
}

// 主函数
async function main() {
  console.log('=== Multiplayer Sync Test ===\n');
  console.log(`Server: ${SERVER_URL}`);
  console.log(`Clients: ${CLIENT_COUNT}\n`);

  // 创建客户端
  for (let i = 0; i < CLIENT_COUNT; i++) {
    const ws = await createClient(i);
    clients.push(ws);
    await new Promise(r => setTimeout(r, 300)); // 错开连接
  }

  // 等待同步
  await waitForSync();
  console.log('\n=== All clients joined ===\n');

  // 等待一秒让消息稳定
  await new Promise(r => setTimeout(r, 1000));

  // 运行测试
  testMoveSync();
  await new Promise(r => setTimeout(r, 500));
  
  testShootSync();
  await new Promise(r => setTimeout(r, 500));
  
  testChatSync();
  await new Promise(r => setTimeout(r, 500));
  
  testBotSync();
  await new Promise(r => setTimeout(r, 1000));

  // 验证结果
  verifySync();

  // 清理
  console.log('\n=== Cleaning up ===\n');
  clients.forEach((ws, i) => {
    ws.close();
  });

  setTimeout(() => process.exit(0), 500);
}

main().catch(console.error);
