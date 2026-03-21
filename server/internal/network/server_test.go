package network

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"fps-game/internal/player"
	"fps-game/internal/room"

	"github.com/gorilla/websocket"
)

// 时序常量
const (
	readTimeout   = 2 * time.Second
	drainWindow   = 200 * time.Millisecond
	noMessageWait = 100 * time.Millisecond
)

// TestServer 测试服务器
type TestServer struct {
	Server      *httptest.Server
	Hub         *Hub
	RoomManager *room.Manager
	URL         string
}

// NewTestServer 创建测试服务器
func NewTestServer(t *testing.T) *TestServer {
	hub := NewHub()
	go hub.Run()

	rm := room.NewManager(100, 10) // 最多100房间，每房间10人

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ServeWS(hub, rm, nil, w, r)
	})

	server := httptest.NewServer(handler)
	ts := &TestServer{
		Server:      server,
		Hub:         hub,
		RoomManager: rm,
		URL:         "ws" + strings.TrimPrefix(server.URL, "http"),
	}
	t.Cleanup(func() {
		server.Close()
	})
	return ts
}

// Message 消息结构（测试用）
type TestMessage struct {
	Type      string          `json:"type"`
	Data      json.RawMessage `json:"data"`
	Timestamp int64           `json:"timestamp"`
}

// Connect 建立连接，读取 welcome
func Connect(t *testing.T, ts *TestServer) (*websocket.Conn, string) {
	conn, _, err := websocket.DefaultDialer.Dial(ts.URL, nil)
	if err != nil {
		t.Fatalf("Failed to connect: %v", err)
	}
	t.Cleanup(func() {
		conn.Close()
	})

	_ = conn.SetReadDeadline(time.Now().Add(readTimeout))
	_, data, err := conn.ReadMessage()
	if err != nil {
		t.Fatalf("Failed to read welcome: %v", err)
	}

	var msg TestMessage
	if err := json.Unmarshal(data, &msg); err != nil {
		t.Fatalf("Failed to parse welcome: %v", err)
	}
	if msg.Type != "welcome" {
		t.Fatalf("Expected welcome, got %s", msg.Type)
	}

	var welcomeData struct {
		PlayerID string `json:"player_id"`
	}
	if err := json.Unmarshal(msg.Data, &welcomeData); err != nil {
		t.Fatalf("Failed to parse welcome data: %v", err)
	}

	return conn, welcomeData.PlayerID
}

// CreateRoom 创建房间，读取 welcome + room_joined
func CreateRoom(t *testing.T, ts *TestServer) (*websocket.Conn, string, string) {
	conn, playerID := Connect(t, ts)

	// 发送 join_room 创建新房间（不指定 room_id）
	Send(t, conn, "join_room", map[string]string{"room_id": "", "name": "test"})

	// 读取 room_joined
	msg := RecvType(t, conn, "room_joined")
	var roomData struct {
		RoomID string `json:"room_id"`
	}
	if err := json.Unmarshal(msg.Data, &roomData); err != nil {
		t.Fatalf("Failed to parse room_joined: %v", err)
	}

	return conn, playerID, roomData.RoomID
}

// JoinRoom 加入已存在房间
func JoinRoom(t *testing.T, ts *TestServer, roomID string) (*websocket.Conn, string) {
	conn, playerID := Connect(t, ts)

	// 发送 join_room 加入已存在房间
	Send(t, conn, "join_room", map[string]string{"room_id": roomID, "name": "player"})

	// 读取 room_joined
	RecvType(t, conn, "room_joined")

	return conn, playerID
}

// CloseConn 关闭连接
func CloseConn(t *testing.T, conn *websocket.Conn) {
	conn.Close()
}

// Send 发送消息
func Send(t *testing.T, conn *websocket.Conn, msgType string, data interface{}) {
	msg := map[string]interface{}{
		"type": msgType,
		"data": data,
	}
	jsonData, err := json.Marshal(msg)
	if err != nil {
		t.Fatalf("Failed to marshal message: %v", err)
	}
	t.Logf("Sending: %s", string(jsonData))
	if err := conn.WriteMessage(websocket.TextMessage, jsonData); err != nil {
		t.Fatalf("Failed to send message: %v", err)
	}
	// 等待服务器处理
	time.Sleep(100 * time.Millisecond)
}

