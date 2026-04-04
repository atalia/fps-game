package network

import (
	"encoding/json"
	"math"
	"testing"
	"time"

	"fps-game/internal/player"
	"fps-game/internal/room"
	"fps-game/internal/team"
)

func registerClient(hub *Hub, client *Client) {
	hub.mu.Lock()
	defer hub.mu.Unlock()
	hub.clients[client] = true
	hub.clientMap[client.Player.ID] = client
}

func recvClientMessage(t *testing.T, send <-chan []byte) Message {
	t.Helper()

	select {
	case raw := <-send:
		var msg Message
		if err := json.Unmarshal(raw, &msg); err != nil {
			t.Fatalf("failed to parse client message: %v", err)
		}
		return msg
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for client message")
		return Message{}
	}
}

func assertNoClientMessage(t *testing.T, send <-chan []byte, wait time.Duration) {
	t.Helper()

	select {
	case raw := <-send:
		var msg Message
		if err := json.Unmarshal(raw, &msg); err == nil {
			t.Fatalf("unexpected client message: %s", msg.Type)
		}
		t.Fatal("unexpected raw client message")
	case <-time.After(wait):
	}
}

func waitForRoundPhase(t *testing.T, rm *room.RoundManager, want room.RoundPhase, timeout time.Duration) room.RoundState {
	t.Helper()

	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		state := rm.Snapshot()
		if state.Phase == want {
			return state
		}
		time.Sleep(5 * time.Millisecond)
	}

	t.Fatalf("timed out waiting for round phase %s (last=%s)", want, rm.Snapshot().Phase)
	return room.RoundState{}
}

func TestClient_handleJoinRoom_MovesExistingPlayerWithoutGhosts(t *testing.T) {
	hub := NewHub()
	roomManager := room.NewManager(10, 2)

	oldRoom := roomManager.CreateRoom()
	newRoom := roomManager.CreateRoom()
	blocker := player.NewPlayer()
	if !newRoom.AddPlayer(blocker) {
		t.Fatal("failed to seed destination room")
	}

	client := &Client{
		Player: player.NewPlayer(),
		Send:   make(chan []byte, 10),
		hub:    hub,
	}

	if !oldRoom.AddPlayer(client.Player) {
		t.Fatal("failed to add player to original room")
	}
	if !roomManager.JoinRoom(client.Player.ID, oldRoom.ID) {
		t.Fatal("failed to record original room membership")
	}
	client.Room = oldRoom

	client.handleJoinRoom(mustMarshal(map[string]string{
		"room_id": newRoom.ID,
		"name":    "Mover",
	}), roomManager)

	msg := recvClientMessage(t, client.Send)
	if msg.Type != "room_joined" {
		t.Fatalf("expected room_joined, got %s", msg.Type)
	}

	if client.Room == nil || client.Room.ID != newRoom.ID {
		t.Fatalf("client room = %#v, want %s", client.Room, newRoom.ID)
	}
	if roomManager.GetPlayerRoom(client.Player.ID) != newRoom {
		t.Fatal("playerRooms mapping should point at the destination room")
	}
	if oldRoom.GetPlayer(client.Player.ID) != nil {
		t.Fatal("player should be removed from the old room")
	}
	if newRoom.GetPlayer(client.Player.ID) == nil {
		t.Fatal("player should be present in the destination room")
	}
}

func TestClient_handleMove_UsesAuthoritativePositionState(t *testing.T) {
	hub := NewHub()
	roomManager := room.NewManager(10, 4)
	r := roomManager.CreateRoom()

	client := &Client{
		Player: player.NewPlayer(),
		Send:   make(chan []byte, 10),
		hub:    hub,
		Room:   r,
	}
	observer := &Client{
		Player: player.NewPlayer(),
		Send:   make(chan []byte, 10),
		hub:    hub,
		Room:   r,
	}

	client.Player.SetPosition(1, 7, 2)
	if !r.AddPlayer(client.Player) || !r.AddPlayer(observer.Player) {
		t.Fatal("failed to seed room players")
	}
	registerClient(hub, client)
	registerClient(hub, observer)

	client.handleMove(mustMarshal(map[string]float64{
		"x":        999,
		"y":        999,
		"z":        -999,
		"rotation": 1.25,
	}), roomManager)

	if client.Player.Position.X != 100 || client.Player.Position.Y != 7 || client.Player.Position.Z != -100 {
		t.Fatalf("player position = %+v, want {100 7 -100}", client.Player.Position)
	}

	msg := recvClientMessage(t, observer.Send)
	if msg.Type != "player_moved" {
		t.Fatalf("expected player_moved, got %s", msg.Type)
	}

	var moveData struct {
		Position struct {
			X float64 `json:"x"`
			Y float64 `json:"y"`
			Z float64 `json:"z"`
		} `json:"position"`
		Rotation float64 `json:"rotation"`
	}
	if err := json.Unmarshal(msg.Data, &moveData); err != nil {
		t.Fatalf("failed to parse move data: %v", err)
	}
	if moveData.Position.X != 100 || moveData.Position.Y != 7 || moveData.Position.Z != -100 {
		t.Fatalf("broadcast position = %+v, want {100 7 -100}", moveData.Position)
	}
	if moveData.Rotation != 1.25 {
		t.Fatalf("broadcast rotation = %f, want 1.25", moveData.Rotation)
	}
}

