package room

import (
	"testing"
	"time"

	"fps-game/internal/ai"
	"fps-game/internal/player"
)

func TestNewRoom(t *testing.T) {
	r := NewRoom(10)

	if r.ID == "" {
		t.Error("Room ID should not be empty")
	}
	if r.MaxSize != 10 {
		t.Errorf("MaxSize = %d, want 10", r.MaxSize)
	}
	if r.GetPlayerCount() != 0 {
		t.Errorf("PlayerCount = %d, want 0", r.GetPlayerCount())
	}
}

func TestRoom_AddPlayer(t *testing.T) {
	r := NewRoom(2)

	p1 := player.NewPlayer()
	if !r.AddPlayer(p1) {
		t.Fatal("Should be able to add first player")
	}
	if r.GetPlayerCount() != 1 {
		t.Errorf("PlayerCount = %d, want 1", r.GetPlayerCount())
	}

	p2 := player.NewPlayer()
	if !r.AddPlayer(p2) {
		t.Fatal("Should be able to add second player")
	}

	// 房间已满
	p3 := player.NewPlayer()
	if r.AddPlayer(p3) {
		t.Fatal("Should not be able to add player to full room")
	}
}

func TestRoom_RemovePlayer(t *testing.T) {
	r := NewRoom(10)
	p := player.NewPlayer()

	r.AddPlayer(p)
	r.RemovePlayer(p.ID)

	if r.GetPlayerCount() != 0 {
		t.Errorf("PlayerCount = %d, want 0", r.GetPlayerCount())
	}
}

func TestRoom_IsFull(t *testing.T) {
	r := NewRoom(2)

	if r.IsFull() {
		t.Error("Empty room should not be full")
	}

	r.AddPlayer(player.NewPlayer())
	if r.IsFull() {
		t.Error("Room with 1 player should not be full")
	}

	r.AddPlayer(player.NewPlayer())
	if !r.IsFull() {
		t.Error("Room with 2 players should be full")
	}
}

func TestRoom_GetPlayer(t *testing.T) {
	r := NewRoom(10)
	p := player.NewPlayer()

	r.AddPlayer(p)

	found := r.GetPlayer(p.ID)
	if found == nil {
		t.Fatal("Should find added player")
	}

	notFound := r.GetPlayer("non-existent")
	if notFound != nil {
		t.Fatal("Should not find non-existent player")
	}
}

func TestRoom_GetPlayerList(t *testing.T) {
	r := NewRoom(10)
	p1 := player.NewPlayer()
	p2 := player.NewPlayer()

	r.AddPlayer(p1)
	r.AddPlayer(p2)

	list := r.GetPlayerList()
	if len(list) != 2 {
		t.Errorf("PlayerList length = %d, want 2", len(list))
	}
}

// ==================== Bot 系统测试 ====================

func TestRoom_AddBot(t *testing.T) {
	r := NewRoom(10)

	bot := r.AddBot(ai.DifficultyNormal, "red")
	if bot == nil {
		t.Fatal("Should be able to add bot")
	}

	// 检查机器人数量
	if r.GetBotCount() != 1 {
		t.Errorf("BotCount = %d, want 1", r.GetBotCount())
	}
}

func TestRoom_RemoveBot(t *testing.T) {
	r := NewRoom(10)

	bot := r.AddBot(ai.DifficultyNormal, "red")
	if bot == nil {
		t.Fatal("Should be able to add bot")
	}

	r.RemoveBot(bot.ID)
	if r.GetBotCount() != 0 {
		t.Errorf("BotCount after remove = %d, want 0", r.GetBotCount())
	}
}

func TestRoom_GetBots(t *testing.T) {
	r := NewRoom(10)

	r.AddBot(ai.DifficultyEasy, "red")
	r.AddBot(ai.DifficultyHard, "blue")

	bots := r.GetBots()
	if len(bots) != 2 {
		t.Errorf("GetBots length = %d, want 2", len(bots))
	}
}

func TestRoom_GetBotCount(t *testing.T) {
	r := NewRoom(10)

	if r.GetBotCount() != 0 {
		t.Errorf("Initial BotCount = %d, want 0", r.GetBotCount())
	}

	r.AddBot(ai.DifficultyNormal, "red")
	r.AddBot(ai.DifficultyNormal, "blue")

	if r.GetBotCount() != 2 {
		t.Errorf("BotCount = %d, want 2", r.GetBotCount())
	}
}

// ==================== C4 系统测试 ====================

