package game

import (
	"fps-game/internal/room"
	"math"
	"testing"
)

func TestCollision_CheckBoundary(t *testing.T) {
	c := NewCollision(100) // 100x100 地图

	tests := []struct {
		name         string
		x, z         float64
		wantX, wantZ float64
	}{
		{"inside", 10, 20, 10, 20},
		{"outside positive", 60, 60, 50, 50},
		{"outside negative", -60, -60, -50, -50},
		{"edge", 50, 50, 50, 50},
		{"edge negative", -50, -50, -50, -50},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotX, gotZ := c.CheckBoundary(tt.x, tt.z)
			if gotX != tt.wantX || gotZ != tt.wantZ {
				t.Errorf("CheckBoundary(%f, %f) = (%f, %f), want (%f, %f)",
					tt.x, tt.z, gotX, gotZ, tt.wantX, tt.wantZ)
			}
		})
	}
}

func TestCollision_CheckHit(t *testing.T) {
	c := NewCollision(100)

	tests := []struct {
		name        string
		shooterPos  [3]float64
		shooterRot  float64
		targetPos   [3]float64
		maxDistance float64
		want        bool
	}{
		{
			name:        "direct hit",
			shooterPos:  [3]float64{0, 0, 0},
			shooterRot:  0,
			targetPos:   [3]float64{0, 0, 10},
			maxDistance: 100,
			want:        true,
		},
		{
			name:        "miss - too far",
			shooterPos:  [3]float64{0, 0, 0},
			shooterRot:  0,
			targetPos:   [3]float64{0, 0, 150},
			maxDistance: 100,
			want:        false,
		},
		{
			name:        "miss - wrong angle",
			shooterPos:  [3]float64{0, 0, 0},
			shooterRot:  0,
			targetPos:   [3]float64{50, 0, 0},
			maxDistance: 100,
			want:        false,
		},
		{
			name:        "hit - slight angle",
			shooterPos:  [3]float64{0, 0, 0},
			shooterRot:  0,
			targetPos:   [3]float64{1, 0, 10},
			maxDistance: 100,
			want:        true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := c.CheckHit(tt.shooterPos, tt.targetPos, tt.shooterRot, tt.maxDistance)
			if got != tt.want {
				t.Errorf("CheckHit() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestPhysics_ApplyGravity(t *testing.T) {
	p := NewPhysics()

	tests := []struct {
		name         string
		velocity     float64
		dt           float64
		wantVelocity float64
	}{
		{"falling", 0, 0.016, -0.32},
		{"jumping", 8, 0.016, 7.68},
		{"fast fall", -10, 0.016, -10.32},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			velocity := tt.velocity
			p.ApplyGravity(&velocity, tt.dt)
			// 允许浮点误差
			if math.Abs(velocity-tt.wantVelocity) > 0.01 {
				t.Errorf("ApplyGravity() = %f, want %f", velocity, tt.wantVelocity)
			}
		})
	}
}

func TestPhysics_IsOnGround(t *testing.T) {
	p := NewPhysics()

	tests := []struct {
		name string
		y    float64
		want bool
	}{
		{"on ground", 0, true},
		{"above ground", 1, false},
		{"below ground", -1, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := p.IsOnGround(tt.y)
			if got != tt.want {
				t.Errorf("IsOnGround(%f) = %v, want %v", tt.y, got, tt.want)
			}
		})
	}
}

func TestEngine_AddRoom(t *testing.T) {
	engine := NewEngine(60)
	engine.Start()
	defer engine.Stop()

	// 创建房间
	r := &room.Room{}
	r.ID = "test-room"
	engine.AddRoom(r)

	if engine.GetRoom("test-room") == nil {
		t.Error("Room not added")
	}
}

func TestEngine_RemoveRoom(t *testing.T) {
	engine := NewEngine(60)
	engine.Start()
	defer engine.Stop()

	r := &room.Room{}
	r.ID = "test-room"
	engine.AddRoom(r)
	engine.RemoveRoom("test-room")

	if engine.GetRoom("test-room") != nil {
		t.Error("Room not removed")
	}
}

func TestEngine_GetActiveRoomCount(t *testing.T) {
	engine := NewEngine(60)
	engine.Start()
	defer engine.Stop()

	// 初始应该为 0
	if count := engine.GetActiveRoomCount(); count != 0 {
		t.Errorf("Expected 0 active rooms, got %d", count)
	}
}