func TestClient_handleShoot_InvalidPayloadDoesNotConsumeAmmoOrCooldown(t *testing.T) {
	tests := []struct {
		name string
		data json.RawMessage
	}{
		{
			name: "malformed json",
			data: json.RawMessage(`{"position":`),
		},
		{
			name: "partial direction",
			data: mustMarshal(map[string]interface{}{
				"direction": map[string]float64{"x": 1},
			}),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			hub := NewHub()
			roomManager := room.NewManager(10, 2)
			r := roomManager.CreateRoom()

			client := &Client{
				Player: player.NewPlayer(),
				Send:   make(chan []byte, 10),
				hub:    hub,
				Room:   r,
			}

			if !r.AddPlayer(client.Player) {
				t.Fatal("failed to seed room")
			}

			ammoBefore := client.Player.Ammo

			client.handleShoot(tt.data, roomManager)

			if client.Player.Ammo != ammoBefore {
				t.Fatalf("ammo = %d, want %d", client.Player.Ammo, ammoBefore)
			}
			if !client.Player.CanShoot() {
				t.Fatal("invalid payload should not start shoot cooldown")
			}
		})
	}
}

func TestClient_handleShoot_UsesAuthoritativeServerState(t *testing.T) {
	hub := NewHub()
	roomManager := room.NewManager(10, 4)
	r := roomManager.CreateRoom()

	shooter := &Client{
		Player: player.NewPlayer(),
		Send:   make(chan []byte, 10),
		hub:    hub,
		Room:   r,
	}
	observer := &Client{
		Player: player.NewPlayer(),
		Send:   make(chan []byte, 10),
		hub:    hub,
		Room:   r,
	}

	shooter.Player.SetPosition(10, 7, 20)
	shooter.Player.SetRotation(1.25)
	shooter.Player.SetWeapon("pistol")
	observer.Player.SetPosition(-50, 0, -50)

	if !r.AddPlayer(shooter.Player) || !r.AddPlayer(observer.Player) {
		t.Fatal("failed to seed room players")
	}
	registerClient(hub, shooter)
	registerClient(hub, observer)

	shooter.handleShoot(mustMarshal(map[string]interface{}{
		"position":  map[string]float64{"x": 999, "y": 888, "z": 777},
		"rotation":  0.25,
		"pitch":     0.5,
		"direction": map[string]float64{"x": 0, "y": 0, "z": -1},
		"weapon_id": "sniper",
	}), roomManager)

	msg := recvClientMessage(t, observer.Send)
	if msg.Type != "player_shot" {
		t.Fatalf("expected player_shot, got %s", msg.Type)
	}

	var shotData struct {
		Position struct {
			X float64 `json:"x"`
			Y float64 `json:"y"`
			Z float64 `json:"z"`
		} `json:"position"`
		Rotation float64 `json:"rotation"`
		WeaponID string  `json:"weapon_id"`
		Ammo     int     `json:"ammo"`
	}
	if err := json.Unmarshal(msg.Data, &shotData); err != nil {
		t.Fatalf("failed to parse shot data: %v", err)
	}

	if shotData.Position.X != 10 || shotData.Position.Y != 7 || shotData.Position.Z != 20 {
		t.Fatalf("shot position = %+v, want {10 7 20}", shotData.Position)
	}
	if shotData.Rotation != 1.25 {
		t.Fatalf("rotation = %f, want 1.25", shotData.Rotation)
	}
	if shotData.WeaponID != "pistol" {
		t.Fatalf("weapon_id = %s, want pistol", shotData.WeaponID)
	}
	if shotData.Ammo != 29 {
		t.Fatalf("ammo = %d, want 29", shotData.Ammo)
	}
}

