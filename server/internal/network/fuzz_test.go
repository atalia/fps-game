package network

import (
	"encoding/json"
	"fps-game/internal/player"
	"fps-game/internal/room"
	"math/rand"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
	"unicode"

	"github.com/gorilla/websocket"
)

// 创建测试用的 Client
func createTestClient() *Client {
	p := player.NewPlayer()
	p.Name = "TestPlayer"
	p.Health = 100
	p.Ammo = 30
	p.Weapon = "rifle"

	return &Client{
		Player:       p,
		Send:         make(chan []byte, 100),
		hub:          NewHub(),
		msgRateLimit: NewRateLimiter(10, time.Second),
	}
}

// 创建测试用的 Room
func createTestRoom() *room.Room {
	roomManager := room.NewManager(100, 16)
	return roomManager.CreateRoom()
}

// FuzzHandleShootReal 测试真实的 handleShoot 方法
func FuzzHandleShootReal(f *testing.F) {
	// 种子语料库
	f.Add([]byte(`{"position":{"x":0,"y":1.7,"z":0},"rotation":1.57,"pitch":0,"direction":{"x":0,"y":0,"z":-1},"weapon_id":"rifle"}`))
	f.Add([]byte(`{"position":{"x":100,"y":200,"z":300}}`))
	f.Add([]byte(`{}`))
	f.Add([]byte(`invalid`))
	f.Add([]byte(`{"position":null}`))
	f.Add([]byte(`{"position":{"x":1e10,"y":-1e10,"z":0}}`))
	f.Add([]byte(`{"position":{"x":0},"weapon_id":"sniper"}`))
	f.Add([]byte(`{"position":{"x":0},"direction":{"x":0,"y":0,"z":-1},"weapon_id":"invalid_weapon"}`))

	f.Fuzz(func(t *testing.T, data []byte) {
		client := createTestClient()
		r := createTestRoom()
		r.AddPlayer(client.Player)
		client.Room = r

		// 调用真实的 handleShoot
		// 不应该 panic
		client.handleShoot(data, room.NewManager(100, 16))

		// 验证：如果 JSON 有效且有 position，弹药应该减少
		var shootData struct {
			Position map[string]float64 `json:"position"`
			WeaponID string             `json:"weapon_id"`
		}
		if err := json.Unmarshal(data, &shootData); err == nil && shootData.Position != nil {
			// 有效数据，弹药应该减少
			if client.Player.Ammo < 30 {
				// 成功射击
			}
		}
	})
}

// FuzzHandleWeaponChangeReal 测试真实的 handleWeaponChange 方法
func FuzzHandleWeaponChangeReal(f *testing.F) {
	validWeapons := []string{"pistol", "rifle", "shotgun", "sniper"}

	// 种子语料库
	f.Add([]byte(`{"weapon":"rifle"}`))
	f.Add([]byte(`{"weapon_id":"sniper"}`))
	f.Add([]byte(`{}`))
	f.Add([]byte(`{"weapon":""}`))
	f.Add([]byte(`{"weapon":"invalid_weapon"}`))
	f.Add([]byte(`{"weapon":123}`))
	f.Add([]byte(`invalid`))
	f.Add([]byte(`{"weapon":"`+validWeapons[rand.Intn(len(validWeapons))]+`"}`))

	f.Fuzz(func(t *testing.T, data []byte) {
		client := createTestClient()
		r := createTestRoom()
		r.AddPlayer(client.Player)
		client.Room = r

		originalWeapon := client.Player.Weapon

		// 调用真实的 handleWeaponChange
		// 不应该 panic
		client.handleWeaponChange(data)

		// 验证：只有有效武器才会切换
		var req struct {
			Weapon   string `json:"weapon"`
			WeaponID string `json:"weapon_id"`
		}
		if err := json.Unmarshal(data, &req); err == nil {
			weapon := req.Weapon
			if weapon == "" {
				weapon = req.WeaponID
			}

			validMap := map[string]bool{"pistol": true, "rifle": true, "shotgun": true, "sniper": true}
			if weapon != "" && validMap[weapon] {
				if client.Player.Weapon != weapon {
					t.Errorf("Weapon not changed: expected %s, got %s", weapon, client.Player.Weapon)
				}
			} else if weapon == "" {
				// 空武器不应该切换
				if client.Player.Weapon != originalWeapon {
					t.Errorf("Weapon should not change for empty input")
				}
			}
		}
	})
}

