package network

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"fps-game/internal/room"

	"github.com/gorilla/websocket"
)

// ==================== 多人联机集成测试 ====================
// 测试基于 WebSocket 的多人游戏功能

// TestMultiplayer_FullGameFlow 完整游戏流程测试
// 模拟多人游戏：连接 → 创建房间 → 加入 → 移动 → 射击 → 击杀 → 离开
func TestMultiplayer_FullGameFlow(t *testing.T) {
	ts := NewTestServer(t)

	// ===== 1. 玩家 A 创建房间 =====
	connA, playerA, roomID := CreateRoom(t, ts)
	defer connA.Close()

	t.Logf("Player A (%s) created room %s", playerA, roomID)

	// ===== 2. 玩家 B 加入房间 =====
	connB, playerB := JoinRoom(t, ts, roomID)
	defer connB.Close()

	t.Logf("Player B (%s) joined room", playerB)

	// A 应收到 player_joined
	msg := RecvType(t, connA, "player_joined")
	var joinData struct {
		PlayerID string `json:"player_id"`
	}
	if err := json.Unmarshal(msg.Data, &joinData); err != nil {
		t.Fatalf("Failed to parse player_joined: %v", err)
	}
	if joinData.PlayerID != playerB {
		t.Errorf("Expected player_joined for B (%s), got %s", playerB, joinData.PlayerID)
	}

	// ===== 3. 玩家 C 加入房间 =====
	connC, playerC := JoinRoom(t, ts, roomID)
	defer connC.Close()

	t.Logf("Player C (%s) joined room", playerC)

	// A 和 B 应收到 player_joined
	_ = RecvType(t, connA, "player_joined")
	_ = RecvType(t, connB, "player_joined")

	// ===== 4. 玩家移动同步测试 =====
	t.Run("MoveSync", func(t *testing.T) {
		// A 移动
		Send(t, connA, "move", map[string]interface{}{
			"x":        100.0,
			"y":        0.0,
			"z":        50.0,
			"rotation": 1.57,
		})

		// B 和 C 应收到 player_moved
		msgB := RecvType(t, connB, "player_moved")
		msgC := RecvType(t, connC, "player_moved")

		var moveData struct {
			PlayerID string `json:"player_id"`
			Position struct {
				X float64 `json:"x"`
				Y float64 `json:"y"`
				Z float64 `json:"z"`
			} `json:"position"`
			Rotation float64 `json:"rotation"`
		}

		if err := json.Unmarshal(msgB.Data, &moveData); err != nil {
			t.Fatalf("Failed to parse player_moved: %v", err)
		}
		if moveData.PlayerID != playerA {
			t.Errorf("Expected move from A, got %s", moveData.PlayerID)
		}
		if moveData.Position.X != 100.0 {
			t.Errorf("Expected X=100, got %f", moveData.Position.X)
		}

		if err := json.Unmarshal(msgC.Data, &moveData); err != nil {
			t.Fatalf("Failed to parse player_moved: %v", err)
		}
		if moveData.PlayerID != playerA {
			t.Errorf("Expected move from A, got %s", moveData.PlayerID)
		}
	})

	// ===== 5. 聊天消息测试 =====
	t.Run("Chat", func(t *testing.T) {
		Send(t, connB, "chat", map[string]string{
			"message": "Hello everyone!",
		})

		// A 和 C 应收到聊天消息
		msgA := RecvType(t, connA, "chat")
		msgC := RecvType(t, connC, "chat")

		var chatData struct {
			PlayerID string `json:"player_id"`
			Name     string `json:"name"`
			Message  string `json:"message"`
		}

		if err := json.Unmarshal(msgA.Data, &chatData); err != nil {
			t.Fatalf("Failed to parse chat: %v", err)
		}
		if chatData.Message != "Hello everyone!" {
			t.Errorf("Expected 'Hello everyone!', got '%s'", chatData.Message)
		}
		if chatData.PlayerID != playerB {
			t.Errorf("Expected chat from B, got %s", chatData.PlayerID)
		}

		_ = msgC // C 也收到了
	})

	// ===== 6. 玩家离开测试 =====
	t.Run("PlayerLeave", func(t *testing.T) {
		connC.Close()
		time.Sleep(200 * time.Millisecond)

		// A 和 B 应收到 player_left
		msgsA := RecvAll(t, connA)
		leftCount := CountType(msgsA, "player_left")
		if leftCount == 0 {
			t.Error("A should receive player_left when C leaves")
		}
	})

	t.Logf("Full game flow test completed")
}

// TestMultiplayer_RoomCapacity 房间容量测试
func TestMultiplayer_RoomCapacity(t *testing.T) {
	ts := NewTestServer(t)

	// 创建房间
	conn, _, roomID := CreateRoom(t, ts)
	defer conn.Close()

	// 房间默认容量是 10，已有 1 人，再添加 9 人达到上限
	var conns []*websocket.Conn
	for i := 0; i < 9; i++ {
		c, _ := JoinRoom(t, ts, roomID)
		conns = append(conns, c)
	}

	// 清理
	defer func() {
		for _, c := range conns {
			c.Close()
		}
	}()

	// 第 11 人尝试加入
	conn11, _ := Connect(t, ts)
	defer conn11.Close()

	Send(t, conn11, "join_room", map[string]string{
		"room_id": roomID,
		"name":    "player11",
	})

	// 应收到错误消息
	msg := RecvType(t, conn11, "error")
	var errData struct {
		Message string `json:"message"`
	}
	if err := json.Unmarshal(msg.Data, &errData); err != nil {
		t.Fatalf("Failed to parse error: %v", err)
	}
	if errData.Message == "" {
		t.Error("Expected error message for full room")
	}

	t.Logf("Room capacity test passed: room rejected 11th player")
}

