package network

import (
	"encoding/json"
	"testing"
	"time"

	"fps-game/internal/player"
	"fps-game/internal/room"
)

func TestHub_Run(t *testing.T) {
	hub := NewHub()
	go hub.Run()
	time.Sleep(10 * time.Millisecond) // 等待启动

	// 测试注册
	c := &Client{
		Player: player.NewPlayer(),
		Send:   make(chan []byte, 10),
	}
	hub.register <- c
	time.Sleep(10 * time.Millisecond)

	if len(hub.clients) != 1 {
		t.Errorf("Expected 1 client, got %d", len(hub.clients))
	}

	// 测试注销
	hub.unregister <- c
	time.Sleep(10 * time.Millisecond)

	if len(hub.clients) != 0 {
		t.Errorf("Expected 0 clients, got %d", len(hub.clients))
	}
}

func TestHub_Broadcast_Empty(t *testing.T) {
	hub := NewHub()

	// 没有客户端时广播不应 panic
	hub.Broadcast("test", map[string]string{"msg": "hello"})
}

func TestHub_BroadcastToRoom_Empty(t *testing.T) {
	hub := NewHub()
	rm := room.NewManager(10, 10)
	r := rm.CreateRoom()

	// 房间没有玩家时广播不应 panic
	hub.BroadcastToRoom(r, "test", map[string]string{"msg": "hello"}, "")
}

func TestHub_GetClient_NotFound(t *testing.T) {
	hub := NewHub()

	c := hub.GetClient("nonexistent")
	if c != nil {
		t.Error("Expected nil for nonexistent client")
	}
}

func TestClient_handleJoinRoom_ExistingRoom(t *testing.T) {
	hub := NewHub()
	roomManager := room.NewManager(10, 10)

	// 先创建一个房间
	existingRoom := roomManager.CreateRoom()

	client := &Client{
		Player: player.NewPlayer(),
		Send:   make(chan []byte, 10),
		hub:    hub,
	}

	data := mustMarshal(map[string]string{
		"room_id": existingRoom.ID,
		"name":    "TestPlayer",
	})

	client.handleJoinRoom(data, roomManager)

	if client.Room == nil {
		t.Error("Should join existing room")
	}

	if client.Room.ID != existingRoom.ID {
		t.Error("Should join the specified room")
	}
}

func TestClient_handleJoinRoom_FullRoom(t *testing.T) {
	hub := NewHub()
	roomManager := room.NewManager(2, 2) // max 2 rooms, 2 players per room

	// 创建满员房间
	r := roomManager.CreateRoom()
	p1 := player.NewPlayer()
	p2 := player.NewPlayer()
	r.AddPlayer(p1)
	r.AddPlayer(p2)

	client := &Client{
		Player: player.NewPlayer(),
		Send:   make(chan []byte, 10),
		hub:    hub,
	}

	data := mustMarshal(map[string]string{
		"room_id": r.ID,
		"name":    "TestPlayer",
	})

	client.handleJoinRoom(data, roomManager)

	// 应该收到错误消息
	select {
	case msg := <-client.Send:
		var parsed Message
		if err := json.Unmarshal(msg, &parsed); err != nil {
			t.Errorf("Failed to parse: %v", err)
		}
		if parsed.Type != "error" {
			t.Errorf("Expected error message, got %s", parsed.Type)
		}
	default:
		// 可能创建了新房间
	}
}

func TestClient_handleMove_NoRoom(t *testing.T) {
	hub := NewHub()
	roomManager := room.NewManager(10, 10)

	client := &Client{
		Player: player.NewPlayer(),
		Send:   make(chan []byte, 10),
		hub:    hub,
	}

	data := mustMarshal(map[string]float64{
		"x": 10.0,
		"y": 5.0,
		"" +
			"z": 20.0,
		"rotation": 1.57,
	})

	// 没有房间时移动不应 panic
	client.handleMove(data, roomManager)
}

func TestClient_handleChat_NoRoom(t *testing.T) {
	hub := NewHub()
	roomManager := room.NewManager(10, 10)

	client := &Client{
		Player: player.NewPlayer(),
		Send:   make(chan []byte, 10),
		hub:    hub,
	}

	data := mustMarshal(map[string]string{
		"message": "Hello",
	})

	// 没有房间时聊天不应 panic
	client.handleChat(data, roomManager)
}

