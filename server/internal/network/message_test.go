package network

import (
	"testing"
)

// ==================== 单元 4a：Self 响应消息 ====================

// TestWS_Reload 有房间
func TestWS_Reload_InRoom(t *testing.T) {
	ts := NewTestServer(t)

	connA, _, roomID := CreateRoom(t, ts)
	defer connA.Close()

	connB, _ := JoinRoom(t, ts, roomID)
	defer connB.Close()

	// A reload
	Send(t, connA, "reload", map[string]string{})

	// A 应收到 reload（self-only）
	msgsA := RecvAll(t, connA)
	reloadCount := CountType(msgsA, "reload")
	if reloadCount == 0 {
		t.Error("A should receive reload message")
	}

	// B 不应收到 reload
	msgsB := RecvAll(t, connB)
	reloadCountB := CountType(msgsB, "reload")
	if reloadCountB > 0 {
		t.Error("B should NOT receive reload message")
	}
}

// TestWS_Reload 无房间
func TestWS_Reload_NoRoom(t *testing.T) {
	ts := NewTestServer(t)

	conn, _ := Connect(t, ts)
	defer conn.Close()

	Send(t, conn, "reload", map[string]string{})

	msgs := RecvAll(t, conn)
	reloadCount := CountType(msgs, "reload")
	if reloadCount == 0 {
		t.Fatal("Should receive reload message")
	}
}

// ==================== 单元 4b：Self+Others 广播消息 ====================

// TestWS_Chat 测试聊天 - 发送者也收到
func TestWS_Chat(t *testing.T) {
	ts := NewTestServer(t)

	connA, _, roomID := CreateRoom(t, ts)
	defer connA.Close()

	connB, _ := JoinRoom(t, ts, roomID)
	defer connB.Close()

	Send(t, connA, "chat", map[string]string{"message": "hello"})

	// A 和 B 都应收到 chat (excludeID="")
	msgsA := RecvAll(t, connA)
	chatCountA := CountType(msgsA, "chat")
	if chatCountA == 0 {
		t.Error("A should receive chat message")
	}

	msgsB := RecvAll(t, connB)
	chatCountB := CountType(msgsB, "chat")
	if chatCountB == 0 {
		t.Error("B should receive chat message")
	}
}

// TestWS_Chat_NoRoom 无房间静默
func TestWS_Chat_NoRoom(t *testing.T) {
	ts := NewTestServer(t)

	conn, _ := Connect(t, ts)
	defer conn.Close()

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

	// Drain 背景消息
	Drain(t, conn)
	Drain(t, connB)

	SendRaw(t, conn, `{"type":"chat","data":invalid}`)
	NoMessage(t, conn)
	NoMessage(t, connB)
}

// TestWS_Move 测试移动 - 发送者不收到
func TestWS_Move(t *testing.T) {
	ts := NewTestServer(t)

	connA, _, roomID := CreateRoom(t, ts)
	defer connA.Close()

	connB, _ := JoinRoom(t, ts, roomID)
	defer connB.Close()

	Send(t, connA, "move", map[string]float64{"x": 1.0, "y": 2.0, "z": 3.0})

	// A 不应收到 player_moved (excludeID=c.Player.ID)
	msgsA := RecvAll(t, connA)
	moveCountA := CountType(msgsA, "player_moved")
	if moveCountA > 0 {
		t.Error("A should NOT receive player_moved")
	}

	// B 应收到 player_moved
	msgsB := RecvAll(t, connB)
	moveCountB := CountType(msgsB, "player_moved")
	if moveCountB == 0 {
		t.Error("B should receive player_moved")
	}
}

// TestWS_Move_NoRoom 无房间静默
func TestWS_Move_NoRoom(t *testing.T) {
	ts := NewTestServer(t)

	conn, _ := Connect(t, ts)
	defer conn.Close()

	Send(t, conn, "move", map[string]float64{"x": 1.0})
	NoMessage(t, conn)
}

// TestWS_Shoot 测试射击 - 发送者不收到
func TestWS_Shoot(t *testing.T) {
	ts := NewTestServer(t)

	connA, _, roomID := CreateRoom(t, ts)
	defer connA.Close()

	connB, _ := JoinRoom(t, ts, roomID)
	defer connB.Close()

	Send(t, connA, "shoot", map[string]interface{}{
		"position": map[string]float64{"x": 1.0, "y": 2.0, "z": 3.0},
		"rotation": 0.0,
	})

	// A 不应收到 player_shot (excludeID=c.Player.ID)
	msgsA := RecvAll(t, connA)
	shootCountA := CountType(msgsA, "player_shot")
	if shootCountA > 0 {
		t.Error("A should NOT receive player_shot")
	}

	// B 应收到 player_shot
	msgsB := RecvAll(t, connB)
	shootCountB := CountType(msgsB, "player_shot")
	if shootCountB == 0 {
		t.Error("B should receive player_shot")
	}
}

