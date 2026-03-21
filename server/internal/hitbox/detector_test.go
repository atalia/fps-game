package hitbox

import (
	"testing"
)

func TestRaySphereIntersect_Hit(t *testing.T) {
	// 射线从原点沿 X 轴射向 (5, 0, 0) 的球体
	origin := Position{X: 0, Y: 0, Z: 0}
	direction := Position{X: 1, Y: 0, Z: 0}
	center := Position{X: 5, Y: 0, Z: 0}
	radius := 1.0

	if !RaySphereIntersect(origin, direction, center, radius) {
		t.Error("expected ray to intersect sphere")
	}
}

func TestRaySphereIntersect_Miss(t *testing.T) {
	// 射线从原点沿 X 轴，球体在 Y=5 处
	origin := Position{X: 0, Y: 0, Z: 0}
	direction := Position{X: 1, Y: 0, Z: 0}
	center := Position{X: 5, Y: 5, Z: 0}
	radius := 1.0

	if RaySphereIntersect(origin, direction, center, radius) {
		t.Error("expected ray to miss sphere")
	}
}

func TestRaySphereIntersect_Tangent(t *testing.T) {
	// 射线与球体相切
	origin := Position{X: 0, Y: 1, Z: 0}
	direction := Position{X: 1, Y: 0, Z: 0}
	center := Position{X: 5, Y: 0, Z: 0}
	radius := 1.0

	if !RaySphereIntersect(origin, direction, center, radius) {
		t.Error("expected ray to be tangent to sphere")
	}
}

func TestCalculateDamage_Headshot(t *testing.T) {
	baseDamage := 40
	distance := 10.0
	weaponRange := 50.0

	damage := CalculateDamage(baseDamage, HitBoxHead, distance, weaponRange)

	expected := int(float64(baseDamage) * DamageMultipliers[HitBoxHead])
	if damage != expected {
		t.Errorf("expected %d, got %d", expected, damage)
	}
}

func TestCalculateDamage_Body(t *testing.T) {
	baseDamage := 40
	distance := 10.0
	weaponRange := 50.0

	damage := CalculateDamage(baseDamage, HitBoxBody, distance, weaponRange)

	if damage != baseDamage {
		t.Errorf("expected %d, got %d", baseDamage, damage)
	}
}

func TestCalculateDamage_DistanceFalloff(t *testing.T) {
	baseDamage := 40
	distance := 75.0 // 超出射程
	weaponRange := 50.0

	damage := CalculateDamage(baseDamage, HitBoxBody, distance, weaponRange)

	// 应该有衰减
	if damage >= baseDamage {
		t.Error("expected damage to be reduced due to distance falloff")
	}
}

func TestCalculateDamage_MinimumDamage(t *testing.T) {
	baseDamage := 40
	distance := 200.0 // 远超射程
	weaponRange := 50.0

	damage := CalculateDamage(baseDamage, HitBoxBody, distance, weaponRange)

	// 最小伤害应该是基础伤害的 30%
	minDamage := int(float64(baseDamage) * 0.3)
	if damage < minDamage {
		t.Errorf("expected minimum damage %d, got %d", minDamage, damage)
	}
}

func TestCalculateDamage_Arm(t *testing.T) {
	baseDamage := 50
	distance := 20.0
	weaponRange := 50.0

	damage := CalculateDamage(baseDamage, HitBoxArm, distance, weaponRange)

	expected := int(float64(baseDamage) * DamageMultipliers[HitBoxArm])
	if damage != expected {
		t.Errorf("expected %d, got %d", expected, damage)
	}
}

func TestCalculateDamage_Leg(t *testing.T) {
	baseDamage := 50
	distance := 20.0
	weaponRange := 50.0

	damage := CalculateDamage(baseDamage, HitBoxLeg, distance, weaponRange)

	expected := int(float64(baseDamage) * DamageMultipliers[HitBoxLeg])
	if damage != expected {
		t.Errorf("expected %d, got %d", expected, damage)
	}
}