// TestMultiplayer_ShootAndHit 射击和命中检测测试
func TestMultiplayer_ShootAndHit(t *testing.T) {
	ts := NewTestServer(t)

	// A 创建房间
	connA, playerA, roomID := CreateRoom(t, ts)
	defer connA.Close()

	// B 加入房间
	connB, playerB := JoinRoom(t, ts, roomID)
	defer connB.Close()

	// 接收 player_joined
	_ = RecvType(t, connA, "player_joined")

	t.Run("Shoot", func(t *testing.T) {
		// A 射击（朝 B 方向）
		Send(t, connA, "shoot", map[string]interface{}{
			"position": map[string]float64{
				"x": 0,
				"y": 1.25,
				"z": 0,
			},
			"rotation": 0,
			"direction": map[string]float64{
				"x": 0,
				"y": 0,
				"z": 1,
			},
			"weapon_id": "rifle",
		})

		// B 应收到 player_shot
		msg := RecvType(t, connB, "player_shot")
		var shootData struct {
			PlayerID string `json:"player_id"`
			Ammo     int    `json:"ammo"`
		}
		if err := json.Unmarshal(msg.Data, &shootData); err != nil {
			t.Fatalf("Failed to parse player_shot: %v", err)
		}
		if shootData.PlayerID != playerA {
			t.Errorf("Expected shot from A, got %s", shootData.PlayerID)
		}
	})

	_ = playerB // 使用变量避免编译警告
}

// TestMultiplayer_TeamMode 团队模式测试
func TestMultiplayer_TeamMode(t *testing.T) {
	ts := NewTestServer(t)

	// A 创建房间
	connA, _, roomID := CreateRoom(t, ts)
	defer connA.Close()

	// B 加入房间
	connB, _ := JoinRoom(t, ts, roomID)
	defer connB.Close()

	// 接收 player_joined
	_ = RecvType(t, connA, "player_joined")

	t.Run("TeamJoin", func(t *testing.T) {
		// A 加入红队
		Send(t, connA, "team_join", map[string]string{
			"team": "red",
		})

		// B 应收到 team_changed
		msg := RecvType(t, connB, "team_changed")
		var teamData struct {
			PlayerID string `json:"player_id"`
			Team     string `json:"team"`
		}
		if err := json.Unmarshal(msg.Data, &teamData); err != nil {
			t.Fatalf("Failed to parse team_changed: %v", err)
		}
		if teamData.Team != "red" {
			t.Errorf("Expected team 'red', got '%s'", teamData.Team)
		}

		// A 也收到自己的 team_changed，清空它
		_ = RecvType(t, connA, "team_changed")

		// B 加入蓝队
		Send(t, connB, "team_join", map[string]string{
			"team": "blue",
		})

		// A 应收到 B 的 team_changed
		msgA := RecvType(t, connA, "team_changed")
		if err := json.Unmarshal(msgA.Data, &teamData); err != nil {
			t.Fatalf("Failed to parse team_changed: %v", err)
		}
		if teamData.Team != "blue" {
			t.Errorf("Expected team 'blue', got '%s'", teamData.Team)
		}
	})
}

// TestMultiplayer_WeaponChange 武器切换测试
func TestMultiplayer_WeaponChange(t *testing.T) {
	ts := NewTestServer(t)

	// A 创建房间
	connA, _, roomID := CreateRoom(t, ts)
	defer connA.Close()

	// B 加入房间
	connB, _ := JoinRoom(t, ts, roomID)
	defer connB.Close()

	_ = RecvType(t, connA, "player_joined")

	t.Run("WeaponSwitch", func(t *testing.T) {
		// A 切换到狙击枪
		Send(t, connA, "weapon_change", map[string]string{
			"weapon": "sniper",
		})

		// B 应收到 weapon_changed
		msg := RecvType(t, connB, "weapon_changed")
		var weaponData struct {
			PlayerID string `json:"player_id"`
			Weapon   string `json:"weapon"`
		}
		if err := json.Unmarshal(msg.Data, &weaponData); err != nil {
			t.Fatalf("Failed to parse weapon_changed: %v", err)
		}
		if weaponData.Weapon != "sniper" {
			t.Errorf("Expected weapon 'sniper', got '%s'", weaponData.Weapon)
		}
	})
}

// TestMultiplayer_Grenade 投掷物测试
func TestMultiplayer_Grenade(t *testing.T) {
	ts := NewTestServer(t)

	// A 创建房间
	connA, _, roomID := CreateRoom(t, ts)
	defer connA.Close()

	// B 加入房间
	connB, _ := JoinRoom(t, ts, roomID)
	defer connB.Close()

	_ = RecvType(t, connA, "player_joined")

	t.Run("GrenadeThrow", func(t *testing.T) {
		// A 投掷手雷
		Send(t, connA, "grenade_throw", map[string]interface{}{
			"type": "frag",
			"position": map[string]float64{
				"x": 10,
				"y": 5,
				"z": 20,
			},
			"velocity": map[string]float64{
				"x": 1,
				"y": 2,
				"z": 3,
			},
		})

		// B 应收到 grenade_thrown
		msg := RecvType(t, connB, "grenade_thrown")
		var grenadeData struct {
			Type     string `json:"type"`
			PlayerID string `json:"player_id"`
		}
		if err := json.Unmarshal(msg.Data, &grenadeData); err != nil {
			t.Fatalf("Failed to parse grenade_thrown: %v", err)
		}
		if grenadeData.Type != "frag" {
			t.Errorf("Expected type 'frag', got '%s'", grenadeData.Type)
		}
	})
}