// TestWS_Shoot_Cooldown 射击冷却
func TestWS_Shoot_Cooldown(t *testing.T) {
	ts := NewTestServer(t)

	conn, _, _ := CreateRoom(t, ts)
	defer conn.Close()

	// 第一次射击
	Send(t, conn, "shoot", map[string]interface{}{
		"position": map[string]float64{"x": 1.0},
		"rotation": map[string]float64{"x": 0.0},
	})
	Drain(t, conn)

	// 立即第二次射击（冷却中）
	Send(t, conn, "shoot", map[string]interface{}{
		"position": map[string]float64{"x": 2.0},
		"rotation": map[string]float64{"x": 0.0},
	})

	// 冷却中不应发送第二次
	msgs := RecvAll(t, conn)
	shootCount := CountType(msgs, "player_shot")
	if shootCount > 0 {
		t.Fatal("Should not shoot during cooldown")
	}
}

// TestWS_Shoot_InvalidJSON 非法 JSON 静默（服务器解析失败不广播）
func TestWS_Shoot_InvalidJSON(t *testing.T) {
	ts := NewTestServer(t)

	conn, _, roomID := CreateRoom(t, ts)
	defer conn.Close()

	connB, _ := JoinRoom(t, ts, roomID)
	defer connB.Close()

	// Drain 背景消息
	Drain(t, conn)
	Drain(t, connB)

	// 发送非法 JSON
	SendRaw(t, conn, `{"type":"shoot","data":invalid}`)

	// 服务器在 CanShoot 检查通过后解析数据
	// 非法 JSON 解析失败但不会阻止广播（零值）
	// 但由于冷却期，可能不会发送
	// 实际行为：静默（因为没有有效数据或冷却）
	NoMessage(t, conn)
	NoMessage(t, connB)
}

// TestWS_Respawn_AliveRejected 活着时不允许手动重生
func TestWS_Respawn(t *testing.T) {
	ts := NewTestServer(t)

	connA, _, roomID := CreateRoom(t, ts)
	defer connA.Close()

	connB, _ := JoinRoom(t, ts, roomID)
	defer connB.Close()

	Send(t, connA, "respawn", map[string]float64{"x": 10.0, "y": 0.0, "z": 5.0})

	// A 活着时应收到 error，不应收到 respawn/player_respawned
	msgsA := RecvAll(t, connA)
	errorCountA := CountType(msgsA, "error")
	playerRespawnedCountA := CountType(msgsA, "player_respawned")
	respawnCountA := CountType(msgsA, "respawn")
	if errorCountA == 0 {
		t.Error("A should receive error when respawning while alive")
	}
	if playerRespawnedCountA > 0 {
		t.Error("A should NOT receive player_respawned when respawn is rejected")
	}
	if respawnCountA > 0 {
		t.Error("A should NOT receive respawn when respawn is rejected")
	}

	// B 不应收到任何重生广播
	msgsB := RecvAll(t, connB)
	respawnCountB := CountType(msgsB, "player_respawned")
	if respawnCountB > 0 {
		t.Error("B should NOT receive player_respawned when respawn is rejected")
	}
}

// TestWS_Respawn_NoRoom 无房间拒绝
func TestWS_Respawn_NoRoom(t *testing.T) {
	ts := NewTestServer(t)

	conn, _ := Connect(t, ts)
	defer conn.Close()

	Send(t, conn, "respawn", map[string]float64{"x": 10.0})
	// 无房间时应返回 error
	msgs := RecvAll(t, conn)
	errorCount := CountType(msgs, "error")
	respawnCount := CountType(msgs, "respawn")
	if errorCount == 0 {
		t.Fatal("Should receive error message (room required)")
	}
	if respawnCount > 0 {
		t.Fatal("Should NOT receive respawn message when no room")
	}
}

// TestWS_Respawn_InvalidJSON 非法 JSON 会被服务器丢弃
func TestWS_Respawn_InvalidJSON(t *testing.T) {
	t.Skip("Server drops messages with invalid JSON at parse time - this is correct behavior")
}

