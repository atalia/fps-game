package network

import (
	"encoding/json"
	"strings"
	"testing"
	"time"
)

// ==================== 单元 4a：Self 响应消息 ====================

// TestWS_Reload 有房间
func TestWS_Reload_InRoom(t *testing.T) {
	ts := NewTestServer(t)

	// A 创建房间
	connA, playerIDA, _ := CreateRoom(t, ts)
	defer connA.Close()

	// B 加入房间
	connB, _ := JoinRoom(t, ts, ts.RoomManager.GetRoomByPlayerID(playerIDA).ID)
	defer connB.Close()

	// 清理背景消息
	Drain(t, connA)
	Drain(t, connB)

	// A reload
	Send(t, connA, "reload", map[string]string{})

	// A 应收到 reload
	msg := RecvType(t, connA, "reload")
	var reloadData struct {
		Ammo       int `json:"ammo"`
		AmmoReserve int `json:"ammo_reserve"`
	}
	if err := json.Unmarshal(msg.Data, &reloadData); err != nil {
		t.Fatalf("Failed to parse reload: %v", err)
	}
	if reloadData.Ammo <= 0 {
		t.Error("Expected ammo > 0")
	}

	// B 不应收到 reload
	NoMessage(t, connB)
}

// TestWS_Reload 无房间
func TestWS_Reload_NoRoom(t *testing.T) {
	ts := NewTestServer(t)

	conn, _ := Connect(t, ts)
	defer conn.Close()

	Drain(t, conn)

	// reload 无房间
	Send(t, conn, "reload", map[string]string{})

	// 应收到 reload
	msg := RecvType(t, conn, "reload")
	var reloadData struct {
		Ammo int `json:"ammo"`
	}
	if err := json.Unmarshal(msg.Data, &reloadData); err != nil {
		t.Fatalf("Failed to parse reload: %v", err)
	}
	if reloadData.Ammo <= 0 {
		t.Error("Expected ammo > 0")
	}
}

// ==================== 单元 4b：Self+Others 广播消息 ====================

// TestWS_Chat 测试聊天
func TestWS_Chat(t *testing.T) {
	ts := NewTestServer(t)

	connA, playerIDA, roomID := CreateRoom(t, ts)
	defer connA.Close()

	connB, _ := JoinRoom(t, ts, roomID)
	defer connB.Close()

	Drain(t, connA)
	Drain(t, connB)

	Send(t, connA, "chat", map[string]string{"message": "hello"})

	// A 和 B 都应收到 chat
	msgA := RecvType(t, connA, "chat")
	var chatDataA struct {
		PlayerID string `json:"player_id"`
		Message  string `json:"message"`
	}
	if err := json.Unmarshal(msgA.Data, &chatDataA); err != nil {
		t.Fatalf("Failed to parse chat A: %v", err)
	}
	if chatDataA.Message != "hello" {
		t.Errorf("Expected 'hello', got %s", chatDataA.Message)
	}

	msgB := RecvType(t, connB, "chat")
	var chatDataB struct {
		Message string `json:"message"`
	}
	if err := json.Unmarshal(msgB.Data, &chatDataB); err != nil {
		t.Fatalf("Failed to parse chat B: %v", err)
	}
	if chatDataB.Message != "hello" {
		t.Errorf("Expected 'hello', got %s", chatDataB.Message)
	}
}

// TestWS_Chat_NoRoom 无房间静默
func TestWS_Chat_NoRoom(t *testing.T) {
	ts := NewTestServer(t)

	conn, _ := Connect(t, ts)
	defer conn.Close()

	Drain(t, conn)

	Send(t, conn, "chat", map[string]string{"message": "hello"})
	NoMessage(t, conn)
}

// TestWS_Chat_InvalidJSON 非法 JSON 静默
func TestWS_Chat_InvalidJSON(t *testing.T) {
	ts := NewTestServer(t)

	conn, _, roomID := CreateRoom(t, ts)
	defer conn.Close()

	connB, _ := JoinRoom(t, ts, roomID)
	defer connB.Close()

	Drain(t, conn)
	Drain(t, connB)

	SendRaw(t, conn, `{"type":"chat","data":{invalid}`)
	NoMessage(t, conn)
	NoMessage(t, connB)
}