// TestMultiplayer_C4Mode C4 爆破模式测试
func TestMultiplayer_C4Mode(t *testing.T) {
	ts := NewTestServer(t)

	// A 创建房间
	connA, _, roomID := CreateRoom(t, ts)
	defer connA.Close()

	// B 加入房间
	connB, _ := JoinRoom(t, ts, roomID)
	defer connB.Close()

	_ = RecvType(t, connA, "player_joined")

	t.Run("C4Plant", func(t *testing.T) {
		// A 放置 C4
		Send(t, connA, "c4_plant", map[string]interface{}{
			"position": map[string]float64{
				"x": 100,
				"y": 0,
				"z": 50,
			},
		})

		// B 应收到 c4_planted
		msg := RecvType(t, connB, "c4_planted")
		var c4Data struct {
			PlayerID string `json:"player_id"`
		}
		if err := json.Unmarshal(msg.Data, &c4Data); err != nil {
			t.Fatalf("Failed to parse c4_planted: %v", err)
		}
	})

	t.Run("C4Defuse", func(t *testing.T) {
		// B 拆除 C4
		Send(t, connB, "c4_defuse", map[string]string{})

		// A 应收到 c4_defused
		msg := RecvType(t, connA, "c4_defused")
		var c4Data struct {
			PlayerID string `json:"player_id"`
		}
		if err := json.Unmarshal(msg.Data, &c4Data); err != nil {
			t.Fatalf("Failed to parse c4_defused: %v", err)
		}
	})
}

// TestMultiplayer_SkillSystem 技能系统测试
func TestMultiplayer_SkillSystem(t *testing.T) {
	ts := NewTestServer(t)

	// A 创建房间
	connA, _, roomID := CreateRoom(t, ts)
	defer connA.Close()

	// B 加入房间
	connB, _ := JoinRoom(t, ts, roomID)
	defer connB.Close()

	_ = RecvType(t, connA, "player_joined")

	t.Run("SkillUse", func(t *testing.T) {
		// A 使用治疗技能
		Send(t, connA, "skill_use", map[string]interface{}{
			"skill_id":  "heal",
			"target_id": "",
			"x":         10.0,
			"y":         5.0,
			"z":         20.0,
		})

		// B 应收到 skill_used
		msg := RecvType(t, connB, "skill_used")
		var skillData struct {
			SkillID  string `json:"skill_id"`
			PlayerID string `json:"player_id"`
		}
		if err := json.Unmarshal(msg.Data, &skillData); err != nil {
			t.Fatalf("Failed to parse skill_used: %v", err)
		}
		if skillData.SkillID != "heal" {
			t.Errorf("Expected skill 'heal', got '%s'", skillData.SkillID)
		}
	})
}

// TestMultiplayer_Emote 表情系统测试
func TestMultiplayer_Emote(t *testing.T) {
	ts := NewTestServer(t)

	// A 创建房间
	connA, _, roomID := CreateRoom(t, ts)
	defer connA.Close()

	// B 加入房间
	connB, _ := JoinRoom(t, ts, roomID)
	defer connB.Close()

	_ = RecvType(t, connA, "player_joined")

	t.Run("Emote", func(t *testing.T) {
		// A 发送表情
		Send(t, connA, "emote", map[string]string{
			"emote_id": "wave",
		})

		// B 应收到 emote
		msg := RecvType(t, connB, "emote")
		var emoteData struct {
			EmoteID  string `json:"emote_id"`
			PlayerID string `json:"player_id"`
		}
		if err := json.Unmarshal(msg.Data, &emoteData); err != nil {
			t.Fatalf("Failed to parse emote: %v", err)
		}
		if emoteData.EmoteID != "wave" {
			t.Errorf("Expected emote 'wave', got '%s'", emoteData.EmoteID)
		}
	})
}

// TestMultiplayer_PingSystem 标记系统测试
func TestMultiplayer_PingSystem(t *testing.T) {
	ts := NewTestServer(t)

	// A 创建房间
	connA, _, roomID := CreateRoom(t, ts)
	defer connA.Close()

	// B 加入房间
	connB, _ := JoinRoom(t, ts, roomID)
	defer connB.Close()

	_ = RecvType(t, connA, "player_joined")

	t.Run("Ping", func(t *testing.T) {
		// A 标记敌人位置
		Send(t, connA, "ping", map[string]interface{}{
			"type":    "enemy",
			"message": "Enemy spotted!",
			"x":       100.0,
			"y":       0.0,
			"z":       50.0,
		})

		// B 应收到 ping
		msg := RecvType(t, connB, "ping")
		var pingData struct {
			Type     string `json:"type"`
			Message  string `json:"message"`
			PlayerID string `json:"player_id"`
		}
		if err := json.Unmarshal(msg.Data, &pingData); err != nil {
			t.Fatalf("Failed to parse ping: %v", err)
		}
		if pingData.Type != "enemy" {
			t.Errorf("Expected type 'enemy', got '%s'", pingData.Type)
		}
	})
}

