package game

import (
	"testing"

	"fps-game/internal/player"
	"fps-game/internal/weapon"
)

func TestNewHitDetector(t *testing.T) {
	hd := NewHitDetector(100)
	if hd == nil {
		t.Error("HitDetector should not be nil")
	}
}

func TestHitDetector_DetectHit(t *testing.T) {
	hd := NewHitDetector(100)

	// 创建射击者和目标
	shooterPos := player.Position{X: 0, Y: 0, Z: 0}
	shooterRot := 0.0 // 朝向正前方

	target := player.NewPlayer()
	target.SetPosition(0, 0, 10) // 正前方 10 米

	targets := map[string]*player.Player{
		target.ID: target,
	}

	// 使用步枪检测
	results := hd.DetectHit(shooterPos, shooterRot, targets, weapon.NewRifle())

	if len(results) == 0 {
		t.Error("Should detect hit on target in front")
	}

	if len(results) > 0 {
		hit := results[0]
		if !hit.Hit {
			t.Error("Hit should be true")
		}
		if hit.TargetID != target.ID {
			t.Errorf("TargetID = %s, want %s", hit.TargetID, target.ID)
		}
		if hit.Damage <= 0 {
			t.Error("Damage should be positive")
		}
	}
}

func TestHitDetector_DetectHit_OutOfRange(t *testing.T) {
	hd := NewHitDetector(100)

	shooterPos := player.Position{X: 0, Y: 0, Z: 0}
	shooterRot := 0.0

	target := player.NewPlayer()
	target.SetPosition(0, 0, 150) // 超出步枪射程

	targets := map[string]*player.Player{
		target.ID: target,
	}

	results := hd.DetectHit(shooterPos, shooterRot, targets, weapon.NewRifle())

	if len(results) > 0 {
		t.Error("Should not detect hit when target is out of range")
	}
}

func TestHitDetector_DetectHit_WrongAngle(t *testing.T) {
	hd := NewHitDetector(100)

	shooterPos := player.Position{X: 0, Y: 0, Z: 0}
	shooterRot := 0.0 // 朝向正前方

	target := player.NewPlayer()
	target.SetPosition(50, 0, 0) // 在侧面

	targets := map[string]*player.Player{
		target.ID: target,
	}

	results := hd.DetectHit(shooterPos, shooterRot, targets, weapon.NewRifle())

	if len(results) > 0 {
		t.Error("Should not detect hit when target is not in front")
	}
}

func TestHitDetector_DetectHit_DeadTarget(t *testing.T) {
	hd := NewHitDetector(100)

	shooterPos := player.Position{X: 0, Y: 0, Z: 0}
	shooterRot := 0.0

	target := player.NewPlayer()
	target.SetPosition(0, 0, 10)
	target.TakeDamage(100) // 击杀目标

	targets := map[string]*player.Player{
		target.ID: target,
	}

	results := hd.DetectHit(shooterPos, shooterRot, targets, weapon.NewRifle())

	if len(results) > 0 {
		t.Error("Should not detect hit on dead target")
	}
}

func TestHitDetector_ApplyDamage(t *testing.T) {
	hd := NewHitDetector(100)

	target := player.NewPlayer()
	remaining := hd.ApplyDamage(target, 30)

	if remaining != 70 {
		t.Errorf("Remaining health = %d, want 70", remaining)
	}
}

func TestHitDetector_calculateDamage(t *testing.T) {
	hd := NewHitDetector(100)
	w := weapon.NewRifle()

	tests := []struct {
		name     string
		distance float64
		minDmg   int
		maxDmg   int
	}{
		{"close range", 10, 25, 30},
		{"mid range", 50, 20, 30},
		{"far range", 80, 10, 25},
		{"max range", 100, 5, 15},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			damage := hd.calculateDamage(w, tt.distance)
			if damage < tt.minDmg || damage > tt.maxDmg {
				t.Errorf("Damage at %fm = %d, want between %d and %d",
					tt.distance, damage, tt.minDmg, tt.maxDmg)
			}
		})
	}
}

func TestHitDetector_ShotgunHit(t *testing.T) {
	hd := NewHitDetector(100)

	shooterPos := player.Position{X: 0, Y: 0, Z: 0}
	shooterRot := 0.0

	target := player.NewPlayer()
	target.SetPosition(0, 0, 5) // 近距离

	targets := map[string]*player.Player{
		target.ID: target,
	}

	// 霰弹枪 8 颗弹丸
	results := hd.ShotgunHit(shooterPos, shooterRot, targets, 8)

	// 近距离应该有命中
	if len(results) == 0 {
		t.Error("Shotgun should hit at close range")
	}
}

func TestHitDetector_MultipleTargets(t *testing.T) {
	hd := NewHitDetector(100)

	shooterPos := player.Position{X: 0, Y: 0, Z: 0}
	shooterRot := 0.0

	target1 := player.NewPlayer()
	target1.SetPosition(0, 0, 10)

	target2 := player.NewPlayer()
	target2.SetPosition(1, 0, 10) // 略微偏移

	targets := map[string]*player.Player{
		target1.ID: target1,
		target2.ID: target2,
	}

	results := hd.DetectHit(shooterPos, shooterRot, targets, weapon.NewRifle())

	// 使用狙击枪（小散布），可能命中一个或两个
	if len(results) > 2 {
		t.Errorf("Too many hits: %d", len(results))
	}
}

func TestHitDetector_Headshot(t *testing.T) {
	hd := NewHitDetector(100)

	shooterPos := player.Position{X: 0, Y: 0, Z: 0}
	shooterRot := 0.0

	target := player.NewPlayer()
	target.SetPosition(0, 2, 10) // 高处目标

	targets := map[string]*player.Player{
		target.ID: target,
	}

	results := hd.DetectHit(shooterPos, shooterRot, targets, weapon.NewRifle())

	if len(results) > 0 && results[0].Headshot {
		// 爆头应该有额外伤害
		if results[0].Damage <= 30 {
			t.Error("Headshot should have bonus damage")
		}
	}
}