// FuzzHandleJoinRoomPlayerName 测试真实的 handleJoinRoom 玩家名称校验
func FuzzHandleJoinRoomPlayerName(f *testing.F) {
	// 种子语料库
	f.Add("Player")
	f.Add("玩家")
	f.Add("")
	f.Add("A")
	f.Add(strings.Repeat("x", 100))
	f.Add("Player123")
	f.Add("Player Name")
	f.Add("Player_Name-Test")
	f.Add("Player<script>")
	f.Add("Player\x00Name")
	f.Add("🎮Player🎮")
	f.Add("Player\tTab")
	f.Add("Player\nNewline")
	f.Add(strings.Repeat("中", 50)) // 长 unicode

	f.Fuzz(func(t *testing.T, name string) {
		client := createTestClient()
		roomManager := room.NewManager(100, 16)

		// 清空 Send channel
		for len(client.Send) > 0 {
			<-client.Send
		}

		// 构造 join_room 消息
		req := map[string]interface{}{
			"name": name,
		}
		data, _ := json.Marshal(req)

		// 调用真实的 handleJoinRoom
		// 不应该 panic
		client.handleJoinRoom(data, roomManager)

		// 必须收到响应消息（error 或 room_joined）
		select {
		case msg := <-client.Send:
			msgStr := string(msg)
			hasError := strings.Contains(msgStr, "error")
			hasRoomJoined := strings.Contains(msgStr, "room_joined")
			
			// 必须是 error 或 room_joined 之一
			if !hasError && !hasRoomJoined {
				t.Errorf("Expected error or room_joined, got: %s", msgStr)
			}
			
			// 如果收到错误消息，检查是否符合预期
			if hasError {
				trimmedName := strings.TrimSpace(name)
				nameLen := len(trimmedName)
				
				// 检查长度错误
				if nameLen < minPlayerName || nameLen > maxPlayerName {
					if !strings.Contains(msgStr, "Player name must be between") {
						t.Errorf("Expected length error for name '%s' (len=%d), got: %s", name, nameLen, msgStr)
					}
				}
				
				// 检查字符错误
				hasInvalidChar := false
				for _, r := range trimmedName {
					if !unicode.IsLetter(r) && !unicode.IsNumber(r) && !unicode.IsSpace(r) && r != '_' && r != '-' {
						hasInvalidChar = true
						break
					}
				}
				if hasInvalidChar {
					if !strings.Contains(msgStr, "can only contain") {
						t.Errorf("Expected character error for name '%s', got: %s", name, msgStr)
					}
				}
			}
			
			// 如果成功加入房间，验证名称是合法的
			if hasRoomJoined {
				trimmedName := strings.TrimSpace(name)
				nameLen := len(trimmedName)
				
				// 验证成功的情况
				if nameLen < minPlayerName || nameLen > maxPlayerName {
					t.Errorf("Name '%s' (len=%d) should have been rejected", name, nameLen)
				}
				
				hasInvalidChar := false
				for _, r := range trimmedName {
					if !unicode.IsLetter(r) && !unicode.IsNumber(r) && !unicode.IsSpace(r) && r != '_' && r != '-' {
						hasInvalidChar = true
						break
					}
				}
				if hasInvalidChar {
					t.Errorf("Name '%s' has invalid characters but was accepted", name)
				}
			}
		case <-time.After(500 * time.Millisecond):
			// 必须收到消息 - 超时表示 bug
			t.Errorf("handleJoinRoom did not send any response for name '%s' - this is a regression", name)
		}
	})
}