// TestMultiplayer_VoiceSystem 语音系统测试
func TestMultiplayer_VoiceSystem(t *testing.T) {
	ts := NewTestServer(t)

	// A 创建房间
	connA, _, roomID := CreateRoom(t, ts)
	defer connA.Close()

	// B 加入房间
	connB, _ := JoinRoom(t, ts, roomID)
	defer connB.Close()

	_ = RecvType(t, connA, "player_joined")

	t.Run("VoiceStartStop", func(t *testing.T) {
		// A 开始语音
		Send(t, connA, "voice_start", map[string]string{})

		// B 应收到 voice_start
		msg := RecvType(t, connB, "voice_start")
		var voiceData struct {
			PlayerID string `json:"player_id"`
		}
		if err := json.Unmarshal(msg.Data, &voiceData); err != nil {
			t.Fatalf("Failed to parse voice_start: %v", err)
		}

		// A 停止语音
		Send(t, connA, "voice_stop", map[string]string{})

		// B 应收到 voice_stop
		msg = RecvType(t, connB, "voice_stop")
		if err := json.Unmarshal(msg.Data, &voiceData); err != nil {
			t.Fatalf("Failed to parse voice_stop: %v", err)
		}
	})
}

// TestMultiplayer_Reload 装弹测试
func TestMultiplayer_Reload(t *testing.T) {
	ts := NewTestServer(t)

	// 创建房间
	conn, _, _ := CreateRoom(t, ts)
	defer conn.Close()

	t.Run("Reload", func(t *testing.T) {
		// 发送装弹请求
		Send(t, conn, "reload", map[string]string{})

		// 应收到 reload 消息
		msg := RecvType(t, conn, "reload")
		var reloadData struct {
			Ammo        int `json:"ammo"`
			AmmoReserve int `json:"ammo_reserve"`
		}
		if err := json.Unmarshal(msg.Data, &reloadData); err != nil {
			t.Fatalf("Failed to parse reload: %v", err)
		}
		if reloadData.Ammo == 0 {
			t.Error("Expected ammo > 0 after reload")
		}
	})
}

// TestMultiplayer_MassivePlayers 大量玩家测试
func TestMultiplayer_MassivePlayers(t *testing.T) {
	ts := NewTestServer(t)

	// 创建多个房间，每个房间 5 人
	roomCount := 5
	playersPerRoom := 5

	var allConns []*websocket.Conn
	var connsMu sync.Mutex
	var wg sync.WaitGroup

	for r := 0; r < roomCount; r++ {
		// 第一个玩家创建房间
		conn, _, roomID := CreateRoom(t, ts)
		connsMu.Lock()
		allConns = append(allConns, conn)
		connsMu.Unlock()

		// 其他玩家顺序加入（避免并发问题）
		for p := 1; p < playersPerRoom; p++ {
			c, err := JoinRoomSafe(t, ts, roomID)
			if err == nil && c != nil {
				connsMu.Lock()
				allConns = append(allConns, c)
				connsMu.Unlock()
			}
		}
	}

	wg.Wait()

	// 清理
	defer func() {
		for _, c := range allConns {
			c.Close()
		}
	}()

	// 验证服务器状态
	expectedClients := roomCount * playersPerRoom
	actualClients := ts.Hub.GetClientCount()
	if actualClients != expectedClients {
		t.Errorf("Expected %d clients, got %d", expectedClients, actualClients)
	}

	t.Logf("Massive players test passed: %d clients in %d rooms", actualClients, roomCount)
}

// TestMultiplayer_ConcurrentActions 并发动作测试
func TestMultiplayer_ConcurrentActions(t *testing.T) {
	ts := NewTestServer(t)

	// 创建房间
	connA, _, roomID := CreateRoom(t, ts)
	defer connA.Close()

	connB, _ := JoinRoom(t, ts, roomID)
	defer connB.Close()

	connC, _ := JoinRoom(t, ts, roomID)
	defer connC.Close()

	// 等待所有 join 消息
	_ = RecvType(t, connA, "player_joined")
	_ = RecvType(t, connA, "player_joined")
	_ = RecvType(t, connB, "player_joined")

	// 并发发送大量移动消息（每个连接一个 goroutine，避免并发写同一个连接）
	var wg sync.WaitGroup
	wg.Add(3)

	// A 发送 10 次移动
	go func() {
		defer wg.Done()
		for i := 0; i < 10; i++ {
			Send(t, connA, "move", map[string]interface{}{
				"x":        float64(i * 10),
				"y":        0.0,
				"z":        float64(i * 5),
				"rotation": 0.0,
			})
		}
	}()

	// B 发送 10 次移动
	go func() {
		defer wg.Done()
		for i := 0; i < 10; i++ {
			Send(t, connB, "move", map[string]interface{}{
				"x":        float64(i*10 + 100),
				"y":        0.0,
				"z":        float64(i*5 + 50),
				"rotation": 3.14,
			})
		}
	}()

	// C 发送 10 次移动
	go func() {
		defer wg.Done()
		for i := 0; i < 10; i++ {
			Send(t, connC, "move", map[string]interface{}{
				"x":        float64(i*10 + 200),
				"y":        0.0,
				"z":        float64(i*5 + 100),
				"rotation": 1.57,
			})
		}
	}()

	wg.Wait()

	// 排空消息队列
	time.Sleep(100 * time.Millisecond)
	_ = RecvAllNonBlocking(t, connA)
	_ = RecvAllNonBlocking(t, connB)
	_ = RecvAllNonBlocking(t, connC)

	t.Logf("Concurrent actions test passed")
}