func TestClient_handleMove_BlocksPositionDuringFreezeTime(t *testing.T) {
	hub := NewHub()
	roomManager := room.NewManager(10, 4)
	r := roomManager.CreateRoom()
	r.RoundManager.Close()
	r.RoundManager = room.NewRoundManager(r, room.RoundConfig{
		FreezeTime:       40 * time.Millisecond,
		RoundTime:        100 * time.Millisecond,
		BuyTime:          50 * time.Millisecond,
		RoundEndDelay:    20 * time.Millisecond,
		RegulationRounds: 30,
		FirstToWin:       16,
		HalftimeAfter:    15,
	})

	client := &Client{
		Player: player.NewPlayer(),
		Send:   make(chan []byte, 10),
		hub:    hub,
		Room:   r,
	}
	observer := &Client{
		Player: player.NewPlayer(),
		Send:   make(chan []byte, 10),
		hub:    hub,
		Room:   r,
	}

	if !r.AddPlayer(client.Player) || !r.AddPlayer(observer.Player) {
		t.Fatal("failed to seed room")
	}
	if _, err := r.JoinTeam(client.Player, team.TeamCounterTerrorists); err != nil {
		t.Fatalf("failed to join ct: %v", err)
	}
	if _, err := r.JoinTeam(observer.Player, team.TeamTerrorists); err != nil {
		t.Fatalf("failed to join t: %v", err)
	}

	registerClient(hub, client)
	registerClient(hub, observer)
	r.RoundManager.MaybeStart()
	waitForRoundPhase(t, r.RoundManager, room.RoundPhaseFreeze, 200*time.Millisecond)

	client.Player.SetPosition(0, 0, 0)
	client.handleMove(mustMarshal(map[string]float64{
		"x":        25,
		"z":        -30,
		"rotation": 1.1,
	}), roomManager)

	if client.Player.Position.X != 0 || client.Player.Position.Z != 0 {
		t.Fatalf("position changed during freeze: %+v", client.Player.Position)
	}
	if client.Player.Rotation != 1.1 {
		t.Fatalf("rotation = %f, want 1.1", client.Player.Rotation)
	}

	msg := recvClientMessage(t, observer.Send)
	if msg.Type != "player_moved" {
		t.Fatalf("expected player_moved, got %s", msg.Type)
	}
}

func TestClient_handleShoot_DoesNotFireDuringFreezeTime(t *testing.T) {
	hub := NewHub()
	roomManager := room.NewManager(10, 4)
	r := roomManager.CreateRoom()
	r.RoundManager.Close()
	r.RoundManager = room.NewRoundManager(r, room.RoundConfig{
		FreezeTime:       40 * time.Millisecond,
		RoundTime:        100 * time.Millisecond,
		BuyTime:          50 * time.Millisecond,
		RoundEndDelay:    20 * time.Millisecond,
		RegulationRounds: 30,
		FirstToWin:       16,
		HalftimeAfter:    15,
	})

	shooter := &Client{
		Player: player.NewPlayer(),
		Send:   make(chan []byte, 10),
		hub:    hub,
		Room:   r,
	}
	observer := &Client{
		Player: player.NewPlayer(),
		Send:   make(chan []byte, 10),
		hub:    hub,
		Room:   r,
	}

	if !r.AddPlayer(shooter.Player) || !r.AddPlayer(observer.Player) {
		t.Fatal("failed to seed room")
	}
	if _, err := r.JoinTeam(shooter.Player, team.TeamCounterTerrorists); err != nil {
		t.Fatalf("failed to join ct: %v", err)
	}
	if _, err := r.JoinTeam(observer.Player, team.TeamTerrorists); err != nil {
		t.Fatalf("failed to join t: %v", err)
	}

	registerClient(hub, shooter)
	registerClient(hub, observer)
	r.RoundManager.MaybeStart()
	waitForRoundPhase(t, r.RoundManager, room.RoundPhaseFreeze, 200*time.Millisecond)

	ammoBefore := shooter.Player.Ammo
	shooter.handleShoot(mustMarshal(map[string]interface{}{
		"pitch": 0.0,
		"direction": map[string]float64{
			"x": 0,
			"y": 0,
			"z": -1,
		},
	}), roomManager)

	if shooter.Player.Ammo != ammoBefore {
		t.Fatalf("ammo changed during freeze: %d -> %d", ammoBefore, shooter.Player.Ammo)
	}
	assertNoClientMessage(t, observer.Send, 50*time.Millisecond)
}