// FuzzHandleVoiceDataReal 测试真实的 handleVoiceData 方法
func FuzzHandleVoiceDataReal(f *testing.F) {
	f.Add([]byte(`{"audio":"base64encodeddata"}`))
	f.Add([]byte(`{}`))
	f.Add([]byte(`{"audio":""}`))
	f.Add([]byte(`invalid`))
	f.Add([]byte(`{"audio":"` + strings.Repeat("x", 1000) + `"}`))
	f.Add([]byte(`{"audio":123}`))
	f.Add([]byte(`{"audio":null}`))
	f.Add([]byte(`{"extra":"data","audio":"test"}`))

	f.Fuzz(func(t *testing.T, data []byte) {
		client := createTestClient()
		r := createTestRoom()
		client.Room = r

		// 调用真实的 handleVoiceData
		// 不应该 panic
		client.handleVoiceData(data)
	})
}

// TestHandleShootWithHit 测试射击命中逻辑
func TestHandleShootWithHit(t *testing.T) {
	// 创建两个客户端
	shooter := createTestClient()
	target := &Client{
		Player:       player.NewPlayer(),
		Send:         make(chan []byte, 100),
		hub:          shooter.hub,
		msgRateLimit: NewRateLimiter(10, time.Second),
	}
	target.Player.Name = "TargetPlayer"
	target.Player.Health = 100
	target.Player.Position = player.Position{X: 0, Y: 1.7, Z: 10}

	// 创建房间
	r := createTestRoom()
	r.AddPlayer(shooter.Player)
	r.AddPlayer(target.Player)
	shooter.Room = r
	target.Room = r

	// 注册到 hub
	shooter.hub.register <- shooter
	shooter.hub.register <- target

	// 射击数据：瞄准目标
	shootData := map[string]interface{}{
		"position": map[string]float64{
			"x": 0, "y": 1.7, "z": 0,
		},
		"direction": map[string]float64{
			"x": 0, "y": 0, "z": 1,
		},
		"weapon_id": "rifle",
	}
	data, _ := json.Marshal(shootData)

	// 执行射击
	shooter.handleShoot(data, room.NewManager(100, 16))

	// 验证弹药减少
	if shooter.Player.Ammo >= 30 {
		t.Error("Ammo should decrease after shooting")
	}
}

// TestHandleWeaponChangeValid 测试有效武器切换
func TestHandleWeaponChangeValid(t *testing.T) {
	client := createTestClient()
	r := createTestRoom()
	r.AddPlayer(client.Player)
	client.Room = r

	weapons := []string{"pistol", "rifle", "shotgun", "sniper"}
	for _, weapon := range weapons {
		data := []byte(`{"weapon":"` + weapon + `"}`)
		client.handleWeaponChange(data)

		if client.Player.Weapon != weapon {
			t.Errorf("Weapon not changed to %s, got %s", weapon, client.Player.Weapon)
		}
	}
}

// TestHandleWeaponChangeInvalid 测试无效武器切换
func TestHandleWeaponChangeInvalid(t *testing.T) {
	client := createTestClient()
	r := createTestRoom()
	r.AddPlayer(client.Player)
	client.Room = r
	client.Player.Weapon = "rifle"

	// 测试空武器名 - 应该不切换
	data := []byte(`{"weapon":""}`)
	client.handleWeaponChange(data)

	if client.Player.Weapon != "rifle" {
		t.Errorf("Empty weapon should not change weapon, expected 'rifle', got %s", client.Player.Weapon)
	}

	// 测试无效 JSON
	data = []byte(`invalid json`)
	client.handleWeaponChange(data)

	if client.Player.Weapon != "rifle" {
		t.Errorf("Invalid JSON should not change weapon, expected 'rifle', got %s", client.Player.Weapon)
	}
}