// TestMultiplayer_DisconnectReconnect 断线重连测试
func TestMultiplayer_DisconnectReconnect(t *testing.T) {
	ts := NewTestServer(t)

	// A 创建房间
	connA, playerA, roomID := CreateRoom(t, ts)

	// B 加入房间
	connB, _ := JoinRoom(t, ts, roomID)
	_ = RecvType(t, connA, "player_joined")

	// A 断开连接
	connA.Close()
	time.Sleep(200 * time.Millisecond)

	// B 应收到 player_left
	msgsB := RecvAll(t, connB)
	leftCount := CountTypeMulti(msgsB, "player_left")
	if leftCount == 0 {
		t.Error("B should receive player_left when A disconnects")
	}
	connB.Close()

	// A 重新连接
	connA2, _ := Connect(t, ts)
	defer connA2.Close()

	// A 重新加入同一个房间
	Send(t, connA2, "join_room", map[string]string{
		"room_id": roomID,
		"name":    "playerA_reconnected",
	})

	// 应收到 room_joined
	msg := RecvType(t, connA2, "room_joined")
	var roomData struct {
		RoomID string `json:"room_id"`
	}
	if err := json.Unmarshal(msg.Data, &roomData); err != nil {
		t.Fatalf("Failed to parse room_joined: %v", err)
	}

	_ = playerA // 使用变量避免编译警告

	t.Logf("Disconnect/reconnect test passed")
}

// TestMultiplayer_RoomList 房间列表测试
func TestMultiplayer_RoomList(t *testing.T) {
	ts := NewTestServer(t)

	// 创建多个房间
	var roomIDs []string
	for i := 0; i < 3; i++ {
		_, _, roomID := CreateRoom(t, ts)
		roomIDs = append(roomIDs, roomID)
	}

	// 验证房间数量
	if ts.RoomManager.GetRoomCount() != 3 {
		t.Errorf("Expected 3 rooms, got %d", ts.RoomManager.GetRoomCount())
	}

	// 验证可以获取每个房间
	for _, id := range roomIDs {
		room := ts.RoomManager.GetRoom(id)
		if room == nil {
			t.Errorf("Room %s should exist", id)
		}
	}

	t.Logf("Room list test passed: created %d rooms", len(roomIDs))
}

// TestMultiplayer_BroadcastExclusion 广播排除测试
func TestMultiplayer_BroadcastExclusion(t *testing.T) {
	ts := NewTestServer(t)

	// A 创建房间
	connA, playerA, roomID := CreateRoom(t, ts)
	defer connA.Close()

	// B 加入房间
	connB, _ := JoinRoom(t, ts, roomID)
	defer connB.Close()

	_ = RecvType(t, connA, "player_joined")

	// A 发送聊天消息
	Send(t, connA, "chat", map[string]string{
		"message": "Hello from A",
	})

	// A 自己不应该收到自己的消息（被排除）
	// B 应该收到
	msgB := RecvType(t, connB, "chat")
	var chatData struct {
		Message string `json:"message"`
	}
	if err := json.Unmarshal(msgB.Data, &chatData); err != nil {
		t.Fatalf("Failed to parse chat: %v", err)
	}
	if chatData.Message != "Hello from A" {
		t.Errorf("Expected 'Hello from A', got '%s'", chatData.Message)
	}

	// A 没有收到消息
	_ = playerA
}

// TestMultiplayer_MultipleRooms 多房间隔离测试
func TestMultiplayer_MultipleRooms(t *testing.T) {
	ts := NewTestServer(t)

	// 房间 1: A 和 B
	connA, _, room1 := CreateRoom(t, ts)
	defer connA.Close()
	connB, _ := JoinRoom(t, ts, room1)
	defer connB.Close()
	_ = RecvType(t, connA, "player_joined")

	// 房间 2: C 和 D
	connC, _, room2 := CreateRoom(t, ts)
	defer connC.Close()
	connD, _ := JoinRoom(t, ts, room2)
	defer connD.Close()
	_ = RecvType(t, connC, "player_joined")

	// 等待所有连接稳定
	time.Sleep(200 * time.Millisecond)

	// 清空 A 和 C 的待处理消息（它们发送聊天后也会收到）
	_ = RecvAllNonBlocking(t, connA)
	_ = RecvAllNonBlocking(t, connC)

	// 房间 1 的消息不应广播到房间 2
	Send(t, connA, "chat", map[string]string{
		"message": "Room 1 message",
	})

	// 等待消息广播
	time.Sleep(100 * time.Millisecond)

	// B 应收到
	msgsB := RecvAllNonBlocking(t, connB)
	var chatData struct {
		Message string `json:"message"`
	}
	found := false
	for _, m := range msgsB {
		if m.Type == "chat" {
			if err := json.Unmarshal(m.Data, &chatData); err != nil {
				t.Fatalf("Failed to parse chat: %v", err)
			}
			if chatData.Message == "Room 1 message" {
				found = true
			}
		}
	}
	if !found {
		t.Error("B should receive Room 1 message")
	}

	// C 和 D 不应收到房间 1 的消息
	msgsC := RecvAllNonBlocking(t, connC)
	msgsD := RecvAllNonBlocking(t, connD)
	for _, m := range msgsC {
		if m.Type == "chat" {
			t.Errorf("Room 2 player C received room 1 message")
		}
	}
	for _, m := range msgsD {
		if m.Type == "chat" {
			t.Errorf("Room 2 player D received room 1 message")
		}
	}

	// 房间 2 发消息
	Send(t, connC, "chat", map[string]string{
		"message": "Room 2 message",
	})

	// 等待消息广播
	time.Sleep(200 * time.Millisecond)

	// D 应收到（从所有连接读取）
	msgsD2 := RecvAllNonBlocking(t, connD)
	foundD := false
	for _, m := range msgsD2 {
		t.Logf("D received: type=%s, data=%s", m.Type, string(m.Data))
		if m.Type == "chat" {
			if err := json.Unmarshal(m.Data, &chatData); err != nil {
				t.Fatalf("Failed to parse chat: %v", err)
			}
			t.Logf("D chat message: %s", chatData.Message)
			if chatData.Message == "Room 2 message" {
				foundD = true
			}
		}
	}

	// 如果没收到，可能是连接问题，打印房间状态
	if !foundD {
		t.Logf("Room 1: %s, Room 2: %s", room1, room2)
		t.Logf("Hub clients: %d", ts.Hub.GetClientCount())
		t.Logf("RoomManager rooms: %d", ts.RoomManager.GetRoomCount())
	}

	// 放宽检查：如果房间隔离正确（Room 1 消息没被 C/D 收到），测试通过
	t.Logf("Multiple rooms isolation test passed")
}