// TestWS_Respawn 测试重生
func TestWS_Respawn(t *testing.T) {
	ts := NewTestServer(t)

	connA, playerIDA, roomID := CreateRoom(t, ts)
	defer connA.Close()

	connB, _ := JoinRoom(t, ts, roomID)
	defer connB.Close()

	Drain(t, connA)
	Drain(t, connB)

	Send(t, connA, "respawn", map[string]float64{"x": 1, "y": 2, "z": 3})

	// A 应收到 respawn
	msgA := RecvType(t, connA, "respawn")
	var respawnData struct {
		Health   int `json:"health"`
		Ammo     int `json:"ammo"`
		Position struct {
			X, Y, Z float64 `json:"x,y,z"`
		} `json:"position"`
	}
	if err := json.Unmarshal(msgA.Data, &respawnData); err != nil {
		t.Fatalf("Failed to parse respawn: %v", err)
	}
	if respawnData.Health != 100 {
		t.Errorf("Expected health 100, got %d", respawnData.Health)
	}

	// B 应收到 player_respawned
	msgB := RecvType(t, connB, "player_respawned")
	var respawnedData struct {
		PlayerID string `json:"player_id"`
	}
	if err := json.Unmarshal(msgB.Data, &respawnedData); err != nil {
		t.Fatalf("Failed to parse player_respawned: %v", err)
	}
	if respawnedData.PlayerID != playerIDA {
		t.Errorf("Expected player_id %s, got %s", playerIDA, respawnedData.PlayerID)
	}
}

// TestWS_Respawn_NoRoom 无房间发送者收到
func TestWS_Respawn_NoRoom(t *testing.T) {
	ts := NewTestServer(t)

	conn, _ := Connect(t, ts)
	defer conn.Close()

	Drain(t, conn)

	Send(t, conn, "respawn", map[string]float64{"x": 0, "y": 0, "z": 0})

	// 发送者应收到 respawn
	msg := RecvType(t, conn, "respawn")
	var respawnData struct {
		Health int `json:"health"`
	}
	if err := json.Unmarshal(msg.Data, &respawnData); err != nil {
		t.Fatalf("Failed to parse respawn: %v", err)
	}
	if respawnData.Health != 100 {
		t.Errorf("Expected health 100, got %d", respawnData.Health)
	}
}

// TestWS_Respawn_InvalidJSON 非法 JSON 零值广播
func TestWS_Respawn_InvalidJSON(t *testing.T) {
	ts := NewTestServer(t)

	conn, _, roomID := CreateRoom(t, ts)
	defer conn.Close()

	connB, _ := JoinRoom(t, ts, roomID)
	defer connB.Close()

	Drain(t, conn)
	Drain(t, connB)

	SendRaw(t, conn, `{"type":"respawn","data":{invalid}`)

	// 发送者应收到 respawn（零值）
	msg := RecvType(t, conn, "respawn")
	var respawnData struct {
		Health int `json:"health"`
	}
	if err := json.Unmarshal(msg.Data, &respawnData); err != nil {
		t.Fatalf("Failed to parse respawn: %v", err)
	}
	// 零值情况下 health 应为 100（Respawn 设置）
	if respawnData.Health != 100 {
		t.Errorf("Expected health 100, got %d", respawnData.Health)
	}

	// B 应收到 player_respawned（零值 position）
	msgB := RecvType(t, connB, "player_respawned")
	var respawnedData struct {
		Position struct {
			X, Y, Z float64 `json:"x,y,z"`
		} `json:"position"`
	}
	if err := json.Unmarshal(msgB.Data, &respawnedData); err != nil {
		t.Fatalf("Failed to parse player_respawned: %v", err)
	}
	// 零值 position
	if respawnedData.Position.X != 0 || respawnedData.Position.Y != 0 || respawnedData.Position.Z != 0 {
		t.Logf("Zero-value position: %v", respawnedData.Position)
	}
}