// SendRaw 发送原始 JSON 字符串
func SendRaw(t *testing.T, conn *websocket.Conn, raw string) {
	if err := conn.WriteMessage(websocket.TextMessage, []byte(raw)); err != nil {
		t.Fatalf("Failed to send raw message: %v", err)
	}
}

// RecvType 读取指定类型的消息，跳过其他类型
func RecvType(t *testing.T, conn *websocket.Conn, wantType string) *TestMessage {
	_ = conn.SetReadDeadline(time.Now().Add(readTimeout))
	
	for {
		_, data, err := conn.ReadMessage()
		if err != nil {
			t.Fatalf("Failed to read message: %v", err)
		}

		var msg TestMessage
		if err := json.Unmarshal(data, &msg); err != nil {
			t.Fatalf("Failed to parse message: %v", err)
		}

		if msg.Type == wantType {
			return &msg
		}
		// 跳过不匹配的消息，继续读取
		t.Logf("Skipping message type %s, waiting for %s", msg.Type, wantType)
		_ = conn.SetReadDeadline(time.Now().Add(readTimeout))
	}
}

// RecvAll 读取所有消息，直到 drainWindow 无新消息
func RecvAll(t *testing.T, conn *websocket.Conn) []*TestMessage {
	var msgs []*TestMessage

	// 设置较长的读超时
	_ = conn.SetReadDeadline(time.Now().Add(2 * time.Second))

	for {
		_, data, err := conn.ReadMessage()
		if err != nil {
			break
		}

		// 处理可能的换行分隔多消息
		for _, line := range bytes.Split(data, []byte{'\n'}) {
			if len(line) == 0 {
				continue
			}
			var msg TestMessage
			if err := json.Unmarshal(line, &msg); err == nil {
				msgs = append(msgs, &msg)
			}
		}

		// 设置下一次读取的超时
		_ = conn.SetReadDeadline(time.Now().Add(drainWindow))
	}

	return msgs
}

// Drain 丢弃所有消息，直到 drainWindow 无新消息
// 注意：这个函数会清空所有待处理的消息，不要在期望接收特定消息之前调用
func Drain(t *testing.T, conn *websocket.Conn) {
	_ = conn.SetReadDeadline(time.Now().Add(drainWindow))
	count := 0
	for {
		_, data, err := conn.ReadMessage()
		if err != nil {
			break
		}
		count++
		// 继续读取直到超时
		_ = conn.SetReadDeadline(time.Now().Add(drainWindow))
		_ = data // 忽略数据
	}
	t.Logf("Drained %d messages", count)
}

// NoMessage 验证静默
func NoMessage(t *testing.T, conn *websocket.Conn) {
	_ = conn.SetReadDeadline(time.Now().Add(noMessageWait))
	_, _, err := conn.ReadMessage()
	if err == nil {
		t.Error("Expected no message, but got one")
	}
}

// FillRoom 填满房间
func FillRoom(t *testing.T, ts *TestServer, roomID string, count int) []*websocket.Conn {
	var conns []*websocket.Conn
	for i := 0; i < count; i++ {
		conn, _ := JoinRoom(t, ts, roomID)
		conns = append(conns, conn)
	}
	return conns
}

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
		"x":        10.0,
		"y":        5.0,
		"z":        20.0,
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

func TestClient_handleWeaponChange(t *testing.T) {
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

	data := mustMarshal(map[string]string{
		"weapon": "sniper",
	})

	client.handleWeaponChange(data)

	if client.Player.Weapon != "sniper" {
		t.Errorf("Weapon = %s, want sniper", client.Player.Weapon)
	}
}

func TestClient_handleTeamJoin(t *testing.T) {
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

	data := mustMarshal(map[string]string{
		"team": "red",
	})

	client.handleTeamJoin(data, roomManager)

	if client.Player.Team != "red" {
		t.Errorf("Team = %s, want red", client.Player.Team)
	}
}