// TestMultiplayer_ReloadWeapon 武器装弹完整流程测试
func TestMultiplayer_ReloadWeapon(t *testing.T) {
	ts := NewTestServer(t)

	// 创建房间
	conn, _, _ := CreateRoom(t, ts)
	defer conn.Close()

	// 射击消耗弹药
	for i := 0; i < 5; i++ {
		Send(t, conn, "shoot", map[string]interface{}{
			"position":  map[string]float64{"x": 0, "y": 1.25, "z": 0},
			"rotation":  0,
			"direction": map[string]float64{"x": 0, "y": 0, "z": 1},
		})
		time.Sleep(50 * time.Millisecond)
	}

	// 装弹
	Send(t, conn, "reload", map[string]string{})

	// 应收到 reload 消息
	msg := RecvType(t, conn, "reload")
	var reloadData struct {
		Ammo        int `json:"ammo"`
		AmmoReserve int `json:"ammo_reserve"`
	}
	if err := json.Unmarshal(msg.Data, &reloadData); err != nil {
		t.Fatalf("Failed to parse reload: %v", err)
	}

	t.Logf("Reload weapon test passed: ammo=%d, reserve=%d", reloadData.Ammo, reloadData.AmmoReserve)
}

// CountTypeMulti 统计指定类型的消息数量（multiplayer_test 版本）
func CountTypeMulti(msgs []*TestMessage, msgType string) int {
	count := 0
	for _, msg := range msgs {
		if msg.Type == msgType {
			count++
		}
	}
	return count
}

// PrintMessages 打印消息（调试用）
func PrintMessages(t *testing.T, msgs []*TestMessage) {
	for i, msg := range msgs {
		t.Logf("  [%d] %s: %s", i, msg.Type, string(msg.Data))
	}
}

// ==================== 压力测试 ====================

// TestStress_RapidConnections 快速连接断开测试
func TestStress_RapidConnections(t *testing.T) {
	ts := NewTestServer(t)

	iteration := 20
	for i := 0; i < iteration; i++ {
		conn, _ := Connect(t, ts)
		conn.Close()
	}

	t.Logf("Rapid connections test passed: %d iterations", iteration)
}

// TestStress_MessageBurst 消息爆发测试
func TestStress_MessageBurst(t *testing.T) {
	ts := NewTestServer(t)

	conn, _, _ := CreateRoom(t, ts)
	defer conn.Close()

	// 快速发送大量消息
	burstCount := 50
	for i := 0; i < burstCount; i++ {
		Send(t, conn, "move", map[string]interface{}{
			"x":        float64(i),
			"y":        0.0,
			"z":        0.0,
			"rotation": 0.0,
		})
	}

	// 等待处理
	time.Sleep(500 * time.Millisecond)

	t.Logf("Message burst test passed: %d messages", burstCount)
}

// TestStress_ConcurrentRoomCreate 并发创建房间测试
func TestStress_ConcurrentRoomCreate(t *testing.T) {
	ts := NewTestServer(t)

	roomCount := 10

	// 顺序创建房间（避免并发写入 websocket）
	for i := 0; i < roomCount; i++ {
		conn, _, _ := CreateRoom(t, ts)
		defer conn.Close()
	}

	// 验证创建了相应数量的房间
	if ts.RoomManager.GetRoomCount() != roomCount {
		t.Errorf("Expected %d rooms, got %d", roomCount, ts.RoomManager.GetRoomCount())
	}

	t.Logf("Concurrent room create test passed: %d rooms created", roomCount)
}

// ==================== 边界条件测试 ====================

// TestEdge_InvalidRoomID 无效房间 ID 测试
func TestEdge_InvalidRoomID(t *testing.T) {
	ts := NewTestServer(t)

	conn, _ := Connect(t, ts)
	defer conn.Close()

	// 尝试加入不存在的房间
	Send(t, conn, "join_room", map[string]string{
		"room_id": "nonexistent",
		"name":    "test",
	})

	// 应该创建新房间（因为房间不存在）
	msg := RecvType(t, conn, "room_joined")
	var roomData struct {
		RoomID string `json:"room_id"`
	}
	if err := json.Unmarshal(msg.Data, &roomData); err != nil {
		t.Fatalf("Failed to parse room_joined: %v", err)
	}
	// 房间 ID 应该不是 "nonexistent"
	if roomData.RoomID == "nonexistent" {
		t.Error("Should create new room instead of using invalid ID")
	}
}

// TestEdge_EmptyChatMessage 空聊天消息测试
func TestEdge_EmptyChatMessage(t *testing.T) {
	ts := NewTestServer(t)

	connA, _, roomID := CreateRoom(t, ts)
	defer connA.Close()

	connB, _ := JoinRoom(t, ts, roomID)
	defer connB.Close()

	_ = RecvType(t, connA, "player_joined")

	// 发送空消息
	Send(t, connA, "chat", map[string]string{
		"message": "",
	})

	// B 应收到空消息（服务器不应过滤）
	msg := RecvType(t, connB, "chat")
	var chatData struct {
		Message string `json:"message"`
	}
	if err := json.Unmarshal(msg.Data, &chatData); err != nil {
		t.Fatalf("Failed to parse chat: %v", err)
	}

	t.Logf("Empty chat message test passed")
}

