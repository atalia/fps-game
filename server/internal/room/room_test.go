package room

import (
	"testing"

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
		t.Error("Should be able to add first player")
	}
	if r.GetPlayerCount() != 1 {
		t.Errorf("PlayerCount = %d, want 1", r.GetPlayerCount())
	}

	p2 := player.NewPlayer()
	if !r.AddPlayer(p2) {
		t.Error("Should be able to add second player")
	}

	// 房间已满
	p3 := player.NewPlayer()
	if r.AddPlayer(p3) {
		t.Error("Should not be able to add player to full room")
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
		t.Error("Should find added player")
	}

	notFound := r.GetPlayer("non-existent")
	if notFound != nil {
		t.Error("Should not find non-existent player")
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
		t.Error("Should create first room")
	}

	r2 := m.CreateRoom()
	if r2 == nil {
		t.Error("Should create second room")
	}

	// 达到最大房间数
	r3 := m.CreateRoom()
	if r3 != nil {
		t.Error("Should not create room when max reached")
	}
}

func TestManager_GetRoom(t *testing.T) {
	m := NewManager(10, 10)
	r := m.CreateRoom()

	found := m.GetRoom(r.ID)
	if found == nil {
		t.Error("Should find created room")
	}

	notFound := m.GetRoom("non-existent")
	if notFound != nil {
		t.Error("Should not find non-existent room")
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
		t.Error("Should not find room when none exist")
	}

	// 创建房间
	r := m.CreateRoom()
	found := m.FindAvailableRoom()
	if found == nil || found.ID != r.ID {
		t.Error("Should find available room")
	}

	// 填满房间
	r.AddPlayer(player.NewPlayer())
	r.AddPlayer(player.NewPlayer())

	// 房间满了
	if m.FindAvailableRoom() != nil {
		t.Error("Should not find full room")
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
		t.Error("Should be able to join room")
	}

	// 再次加入（离开旧房间，加入新房间）
	r2 := m.CreateRoom()
	if !m.JoinRoom(p.ID, r2.ID) {
		t.Error("Should be able to join another room")
	}

	// 检查是否离开了旧房间
	if m.GetPlayerRoom(p.ID).ID != r2.ID {
		t.Error("Should be in new room")
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