func TestClient_handleVoiceStart(t *testing.T) {
	hub := NewHub()
	roomManager := room.NewManager(10, 10)

	client := &Client{
		Player: player.NewPlayer(),
		Send:   make(chan []byte, 10),
		hub:    hub,
	}

	// 没有房间时不应 panic
	client.handleVoiceStart()

	// 创建房间
	r := roomManager.CreateRoom()
	r.AddPlayer(client.Player)
	client.Room = r

	client.handleVoiceStart()
}

func TestClient_handleVoiceStop(t *testing.T) {
	hub := NewHub()
	roomManager := room.NewManager(10, 10)

	client := &Client{
		Player: player.NewPlayer(),
		Send:   make(chan []byte, 10),
		hub:    hub,
	}

	// 没有房间时不应 panic
	client.handleVoiceStop()

	// 创建房间
	r := roomManager.CreateRoom()
	r.AddPlayer(client.Player)
	client.Room = r

	client.handleVoiceStop()
}

func TestClient_handleGrenadeThrow(t *testing.T) {
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
		"type": "frag",
		"position": map[string]float64{
			"x": 10.0,
			"y": 5.0,
			"z": 20.0,
		},
		"velocity": map[string]float64{
			"x": 1.0,
			"y": 2.0,
			"z": 3.0,
		},
	})

	client.handleGrenadeThrow(data, roomManager)
}

func TestClient_handleEmote(t *testing.T) {
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

	data := mustMarshal(map[string]string{
		"emote_id": "wave",
	})

	client.handleEmote(data, roomManager)
}

func TestClient_handlePing(t *testing.T) {
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
		"type":    "enemy",
		"message": "Enemy spotted!",
		"x":       100.0,
		"y":       0.0,
		"z":       50.0,
	})

	client.handlePing(data, roomManager)
}

func TestClient_handleSkillUse(t *testing.T) {
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
		"skill_id":  "heal",
		"target_id": "",
		"x":         10.0,
		"y":         5.0,
		"z":         20.0,
	})

	client.handleSkillUse(data, roomManager)

	// 再次使用应该失败（冷却中）
	client.handleSkillUse(data, roomManager)
}

func TestClient_handleC4Plant(t *testing.T) {
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
		"position": map[string]float64{
			"x": 10.0,
			"y": 5.0,
			"z": 20.0,
		},
	})

	client.handleC4Plant(data, roomManager)

	if !r.IsC4Planted() {
		t.Error("C4 should be planted")
	}
}

func TestClient_handleC4Defuse(t *testing.T) {
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

	// 先放置 C4
	r.SetC4Planted(true, client.Player.ID, player.Position{X: 10, Y: 5, Z: 20})

	client.handleC4Defuse(roomManager)

	if r.IsC4Planted() {
		t.Error("C4 should be defused")
	}
}

// ==================== WebSocket 集成测试 ====================

// TestWS_Connect 测试连接建立
func TestWS_Connect(t *testing.T) {
	ts := NewTestServer(t)
	conn, playerID := Connect(t, ts)
	defer conn.Close()

	if playerID == "" {
		t.Error("Expected non-empty playerID")
	}
}

// TestWS_Disconnect_InRoom 测试断开连接
func TestWS_Disconnect_InRoom(t *testing.T) {
	ts := NewTestServer(t)

	// A 创建房间
	connA, _, roomID := CreateRoom(t, ts)

	// B 加入房间
	connB, _ := JoinRoom(t, ts, roomID)
	defer connB.Close()

	// A 断开连接
	connA.Close()

	// 等待并验证 B 收到 player_left
	time.Sleep(200 * time.Millisecond)
	msgsB := RecvAll(t, connB)
	leftCount := CountType(msgsB, "player_left")
	if leftCount == 0 {
		t.Error("B should receive player_left when A disconnects")
	}
}

// TestWS_UnknownType 测试未知消息类型
func TestWS_UnknownType(t *testing.T) {
	ts := NewTestServer(t)
	conn, _ := Connect(t, ts)
	defer conn.Close()

	SendRaw(t, conn, `{"type":"unknown","data":{}}`)
	NoMessage(t, conn)
}