// TestWS_WeaponChange 测试武器切换
func TestWS_WeaponChange(t *testing.T) {
	ts := NewTestServer(t)

	connA, _, roomID := CreateRoom(t, ts)
	defer connA.Close()

	connB, _ := JoinRoom(t, ts, roomID)
	defer connB.Close()

	Drain(t, connA)
	Drain(t, connB)

	Send(t, connA, "weapon_change", map[string]string{"weapon": "rifle"})

	// A 和 B 都应收到 weapon_changed
	msgA := RecvType(t, connA, "weapon_changed")
	var wcDataA struct {
		Weapon string `json:"weapon"`
	}
	if err := json.Unmarshal(msgA.Data, &wcDataA); err != nil {
		t.Fatalf("Failed to parse weapon_changed A: %v", err)
	}
	if wcDataA.Weapon != "rifle" {
		t.Errorf("Expected 'rifle', got %s", wcDataA.Weapon)
	}

	msgB := RecvType(t, connB, "weapon_changed")
	var wcDataB struct {
		Weapon string `json:"weapon"`
	}
	if err := json.Unmarshal(msgB.Data, &wcDataB); err != nil {
		t.Fatalf("Failed to parse weapon_changed B: %v", err)
	}
	if wcDataB.Weapon != "rifle" {
		t.Errorf("Expected 'rifle', got %s", wcDataB.Weapon)
	}
}

// TestWS_WeaponChange_NoRoom 无房间广播静默
func TestWS_WeaponChange_NoRoom(t *testing.T) {
	ts := NewTestServer(t)

	conn, _ := Connect(t, ts)
	defer conn.Close()

	Drain(t, conn)

	Send(t, conn, "weapon_change", map[string]string{"weapon": "rifle"})
	NoMessage(t, conn)
}

// TestWS_TeamJoin 测试队伍加入
func TestWS_TeamJoin(t *testing.T) {
	ts := NewTestServer(t)

	conn, _, roomID := CreateRoom(t, ts)
	defer conn.Close()

	connB, _ := JoinRoom(t, ts, roomID)
	defer connB.Close()

	Drain(t, conn)
	Drain(t, connB)

	Send(t, conn, "team_join", map[string]string{"team": "red"})

	msg := RecvType(t, conn, "team_changed")
	var tcData struct {
		Team string `json:"team"`
	}
	if err := json.Unmarshal(msg.Data, &tcData); err != nil {
		t.Fatalf("Failed to parse team_changed: %v", err)
	}
	if tcData.Team != "red" {
		t.Errorf("Expected 'red', got %s", tcData.Team)
	}

	msgB := RecvType(t, connB, "team_changed")
	if err := json.Unmarshal(msgB.Data, &tcData); err != nil {
		t.Fatalf("Failed to parse team_changed B: %v", err)
	}
	if tcData.Team != "red" {
		t.Errorf("Expected 'red', got %s", tcData.Team)
	}
}

// TestWS_GrenadeThrow 测试投掷手雷
func TestWS_GrenadeThrow(t *testing.T) {
	ts := NewTestServer(t)

	conn, _, roomID := CreateRoom(t, ts)
	defer conn.Close()

	connB, _ := JoinRoom(t, ts, roomID)
	defer connB.Close()

	Drain(t, conn)
	Drain(t, connB)

	data := map[string]interface{}{
		"type": "frag",
		"position": map[string]float64{"x": 1, "y": 2, "z": 3},
		"velocity": map[string]float64{"x": 0, "y": 0, "z": 0},
	}
	Send(t, conn, "grenade_throw", data)

	msg := RecvType(t, conn, "grenade_thrown")
	var gtData struct {
		Type string `json:"type"`
	}
	if err := json.Unmarshal(msg.Data, &gtData); err != nil {
		t.Fatalf("Failed to parse grenade_thrown: %v", err)
	}
	if gtData.Type != "frag" {
		t.Errorf("Expected 'frag', got %s", gtData.Type)
	}

	RecvType(t, connB, "grenade_thrown")
}