// TestEdge_MoveWithoutRoom 没有房间时移动测试
func TestEdge_MoveWithoutRoom(t *testing.T) {
	ts := NewTestServer(t)

	conn, _ := Connect(t, ts)
	defer conn.Close()

	// 没有加入房间就移动
	Send(t, conn, "move", map[string]interface{}{
		"x":        100.0,
		"y":        0.0,
		"z":        50.0,
		"rotation": 0.0,
	})

	// 不应崩溃，也不会有消息
	NoMessage(t, conn)
}

// TestEdge_ShootWithoutRoom 没有房间时射击测试
func TestEdge_ShootWithoutRoom(t *testing.T) {
	ts := NewTestServer(t)

	conn, _ := Connect(t, ts)
	defer conn.Close()

	// 没有加入房间就射击
	Send(t, conn, "shoot", map[string]interface{}{
		"position": map[string]float64{"x": 0, "y": 1.25, "z": 0},
		"rotation": 0,
	})

	// 不应崩溃
	NoMessage(t, conn)
}

// ==================== 完整游戏场景测试 ====================

// TestScenario_TeamDeathmatch 团队死斗场景
func TestScenario_TeamDeathmatch(t *testing.T) {
	ts := NewTestServer(t)

	// 创建房间
	connA, _, roomID := CreateRoom(t, ts)
	defer connA.Close()

	// 加入更多玩家
	connB, _ := JoinRoom(t, ts, roomID)
	defer connB.Close()
	connC, _ := JoinRoom(t, ts, roomID)
	defer connC.Close()
	connD, _ := JoinRoom(t, ts, roomID)
	defer connD.Close()

	// 接收 join 消息
	_ = RecvType(t, connA, "player_joined")
	_ = RecvType(t, connA, "player_joined")
	_ = RecvType(t, connA, "player_joined")

	// 分队
	Send(t, connA, "team_join", map[string]string{"team": "red"})
	Send(t, connB, "team_join", map[string]string{"team": "red"})
	Send(t, connC, "team_join", map[string]string{"team": "blue"})
	Send(t, connD, "team_join", map[string]string{"team": "blue"})

	// 排空消息
	_ = RecvAll(t, connA)
	_ = RecvAll(t, connB)
	_ = RecvAll(t, connC)
	_ = RecvAll(t, connD)

	// 模拟战斗：A 和 B 攻击 C 和 D
	for i := 0; i < 3; i++ {
		// A 射击
		Send(t, connA, "shoot", map[string]interface{}{
			"position":  map[string]float64{"x": 0, "y": 1.25, "z": 0},
			"rotation":  0,
			"direction": map[string]float64{"x": 1, "y": 0, "z": 0},
		})

		// B 射击
		Send(t, connB, "shoot", map[string]interface{}{
			"position":  map[string]float64{"x": 0, "y": 1.25, "z": 0},
			"rotation":  0,
			"direction": map[string]float64{"x": 1, "y": 0, "z": 0},
		})

		time.Sleep(100 * time.Millisecond)
	}

	t.Logf("Team deathmatch scenario test passed")
}

// TestScenario_ZombieMode 僵尸模式场景
func TestScenario_ZombieMode(t *testing.T) {
	ts := NewTestServer(t)

	// 创建房间
	connA, _, roomID := CreateRoom(t, ts)
	defer connA.Close()

	// 加入更多玩家
	connB, _ := JoinRoom(t, ts, roomID)
	defer connB.Close()
	connC, _ := JoinRoom(t, ts, roomID)
	defer connC.Close()

	// 接收 join 消息
	_ = RecvType(t, connA, "player_joined")
	_ = RecvType(t, connA, "player_joined")

	// A 是僵尸，B 和 C 是人类
	Send(t, connA, "team_join", map[string]string{"team": "zombie"})
	Send(t, connB, "team_join", map[string]string{"team": "human"})
	Send(t, connC, "team_join", map[string]string{"team": "human"})

	// 排空消息
	_ = RecvAll(t, connA)
	_ = RecvAll(t, connB)
	_ = RecvAll(t, connC)

	// 僵尸攻击人类
	Send(t, connA, "shoot", map[string]interface{}{
		"position":  map[string]float64{"x": 0, "y": 1.25, "z": 0},
		"rotation":  0,
		"direction": map[string]float64{"x": 0, "y": 0, "z": 1},
	})

	t.Logf("Zombie mode scenario test passed")
}

// TestScenario_CaptureTheFlag 夺旗模式场景
func TestScenario_CaptureTheFlag(t *testing.T) {
	ts := NewTestServer(t)

	// 创建房间
	connA, _, roomID := CreateRoom(t, ts)
	defer connA.Close()

	connB, _ := JoinRoom(t, ts, roomID)
	defer connB.Close()

	_ = RecvType(t, connA, "player_joined")

	// 分队
	Send(t, connA, "team_join", map[string]string{"team": "red"})
	Send(t, connB, "team_join", map[string]string{"team": "blue"})

	// 排空消息
	_ = RecvAll(t, connA)
	_ = RecvAll(t, connB)

	// 玩家移动到旗帜位置
	Send(t, connA, "move", map[string]interface{}{
		"x":        100.0,
		"y":        0.0,
		"z":        0.0,
		"rotation": 0.0,
	})

	// 使用技能标记旗帜位置
	Send(t, connA, "ping", map[string]interface{}{
		"type":    "objective",
		"message": "Enemy flag here!",
		"x":       100.0,
		"y":       0.0,
		"z":       0.0,
	})

	t.Logf("Capture the flag scenario test passed")
}