func TestRoom_SetC4Planted(t *testing.T) {
	r := NewRoom(10)

	pos := player.Position{X: 100, Y: 0, Z: 200}
	r.SetC4Planted(true, "player1", pos)

	if !r.C4Planted {
		t.Error("C4Planted should be true")
	}
	if r.C4Planter != "player1" {
		t.Errorf("C4Planter = %s, want player1", r.C4Planter)
	}
	if r.C4Position.X != 100 || r.C4Position.Z != 200 {
		t.Errorf("C4Position = %v, want {100, 0, 200}", r.C4Position)
	}
}

func TestRoom_IsC4Planted(t *testing.T) {
	r := NewRoom(10)

	if r.IsC4Planted() {
		t.Error("C4 should not be planted initially")
	}

	r.SetC4Planted(true, "player1", player.Position{})
	if !r.IsC4Planted() {
		t.Error("C4 should be planted")
	}

	r.SetC4Planted(false, "", player.Position{})
	if r.IsC4Planted() {
		t.Error("C4 should not be planted after defuse")
	}
}

func TestRoom_GetC4Position(t *testing.T) {
	r := NewRoom(10)

	pos := player.Position{X: 50, Y: 1, Z: 75}
	r.SetC4Planted(true, "player1", pos)

	gotPos := r.GetC4Position()
	if gotPos.X != 50 || gotPos.Y != 1 || gotPos.Z != 75 {
		t.Errorf("C4Position = %v, want {50, 1, 75}", gotPos)
	}
}

func TestRoom_GetC4Planter(t *testing.T) {
	r := NewRoom(10)

	r.SetC4Planted(true, "test-player", player.Position{})
	if r.GetC4Planter() != "test-player" {
		t.Errorf("C4Planter = %s, want test-player", r.GetC4Planter())
	}
}

func TestRoom_GetC4TimeRemaining(t *testing.T) {
	r := NewRoom(10)

	// 未放置时
	if r.GetC4TimeRemaining() != 0 {
		t.Error("C4TimeRemaining should be 0 when not planted")
	}

	// 放置后
	r.SetC4Planted(true, "player1", player.Position{})
	time.Sleep(100 * time.Millisecond)

	remaining := r.GetC4TimeRemaining()
	if remaining <= 0 || remaining > 40 {
		t.Errorf("C4TimeRemaining = %f, expected between 0 and 40", remaining)
	}
}

// ==================== 游戏模式测试 ====================

func TestRoom_SetGameMode(t *testing.T) {
	r := NewRoom(10)

	r.SetGameMode("deathmatch")
	if r.GameMode != "deathmatch" {
		t.Errorf("GameMode = %s, want deathmatch", r.GameMode)
	}
}

func TestRoom_GetGameMode(t *testing.T) {
	r := NewRoom(10)

	// 默认空
	if r.GetGameMode() != "" {
		t.Errorf("Initial GameMode = %s, want empty", r.GetGameMode())
	}

	r.SetGameMode("team_deathmatch")
	if r.GetGameMode() != "team_deathmatch" {
		t.Errorf("GameMode = %s, want team_deathmatch", r.GetGameMode())
	}
}

// ==================== 房间状态测试 ====================

func TestRoom_IsActive(t *testing.T) {
	r := NewRoom(10)

	if r.IsActive() {
		t.Error("Empty room should not be active")
	}

	r.AddPlayer(player.NewPlayer())
	if !r.IsActive() {
		t.Error("Room with players should be active")
	}
}

func TestRoom_Update(t *testing.T) {
	r := NewRoom(10)
	p := player.NewPlayer()
	r.AddPlayer(p)

	// Update 不应 panic
	r.Update()
}

func TestRoom_Broadcast(t *testing.T) {
	r := NewRoom(10)

	// Broadcast 是占位函数，不应 panic
	r.Broadcast("test", map[string]string{"msg": "hello"}, "")
}

// ==================== 列表查询测试 ====================

func TestRoom_GetPlayers(t *testing.T) {
	r := NewRoom(10)
	p1 := player.NewPlayer()
	p2 := player.NewPlayer()

	r.AddPlayer(p1)
	r.AddPlayer(p2)

	players := r.GetPlayers()
	if len(players) != 2 {
		t.Errorf("GetPlayers length = %d, want 2", len(players))
	}
}

func TestRoom_GetPlayerIDs(t *testing.T) {
	r := NewRoom(10)
	p1 := player.NewPlayer()
	p2 := player.NewPlayer()

	r.AddPlayer(p1)
	r.AddPlayer(p2)

	ids := r.GetPlayerIDs()
	if len(ids) != 2 {
		t.Errorf("GetPlayerIDs length = %d, want 2", len(ids))
	}
}

// Manager 测试

func TestNewManager(t *testing.T) {
	m := NewManager(100, 10)

	if m.maxRooms != 100 {
		t.Errorf("maxRooms = %d, want 100", m.maxRooms)
	}
	if m.defaultSize != 10 {
		t.Errorf("defaultSize = %d, want 10", m.defaultSize)
	}
}