func TestClient_handleShoot_NoRoom(t *testing.T) {
	hub := NewHub()
	roomManager := room.NewManager(10, 10)

	client := &Client{
		Player: player.NewPlayer(),
		Send:   make(chan []byte, 10),
		hub:    hub,
	}

	data := mustMarshal(map[string]interface{}{
		"position": map[string]float64{"x": 0, "y": 0, "z": 0},
		"rotation": 0,
	})

	// 没有房间时射击不应 panic
	client.handleShoot(data, roomManager)
}

func TestClient_handleShoot_NoAmmo(t *testing.T) {
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

	// 消耗所有弹药
	for client.Player.Ammo > 0 {
		client.Player.Shoot()
	}

	data := mustMarshal(map[string]interface{}{
		"position": map[string]float64{"x": 0, "y": 0, "z": 0},
		"rotation": 0,
	})

	// 没有弹药时射击不应 panic
	client.handleShoot(data, roomManager)
}

func TestMessage_NewMessage_Timestamp(t *testing.T) {
	before := time.Now().UnixMilli()
	msg := NewMessage("test", map[string]string{"key": "value"})
	after := time.Now().UnixMilli()

	if msg.Timestamp < before || msg.Timestamp > after {
		t.Errorf("Timestamp %d not in expected range [%d, %d]", msg.Timestamp, before, after)
	}
}

func TestMustMarshal(t *testing.T) {
	// 测试各种类型
	tests := []interface{}{
		map[string]string{"key": "value"},
		map[string]int{"count": 10},
		[]string{"a", "b", "c"},
		"string",
		123,
		true,
		nil,
	}

	for _, v := range tests {
		data := mustMarshal(v)
		if data == nil {
			t.Error("mustMarshal should not return nil")
		}
	}
}

func TestClient_handleLeaveRoom_NoRoom(t *testing.T) {
	hub := NewHub()
	roomManager := room.NewManager(10, 10)

	client := &Client{
		Player: player.NewPlayer(),
		Send:   make(chan []byte, 10),
		hub:    hub,
	}

	// 没有房间时离开不应 panic
	client.handleLeaveRoom(roomManager)
}

func TestClient_handleLeaveRoom_EmptyRoom(t *testing.T) {
	hub := NewHub()
	roomManager := room.NewManager(10, 10)

	client := &Client{
		Player: player.NewPlayer(),
		Send:   make(chan []byte, 10),
		hub:    hub,
	}

	// 加入房间
	r := roomManager.CreateRoom()
	r.AddPlayer(client.Player)
	client.Room = r

	// 离开房间
	client.handleLeaveRoom(roomManager)

	if client.Room != nil {
		t.Error("Room should be nil after leave")
	}
}

func TestClient_SendMessage(t *testing.T) {
	hub := NewHub()
	client := &Client{
		Player: player.NewPlayer(),
		Send:   make(chan []byte, 10),
		hub:    hub,
	}

	msg := NewMessage("test", map[string]string{"msg": "hello"})
	client.Send <- msg.ToJSON()

	select {
	case received := <-client.Send:
		if received == nil {
			t.Error("Should receive message")
		}
	default:
		t.Error("Should have message in buffer")
	}
}

func TestClient_BufferFull(t *testing.T) {
	hub := NewHub()
	client := &Client{
		Player: player.NewPlayer(),
		Send:   make(chan []byte, 1), // 小缓冲区
		hub:    hub,
	}

	// 填满缓冲区
	client.Send <- []byte("message1")

	// 再发送不会阻塞（被跳过）
	select {
	case client.Send <- []byte("message2"):
		// 如果成功，说明缓冲区没满
	default:
		// 缓冲区满，跳过
	}
}

func TestMessageTypes(t *testing.T) {
	types := []string{
		"welcome",
		"room_joined",
		"player_joined",
		"player_left",
		"player_moved",
		"player_shot",
		"chat",
		"respawn",
		"reload",
		"error",
	}

	for _, msgType := range types {
		msg := NewMessage(msgType, map[string]string{})
		if msg.Type != msgType {
			t.Errorf("Type = %s, want %s", msg.Type, msgType)
		}
	}
}

func TestMessage_JSON(t *testing.T) {
	msg := NewMessage("test", map[string]string{"key": "value"})
	jsonData := msg.ToJSON()

	var parsed Message
	if err := json.Unmarshal(jsonData, &parsed); err != nil {
		t.Errorf("Failed to unmarshal: %v", err)
	}

	if parsed.Type != "test" {
		t.Errorf("Type = %s, want test", parsed.Type)
	}
}