func TestClient_handleRespawn_IgnoresClientSuppliedCoordinates(t *testing.T) {
	hub := NewHub()
	roomManager := room.NewManager(10, 4)
	r := roomManager.CreateRoom()

	client := &Client{
		Player: player.NewPlayer(),
		Send:   make(chan []byte, 10),
		hub:    hub,
		Room:   r,
	}
	observer := &Client{
		Player: player.NewPlayer(),
		Send:   make(chan []byte, 10),
		hub:    hub,
		Room:   r,
	}

	client.Player.Die()
	if !r.AddPlayer(client.Player) || !r.AddPlayer(observer.Player) {
		t.Fatal("failed to seed room players")
	}
	registerClient(hub, client)
	registerClient(hub, observer)

	client.handleRespawn(mustMarshal(map[string]float64{
		"x": 999,
		"y": 999,
		"z": 999,
	}), roomManager)

	if client.Player.Health != client.Player.MaxHealth {
		t.Fatalf("health = %d, want %d", client.Player.Health, client.Player.MaxHealth)
	}
	if client.Player.Position.X == 999 || client.Player.Position.Y == 999 || client.Player.Position.Z == 999 {
		t.Fatalf("respawn position should ignore client coordinates, got %+v", client.Player.Position)
	}
	if math.Abs(client.Player.Position.X) > 50 || client.Player.Position.Y != 0 || math.Abs(client.Player.Position.Z) > 50 {
		t.Fatalf("respawn position = %+v, want server-generated spawn within map bounds", client.Player.Position)
	}

	respawnMsg := recvClientMessage(t, client.Send)
	if respawnMsg.Type != "respawn" {
		t.Fatalf("expected respawn, got %s", respawnMsg.Type)
	}

	playerRespawned := recvClientMessage(t, observer.Send)
	if playerRespawned.Type != "player_respawned" {
		t.Fatalf("expected player_respawned, got %s", playerRespawned.Type)
	}
}

func TestClient_respawnPlayer_UsesVictimRoomAndRespawnHelper(t *testing.T) {
	oldRespawnDelay := respawnDelay
	respawnDelay = 20 * time.Millisecond
	t.Cleanup(func() {
		respawnDelay = oldRespawnDelay
	})

	hub := NewHub()
	roomManager := room.NewManager(10, 4)
	victimRoom := roomManager.CreateRoom()
	otherRoom := roomManager.CreateRoom()

	killer := &Client{
		Player: player.NewPlayer(),
		Send:   make(chan []byte, 10),
		hub:    hub,
		Room:   victimRoom,
	}
	observer := &Client{
		Player: player.NewPlayer(),
		Send:   make(chan []byte, 10),
		hub:    hub,
		Room:   victimRoom,
	}
	intruder := &Client{
		Player: player.NewPlayer(),
		Send:   make(chan []byte, 10),
		hub:    hub,
		Room:   otherRoom,
	}
	victim := player.NewPlayer()
	victim.Die()
	victim.Ammo = 0

	if !victimRoom.AddPlayer(killer.Player) || !victimRoom.AddPlayer(observer.Player) || !victimRoom.AddPlayer(victim) {
		t.Fatal("failed to seed victim room")
	}
	if !otherRoom.AddPlayer(intruder.Player) {
		t.Fatal("failed to seed other room")
	}

	registerClient(hub, killer)
	registerClient(hub, observer)
	registerClient(hub, intruder)

	go killer.respawnPlayer(victim, victimRoom)

	time.Sleep(5 * time.Millisecond)
	killer.Room = otherRoom

	time.Sleep(50 * time.Millisecond)

	respawned := recvClientMessage(t, observer.Send)
	if respawned.Type != "player_respawned" {
		t.Fatalf("expected player_respawned, got %s", respawned.Type)
	}

	assertNoClientMessage(t, intruder.Send, 200*time.Millisecond)

	state := victim.Snapshot()
	if state.Health != state.MaxHealth {
		t.Fatalf("health = %d, want %d", state.Health, state.MaxHealth)
	}
	if state.Ammo != player.DefaultConfig.DefaultAmmo {
		t.Fatalf("ammo = %d, want %d", state.Ammo, player.DefaultConfig.DefaultAmmo)
	}
}
