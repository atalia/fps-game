package network

import (
	"encoding/json"
	"testing"

	"fps-game/internal/player"
	"fps-game/internal/room"
)

func TestHub_NewHub(t *testing.T) {
	hub := NewHub()

	if hub == nil {
		t.Error("Hub should not be nil")
	}
	if hub.clients == nil {
		t.Error("clients map should be initialized")
	}
	if hub.clientMap == nil {
		t.Error("clientMap should be initialized")
	}
}

func TestHub_RegisterUnregister(t *testing.T) {
	hub := NewHub()
	go hub.Run()

	client := &Client{
		Player: player.NewPlayer(),
		Send:   make(chan []byte, 10),
	}

	// 注册
	hub.register <- client

	// 等待处理
	for len(hub.clients) == 0 {
	}

	if len(hub.clients) != 1 {
		t.Errorf("clients count = %d, want 1", len(hub.clients))
	}

	// 注销
	hub.unregister <- client

	// 等待处理
	for len(hub.clients) > 0 {
	}

	if len(hub.clients) != 0 {
		t.Errorf("clients count = %d, want 0", len(hub.clients))
	}
}

func TestHub_GetClient(t *testing.T) {
	hub := NewHub()
	p := player.NewPlayer()

	hub.clientMap[p.ID] = &Client{Player: p}

	client := hub.GetClient(p.ID)
	if client == nil {
		t.Error("Should find client")
	}

	// 不存在的客户端
	client = hub.GetClient("nonexistent")
	if client != nil {
		t.Error("Should return nil for nonexistent client")
	}
}

func TestHub_Broadcast(t *testing.T) {
	hub := NewHub()

	// 创建测试客户端
	c1 := &Client{
		Player: player.NewPlayer(),
		Send:   make(chan []byte, 10),
	}
	c2 := &Client{
		Player: player.NewPlayer(),
		Send:   make(chan []byte, 10),
	}

	hub.clients[c1] = true
	hub.clients[c2] = true

	// 广播消息
	hub.Broadcast("test", map[string]string{"msg": "hello"})

	// 验证两个客户端都收到消息
	select {
	case msg := <-c1.Send:
		if msg == nil {
			t.Error("c1 should receive message")
		}
	default:
		t.Error("c1 should have received message")
	}

	select {
	case msg := <-c2.Send:
		if msg == nil {
			t.Error("c2 should receive message")
		}
	default:
		t.Error("c2 should have received message")
	}
}

func TestHub_BroadcastToRoom(t *testing.T) {
	hub := NewHub()
	rm := room.NewManager(10, 10)

	// 创建房间
	r := rm.CreateRoom()

	// 创建测试客户端
	p1 := player.NewPlayer()
	p2 := player.NewPlayer()
	p3 := player.NewPlayer()

	r.AddPlayer(p1)
	r.AddPlayer(p2)
	// p3 不在房间

	c1 := &Client{Player: p1, Send: make(chan []byte, 10)}
	c2 := &Client{Player: p2, Send: make(chan []byte, 10)}
	c3 := &Client{Player: p3, Send: make(chan []byte, 10)}

	hub.clients[c1] = true
	hub.clients[c2] = true
	hub.clients[c3] = true
	hub.clientMap[p1.ID] = c1
	hub.clientMap[p2.ID] = c2
	hub.clientMap[p3.ID] = c3

	// 广播到房间，排除 p1
	hub.BroadcastToRoom(r, "test", map[string]string{"msg": "hello"}, p1.ID)

	// p1 不应该收到
	select {
	case <-c1.Send:
		t.Error("c1 should not receive message (excluded)")
	default:
		// 正确
	}

	// p2 应该收到
	select {
	case <-c2.Send:
		// 正确
	default:
		t.Error("c2 should have received message")
	}

	// p3 不在房间，不应该收到
	select {
	case <-c3.Send:
		t.Error("c3 should not receive message (not in room)")
	default:
		// 正确
	}
}

func TestMessage_NewMessage(t *testing.T) {
	msg := NewMessage("test", map[string]string{"key": "value"})

	if msg.Type != "test" {
		t.Errorf("Type = %s, want test", msg.Type)
	}
	if msg.Timestamp == 0 {
		t.Error("Timestamp should not be zero")
	}
}

func TestMessage_ToJSON(t *testing.T) {
	msg := NewMessage("test", map[string]string{"key": "value"})
	jsonData := msg.ToJSON()

	var parsed Message
	if err := json.Unmarshal(jsonData, &parsed); err != nil {
		t.Errorf("Failed to unmarshal: %v", err)
	}

	if parsed.Type != "test" {
		t.Errorf("Parsed type = %s, want test", parsed.Type)
	}
}

func TestClient_HandleJoinRoom(t *testing.T) {
	hub := NewHub()
	roomManager := room.NewManager(10, 10)
	client := &Client{
		Player: player.NewPlayer(),
		Send:   make(chan []byte, 10),
		hub:    hub,
	}

	data := mustMarshal(map[string]string{
		"room_id": "",
		"name":    "TestPlayer",
	})

	client.handleJoinRoom(data, roomManager)

	// 验证玩家名字已设置
	if client.Player.Name != "TestPlayer" {
		t.Errorf("Player name = %s, want TestPlayer", client.Player.Name)
	}

	// 验证房间已创建
	if client.Room == nil {
		t.Error("Room should not be nil after join")
	}

	// 验证收到 room_joined 消息
	select {
	case msg := <-client.Send:
		var parsed Message
		if err := json.Unmarshal(msg, &parsed); err != nil {
			t.Errorf("Failed to unmarshal: %v", err)
		}
		if parsed.Type != "room_joined" {
			t.Errorf("Message type = %s, want room_joined", parsed.Type)
		}
	default:
		t.Error("Should receive room_joined message")
	}
}