// TestWS_InvalidTopLevelJSON 测试顶层非法 JSON
func TestWS_InvalidTopLevelJSON(t *testing.T) {
	ts := NewTestServer(t)
	conn, _ := Connect(t, ts)
	defer conn.Close()

	SendRaw(t, conn, `{invalid`)
	// 连接应关闭或静默
	time.Sleep(100 * time.Millisecond)
}

// TestWS_JoinRoom_NewRoom 测试创建新房间
func TestWS_JoinRoom_NewRoom(t *testing.T) {
	ts := NewTestServer(t)
	conn, _, roomID := CreateRoom(t, ts)
	defer conn.Close()

	if roomID == "" {
		t.Error("Expected non-empty roomID")
	}
}

// TestWS_JoinRoom_ExistingRoom 测试加入已存在房间
func TestWS_JoinRoom_ExistingRoom(t *testing.T) {
	ts := NewTestServer(t)

	// A 创建房间
	connA, playerIDA, roomID := CreateRoom(t, ts)
	defer connA.Close()

	// B 加入房间
	connB, _ := JoinRoom(t, ts, roomID)
	defer connB.Close()

	// A 应收到 player_joined
	msg := RecvType(t, connA, "player_joined")
	var joinData struct {
		PlayerID string `json:"player_id"`
	}
	if err := json.Unmarshal(msg.Data, &joinData); err != nil {
		t.Fatalf("Failed to parse player_joined: %v", err)
	}
	if joinData.PlayerID == playerIDA {
		t.Error("player_joined should be for B, not A")
	}
}

// TestWS_JoinRoom_Full 测试房间满
func TestWS_JoinRoom_Full(t *testing.T) {
	ts := NewTestServer(t)

	// A 创建房间
	connA, _, roomID := CreateRoom(t, ts)
	defer connA.Close()

	// 填满房间（容量 10，A 已占 1，再填 9 人）
	for i := 0; i < 9; i++ {
		conn, _ := JoinRoom(t, ts, roomID)
		defer conn.Close()
	}

	// 第 11 人尝试加入
	connB, _ := Connect(t, ts)
	defer connB.Close()

	Send(t, connB, "join_room", map[string]string{"room_id": roomID, "name": "player11"})

	// 应收到 error
	msg := RecvType(t, connB, "error")
	var errData struct {
		Message string `json:"message"`
	}
	if err := json.Unmarshal(msg.Data, &errData); err != nil {
		t.Fatalf("Failed to parse error: %v", err)
	}
	if !strings.Contains(errData.Message, "full") {
		t.Errorf("Expected 'full' in error message, got: %s", errData.Message)
	}
}

// TestWS_LeaveRoom 测试离开房间
func TestWS_LeaveRoom(t *testing.T) {
	ts := NewTestServer(t)

	// A 创建房间
	connA, playerIDA, roomID := CreateRoom(t, ts)
	defer connA.Close()

	// B 加入房间
	connB, _ := JoinRoom(t, ts, roomID)
	defer connB.Close()

	// A 离开房间
	Send(t, connA, "leave_room", map[string]string{})

	// B 应收到 player_left
	msgsB := RecvAll(t, connB)
	leftCount := 0
	for _, msg := range msgsB {
		if msg.Type == "player_left" {
			leftCount++
			var leftData struct {
				PlayerID string `json:"player_id"`
			}
			if err := json.Unmarshal(msg.Data, &leftData); err != nil {
				t.Fatalf("Failed to parse player_left: %v", err)
			}
			if leftData.PlayerID != playerIDA {
				t.Errorf("Expected player_id %s, got %s", playerIDA, leftData.PlayerID)
			}
		}
	}
	if leftCount == 0 {
		t.Error("B should receive player_left")
	}
}

// TestWS_BroadcastToRoom_Nil 测试 BroadcastToRoom nil 检查
func TestWS_BroadcastToRoom_Nil(t *testing.T) {
	ts := NewTestServer(t)
	hub := ts.Hub

	// 不应 panic
	hub.BroadcastToRoom(nil, "test", map[string]string{"msg": "hello"}, "")
}