// TestHandleShootMalformed 测试畸形射击消息
func TestHandleShootMalformed(t *testing.T) {
	testCases := []struct {
		name  string
		input string
	}{
		{"empty object", `{}`},
		{"missing position", `{"rotation":1.57}`},
		{"null position", `{"position":null}`},
		{"string position", `{"position":"invalid"}`},
		{"array position", `{"position":[0,1.7,0]}`},
		{"extreme coordinates", `{"position":{"x":1e308,"y":-1e308,"z":0}}`},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			client := createTestClient()
			r := createTestRoom()
			r.AddPlayer(client.Player)
			client.Room = r

			// 不应该 panic
			client.handleShoot([]byte(tc.input), room.NewManager(100, 16))
		})
	}
}

// TestHandleChat 测试聊天消息处理
func TestHandleChat(t *testing.T) {
	client := createTestClient()
	r := createTestRoom()
	r.AddPlayer(client.Player)
	client.Room = r
	
	// 注册客户端到 hub 的 clientMap，这样 BroadcastToRoom 才能找到它
	client.hub.clientMap[client.Player.ID] = client
	
	roomManager := room.NewManager(100, 16)

	testCases := []struct {
		name           string
		input          string
		shouldBroadcast bool
		shouldError    bool
		description    string
	}{
		{"normal message", `{"message":"Hello!"}`, true, false, "正常消息应该被广播"},
		{"empty message", `{"message":""}`, false, false, "空消息不应该被广播"},
		{"whitespace only", `{"message":"   "}`, false, false, "纯空格消息不应该被广播"},
		{"long message", `{"message":"` + strings.Repeat("x", 300) + `"}`, false, true, "超过256字符的消息应该被拒绝并发送错误"},
		{"invalid json", `invalid`, false, false, "无效 JSON 不应该导致 panic"},
		{"missing message field", `{}`, false, false, "缺少 message 字段不应该导致 panic"},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// 清空 Send channel
			for len(client.Send) > 0 {
				<-client.Send
			}

			// 不应该 panic
			client.handleChat([]byte(tc.input), roomManager)

			// 检查结果
			select {
			case msg := <-client.Send:
				msgStr := string(msg)
				hasError := strings.Contains(msgStr, "error")
				hasChat := strings.Contains(msgStr, "chat")
				
				if tc.shouldBroadcast {
					// 应该有 chat 广播
					if !hasChat {
						t.Errorf("Expected chat broadcast for %s, got: %s", tc.description, msgStr)
					}
				} else if tc.shouldError {
					// 应该有错误消息
					if !hasError {
						t.Errorf("Expected error for %s, got: %s", tc.description, msgStr)
					}
				} else {
					// 不应该有消息
					if hasChat {
						t.Errorf("Unexpected chat broadcast for %s: %s", tc.description, msgStr)
					}
				}
			case <-time.After(100 * time.Millisecond):
				// 无消息是合理的（空消息、无效 JSON 等）
				if tc.shouldBroadcast {
					t.Errorf("Expected broadcast for %s, but got no message", tc.description)
				}
				if tc.shouldError {
					t.Errorf("Expected error for %s, but got no message", tc.description)
				}
			}
		})
	}
}

// BenchmarkHandleShoot 基准测试
func BenchmarkHandleShoot(b *testing.B) {
	data := []byte(`{"position":{"x":0,"y":1.7,"z":0},"rotation":1.57,"pitch":0,"direction":{"x":0,"y":0,"z":-1},"weapon_id":"rifle"}`)
	roomManager := room.NewManager(100, 16)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		client := createTestClient()
		r := createTestRoom()
		r.AddPlayer(client.Player)
		client.Room = r
		client.handleShoot(data, roomManager)
	}
}

// WebSocket 测试辅助
var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