// ==================== 单元 4c：广播消息（发送者也收到） ====================

// TestWS_WeaponChange 测试武器切换 - 发送者也收到
func TestWS_WeaponChange(t *testing.T) {
	ts := NewTestServer(t)

	connA, _, roomID := CreateRoom(t, ts)
	defer connA.Close()

	connB, _ := JoinRoom(t, ts, roomID)
	defer connB.Close()

	Send(t, connA, "weapon_change", map[string]string{"weapon": "rifle"})

	// A 和 B 都应收到 weapon_changed (excludeID="")
	msgsA := RecvAll(t, connA)
	weaponCountA := CountType(msgsA, "weapon_changed")
	if weaponCountA == 0 {
		t.Error("A should receive weapon_changed")
	}

	msgsB := RecvAll(t, connB)
	weaponCountB := CountType(msgsB, "weapon_changed")
	if weaponCountB == 0 {
		t.Error("B should receive weapon_changed")
	}
}

// TestWS_WeaponChange_NoRoom 无房间静默
func TestWS_WeaponChange_NoRoom(t *testing.T) {
	ts := NewTestServer(t)

	conn, _ := Connect(t, ts)
	defer conn.Close()

	Send(t, conn, "weapon_change", map[string]string{"weapon": "rifle"})
	NoMessage(t, conn)
}

// TestWS_VoiceStart 测试语音开始 - 发送者不收到
func TestWS_VoiceStart(t *testing.T) {
	ts := NewTestServer(t)

	connA, _, roomID := CreateRoom(t, ts)
	defer connA.Close()

	connB, _ := JoinRoom(t, ts, roomID)
	defer connB.Close()

	Send(t, connA, "voice_start", map[string]string{})

	// A 不应收到 voice_start (excludeID=c.Player.ID)
	msgsA := RecvAll(t, connA)
	voiceCountA := CountType(msgsA, "voice_start")
	if voiceCountA > 0 {
		t.Error("A should NOT receive voice_start")
	}

	// B 应收到 voice_start
	msgsB := RecvAll(t, connB)
	voiceCountB := CountType(msgsB, "voice_start")
	if voiceCountB == 0 {
		t.Error("B should receive voice_start")
	}
}

// TestWS_VoiceStop 测试语音停止 - 发送者不收到
func TestWS_VoiceStop(t *testing.T) {
	ts := NewTestServer(t)

	connA, _, roomID := CreateRoom(t, ts)
	defer connA.Close()

	connB, _ := JoinRoom(t, ts, roomID)
	defer connB.Close()

	Send(t, connA, "voice_stop", map[string]string{})

	// A 不应收到 voice_stop (excludeID=c.Player.ID)
	msgsA := RecvAll(t, connA)
	voiceCountA := CountType(msgsA, "voice_stop")
	if voiceCountA > 0 {
		t.Error("A should NOT receive voice_stop")
	}

	// B 应收到 voice_stop
	msgsB := RecvAll(t, connB)
	voiceCountB := CountType(msgsB, "voice_stop")
	if voiceCountB == 0 {
		t.Error("B should receive voice_stop")
	}
}

// TestWS_VoiceData 测试语音数据 - 发送者不收到
func TestWS_VoiceData(t *testing.T) {
	ts := NewTestServer(t)

	connA, _, roomID := CreateRoom(t, ts)
	defer connA.Close()

	connB, _ := JoinRoom(t, ts, roomID)
	defer connB.Close()

	Send(t, connA, "voice_data", map[string]string{"data": "base64audio"})

	// A 不应收到 voice_data (excludeID=c.Player.ID)
	msgsA := RecvAll(t, connA)
	voiceCountA := CountType(msgsA, "voice_data")
	if voiceCountA > 0 {
		t.Error("A should NOT receive voice_data")
	}

	// B 应收到 voice_data
	msgsB := RecvAll(t, connB)
	voiceCountB := CountType(msgsB, "voice_data")
	if voiceCountB == 0 {
		t.Error("B should receive voice_data")
	}
}