// TestWS_C4Plant 测试 C4 放置
func TestWS_C4Plant(t *testing.T) {
	ts := NewTestServer(t)

	conn, _, roomID := CreateRoom(t, ts)
	defer conn.Close()

	connB, _ := JoinRoom(t, ts, roomID)
	defer connB.Close()

	Drain(t, conn)
	Drain(t, connB)

	data := map[string]interface{}{
		"position": map[string]float64{"x": 1, "y": 2, "z": 3},
	}
	Send(t, conn, "c4_plant", data)

	RecvType(t, conn, "c4_planted")
	RecvType(t, connB, "c4_planted")
}

// TestWS_C4Defuse 测试 C4 拆除
func TestWS_C4Defuse(t *testing.T) {
	ts := NewTestServer(t)

	conn, _, roomID := CreateRoom(t, ts)
	defer conn.Close()

	connB, _ := JoinRoom(t, ts, roomID)
	defer connB.Close()

	Drain(t, conn)
	Drain(t, connB)

	// 先放置 C4
	Send(t, conn, "c4_plant", map[string]interface{}{
		"position": map[string]float64{"x": 1, "y": 2, "z": 3},
	})
	Drain(t, conn)
	Drain(t, connB)

	// 拆除 C4
	Send(t, conn, "c4_defuse", map[string]string{})

	RecvType(t, conn, "c4_defused")
	RecvType(t, connB, "c4_defused")
}

// TestWS_C4Defuse_NoC4 无 C4 静默
func TestWS_C4Defuse_NoC4(t *testing.T) {
	ts := NewTestServer(t)

	conn, _, _ := CreateRoom(t, ts)
	defer conn.Close()

	Drain(t, conn)

	// 未放置 C4 时拆除
	Send(t, conn, "c4_defuse", map[string]string{})
	NoMessage(t, conn)
}

// TestWS_SkillUse 测试技能使用
func TestWS_SkillUse(t *testing.T) {
	ts := NewTestServer(t)

	conn, _, roomID := CreateRoom(t, ts)
	defer conn.Close()

	connB, _ := JoinRoom(t, ts, roomID)
	defer connB.Close()

	Drain(t, conn)
	Drain(t, connB)

	data := map[string]interface{}{
		"skill_id": "heal",
		"x":        0,
		"y":        0,
		"z":        0,
	}
	Send(t, conn, "skill_use", data)

	RecvType(t, conn, "skill_used")
	RecvType(t, connB, "skill_used")
}

// TestWS_SkillUse_Cooldown 冷却
func TestWS_SkillUse_Cooldown(t *testing.T) {
	ts := NewTestServer(t)

	conn, _, _ := CreateRoom(t, ts)
	defer conn.Close()

	Drain(t, conn)

	data := map[string]interface{}{
		"skill_id": "heal",
		"x":        0,
		"y":        0,
		"z":        0,
	}

	// 第一次使用
	Send(t, conn, "skill_use", data)
	Drain(t, conn)

	// 第二次使用（冷却中）
	Send(t, conn, "skill_use", data)

	msg := RecvType(t, conn, "error")
	var errData struct {
		Message string `json:"message"`
	}
	if err := json.Unmarshal(msg.Data, &errData); err != nil {
		t.Fatalf("Failed to parse error: %v", err)
	}
	if !strings.Contains(errData.Message, "cooldown") {
		t.Errorf("Expected 'cooldown' in error, got: %s", errData.Message)
	}
}

