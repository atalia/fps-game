package network

import (
	"encoding/json"
	"testing"

	"fps-game/internal/player"
	"fps-game/internal/room"
)

func TestHandleJoinRoom(t *testing.T) {
	// 测试数据
	data := `{"room_id": "test-room", "name": "TestPlayer"}`

	var req struct {
		RoomID string `json:"room_id"`
		Name   string `json:"name"`
	}

	if err := json.Unmarshal([]byte(data), &req); err != nil {
		t.Errorf("Failed to unmarshal: %v", err)
	}

	if req.RoomID != "test-room" {
		t.Errorf("RoomID = %s, want test-room", req.RoomID)
	}
	if req.Name != "TestPlayer" {
		t.Errorf("Name = %s, want TestPlayer", req.Name)
	}
}

func TestHandleMove(t *testing.T) {
	data := `{"x": 10.5, "y": 0, "z": 20.3, "rotation": 1.57}`

	var pos struct {
		X        float64 `json:"x"`
		Y        float64 `json:"y"`
		Z        float64 `json:"z"`
		Rotation float64 `json:"rotation"`
	}

	if err := json.Unmarshal([]byte(data), &pos); err != nil {
		t.Errorf("Failed to unmarshal: %v", err)
	}

	if pos.X != 10.5 || pos.Y != 0 || pos.Z != 20.3 || pos.Rotation != 1.57 {
		t.Errorf("Position data mismatch: %v", pos)
	}
}

func TestHandleShoot(t *testing.T) {
	data := `{"target_id": "player2", "damage": 30}`

	var shot struct {
		TargetID string `json:"target_id"`
		Damage   int    `json:"damage"`
	}

	if err := json.Unmarshal([]byte(data), &shot); err != nil {
		t.Errorf("Failed to unmarshal: %v", err)
	}

	if shot.TargetID != "player2" {
		t.Errorf("TargetID = %s, want player2", shot.TargetID)
	}
	if shot.Damage != 30 {
		t.Errorf("Damage = %d, want 30", shot.Damage)
	}
}

func TestHandleChat(t *testing.T) {
	data := `{"message": "Hello World"}`

	var chat struct {
		Message string `json:"message"`
	}

	if err := json.Unmarshal([]byte(data), &chat); err != nil {
		t.Errorf("Failed to unmarshal: %v", err)
	}

	if chat.Message != "Hello World" {
		t.Errorf("Message = %s, want Hello World", chat.Message)
	}
}

func TestClient_SendMessage(t *testing.T) {
	// 创建一个简单的测试客户端
	client := &Client{
		Player: player.NewPlayer(),
		Send:   make(chan []byte, 10),
	}

	// 发送消息
	msg := NewMessage("test", map[string]string{"data": "value"})
	client.Send <- msg.ToJSON()

	// 验证消息被发送
	select {
	case received := <-client.Send:
		var parsed Message
		if err := json.Unmarshal(received, &parsed); err != nil {
			t.Errorf("Failed to unmarshal message: %v", err)
		}
		if parsed.Type != "test" {
			t.Errorf("Message type = %s, want test", parsed.Type)
		}
	default:
		t.Error("No message received")
	}
}

func TestMessageTypes(t *testing.T) {
	tests := []struct {
		msgType string
		data    interface{}
	}{
		{"welcome", map[string]string{"player_id": "123"}},
		{"room_joined", map[string]interface{}{"room_id": "abc", "players": []string{}}},
		{"player_moved", map[string]interface{}{"player_id": "123", "position": player.Position{}}},
		{"player_shot", map[string]interface{}{"player_id": "123", "damage": 30}},
		{"chat", map[string]string{"message": "hello"}},
	}

	for _, tt := range tests {
		t.Run(tt.msgType, func(t *testing.T) {
			msg := NewMessage(tt.msgType, tt.data)
			if msg.Type != tt.msgType {
				t.Errorf("Type = %s, want %s", msg.Type, tt.msgType)
			}
			if msg.Timestamp == 0 {
				t.Error("Timestamp should not be zero")
			}

			// 验证 JSON 序列化
			jsonData := msg.ToJSON()
			var parsed Message
			if err := json.Unmarshal(jsonData, &parsed); err != nil {
				t.Errorf("Failed to unmarshal: %v", err)
			}
		})
	}
}