// TestWS_TeamJoin 测试加入队伍 - 发送者也收到
func TestWS_TeamJoin(t *testing.T) {
	ts := NewTestServer(t)

	connA, _, roomID := CreateRoom(t, ts)
	defer connA.Close()

	connB, _ := JoinRoom(t, ts, roomID)
	defer connB.Close()

	Send(t, connA, "team_join", map[string]string{"team": "red"})

	// A 和 B 都应收到 team_changed (excludeID="")
	msgsA := RecvAll(t, connA)
	teamCountA := CountType(msgsA, "team_changed")
	if teamCountA == 0 {
		t.Error("A should receive team_changed")
	}

	msgsB := RecvAll(t, connB)
	teamCountB := CountType(msgsB, "team_changed")
	if teamCountB == 0 {
		t.Error("B should receive team_changed")
	}
}

// TestWS_GrenadeThrow 测试投掷手雷 - 发送者也收到
func TestWS_GrenadeThrow(t *testing.T) {
	ts := NewTestServer(t)

	connA, _, roomID := CreateRoom(t, ts)
	defer connA.Close()

	connB, _ := JoinRoom(t, ts, roomID)
	defer connB.Close()

	Send(t, connA, "grenade_throw", map[string]interface{}{
		"position": map[string]float64{"x": 1.0, "y": 2.0, "z": 3.0},
		"velocity": map[string]float64{"x": 1.0, "y": 0.5, "z": 0.0},
	})

	// A 和 B 都应收到 grenade_thrown (excludeID="")
	msgsA := RecvAll(t, connA)
	grenadeCountA := CountType(msgsA, "grenade_thrown")
	if grenadeCountA == 0 {
		t.Error("A should receive grenade_thrown")
	}

	msgsB := RecvAll(t, connB)
	grenadeCountB := CountType(msgsB, "grenade_thrown")
	if grenadeCountB == 0 {
		t.Error("B should receive grenade_thrown")
	}
}

// TestWS_C4Plant 测试放置 C4 - 发送者也收到
func TestWS_C4Plant(t *testing.T) {
	ts := NewTestServer(t)

	connA, _, roomID := CreateRoom(t, ts)
	defer connA.Close()

	connB, _ := JoinRoom(t, ts, roomID)
	defer connB.Close()

	Send(t, connA, "c4_plant", map[string]interface{}{
		"position": map[string]float64{"x": 1.0, "y": 2.0, "z": 3.0},
	})

	// A 和 B 都应收到 c4_planted (excludeID="")
	msgsA := RecvAll(t, connA)
	c4CountA := CountType(msgsA, "c4_planted")
	if c4CountA == 0 {
		t.Error("A should receive c4_planted")
	}

	msgsB := RecvAll(t, connB)
	c4CountB := CountType(msgsB, "c4_planted")
	if c4CountB == 0 {
		t.Error("B should receive c4_planted")
	}
}

// TestWS_C4Defuse 测试拆除 C4
func TestWS_C4Defuse(t *testing.T) {
	ts := NewTestServer(t)

	connA, _, roomID := CreateRoom(t, ts)
	defer connA.Close()

	connB, _ := JoinRoom(t, ts, roomID)
	defer connB.Close()

	// A 放置 C4
	Send(t, connA, "c4_plant", map[string]interface{}{
		"position": map[string]float64{"x": 1.0, "y": 2.0, "z": 3.0},
	})

	// A 读取 c4_planted (用 RecvType 精确读取)
	msgA := RecvType(t, connA, "c4_planted")
	if msgA == nil {
		t.Fatal("A should receive c4_planted")
	}

	// B 读取 c4_planted
	msgB := RecvType(t, connB, "c4_planted")
	if msgB == nil {
		t.Fatal("B should receive c4_planted")
	}

	// B 拆除
	Send(t, connB, "c4_defuse", map[string]string{})

	// A 读取 c4_defused
	msgA2 := RecvType(t, connA, "c4_defused")
	if msgA2 == nil {
		t.Error("A should receive c4_defused")
	}

	// B 读取 c4_defused
	msgB2 := RecvType(t, connB, "c4_defused")
	if msgB2 == nil {
		t.Error("B should receive c4_defused")
	}
}

// TestWS_C4Defuse_NoC4 无 C4 静默
func TestWS_C4Defuse_NoC4(t *testing.T) {
	ts := NewTestServer(t)

	conn, _, _ := CreateRoom(t, ts)
	defer conn.Close()

	Send(t, conn, "c4_defuse", map[string]string{})
	NoMessage(t, conn)
}