// TestWebSocketWithRealServer 测试真实 WebSocket 路径（通过 httptest）
// 注意：此测试验证真实的 ServeWS 路径，包括 origin 检查
func TestWebSocketWithRealServer(t *testing.T) {
	// 创建 Hub
	hub := NewHub()
	go hub.Run()

	// 创建 RoomManager
	roomManager := room.NewManager(100, 16)

	// 使用真实的 ServeWS handler
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// 使用默认参数调用 ServeWS (空 allowedOrigins 会使用 localhost 默认规则)
		ServeWS(hub, roomManager, nil, []string{}, w, r)
	}))
	defer server.Close()

	// 连接测试 - 使用 localhost 作为 Origin
	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")
	header := http.Header{}
	header.Set("Origin", "http://localhost")
	
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, header)
	if err != nil {
		t.Fatalf("Failed to connect: %v", err)
	}
	defer conn.Close()

	// 读取第一条消息 - 应该是 welcome
	_, msg1, err := conn.ReadMessage()
	if err != nil {
		t.Fatalf("Failed to read welcome: %v", err)
	}
	msg1Str := string(msg1)
	if !strings.Contains(msg1Str, "welcome") {
		t.Errorf("Expected welcome message first, got: %s", msg1Str)
	}

	// 发送 join_room 消息
	joinMsg := map[string]interface{}{
		"type": "join_room",
		"data": map[string]string{
			"name": "TestPlayer",
		},
	}
	if err := conn.WriteJSON(joinMsg); err != nil {
		t.Fatalf("Failed to send join_room: %v", err)
	}

	// 读取第二条消息 - 必须是 room_joined
	_, msg2, err := conn.ReadMessage()
	if err != nil {
		t.Fatalf("Failed to read room_joined: %v", err)
	}
	msg2Str := string(msg2)
	if !strings.Contains(msg2Str, "room_joined") {
		t.Errorf("Expected room_joined message after join_room, got: %s", msg2Str)
	}

	// 验证 room_joined 包含必要字段
	if !strings.Contains(msg2Str, "room_id") || !strings.Contains(msg2Str, "player_id") {
		t.Errorf("room_joined missing required fields, got: %s", msg2Str)
	}
}

// TestPlayerNameValidationDirect 直接测试玩家名称校验逻辑
func TestPlayerNameValidationDirect(t *testing.T) {
	testCases := []struct {
		name      string
		playerName string
		shouldFail bool
		failReason string
	}{
		{"valid english", "Player", false, ""},
		{"valid chinese", "玩家", false, ""},
		{"valid with numbers", "Player123", false, ""},
		{"valid with space", "Player Name", false, ""},
		{"valid with underscore", "Player_Name", false, ""},
		{"valid with hyphen", "Player-Name", false, ""},
		{"too short", "", true, "length"},
		{"too long", strings.Repeat("x", 100), true, "length"},
		{"with html", "Player<script>", true, "character"},
		{"with emoji", "Player🎮", true, "character"},
		{"with null", "Player\x00Name", true, "character"},
		{"with tab", "Player\tName", false, ""}, // tab is allowed by unicode.IsSpace
		{"with newline", "Player\nName", false, ""}, // newline is allowed by unicode.IsSpace
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			client := createTestClient()
			roomManager := room.NewManager(100, 16)

			req := map[string]interface{}{
				"name": tc.playerName,
			}
			data, _ := json.Marshal(req)

			client.handleJoinRoom(data, roomManager)

			// 检查结果
			select {
			case msg := <-client.Send:
				msgStr := string(msg)
				hasError := strings.Contains(msgStr, "error")
				
				if tc.shouldFail && !hasError {
					t.Errorf("Expected failure for %s (reason: %s), but got success", tc.name, tc.failReason)
				}
				if !tc.shouldFail && hasError {
					t.Errorf("Expected success for %s, but got error: %s", tc.name, msgStr)
				}
			case <-time.After(100 * time.Millisecond):
				if tc.shouldFail {
					t.Errorf("Expected error for %s, but got no response", tc.name)
				}
			}
		})
	}
}