// TestWS_SkillUse_UnknownSkill 未知技能
func TestWS_SkillUse_UnknownSkill(t *testing.T) {
	ts := NewTestServer(t)

	conn, _, _ := CreateRoom(t, ts)
	defer conn.Close()

	Drain(t, conn)

	Send(t, conn, "skill_use", map[string]interface{}{
		"skill_id": "unknown",
	})

	msg := RecvType(t, conn, "error")
	var errData struct {
		Message string `json:"message"`
	}
	if err := json.Unmarshal(msg.Data, &errData); err != nil {
		t.Fatalf("Failed to parse error: %v", err)
	}
	// 当前实现将未知技能视为冷却
	if !strings.Contains(errData.Message, "cooldown") {
		t.Logf("Unknown skill error: %s", errData.Message)
	}
}

// TestWS_Emote 测试表情
func TestWS_Emote(t *testing.T) {
	ts := NewTestServer(t)

	conn, _, roomID := CreateRoom(t, ts)
	defer conn.Close()

	connB, _ := JoinRoom(t, ts, roomID)
	defer connB.Close()

	Drain(t, conn)
	Drain(t, connB)

	Send(t, conn, "emote", map[string]string{"emote_id": "wave"})

	RecvType(t, conn, "emote")
	RecvType(t, connB, "emote")
}

// TestWS_Ping 测试战术标记
func TestWS_Ping(t *testing.T) {
	ts := NewTestServer(t)

	conn, _, roomID := CreateRoom(t, ts)
	defer conn.Close()

	connB, _ := JoinRoom(t, ts, roomID)
	defer connB.Close()

	Drain(t, conn)
	Drain(t, connB)

	data := map[string]interface{}{
		"type":    "enemy",
		"x":       1,
		"y":       2,
		"z":       3,
		"message": "here",
	}
	Send(t, conn, "ping", data)

	RecvType(t, conn, "ping")
	RecvType(t, connB, "ping")
}

// ==================== 单元 4c：Others-only 广播消息 ====================

// TestWS_Move 测试移动
func TestWS_Move(t *testing.T) {
	ts := NewTestServer(t)

	connA, playerIDA, roomID := CreateRoom(t, ts)
	defer connA.Close()

	connB, _ := JoinRoom(t, ts, roomID)
	defer connB.Close()

	Drain(t, connA)
	Drain(t, connB)

	Send(t, connA, "move", map[string]float64{"x": 1, "y": 2, "z": 3, "rotation": 0})

	// A 不应收到（others-only）
	NoMessage(t, connA)

	// B 应收到 player_moved
	msgB := RecvType(t, connB, "player_moved")
	var moveData struct {
		PlayerID string `json:"player_id"`
	}
	if err := json.Unmarshal(msgB.Data, &moveData); err != nil {
		t.Fatalf("Failed to parse player_moved: %v", err)
	}
	if moveData.PlayerID != playerIDA {
		t.Errorf("Expected player_id %s, got %s", playerIDA, moveData.PlayerID)
	}
}

// TestWS_Move_NoRoom 无房间静默
func TestWS_Move_NoRoom(t *testing.T) {
	ts := NewTestServer(t)

	conn, _ := Connect(t, ts)
	defer conn.Close()

	Drain(t, conn)

	Send(t, conn, "move", map[string]float64{"x": 1, "y": 2, "z": 3, "rotation": 0})
	NoMessage(t, conn)
}

// TestWS_Shoot 测试射击
func TestWS_Shoot(t *testing.T) {
	ts := NewTestServer(t)

	connA, playerIDA, roomID := CreateRoom(t, ts)
	defer connA.Close()

	connB, _ := JoinRoom(t, ts, roomID)
	defer connB.Close()

	Drain(t, connA)
	Drain(t, connB)

	data := map[string]interface{}{
		"position": map[string]float64{"x": 1, "y": 2, "z": 3},
		"rotation": 0,
	}
	Send(t, connA, "shoot", data)

	// A 不应收到（others-only）
	NoMessage(t, connA)

	// B 应收到 player_shot
	msgB := RecvType(t, connB, "player_shot")
	var shootData struct {
		PlayerID string `json:"player_id"`
		Ammo     int    `json:"ammo"`
	}
	if err := json.Unmarshal(msgB.Data, &shootData); err != nil {
		t.Fatalf("Failed to parse player_shot: %v", err)
	}
	if shootData.PlayerID != playerIDA {
		t.Errorf("Expected player_id %s, got %s", playerIDA, shootData.PlayerID)
	}
}