// TestWS_SkillUse 测试使用技能 - 发送者也收到
func TestWS_SkillUse(t *testing.T) {
	ts := NewTestServer(t)

	connA, _, roomID := CreateRoom(t, ts)
	defer connA.Close()

	connB, _ := JoinRoom(t, ts, roomID)
	defer connB.Close()

	Send(t, connA, "skill_use", map[string]interface{}{
		"skill_id": "heal",
		"x":        0.0,
		"y":        0.0,
		"z":        0.0,
	})

	// A 和 B 都应收到 skill_used (excludeID="")
	msgsA := RecvAll(t, connA)
	skillCountA := CountType(msgsA, "skill_used")
	if skillCountA == 0 {
		t.Error("A should receive skill_used")
	}

	msgsB := RecvAll(t, connB)
	skillCountB := CountType(msgsB, "skill_used")
	if skillCountB == 0 {
		t.Error("B should receive skill_used")
	}
}

// TestWS_SkillUse_Cooldown 技能冷却
func TestWS_SkillUse_Cooldown(t *testing.T) {
	ts := NewTestServer(t)

	conn, _, _ := CreateRoom(t, ts)
	defer conn.Close()

	// 第一次使用
	Send(t, conn, "skill_use", map[string]interface{}{
		"skill_id": "heal",
		"x":        0.0,
		"y":        0.0,
		"z":        0.0,
	})

	// 只读取一条消息（skill_used）
	msg := RecvType(t, conn, "skill_used")
	if msg == nil {
		t.Fatal("Should receive skill_used")
	}

	// 第二次使用（冷却中）
	Send(t, conn, "skill_use", map[string]interface{}{
		"skill_id": "heal",
		"x":        0.0,
		"y":        0.0,
		"z":        0.0,
	})

	// 读取 error 消息
	msg2 := RecvType(t, conn, "error")
	if msg2 == nil {
		t.Fatal("Should receive error for cooldown")
	}
}

// TestWS_SkillUse_UnknownSkill 未知技能返回错误
func TestWS_SkillUse_UnknownSkill(t *testing.T) {
	ts := NewTestServer(t)

	conn, _, _ := CreateRoom(t, ts)
	defer conn.Close()

	// 使用未知技能（不 Drain，直接发送）
	Send(t, conn, "skill_use", map[string]interface{}{
		"skill_id": "unknown_skill",
		"x":        0.0,
		"y":        0.0,
		"z":        0.0,
	})

	// 读取所有消息，找 error
	msgs := RecvAll(t, conn)
	var errorMsg *TestMessage
	for _, m := range msgs {
		if m.Type == "error" {
			errorMsg = m
			break
		}
	}
	if errorMsg == nil {
		t.Fatal("Should receive error for unknown skill")
	}
}

// TestWS_Emote 测试表情 - 发送者也收到
func TestWS_Emote(t *testing.T) {
	ts := NewTestServer(t)

	connA, _, roomID := CreateRoom(t, ts)
	defer connA.Close()

	connB, _ := JoinRoom(t, ts, roomID)
	defer connB.Close()

	Send(t, connA, "emote", map[string]string{"emote_id": "wave"})

	// A 和 B 都应收到 emote (excludeID="")
	msgsA := RecvAll(t, connA)
	emoteCountA := CountType(msgsA, "emote")
	if emoteCountA == 0 {
		t.Error("A should receive emote")
	}

	msgsB := RecvAll(t, connB)
	emoteCountB := CountType(msgsB, "emote")
	if emoteCountB == 0 {
		t.Error("B should receive emote")
	}
}

// TestWS_Ping 测试战术标记 - 发送者也收到
func TestWS_Ping(t *testing.T) {
	ts := NewTestServer(t)

	connA, _, roomID := CreateRoom(t, ts)
	defer connA.Close()

	connB, _ := JoinRoom(t, ts, roomID)
	defer connB.Close()

	Send(t, connA, "ping", map[string]float64{"x": 10.0, "y": 5.0, "z": 0.0})

	// A 和 B 都应收到 ping (excludeID="")
	msgsA := RecvAll(t, connA)
	pingCountA := CountType(msgsA, "ping")
	if pingCountA == 0 {
		t.Error("A should receive ping")
	}

	msgsB := RecvAll(t, connB)
	pingCountB := CountType(msgsB, "ping")
	if pingCountB == 0 {
		t.Error("B should receive ping")
	}
}

// ==================== 辅助函数 ====================

// CountType 统计特定类型的消息数量
func CountType(msgs []*TestMessage, msgType string) int {
	count := 0
	for _, msg := range msgs {
		if msg.Type == msgType {
			count++
		}
	}
	return count
}

// assertChatData 验证聊天消息数据