func TestManager_CreateRoom(t *testing.T) {
	m := NewManager(2, 10)

	r1 := m.CreateRoom()
	if r1 == nil {
		t.Fatal("Should create first room")
	}

	r2 := m.CreateRoom()
	if r2 == nil {
		t.Fatal("Should create second room")
	}

	// 达到最大房间数
	r3 := m.CreateRoom()
	if r3 != nil {
		t.Fatal("Should not create room when max reached")
	}
}

func TestManager_GetRoom(t *testing.T) {
	m := NewManager(10, 10)
	r := m.CreateRoom()

	found := m.GetRoom(r.ID)
	if found == nil {
		t.Fatal("Should find created room")
	}

	notFound := m.GetRoom("non-existent")
	if notFound != nil {
		t.Fatal("Should not find non-existent room")
	}
}

func TestManager_RemoveRoom(t *testing.T) {
	m := NewManager(10, 10)
	r := m.CreateRoom()

	m.RemoveRoom(r.ID)

	if m.GetRoom(r.ID) != nil {
		t.Error("Room should be removed")
	}
}

func TestManager_FindAvailableRoom(t *testing.T) {
	m := NewManager(10, 2)

	// 没有房间时
	if m.FindAvailableRoom() != nil {
		t.Fatal("Should not find room when none exist")
	}

	// 创建房间
	r := m.CreateRoom()
	found := m.FindAvailableRoom()
	if found == nil || found.ID != r.ID {
		t.Fatal("Should find available room")
	}

	// 填满房间
	r.AddPlayer(player.NewPlayer())
	r.AddPlayer(player.NewPlayer())

	// 房间满了
	if m.FindAvailableRoom() != nil {
		t.Fatal("Should not find full room")
	}
}

func TestManager_GetRoomCount(t *testing.T) {
	m := NewManager(10, 10)

	if m.GetRoomCount() != 0 {
		t.Errorf("RoomCount = %d, want 0", m.GetRoomCount())
	}

	m.CreateRoom()
	if m.GetRoomCount() != 1 {
		t.Errorf("RoomCount = %d, want 1", m.GetRoomCount())
	}
}

func TestManager_JoinRoom(t *testing.T) {
	m := NewManager(10, 10)
	r := m.CreateRoom()
	p := player.NewPlayer()

	if !m.JoinRoom(p.ID, r.ID) {
		t.Fatal("Should be able to join room")
	}

	// 再次加入（离开旧房间，加入新房间）
	r2 := m.CreateRoom()
	if !m.JoinRoom(p.ID, r2.ID) {
		t.Fatal("Should be able to join another room")
	}

	// 检查是否离开了旧房间
	if m.GetPlayerRoom(p.ID).ID != r2.ID {
		t.Fatal("Should be in new room")
	}
}

func TestManager_LeaveRoom(t *testing.T) {
	m := NewManager(10, 10)
	r := m.CreateRoom()
	p := player.NewPlayer()

	m.JoinRoom(p.ID, r.ID)
	m.LeaveRoom(p.ID)

	if m.GetPlayerRoom(p.ID) != nil {
		t.Error("Player should have left room")
	}
}

// ==================== Manager 列表查询测试 ====================

func TestManager_GetAllRooms(t *testing.T) {
	m := NewManager(10, 10)

	m.CreateRoom()
	m.CreateRoom()
	m.CreateRoom()

	rooms := m.GetAllRooms()
	if len(rooms) != 3 {
		t.Errorf("GetAllRooms length = %d, want 3", len(rooms))
	}
}

func TestManager_ListRooms(t *testing.T) {
	m := NewManager(10, 10)
	r := m.CreateRoom()
	r.AddPlayer(player.NewPlayer())

	list := m.ListRooms()
	if len(list) != 1 {
		t.Fatalf("ListRooms length = %d, want 1", len(list))
	}

	roomInfo := list[0]
	if roomInfo["id"] != r.ID {
		t.Errorf("Room id = %v, want %s", roomInfo["id"], r.ID)
	}
	if roomInfo["player_count"] != 1 {
		t.Errorf("Room player_count = %v, want 1", roomInfo["player_count"])
	}
}

func TestManager_ConcurrentAccess(t *testing.T) {
	m := NewManager(100, 10)
	done := make(chan bool)

	// 并发创建房间
	for i := 0; i < 10; i++ {
		go func() {
			for j := 0; j < 100; j++ {
				r := m.CreateRoom()
				if r != nil {
					p := player.NewPlayer()
					r.AddPlayer(p)
					r.RemovePlayer(p.ID)
				}
			}
			done <- true
		}()
	}

	for i := 0; i < 10; i++ {
		<-done
	}
}