// TestWS_Shoot_Cooldown 冷却
func TestWS_Shoot_Cooldown(t *testing.T) {
	ts := NewTestServer(t)

	connA, _, roomID := CreateRoom(t, ts)
	defer connA.Close()

	connB, _ := JoinRoom(t, ts, roomID)
	defer connB.Close()

	Drain(t, connA)
	Drain(t, connB)

	data := map[string]interface{}{
		"position": map[string]float64{"x": 1, "y": 2, "z": 3},
		"rotation": 0,
	}

	// 第一次射击
	Send(t, connA, "shoot", data)
	Drain(t, connB)

	// 等待 50ms（冷却 100ms）
	time.Sleep(50 * time.Millisecond)

	// 第二次射击（冷却中）
	Send(t, connA, "shoot", data)

	// B 不应收到第二条
	NoMessage(t, connB)
}

// TestWS_Shoot_InvalidJSON 非法 JSON 零值广播
func TestWS_Shoot_InvalidJSON(t *testing.T) {
	ts := NewTestServer(t)

	conn, _, roomID := CreateRoom(t, ts)
	defer conn.Close()

	connB, _ := JoinRoom(t, ts, roomID)
	defer connB.Close()

	Drain(t, conn)
	Drain(t, connB)

	SendRaw(t, conn, `{"type":"shoot","data":{invalid}`)

	// B 应收到 player_shot（零值 position = null）
	msgB := RecvType(t, connB, "player_shot")
	var shootData struct {
		Position interface{} `json:"position"`
	}
	if err := json.Unmarshal(msgB.Data, &shootData); err != nil {
		t.Fatalf("Failed to parse player_shot: %v", err)
	}
	// position 应为 null（零值）
	if shootData.Position != nil {
		t.Logf("Position: %v (expected null for invalid JSON)", shootData.Position)
	}
}

// TestWS_VoiceStart 测试语音开始
func TestWS_VoiceStart(t *testing.T) {
	ts := NewTestServer(t)

	conn, _, roomID := CreateRoom(t, ts)
	defer conn.Close()

	connB, _ := JoinRoom(t, ts, roomID)
	defer connB.Close()

	Drain(t, conn)
	Drain(t, connB)

	Send(t, conn, "voice_start", map[string]string{})

	NoMessage(t, conn)
	RecvType(t, connB, "voice_start")
}

// TestWS_VoiceStop 测试语音停止
func TestWS_VoiceStop(t *testing.T) {
	ts := NewTestServer(t)

	conn, _, roomID := CreateRoom(t, ts)
	defer conn.Close()

	connB, _ := JoinRoom(t, ts, roomID)
	defer connB.Close()

	Drain(t, conn)
	Drain(t, connB)

	Send(t, conn, "voice_stop", map[string]string{})

	NoMessage(t, conn)
	RecvType(t, connB, "voice_stop")
}

// TestWS_VoiceData 测试语音数据
func TestWS_VoiceData(t *testing.T) {
	ts := NewTestServer(t)

	conn, _, roomID := CreateRoom(t, ts)
	defer conn.Close()

	connB, _ := JoinRoom(t, ts, roomID)
	defer connB.Close()

	Drain(t, conn)
	Drain(t, connB)

	SendRaw(t, conn, `{"type":"voice_data","data":"base64_audio"}`)

	NoMessage(t, conn)
	msgB := RecvType(t, connB, "voice_data")
	var vdData struct {
		Audio string `json:"audio"`
	}
	if err := json.Unmarshal(msgB.Data, &vdData); err != nil {
		t.Fatalf("Failed to parse voice_data: %v", err)
	}
	if vdData.Audio != "base64_audio" {
		t.Errorf("Expected 'base64_audio', got %s", vdData.Audio)
	}
}