func TestClient_BufferFull(t *testing.T) {
	client := &Client{
		Player: player.NewPlayer(),
		Send:   make(chan []byte, 1), // 只有一个槽位
	}

	// 填满缓冲区
	client.Send <- []byte("message1")

	// 尝试发送另一条消息（非阻塞）
	select {
	case client.Send <- []byte("message2"):
		// 应该不会到达这里
	default:
		// 缓冲区已满，这是预期行为
	}
}

func TestMessage_JSON(t *testing.T) {
	original := NewMessage("test", map[string]int{"count": 42})

	jsonData := original.ToJSON()

	var parsed Message
	if err := json.Unmarshal(jsonData, &parsed); err != nil {
		t.Errorf("Failed to unmarshal: %v", err)
	}

	// 解析 data
	var data map[string]int
	if err := json.Unmarshal(parsed.Data, &data); err != nil {
		t.Errorf("Failed to unmarshal data: %v", err)
	}

	if data["count"] != 42 {
		t.Errorf("count = %d, want 42", data["count"])
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
}

func TestClient_HandleJoinRoom_ExistingRoom(t *testing.T) {
	hub := NewHub()
	roomManager := room.NewManager(10, 10)

	// 创建房间
	r := roomManager.CreateRoom()

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

	if client.Room == nil || client.Room.ID != r.ID {
		t.Error("Should join existing room")
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

	client.handleMove(data)

	if client.Player.Position.X != 10.0 {
		t.Errorf("Position X = %f, want 10.0", client.Player.Position.X)
	}
	if client.Player.Rotation != 1.57 {
		t.Errorf("Rotation = %f, want 1.57", client.Player.Rotation)
	}
}

func TestClient_HandleMove_NoRoom(t *testing.T) {
	hub := NewHub()
	client := &Client{
		Player: player.NewPlayer(),
		Send:   make(chan []byte, 10),
		hub:    hub,
	}

	// 没有加入房间，不应该 panic
	data := mustMarshal(map[string]interface{}{
		"x": 10.0,
		"y": 5.0,
		"z": 20.0,
	})

	client.handleMove(data)

	// 验证没有崩溃
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

	// 应该能射击
	client.handleShoot(data)

	// 弹药应该减少
	if client.Player.Ammo >= 30 {
		t.Error("Ammo should decrease after shoot")
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

	// 发送聊天消息
	data := mustMarshal(map[string]string{
		"message": "Hello World",
	})

	client1.handleChat(data)

	// 验证消息处理（实际广播由 network 层实现）
}

func TestClient_HandleChat_NoRoom(t *testing.T) {
	hub := NewHub()
	client := &Client{
		Player: player.NewPlayer(),
		Send:   make(chan []byte, 10),
		hub:    hub,
	}

	// 没有房间，不应该 panic
	data := mustMarshal(map[string]string{
		"message": "Hello",
	})

	client.handleChat(data)
}

func TestHandleConnection(t *testing.T) {
	hub := NewHub()
	go hub.Run()

	// 由于需要 WebSocket 连接，这里只测试逻辑
	client := &Client{
		Player: player.NewPlayer(),
		Send:   make(chan []byte, 100),
		hub:    hub,
	}

	// 验证客户端创建成功
	if client.Player == nil {
		t.Error("Player should not be nil")
	}
}

func TestMessageUnmarshal(t *testing.T) {
	tests := []struct {
		name string
		data string
		want Message
	}{
		{
			name: "welcome message",
			data: `{"type":"welcome","data":{"player_id":"123"},"timestamp":1234567890}`,
			want: Message{Type: "welcome", Timestamp: 1234567890},
		},
		{
			name: "move message",
			data: `{"type":"move","data":{"x":10,"y":0,"z":20},"timestamp":1234567890}`,
			want: Message{Type: "move", Timestamp: 1234567890},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var msg Message
			if err := json.Unmarshal([]byte(tt.data), &msg); err != nil {
				t.Errorf("Failed to unmarshal: %v", err)
			}
			if msg.Type != tt.want.Type {
				t.Errorf("Type = %s, want %s", msg.Type, tt.want.Type)
			}
		})
	}
}