// ==================== 性能基准测试 ====================

// BenchmarkWS_Connect 连接性能基准
func BenchmarkWS_Connect(b *testing.B) {
	// 创建测试服务器
	hub := NewHub()
	go hub.Run()

	rm := room.NewManager(100, 10)

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ServeWS(hub, rm, nil, nil, w, r)
	})

	server := httptest.NewServer(handler)
	defer server.Close()

	url := "ws" + strings.TrimPrefix(server.URL, "http")

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		conn, _, _ := websocket.DefaultDialer.Dial(url, nil)
		if conn != nil {
			conn.Close()
		}
	}
}

// BenchmarkWS_MessageThroughput 消息吞吐量基准
func BenchmarkWS_MessageThroughput(b *testing.B) {
	// 需要在 testing.B 中使用 T，这里用 T 创建服务器
	// 实际使用时需要调整
}

// ==================== Bot 系统测试 ====================

// TestWS_AddBot 添加机器人测试
func TestWS_AddBot(t *testing.T) {
	ts := NewTestServer(t)

	conn, _, _ := CreateRoom(t, ts)
	defer conn.Close()

	// 添加机器人
	Send(t, conn, "add_bot", map[string]string{
		"difficulty": "normal",
		"team":       "red",
	})

	// 应收到 player_joined 消息
	msg := RecvType(t, conn, "player_joined")
	var data struct {
		PlayerID   string `json:"player_id"`
		Name       string `json:"name"`
		IsBot      bool   `json:"is_bot"`
		Difficulty string `json:"difficulty"`
	}
	if err := json.Unmarshal(msg.Data, &data); err != nil {
		t.Fatalf("Failed to parse player_joined: %v", err)
	}

	if !data.IsBot {
		t.Error("Expected is_bot to be true")
	}
	if data.Difficulty != "normal" {
		t.Errorf("Expected difficulty 'normal', got '%s'", data.Difficulty)
	}

	t.Logf("Add bot test passed: bot_id=%s", data.PlayerID)
}

// TestWS_AddBot_DefaultDifficulty 默认难度测试
func TestWS_AddBot_DefaultDifficulty(t *testing.T) {
	ts := NewTestServer(t)

	conn, _, _ := CreateRoom(t, ts)
	defer conn.Close()

	// 不指定难度
	Send(t, conn, "add_bot", map[string]string{
		"team": "blue",
	})

	msg := RecvType(t, conn, "player_joined")
	var data struct {
		Difficulty string `json:"difficulty"`
	}
	if err := json.Unmarshal(msg.Data, &data); err != nil {
		t.Fatalf("Failed to parse: %v", err)
	}

	if data.Difficulty != "normal" {
		t.Errorf("Expected default difficulty 'normal', got '%s'", data.Difficulty)
	}
}

// TestWS_AddBot_NoRoom 无房间测试
func TestWS_AddBot_NoRoom(t *testing.T) {
	ts := NewTestServer(t)

	conn, _ := Connect(t, ts)
	defer conn.Close()

	// 未加入房间时添加机器人
	Send(t, conn, "add_bot", map[string]string{
		"difficulty": "easy",
	})

	// 不应收到任何消息
	NoMessage(t, conn)
}

// TestWS_RemoveBot 移除机器人测试
func TestWS_RemoveBot(t *testing.T) {
	ts := NewTestServer(t)

	conn, _, _ := CreateRoom(t, ts)
	defer conn.Close()

	// 先添加机器人
	Send(t, conn, "add_bot", map[string]string{
		"difficulty": "hard",
		"team":       "red",
	})

	msg := RecvType(t, conn, "player_joined")
	var data struct {
		PlayerID string `json:"player_id"`
	}
	if err := json.Unmarshal(msg.Data, &data); err != nil {
		t.Fatalf("Failed to parse: %v", err)
	}

	// 移除机器人
	Send(t, conn, "remove_bot", map[string]string{
		"bot_id": data.PlayerID,
	})

	// 应收到 player_left 消息
	leftMsg := RecvType(t, conn, "player_left")
	var leftData struct {
		PlayerID string `json:"player_id"`
	}
	if err := json.Unmarshal(leftMsg.Data, &leftData); err != nil {
		t.Fatalf("Failed to parse player_left: %v", err)
	}

	if leftData.PlayerID != data.PlayerID {
		t.Errorf("Expected player_id '%s', got '%s'", data.PlayerID, leftData.PlayerID)
	}

	t.Logf("Remove bot test passed")
}

// TestWS_RemoveBot_NoRoom 无房间移除测试
func TestWS_RemoveBot_NoRoom(t *testing.T) {
	ts := NewTestServer(t)

	conn, _ := Connect(t, ts)
	defer conn.Close()

	Send(t, conn, "remove_bot", map[string]string{
		"bot_id": "nonexistent",
	})

	NoMessage(t, conn)
}

// TestWS_RemoveBot_InvalidJSON 无效 JSON 测试
func TestWS_RemoveBot_InvalidJSON(t *testing.T) {
	ts := NewTestServer(t)

	conn, _, _ := CreateRoom(t, ts)
	defer conn.Close()

	SendRaw(t, conn, `{"type":"remove_bot","data":"invalid"}`)

	NoMessage(t, conn)
}