func TestClient_HandleLeaveRoom(t *testing.T) {
	hub := NewHub()
	roomManager := room.NewManager(10, 10)
	client := &Client{
		Player: player.NewPlayer(),
		Send:   make(chan []byte, 10),
		hub:    hub,
	}

	// 先加入房间
	r := roomManager.CreateRoom()
	client.Room = r
	r.AddPlayer(client.Player)

	// 离开房间
	client.handleLeaveRoom(roomManager)

	if client.Room != nil {
		t.Error("Room should be nil after leave")
	}
}

func TestClient_HandleMove(t *testing.T) {
	hub := NewHub()
	roomManager := room.NewManager(10, 10)
	client := &Client{
		Player: player.NewPlayer(),
		Send:   make(chan []byte, 10),
		hub:    hub,
	}

	// 创建房间
	r := roomManager.CreateRoom()
	r.AddPlayer(client.Player)
	client.Room = r

	data := mustMarshal(map[string]interface{}{
		"x":        10.0,
		"y":        5.0,
		"z":        20.0,
		"rotation": 1.57,
	})

	client.handleMove(data, roomManager)

	if client.Player.Position.X != 10.0 {
		t.Errorf("Position X = %f, want 10.0", client.Player.Position.X)
	}
	if client.Player.Rotation != 1.57 {
		t.Errorf("Rotation = %f, want 1.57", client.Player.Rotation)
	}
}

func TestClient_HandleReload(t *testing.T) {
	hub := NewHub()
	client := &Client{
		Player: player.NewPlayer(),
		Send:   make(chan []byte, 10),
		hub:    hub,
	}

	// 消耗一些弹药
	for i := 0; i < 10; i++ {
		client.Player.Shoot()
	}

	// 换弹
	client.handleReload()

	// 验证弹药已恢复
	if client.Player.Ammo != 30 {
		t.Errorf("Ammo = %d, want 30", client.Player.Ammo)
	}

	// 验证收到 reload 消息
	select {
	case msg := <-client.Send:
		var parsed Message
		if err := json.Unmarshal(msg, &parsed); err != nil {
			t.Errorf("Failed to unmarshal: %v", err)
		}
		if parsed.Type != "reload" {
			t.Errorf("Message type = %s, want reload", parsed.Type)
		}
	default:
		t.Error("Should receive reload message")
	}
}

func TestClient_HandleShoot(t *testing.T) {
	hub := NewHub()
	roomManager := room.NewManager(10, 10)
	client := &Client{
		Player: player.NewPlayer(),
		Send:   make(chan []byte, 10),
		hub:    hub,
	}

	// 创建房间
	r := roomManager.CreateRoom()
	r.AddPlayer(client.Player)
	client.Room = r

	// 射击
	data := mustMarshal(map[string]interface{}{
		"position": map[string]float64{"x": 0, "y": 0, "z": 0},
		"rotation": 0,
	})

	client.handleShoot(data, roomManager)

	// 弹药应该减少
	if client.Player.Ammo >= 30 {
		t.Error("Ammo should decrease after shoot")
	}
}

func TestClient_HandleChat(t *testing.T) {
	hub := NewHub()
	roomManager := room.NewManager(10, 10)

	client1 := &Client{
		Player: player.NewPlayer(),
		Send:   make(chan []byte, 10),
		hub:    hub,
	}
	client1.Player.SetName("Player1")

	client2 := &Client{
		Player: player.NewPlayer(),
		Send:   make(chan []byte, 10),
		hub:    hub,
	}

	// 创建房间并加入两个玩家
	r := roomManager.CreateRoom()
	r.AddPlayer(client1.Player)
	r.AddPlayer(client2.Player)
	client1.Room = r
	client2.Room = r

	hub.clients[client1] = true
	hub.clients[client2] = true
	hub.clientMap[client1.Player.ID] = client1
	hub.clientMap[client2.Player.ID] = client2

	// 发送聊天消息
	data := mustMarshal(map[string]string{
		"message": "Hello World",
	})

	client1.handleChat(data, roomManager)

	// client2 应该收到聊天消息
	select {
	case <-client2.Send:
		// 正确
	default:
		t.Error("client2 should receive chat message")
	}
}

func TestClient_HandleRespawn(t *testing.T) {
	hub := NewHub()
	roomManager := room.NewManager(10, 10)
	client := &Client{
		Player: player.NewPlayer(),
		Send:   make(chan []byte, 10),
		hub:    hub,
	}

	// 创建房间
	r := roomManager.CreateRoom()
	r.AddPlayer(client.Player)
	client.Room = r

	// 重生
	data := mustMarshal(map[string]float64{
		"x": 10.0,
		"y": 0,
		"z": 20.0,
	})

	client.handleRespawn(data, roomManager)

	// 验证收到 respawn 消息
	select {
	case msg := <-client.Send:
		var parsed Message
		if err := json.Unmarshal(msg, &parsed); err != nil {
			t.Errorf("Failed to unmarshal: %v", err)
		}
		if parsed.Type != "respawn" {
			t.Errorf("Message type = %s, want respawn", parsed.Type)
		}
	default:
		t.Error("Should receive respawn message")
	}
}

func TestMustMarshal(t *testing.T) {
	data := mustMarshal(map[string]string{"key": "value"})

	var parsed map[string]string
	if err := json.Unmarshal(data, &parsed); err != nil {
		t.Errorf("Failed to unmarshal: %v", err)
	}

	if parsed["key"] != "value" {
		t.Errorf("parsed[key] = %s, want value", parsed["key"])
	}
}
